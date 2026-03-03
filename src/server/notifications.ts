import { and, eq, gte } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "@/db/schema";
import { notifications, trackedAccounts, user } from "@/db/schema";
import { enqueue } from "@/lib/queue";
import { getResend, sendDailyDigest, sendStrongSignal } from "@/lib/email";
import type { DigestAccount } from "@/lib/email";

type Db = DrizzleD1Database<typeof schema>;

// Returns true if the user's local hour in their timezone is 9am
function isNineAm(timezone: string | null): boolean {
  const tz = timezone ?? "UTC";
  const hour = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: tz,
  }).format(new Date());
  return Number(hour) === 9;
}

// Returns true if we should send today based on frequency (weekly = Monday)
function shouldSendToday(frequency: "daily" | "weekly", timezone: string | null): boolean {
  if (frequency === "daily") return true;
  const tz = timezone ?? "UTC";
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(new Date());
  return day === "Monday";
}

// Start-of-today in UTC (for duplicate-send guard)
function todayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function enqueueDailyDigests(db: Db, queue: Queue): Promise<void> {
  const users = await db.query.user.findMany({
    columns: { id: true, timezone: true, notificationFrequency: true },
    where: (u, { ne }) => ne(u.notificationFrequency, "never"),
  });

  await Promise.all(
    users
      .filter((u) => {
        const freq = (u.notificationFrequency ?? "daily") as "daily" | "weekly";
        return isNineAm(u.timezone) && shouldSendToday(freq, u.timezone);
      })
      .map((u) =>
        enqueue.sendNotification(queue, { userId: u.id, notificationType: "daily_digest" }),
      ),
  );
}

export async function sendDigest(db: Db, resendApiKey: string, appUrl: string, userId: string): Promise<void> {
  // Duplicate guard: skip if already sent today
  const alreadySent = await db.query.notifications.findFirst({
    where: and(
      eq(notifications.userId, userId),
      eq(notifications.type, "daily_digest"),
      gte(notifications.sentAt, todayUTC()),
    ),
  });
  if (alreadySent) return;

  const profile = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { email: true, name: true },
  });
  if (!profile) return;

  const accounts = await db.query.trackedAccounts.findMany({
    where: eq(trackedAccounts.userId, userId),
    with: {
      briefings: {
        orderBy: (b, { desc }) => [desc(b.generatedAt)],
        limit: 1,
      },
    },
  });

  const digest: DigestAccount[] = accounts
    .filter((a) => a.briefings[0]?.moment)
    .map((a) => ({
      handle: a.handle,
      name: a.name,
      moment: a.briefings[0].moment!,
      forYou: a.briefings[0].forYou ?? "",
      engagementScore: a.briefings[0].engagementScore ?? 0,
    }));

  if (digest.length === 0) return;

  await sendDailyDigest(getResend(resendApiKey), profile.email, digest, appUrl);

  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    userId,
    type: "daily_digest",
  });
}

export async function sendStrongSignalNotification(
  db: Db,
  resendApiKey: string,
  appUrl: string,
  userId: string,
  accountId: string,
): Promise<void> {
  // Duplicate guard: max 1 strong_signal per account per day
  const alreadySent = await db.query.notifications.findFirst({
    where: and(
      eq(notifications.userId, userId),
      eq(notifications.accountId, accountId),
      eq(notifications.type, "strong_signal"),
      gte(notifications.sentAt, todayUTC()),
    ),
  });
  if (alreadySent) return;

  const [profile, account] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, userId), columns: { email: true } }),
    db.query.trackedAccounts.findFirst({
      where: eq(trackedAccounts.id, accountId),
      with: { briefings: { orderBy: (b, { desc }) => [desc(b.generatedAt)], limit: 1 } },
    }),
  ]);

  if (!profile || !account?.briefings[0]?.moment) return;

  await sendStrongSignal(
    getResend(resendApiKey),
    profile.email,
    account.handle,
    account.briefings[0].moment,
    appUrl,
  );

  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    userId,
    accountId,
    type: "strong_signal",
  });
}
