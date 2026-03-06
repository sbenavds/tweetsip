import { eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type * as schema from "@/db/schema"
import { trackedAccounts, user } from "@/db/schema"

type Db = DrizzleD1Database<typeof schema>
type Frequency = "daily" | "weekly" | "never"

export async function getUserSettings(db: Db, userId: string) {
  const [profile, accounts] = await Promise.all([
    db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { id: true, name: true, email: true, timezone: true, notificationFrequency: true },
    }),
    db.query.trackedAccounts.findMany({
      where: eq(trackedAccounts.userId, userId),
      columns: { id: true, handle: true, name: true, avatarUrl: true },
      orderBy: (t, { asc }) => asc(t.createdAt),
    }),
  ])
  return { profile: profile!, accounts }
}

export async function setProfile(db: Db, userId: string, name: string, timezone: string) {
  await db.update(user).set({ name, timezone }).where(eq(user.id, userId))
}

export async function setNotificationFrequency(db: Db, userId: string, frequency: Frequency) {
  await db.update(user).set({ notificationFrequency: frequency }).where(eq(user.id, userId))
}

export async function deleteUser(db: Db, userId: string) {
  await db.delete(user).where(eq(user.id, userId))
}

export type UserSettings = Awaited<ReturnType<typeof getUserSettings>>
