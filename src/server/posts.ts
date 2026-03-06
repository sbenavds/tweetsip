import { eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type * as schema from "@/db/schema"
import { posts, trackedAccounts } from "@/db/schema"
import { fetchUserByHandle, fetchUserTimeline } from "./x-api"

type Db = DrizzleD1Database<typeof schema>

export async function syncAccountPosts(
  db: Db,
  accountId: string,
  bearerToken: string
): Promise<void> {
  const account = await db.query.trackedAccounts.findFirst({
    where: eq(trackedAccounts.id, accountId),
  })

  if (!account) throw new Error("Account not found")

  // Fetch X user id if we don't have it yet
  if (!account.xUserId) {
    const xUser = await fetchUserByHandle(account.handle, bearerToken)
    if (!xUser) throw new Error(`X user not found: ${account.handle}`)

    await db
      .update(trackedAccounts)
      .set({
        xUserId: xUser.id,
        name: xUser.name,
        avatarUrl: xUser.profile_image_url,
      })
      .where(eq(trackedAccounts.id, accountId))

    account.xUserId = xUser.id
  }

  const xPosts = await fetchUserTimeline(account.xUserId, bearerToken)

  if (xPosts.length === 0) return

  await db
    .insert(posts)
    .values(
      xPosts.map((p) => ({
        id: p.id,
        accountId,
        text: p.text,
        likes: p.public_metrics.like_count,
        reposts: p.public_metrics.repost_count,
        replies: p.public_metrics.reply_count,
        postedAt: new Date(p.created_at),
      }))
    )
    .onConflictDoNothing()
}
