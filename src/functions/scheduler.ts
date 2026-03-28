import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { user as userTable } from "@/db/schema"
import { authMiddleware } from "@/middleware"
import { enqueueAllAccountFetches } from "@/server/scheduler"

const FETCH_COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

export const triggerFetch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const user = context.user
    if (!user) throw new Error("Unauthorized")

    const env = (context as unknown as { cloudflare: { env: Env } }).cloudflare.env
    const db = getDb(env.DB)

    const row = await db.query.user.findFirst({
      where: eq(userTable.id, user.id),
      columns: { lastFetchAt: true },
    })

    if (row?.lastFetchAt && Date.now() - row.lastFetchAt.getTime() < FETCH_COOLDOWN_MS) {
      const minutesLeft = Math.ceil(
        (FETCH_COOLDOWN_MS - (Date.now() - row.lastFetchAt.getTime())) / 60_000
      )
      throw new Error(
        `Please wait ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"} before fetching again`
      )
    }

    const result = await enqueueAllAccountFetches(db, env.QUEUE, user.id)

    await db.update(userTable).set({ lastFetchAt: new Date() }).where(eq(userTable.id, user.id))

    return result
  })
