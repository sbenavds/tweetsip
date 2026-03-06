import { and, eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type * as schema from "@/db/schema"
import { trackedAccounts } from "@/db/schema"

type Db = DrizzleD1Database<typeof schema>

export async function findAccountsByUser(db: Db, userId: string) {
  return db.query.trackedAccounts.findMany({
    where: eq(trackedAccounts.userId, userId),
    orderBy: (t, { asc }) => asc(t.createdAt),
  })
}

export async function insertAccount(db: Db, userId: string, handle: string) {
  const existing = await findAccountsByUser(db, userId)
  if (existing.length >= 5) throw new Error("Maximum 5 accounts")

  const clean = handle.trim().replace(/^@/, "")
  const duplicate = existing.find((a) => a.handle === `@${clean}`)
  if (duplicate) throw new Error("Already tracking this account")

  const [account] = await db
    .insert(trackedAccounts)
    .values({
      id: crypto.randomUUID(),
      userId,
      handle: `@${clean}`,
      name: clean,
    })
    .returning()

  return account
}

export async function removeAccount(db: Db, userId: string, accountId: string) {
  await db
    .delete(trackedAccounts)
    .where(and(eq(trackedAccounts.id, accountId), eq(trackedAccounts.userId, userId)))
  return { success: true }
}
