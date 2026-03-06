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
| AI | Workers AI — Llama 3.3 70B (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) |
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
                    └── generateBriefing()    # Workers AI → D1 briefings table
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
| `GENERATE_BRIEFING` | `{ accountId, userId }` | Run Workers AI, insert briefing |
| `SEND_NOTIFICATION` | `{ userId, notificationType, accountId? }` | Send email via Resend |

Queue config: `max_batch_size: 10`, `max_batch_timeout: 30s`. Failed jobs call `msg.retry()`.

---

## AI Briefing

`src/server/briefting.ts` — `generateBriefing(db, env, accountId, userId)`:

- Reads the **5 most recent posts** for the account from D1
- Calls **Workers AI** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) with structured JSON output
- Validates response with Zod against the briefing schema
- Inserts into `briefings` table

**Output schema:**
```ts
{
  moment: string          // one-sentence vibe summary (max 120 chars)
  topPostSummary: string  // most engaging post summary (max 150 chars)
  forYou: string          // personalized insight (max 150 chars)
  engagementScore: number // 0–100
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
