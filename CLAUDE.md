# TweetSip — Codebase Guide

TweetSip is a **X/Twitter digest app** built entirely on the Cloudflare developer platform. Users add accounts to track, and the app fetches their posts on a schedule, generates AI briefings, and delivers smart email notifications.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | TanStack Start (React 19, SSR), TanStack Router, TanStack Query |
| Backend | Cloudflare Workers (D1, R2, Queue, AI, Durable Objects) |
| Auth | Better Auth — magic link only |
| ORM | Drizzle ORM + D1 (SQLite dialect) |
| AI | Groq (Llama 3.3 70B `llama-3.3-70b-versatile`) via **Vercel AI SDK** + **Cloudflare AI Gateway** |
| Email | Resend + React Email |
| State | Zustand (theme store) |
| Styling | Tailwind CSS v4 + DaisyUI |
| Linter | Biome |
| Package manager | pnpm |
| Build / deploy | Vite + `@cloudflare/vite-plugin` + Wrangler |

---

## Project Structure

```
src/
  db/
    schema.ts          # Drizzle schema — all tables
    index.ts           # getDb() factory
  functions/           # TanStack Start server functions (HTTP entry points)
    accounts.ts
    posts.ts
    feed.ts
    settings.ts
    scheduler.ts
    guards.ts
  server/              # Pure business logic (no HTTP concerns)
    accounts.ts
    posts.ts
    briefting.ts       # generateBriefing() — AI briefing generation
    feed.ts
    notifications.ts   # enqueueDailyDigests, sendDigest, sendStrongSignal, sendSilenceAlert
    scheduler.ts       # enqueueAllAccountFetches()
    settings.ts
    x-api.ts           # fetchUserByHandle(), fetchUserTimeline()
  lib/
    auth.ts            # Better Auth server config
    auth-client.ts     # Better Auth browser client
    account-monitor.ts # AccountMonitor Durable Object
    queue.ts           # Queue job types, schemas, enqueue helpers
    email.tsx          # React Email templates + Resend send helpers
    r2-storage.ts      # R2 helpers
    store.ts           # Zustand stores
  routes/              # TanStack Router file-based routes
  middleware.ts
  worker.ts            # Worker entry: fetch + scheduled + queue handlers
```

---

## Database Schema (D1 / SQLite)

| Table | Purpose |
|---|---|
| `user` | App users — stores timezone, notification frequency |
| `session` | Auth sessions |
| `account` | OAuth accounts (Better Auth) |
| `verification` | Magic link verification tokens |
| `magic_link` | Magic link tokens |
| `tracked_accounts` | X accounts a user is monitoring (handle, xUserId, avatarUrl) |
| `posts` | Fetched posts with engagement metrics (likes, reposts, replies) |
| `briefings` | AI-generated briefings per tracked account (moment, topPostSummary, forYou, engagementScore) |
| `notifications` | Record of sent notifications (daily_digest, strong_signal, silence_alert) |

---

## Cloudflare Bindings

| Binding | Type | Name (staging) |
|---|---|---|
| `DB` | D1 | `tweetsip-db-staging` |
| `R2` | R2 Bucket | `tweetsip-data-staging` |
| `QUEUE` | Queue | `tweetsip-jobs-staging` |
| `AI` | Workers AI | — |
| `ACCOUNT_MONITOR` | Durable Object | `AccountMonitor` class |

Secrets (via `.dev.vars` locally, Wrangler secrets in production):
- `X_BEARER_TOKEN` — X API v2 bearer token
- `RESEND_API_KEY` — Resend API key
- `BETTER_AUTH_SECRET` — Better Auth secret
- `GROQ_API_KEY` — Groq API key (for AI briefing generation)
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID (used to build the AI Gateway URL)

---

## Data Flow

### Post Ingestion (cron: `0 8 * * *` daily)

```
scheduled("0 8 * * *")
  └── enqueueAllAccountFetches()
        └── FETCH_ACCOUNT job per tracked account
              └── syncAccountPosts()          # X API v2 → D1 posts table
              └── AccountMonitor.recordPosts() # update Durable Object state
              └── strong signal check         # if latest post > 3x avg engagement
              │     └── SEND_NOTIFICATION(strong_signal)
              └── GENERATE_BRIEFING job
                    └── generateBriefing()    # Groq via AI Gateway → D1 briefings table
```

### Daily Digest (cron: `0 * * * *` hourly)

```
scheduled("0 * * * *")
  └── enqueueDailyDigests()
        └── filters users where local time == 9am
        └── SEND_NOTIFICATION(daily_digest) per user
              └── sendDigest()               # Resend email with all briefings
```

### Silence Alert (Durable Object alarm)

