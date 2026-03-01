import { eq } from "drizzle-orm";
import { z } from "zod";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "@/db/schema";
import { briefings, posts, trackedAccounts } from "@/db/schema";

type Db = DrizzleD1Database<typeof schema>;

const briefingSchema = z.object({
  moment: z.string().max(120),
  topPostSummary: z.string().max(150),
  forYou: z.string().max(150),
  engagementScore: z.number().min(0).max(100),
});

type BriefingContent = z.infer<typeof briefingSchema>;

const SYSTEM_PROMPT = `You are a social media analyst. Analyze the provided posts and return a JSON object with exactly these fields:
- moment: a one-sentence summary of the account's current vibe or theme (max 120 chars)
- topPostSummary: a summary of the most engaging post (max 150 chars)
- forYou: a personalized insight or recommendation based on the content (max 150 chars)
- engagementScore: an overall engagement score from 0 to 100 based on likes and reposts`;

export async function generateBriefing(
  db: Db,
  env: Env,
  accountId: string,
  userId: string,
): Promise<void> {
  const account = await db.query.trackedAccounts.findFirst({
    where: eq(trackedAccounts.id, accountId),
  });

  if (!account) throw new Error("Account not found");

  const recentPosts = await db.query.posts.findMany({
    where: eq(posts.accountId, accountId),
    orderBy: (p, { desc }) => desc(p.postedAt),
    limit: 5,
  });

  if (recentPosts.length === 0) throw new Error("No posts to analyze");

  const postsText = recentPosts
    .map((p) => `- ${p.text} (likes: ${p.likes}, reposts: ${p.reposts})`)
    .join("\n");

  const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Analyze these recent posts from ${account.handle}:\n\n${postsText}` },
    ],
    response_format: { type: "json_object" },
  });

  if (typeof result !== "object" || !("response" in result)) {
    throw new Error("Unexpected response from Workers AI");
  }

  const content: BriefingContent = briefingSchema.parse(JSON.parse(result.response));

  await db.insert(briefings).values({
    id: crypto.randomUUID(),
    accountId,
    userId,
    moment: content.moment,
    topPostSummary: content.topPostSummary,
    forYou: content.forYou,
    engagementScore: content.engagementScore,
  });
}
