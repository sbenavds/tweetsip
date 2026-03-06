import { eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { z } from "zod"
import type * as schema from "@/db/schema"
import { briefings, posts, trackedAccounts } from "@/db/schema"

type Db = DrizzleD1Database<typeof schema>

const briefingSchema = z.object({
  moment: z.string().max(120),
  topPostSummary: z.string().max(150),
  forYou: z.string().max(150),
  engagementScore: z.number().min(0).max(100),
})

type BriefingContent = z.infer<typeof briefingSchema>

const SYSTEM_PROMPT = `You are an intelligence analyst briefing a professional who tracks this X account for strategic or competitive reasons.

Analyze the posts and return a JSON object with exactly these fields:

- moment: What specific narrative or push is this account running RIGHT NOW? Name the angle and intent concretely — not their general topic, but what they are actively doing this week. Max 120 chars.
- topPostSummary: Why did the top post actually perform? Identify the hook, mechanic, or angle that drove engagement — not what the post said, but why it landed. Max 150 chars.
- forYou: One sharp, actionable signal. What should the person tracking this account know or do right now — a window to act, a trend to watch, a risk to note? Make it specific. Max 150 chars.
- engagementScore: 0–100. Use 50 as the baseline for normal engagement on this account. Score 80+ only for genuinely viral or exceptional posts. Under 30 for low traction or silence.

Strict rules:
- Do NOT restate tweet text or paraphrase what the post said
- Do NOT write generic descriptions like "sharing content", "promoting their product", or "engaging with followers"
- Do NOT give obvious advice like "consider engaging with their posts"
- Every sentence must contain a specific, non-obvious observation`

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
    limit: 5,
  })

  if (recentPosts.length === 0) throw new Error("No posts to analyze")

  const postsText = recentPosts
    .map((p) => `- ${p.text} (likes: ${p.likes}, reposts: ${p.reposts})`)
    .join("\n")

  const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Analyze these recent posts from ${account.handle}:\n\n${postsText}`,
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
  })
}
