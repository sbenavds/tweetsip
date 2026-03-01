import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getDb } from "@/db";
import { authMiddleware } from "@/middleware";
import { getFeedAccounts } from "@/server/feed";

export const getFeed = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });

    const env = (context as unknown as { cloudflare: { env: Env } }).cloudflare.env;
    const accounts = await getFeedAccounts(getDb(env.DB), context.user.id);

    if (accounts.length === 0) throw redirect({ to: "/onboarding" });

    return accounts;
  });
