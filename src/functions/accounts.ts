import { createServerFn } from "@tanstack/react-start";
import { getDb } from "@/db";
import { authMiddleware } from "@/middleware";
import {
  findAccountsByUser,
  insertAccount,
  removeAccount,
} from "@/server/accounts";

export const getAccounts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const user = context.user;
    if (!user) throw new Error("Unauthorized");
    const db = getDb(
      (context as unknown as { cloudflare: { env: Env } }).cloudflare.env.DB,
    );
    return findAccountsByUser(db, user.id);
  });

export const addAccount = createServerFn({ method: "POST" })
  .inputValidator((data: { handle: string }) => data)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const user = context.user;
    if (!user) throw new Error("Unauthorized");
    const db = getDb(
      (context as unknown as { cloudflare: { env: Env } }).cloudflare.env.DB,
    );
    return insertAccount(db, user.id, data.handle);
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .inputValidator((data: { accountId: string }) => data)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const user = context.user;
    if (!user) throw new Error("Unauthorized");
    const db = getDb(
      (context as unknown as { cloudflare: { env: Env } }).cloudflare.env.DB,
    );
    return removeAccount(db, user.id, data.accountId);
  });
