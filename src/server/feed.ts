import { eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type * as schema from "@/db/schema"
import { trackedAccounts } from "@/db/schema"

type Db = DrizzleD1Database<typeof schema>

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
        limit: 5,
        columns: { id: true, text: true, likes: true },
      },
    },
  })

  return accounts.map((a) => ({
    id: a.id,
    handle: a.handle,
    name: a.name,
    avatarUrl: a.avatarUrl,
    briefing: a.briefings[0]
      ? {
          moment: a.briefings[0].moment,
          topPostSummary: a.briefings[0].topPostSummary,
          forYou: a.briefings[0].forYou,
          engagementScore: a.briefings[0].engagementScore ?? 0,
          generatedAt: a.briefings[0].generatedAt.toISOString(),
        }
      : null,
    posts: a.posts.map((p) => ({ id: p.id, text: p.text, likes: p.likes ?? 0 })),
  }))
}

export type FeedAccount = Awaited<ReturnType<typeof getFeedAccounts>>[number]
