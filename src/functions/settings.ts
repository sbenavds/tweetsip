import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getDb } from "@/db";
import { authMiddleware } from "@/middleware";
import {
  deleteUser,
  getUserSettings,
  setNotificationFrequency,
  setProfile,
} from "@/server/settings";

type CF = { cloudflare: { env: Env } };

export const getSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
    const env = (context as unknown as CF).cloudflare.env;
    return getUserSettings(getDb(env.DB), context.user.id);
  });

export const updateProfile = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; timezone: string }) => d)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    if (!context.user) throw redirect({ to: "/login" });
    const env = (context as unknown as CF).cloudflare.env;
    await setProfile(getDb(env.DB), context.user.id, data.name, data.timezone);
  });

export const updateNotifications = createServerFn({ method: "POST" })
  .inputValidator((d: { frequency: "daily" | "weekly" | "never" }) => d)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    if (!context.user) throw redirect({ to: "/login" });
    const env = (context as unknown as CF).cloudflare.env;
    await setNotificationFrequency(getDb(env.DB), context.user.id, data.frequency);
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
    const env = (context as unknown as CF).cloudflare.env;
    await deleteUser(getDb(env.DB), context.user.id);
    throw redirect({ to: "/login" });
  });
