import { createServerFn } from "@tanstack/react-start";
import { getDb } from "@/db";
import { authMiddleware } from "@/middleware";
import { enqueueAllAccountFetches } from "@/server/scheduler";

export const triggerFetch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const user = context.user;
    if (!user) throw new Error("Unauthorized");

    const env = (context as unknown as { cloudflare: { env: Env } }).cloudflare
      .env;
    const db = getDb(env.DB);

    return enqueueAllAccountFetches(db, env.QUEUE);
  });
