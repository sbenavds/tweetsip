import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { getResend, sendMagicLink } from "@/lib/email";

export function createAuth(d1: D1Database, resendApiKey?: string) {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    database: drizzleAdapter(drizzle(d1, { schema }), {
      provider: "sqlite",
    }),
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          if (resendApiKey) {
            await sendMagicLink(getResend(resendApiKey), email, url);
          } else {
            // Dev fallback: log to console
            console.log(`[magic-link] ${email} → ${url}`);
          }
        },
      }),
      tanstackStartCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
