import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "@/db/schema";
import { trackedAccounts } from "@/db/schema";
import { enqueue } from "@/lib/queue";

type Db = DrizzleD1Database<typeof schema>;

export async function enqueueAllAccountFetches(
  db: Db,
  queue: Queue,
): Promise<{ enqueued: number }> {
  const accounts = await db.query.trackedAccounts.findMany({
    columns: { id: true, handle: true },
  });

  if (accounts.length === 0) return { enqueued: 0 };

  await Promise.all(
    accounts.map((a) =>
      enqueue.fetchAccount(queue, { accountId: a.id, handle: a.handle }),
    ),
  );

  return { enqueued: accounts.length };
}
