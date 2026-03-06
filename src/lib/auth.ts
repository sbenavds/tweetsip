import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { magicLink } from "better-auth/plugins"
import { drizzle } from "drizzle-orm/d1"
import * as schema from "@/db/schema"
import { getResend, sendMagicLink } from "@/lib/email"

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
            try {
              await sendMagicLink(getResend(resendApiKey), email, url)
            } catch (e) {
              console.error("[magic-link] Resend error:", JSON.stringify(e))
              throw e
            }
          } else {
            // Dev fallback: log to console
            console.log(`[magic-link] ${email} → ${url}`)
          }
        },
      }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
