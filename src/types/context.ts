export type CloudflareContext = {
  cloudflare: {
    env: Env
    ctx: ExecutionContext
  }
  request: Request
}

export type AuthContext = CloudflareContext & {
  user: {
    id: string
    email: string
    name: string
  } | null
  session: {
    id: string
    expiresAt: Date
  } | null
}
