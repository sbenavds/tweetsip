import server from "@tanstack/react-start/server-entry";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { posts, trackedAccounts } from "@/db/schema";
import { AccountMonitor } from "@/lib/account-monitor";
import { enqueue, queueMessageSchema } from "@/lib/queue";
import { generateBriefing } from "@/server/briefting";
import { syncAccountPosts } from "@/server/posts";
import { enqueueAllAccountFetches } from "@/server/scheduler";

export { AccountMonitor };

export default {
  fetch: server.fetch.bind(server),

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const db = getDb(env.DB);
    ctx.waitUntil(enqueueAllAccountFetches(db, env.QUEUE));
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

          const latest = await db.query.posts.findFirst({
            where: eq(posts.accountId, payload.accountId),
            orderBy: [desc(posts.postedAt)],
            columns: { postedAt: true },
          });

          if (latest?.postedAt) {
            const id = env.ACCOUNT_MONITOR.idFromName(payload.accountId);
            await env.ACCOUNT_MONITOR.get(id).recordPosts(latest.postedAt.getTime());
          }

          await enqueue.generateBriefing(env.QUEUE, {
            accountId: payload.accountId,
            userId: account.userId,
          });
        } else if (type === "GENERATE_BRIEFING") {
          await generateBriefing(db, env, payload.accountId, payload.userId);
        }

        msg.ack();
      } catch {
        msg.retry();
      }
    }
  },
};
