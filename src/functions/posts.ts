import { createServerFn } from "@tanstack/react-start";
import { getDb } from "@/db";
import { authMiddleware } from "@/middleware";
import { syncAccountPosts } from "@/server/posts";

export const syncPosts = createServerFn({ method: "POST" })
  .inputValidator((data: { accountId: string }) => data)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const user = context.user;
    if (!user) throw new Error("Unauthorized");

    const env = (context as unknown as { cloudflare: { env: Env } }).cloudflare
      .env;
    const db = getDb(env.DB);

    await syncAccountPosts(db, data.accountId, env.X_BEARER_TOKEN);

    return { success: true };
  });
