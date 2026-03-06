import { eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { z } from "zod"
import type * as schema from "@/db/schema"
import { briefings, posts, trackedAccounts } from "@/db/schema"

type Db = DrizzleD1Database<typeof schema>

// .catch() means "use this default instead of throwing" — the AI output is valid-ish
// but often violates strict length/count constraints, which was silently killing jobs.
// .transform() truncates strings at the DB column limits without rejecting the briefing.
const highlightSchema = z.object({
  emoji: z.string().catch("📌"),
  text: z
    .string()
    .transform((s) => s.slice(0, 150))
    .catch(""),
  tone: z.enum(["positive", "notable", "warning"]).catch("notable"),
})

const briefingSchema = z.object({
  moment: z.string().transform((s) => s.slice(0, 280)),
  topPostSummary: z.string().transform((s) => s.slice(0, 200)),
  forYou: z.string().transform((s) => s.slice(0, 200)),
  engagementScore: z.coerce.number().catch(50),
  mood: z
    .string()
    .transform((s) => s.slice(0, 60))
    .catch(""),
  sentiment: z
    .object({
      positive: z.coerce.number(),
      neutral: z.coerce.number(),
      negative: z.coerce.number(),
    })
    .catch({ positive: 33, neutral: 34, negative: 33 }),
  themes: z.array(z.string().transform((s) => s.slice(0, 30))).catch([]),
  highlights: z.array(highlightSchema).max(5).catch([]),
})

type BriefingContent = z.infer<typeof briefingSchema>

const SYSTEM_PROMPT = `You are an intelligence analyst briefing a professional who tracks this X account for strategic or competitive reasons.

Analyze the posts and return a JSON object with exactly these fields:

- moment: A 2–3 sentence narrative of what this account is actively doing RIGHT NOW. Name the specific angle, campaign, or push. What story are they telling? What pattern emerges across these posts? Max 280 chars.
- topPostSummary: Why did the top-performing post actually land? Identify the specific hook, mechanic, or emotional trigger — not what it said, but why it worked. Max 200 chars.
- forYou: A concrete tweet angle or post suggestion for the person monitoring this account. What should they post RIGHT NOW to ride this wave, counter this narrative, or insert themselves into this conversation? Give the hook or framing — not generic advice. Max 200 chars.
- engagementScore: 0–100. Baseline 50 = normal. 75+ = notably high. 90+ = exceptional/viral. Under 30 = low traction or silence.
- mood: 2–4 words capturing the emotional register of recent posts (e.g., "Triumphant + Promotional", "Defensive + Aggressive", "Quiet + Strategic"). Max 60 chars.
- sentiment: Object with "positive", "neutral", "negative" as integers that sum to exactly 100. Based on tone and intent of the posts.
- themes: Array of 3–5 short topic tags (max 30 chars each) representing the dominant subjects in these posts.
- highlights: Array of exactly 3 standout observations from the posts. Each object has:
  - "emoji": 1 relevant emoji capturing the nature of the observation
  - "text": A specific, concrete observation (max 150 chars). Name the thing — what happened, what changed, what was said. Not vague.
  - "tone": "positive" (win/achievement/good news), "notable" (surprising/unexpected/shift), or "warning" (risk/concern/criticism)

Strict rules:
- Do NOT restate tweet text verbatim or paraphrase individual posts
- Do NOT write generic descriptions ("sharing content", "promoting product", "engaging followers")
- Do NOT give obvious advice ("consider monitoring", "check their profile")
- mood must be specific to THIS account's current emotional register, not a generic label
- themes should be specific topics, not generic categories like "Politics" or "Business"
- highlights must be 3 distinct observations — no repeating the same theme in different words`

export async function generateBriefing(
  db: Db,
  env: Env,
  accountId: string,
  userId: string
): Promise<void> {
  const account = await db.query.trackedAccounts.findFirst({
    where: eq(trackedAccounts.id, accountId),
  })

  if (!account) throw new Error("Account not found")

  const recentPosts = await db.query.posts.findMany({
    where: eq(posts.accountId, accountId),
    orderBy: (p, { desc }) => desc(p.postedAt),
    limit: 10,
  })

  if (recentPosts.length === 0) throw new Error("No posts to analyze")

  const postsText = recentPosts
    .map((p, i) => `${i + 1}. "${p.text}" (likes: ${p.likes}, reposts: ${p.reposts})`)
    .join("\n")

  const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Analyze these ${recentPosts.length} recent posts from ${account.handle}:\n\n${postsText}\n\nReturn only valid JSON.`,
      },
    ],
    response_format: { type: "json_object" },
  })

  if (typeof result !== "object" || !("response" in result)) {
    throw new Error("Unexpected response from Workers AI")
  }

  const raw = result.response
  const jsonStart = raw.indexOf("{")
  const jsonEnd = raw.lastIndexOf("}")
  if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON object found in AI response")
  const content: BriefingContent = briefingSchema.parse(
    JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
  )

  await db.insert(briefings).values({
    id: crypto.randomUUID(),
    accountId,
    userId,
    moment: content.moment,
    topPostSummary: content.topPostSummary,
    forYou: content.forYou,
    engagementScore: content.engagementScore,
    mood: content.mood,
    sentiment: JSON.stringify(content.sentiment),
    themes: JSON.stringify(content.themes),
    highlights: JSON.stringify(content.highlights),
  })
}