```
AccountMonitor.alarm()  (fires every 6h)
  └── if lastPostAt > 48h ago && !silenceAlertSent
        └── SEND_NOTIFICATION(silence_alert)
              └── sendSilenceAlertNotification()  # Resend email
```

---

## Queue Jobs

Defined in `src/lib/queue.ts`, consumed in `src/worker.ts`:

| Job type | Payload | Action |
|---|---|---|
| `FETCH_ACCOUNT` | `{ accountId, handle }` | Sync posts from X API |
| `GENERATE_BRIEFING` | `{ accountId, userId }` | Run Groq via AI Gateway, insert briefing |
| `SEND_NOTIFICATION` | `{ userId, notificationType, accountId? }` | Send email via Resend |

Queue config: `max_batch_size: 10`, `max_batch_timeout: 30s`. Failed jobs call `msg.retry()`.

---

## AI Briefing

`src/server/briefting.ts` — `generateBriefing(db, env, accountId, userId)`:

- Reads the **10 most recent posts** for the account from D1
- Calls **Groq** (`llama-3.3-70b-versatile`, ~3-5s) via **Vercel AI SDK** `generateObject()`, proxied through **Cloudflare AI Gateway**
- `generateObject()` enforces the Zod schema as structured output — no manual JSON parsing needed
- All schema fields use `.catch()` defaults and `.transform()` truncation so a partial AI response never kills the job
- Inserts into `briefings` table

**AI stack rationale:**
- **Groq** — LPU hardware, 3-5s for 70B models (vs 45-60s on Workers AI)
- **Vercel AI SDK** (`generateObject`) — native structured output with Zod; retries on invalid JSON automatically
- **Cloudflare AI Gateway** — transparent proxy at `gateway.ai.cloudflare.com/v1/{accountId}/tweetsip/groq/openai/v1`; adds request caching, cost analytics, rate-limit protection, and a request log in the CF dashboard — all without changing how the app calls Groq

**Output schema:**
```ts
{
  moment: string          // 2-3 sentence narrative of what the account is doing now (max 280 chars)
  topPostSummary: string  // why the top post landed — hook/mechanic/trigger (max 200 chars)
  forYou: string          // concrete post angle suggestion for the monitor (max 200 chars)
  engagementScore: number // 0–100 (50 = baseline, 75+ = high, 90+ = viral)
  mood: string            // 2-4 word emotional register (max 60 chars)
  sentiment: { positive: number, neutral: number, negative: number } // integers summing to 100
  themes: string[]        // 3–5 topic tags (max 30 chars each)
  highlights: { emoji: string, text: string, tone: "positive"|"notable"|"warning" }[] // 3 items
}
```

---

## Email Notifications

`src/lib/email.tsx` — React Email templates rendered and sent via Resend:

| Template | Trigger |
|---|---|
| `MagicLinkEmail` | Auth sign-in |
| `DailyDigestEmail` | Daily at 9am user local time |
| `StrongSignalEmail` | Post engagement > 3x account average |
| `SilenceAlertEmail` | No posts in 48h |

Duplicate-send guards exist for all notification types (checked against `notifications` table before sending).

---

## AccountMonitor Durable Object

`src/lib/account-monitor.ts` — one instance per tracked account (keyed by `accountId`):

- Persists: `{ userId, accountId, lastPostAt, silenceAlertSent }`
- `recordPosts()`: called after each successful fetch; resets `silenceAlertSent` when new posts appear; sets a 6h alarm
- `alarm()`: fires every 6h; if silence > 48h and alert not yet sent, enqueues `SEND_NOTIFICATION(silence_alert)`

---

## X API

`src/server/x-api.ts` — X API v2, authenticated with Bearer token:

- `fetchUserByHandle(handle, token)` — resolves username to user object
- `fetchUserTimeline(xUserId, token, maxResults)` — fetches recent original tweets (excludes retweets/replies)

Fields fetched: `public_metrics` (likes, reposts, replies), `created_at`.

---

## Development Commands

```bash
pnpm dev          # local dev server (Vite + Workers runtime)
pnpm build        # production build
pnpm deploy       # build + wrangler deploy
pnpm check        # Biome lint + format
pnpm typecheck    # TypeScript type check
pnpm test         # Vitest unit tests
pnpm cf-typegen   # Regenerate worker-configuration.d.ts from wrangler.jsonc
```

Local secrets go in `.dev.vars` (see `.dev.vars.example`).

---

## Conventions

- **Server functions** in `src/functions/` are the HTTP boundary — they call into `src/server/` for business logic.
- **No direct DB access from routes** — always go through server functions.
- **Biome** is the linter/formatter — run `pnpm check` before committing.
- **Path alias**: `@/` maps to `src/` (configured in `tsconfig.json` and `vite.config.ts`).
- The file `src/server/briefting.ts` has a typo in the name — do not rename it without updating all imports.
