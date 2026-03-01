import { createMiddleware } from "@tanstack/react-start";
import { createAuth } from "@/lib/auth";
import type { CloudflareContext } from "@/types/context";

export const authMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next, context }) => {
    const cf = context as unknown as CloudflareContext;
    const auth = createAuth(cf.cloudflare.env.DB);
    const session = await auth.api.getSession({
      headers: cf.request.headers,
    });

    return next({
      context: {
        user: session?.user ?? null,
        session: session?.session ?? null,
      },
    });
  },
);
