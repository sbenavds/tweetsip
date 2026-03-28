import { redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { eq, sql } from "drizzle-orm"
import { getDb } from "@/db"
import { demoUsage } from "@/db/schema"
import { authMiddleware } from "@/middleware"
import { createBriefingContent } from "@/server/briefting"
import { getFeedAccounts } from "@/server/feed"
import { fetchUserByHandle, fetchUserTimeline } from "@/server/x-api"

export const getFeed = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" })

    const env = (context as unknown as { cloudflare: { env: Env } }).cloudflare.env
    const accounts = await getFeedAccounts(getDb(env.DB), context.user.id)

    return accounts
  })

export const getDemoFeed = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const env = (context as unknown as { cloudflare: { env: Env } }).cloudflare.env
  const demoUserId = env.DEMO_USER_ID
  if (!demoUserId) throw new Error("Demo not configured")

  return getFeedAccounts(getDb(env.DB), demoUserId)
})

const DEMO_DAILY_CAP = 10

export const addDemoAccount = createServerFn({ method: "POST" })
  .inputValidator((data: { handle: string }) => data)
  .handler(async ({ data, context }) => {
    const env = (context as unknown as { cloudflare: { env: Env } }).cloudflare.env
    const db = getDb(env.DB)

    // Check global daily cap
    const today = new Date().toISOString().slice(0, 10)
    const usage = await db.query.demoUsage.findFirst({
      where: eq(demoUsage.date, today),
    })
    if (usage && (usage.count ?? 0) >= DEMO_DAILY_CAP) {
      throw new Error("Demo limit reached for today — sign up to track your own accounts")
    }

    // Resolve handle via X API
    const handle = data.handle.trim().replace(/^@/, "")
    const xUser = await fetchUserByHandle(handle, env.X_BEARER_TOKEN)
    if (!xUser) throw new Error("Account not found on X")

    // Fetch timeline
    const timeline = await fetchUserTimeline(xUser.id, env.X_BEARER_TOKEN, 10)
    if (timeline.length === 0) throw new Error("No recent posts found")

    // Generate briefing inline (no DB write)
    const postsData = timeline.map((t) => ({
      text: t.text,
      likes: t.public_metrics.like_count,
      reposts: t.public_metrics.repost_count,
    }))
    const briefing = await createBriefingContent(env, `@${handle}`, postsData)

    // Increment daily counter
    await db
      .insert(demoUsage)
      .values({ date: today, count: 1 })
      .onConflictDoUpdate({
        target: demoUsage.date,
        set: { count: sql`${demoUsage.count} + 1` },
      })

    // Return full account shape to client (matches FeedAccount type)
    return {
      id: `demo-${handle}`,
      handle: `@${handle}`,
      name: xUser.name,
      avatarUrl: xUser.profile_image_url ?? null,
      briefing: {
        moment: briefing.moment,
        topPostSummary: briefing.topPostSummary,
        forYou: briefing.forYou,
        engagementScore: briefing.engagementScore,
        generatedAt: new Date().toISOString(),
        mood: briefing.mood || null,
        sentiment: briefing.sentiment,
        themes: briefing.themes,
        highlights: briefing.highlights,
      },
      posts: timeline.map((t) => ({
        id: t.id,
        text: t.text,
        likes: t.public_metrics.like_count,
        reposts: t.public_metrics.repost_count,
        postedAt: t.created_at,
      })),
    }
  })
