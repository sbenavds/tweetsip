import server from "@tanstack/react-start/server-entry";
import { avg, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { posts, trackedAccounts } from "@/db/schema";
import { AccountMonitor } from "@/lib/account-monitor";
import { enqueue, queueMessageSchema } from "@/lib/queue";
import { generateBriefing } from "@/server/briefting";
import { enqueueDailyDigests, sendDigest, sendSilenceAlertNotification, sendStrongSignalNotification } from "@/server/notifications";
import { syncAccountPosts } from "@/server/posts";
import { enqueueAllAccountFetches } from "@/server/scheduler";

export { AccountMonitor };

export default {
  fetch: server.fetch.bind(server),

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const db = getDb(env.DB);
    if (event.cron === "0 8 * * *") {
      ctx.waitUntil(enqueueAllAccountFetches(db, env.QUEUE));
    } else if (event.cron === "0 * * * *") {
      ctx.waitUntil(enqueueDailyDigests(db, env.QUEUE));
    }
  },

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    const db = getDb(env.DB);

    for (const msg of batch.messages) {
      const parsed = queueMessageSchema.safeParse(msg.body);
      if (!parsed.success) {
        msg.ack();
        continue;
      }

      const { type, payload } = parsed.data;

      try {
        if (type === "FETCH_ACCOUNT") {
          await syncAccountPosts(db, payload.accountId, env.X_BEARER_TOKEN);

          const account = await db.query.trackedAccounts.findFirst({
            where: eq(trackedAccounts.id, payload.accountId),
            columns: { userId: true },
          });

          if (!account) { msg.ack(); continue; }

          const [latest, allPosts] = await Promise.all([
            db.query.posts.findFirst({
              where: eq(posts.accountId, payload.accountId),
              orderBy: [desc(posts.postedAt)],
              columns: { postedAt: true, likes: true, reposts: true },
            }),
            db
              .select({ avgEngagement: avg(posts.likes) })
              .from(posts)
              .where(eq(posts.accountId, payload.accountId)),
          ]);

          if (latest?.postedAt) {
            const id = env.ACCOUNT_MONITOR.idFromName(payload.accountId);
            await env.ACCOUNT_MONITOR.get(id).recordPosts(
              account.userId,
              payload.accountId,
              latest.postedAt.getTime(),
            );
          }

          // Enqueue strong signal alert if latest post engagement exceeds 3x account average
          const avgLikes = Number(allPosts[0]?.avgEngagement ?? 0);
          const latestLikes = (latest?.likes ?? 0) + (latest?.reposts ?? 0);
          if (avgLikes > 0 && latestLikes > avgLikes * 3) {
            await enqueue.sendNotification(env.QUEUE, {
              userId: account.userId,
              notificationType: "strong_signal",
              accountId: payload.accountId,
            });
          }

          await enqueue.generateBriefing(env.QUEUE, {
            accountId: payload.accountId,
            userId: account.userId,
          });
        } else if (type === "GENERATE_BRIEFING") {
          await generateBriefing(db, env, payload.accountId, payload.userId);
        } else if (type === "SEND_NOTIFICATION") {
          if (payload.notificationType === "daily_digest") {
            await sendDigest(db, env.RESEND_API_KEY, env.BETTER_AUTH_URL, payload.userId);
          } else if (payload.notificationType === "strong_signal" && payload.accountId) {
            await sendStrongSignalNotification(
              db,
              env.RESEND_API_KEY,
              env.BETTER_AUTH_URL,
              payload.userId,
              payload.accountId,
            );
          } else if (payload.notificationType === "silence_alert" && payload.accountId) {
            await sendSilenceAlertNotification(
              db,
              env.RESEND_API_KEY,
              env.BETTER_AUTH_URL,
              payload.userId,
              payload.accountId,
            );
          }
        }

        msg.ack();
      } catch {
        msg.retry();
      }
    }
  },
};
