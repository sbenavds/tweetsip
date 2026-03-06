import { eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type * as schema from "@/db/schema"
import { trackedAccounts } from "@/db/schema"

type Db = DrizzleD1Database<typeof schema>

type Sentiment = { positive: number; neutral: number; negative: number }

export async function getFeedAccounts(db: Db, userId: string) {
  const accounts = await db.query.trackedAccounts.findMany({
    where: eq(trackedAccounts.userId, userId),
    with: {
      briefings: {
        orderBy: (b, { desc }) => [desc(b.generatedAt)],
        limit: 1,
      },
      posts: {
        orderBy: (p, { desc }) => [desc(p.postedAt)],
        limit: 10,
        columns: { id: true, text: true, likes: true, reposts: true, postedAt: true },
      },
    },
  })

  return accounts.map((a) => {
    const b = a.briefings[0]
    return {
      id: a.id,
      handle: a.handle,
      name: a.name,
      avatarUrl: a.avatarUrl,
      briefing: b
        ? {
            moment: b.moment,
            topPostSummary: b.topPostSummary,
            forYou: b.forYou,
            engagementScore: b.engagementScore ?? 0,
            generatedAt: b.generatedAt.toISOString(),
            mood: b.mood ?? null,
            sentiment: b.sentiment ? (JSON.parse(b.sentiment) as Sentiment) : null,
            themes: b.themes ? (JSON.parse(b.themes) as string[]) : null,
          }
        : null,
      posts: a.posts.map((p) => ({
        id: p.id,
        text: p.text,
        likes: p.likes ?? 0,
        reposts: p.reposts ?? 0,
        postedAt: p.postedAt?.toISOString() ?? null,
      })),
    }
  })
}

export type FeedAccount = Awaited<ReturnType<typeof getFeedAccounts>>[number]
