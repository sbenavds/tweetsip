import { createServerFn } from "@tanstack/react-start"
import { getDb } from "@/db"
import { enqueue } from "@/lib/queue"
import { authMiddleware } from "@/middleware"
import { findAccountsByUser, insertAccount, removeAccount } from "@/server/accounts"
import { syncAccountPosts } from "@/server/posts"

export const getAccounts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const user = context.user
    if (!user) throw new Error("Unauthorized")
    const db = getDb((context as unknown as { cloudflare: { env: Env } }).cloudflare.env.DB)
    return findAccountsByUser(db, user.id)
  })

export const addAccount = createServerFn({ method: "POST" })
  .inputValidator((data: { handle: string }) => data)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const user = context.user
    if (!user) throw new Error("Unauthorized")
    const env = (context as unknown as { cloudflare: { env: Env } }).cloudflare.env
    const db = getDb(env.DB)
    const account = await insertAccount(db, user.id, data.handle)
    // Fetch posts inline (skips one queue cycle) then enqueue briefing generation
    await syncAccountPosts(db, account.id, env.X_BEARER_TOKEN)
    await enqueue.generateBriefing(env.QUEUE, { accountId: account.id, userId: user.id })
    return account
  })

export const deleteAccount = createServerFn({ method: "POST" })
  .inputValidator((data: { accountId: string }) => data)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const user = context.user
    if (!user) throw new Error("Unauthorized")
    const db = getDb((context as unknown as { cloudflare: { env: Env } }).cloudflare.env.DB)
    return removeAccount(db, user.id, data.accountId)
  })
