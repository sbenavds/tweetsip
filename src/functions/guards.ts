import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getDb } from "@/db";
import { authMiddleware } from "@/middleware";
import { findAccountsByUser } from "@/server/accounts";

// Onboarding: needs auth + no accounts yet
export const guardOnboarding = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
    const env = (context as unknown as { cloudflare: { env: Env } }).cloudflare.env;
    const accounts = await findAccountsByUser(getDb(env.DB), context.user.id);
    if (accounts.length > 0) throw redirect({ to: "/feed" });
    return null;
  });
