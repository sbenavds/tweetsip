import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_APP_URL ?? "http://localhost:3000",
  plugins: [magicLinkClient()],
});

export const { signIn, signOut, useSession } = authClient;
