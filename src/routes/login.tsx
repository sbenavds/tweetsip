import { createFileRoute } from "@tanstack/react-router"
import { ArrowRight, Mail } from "lucide-react"
import { useActionState } from "react"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

type State = { sent: boolean; email: string; error?: string }

async function sendMagicLink(_: State, formData: FormData): Promise<State> {
  const email = formData.get("email") as string
  const { error } = await authClient.signIn.magicLink({
    email,
    callbackURL: "/feed",
  })
  if (error) return { sent: false, email, error: error.message }
  return { sent: true, email }
}

function LoginPage() {
  const [state, action, pending] = useActionState(sendMagicLink, {
    sent: false,
    email: "",
  })

  if (state.sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="max-w-sm w-full px-6 text-center space-y-3">
          <div className="flex justify-center mb-5">
            <div className="w-12 h-12 rounded-2xl bg-base-100 border border-base-300 flex items-center justify-center">
              <Mail size={20} className="text-base-content/60" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-base-content">Check your inbox</h1>
          <p className="text-base-content/50 text-sm leading-relaxed">
            We sent a magic link to{" "}
            <span className="text-base-content font-medium">{state.email}</span>. Open it to sign
            in.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="max-w-sm w-full px-6">
        <div className="mb-10">
          <p className="text-lg font-bold text-base-content tracking-tight">TweetSip</p>
          <p className="text-base-content/40 text-sm mt-0.5">Sign in to your account</p>
        </div>

        <form action={action} className="space-y-3">
          <div>
            <label
              htmlFor="email"
              className="text-xs font-medium text-base-content/60 mb-1.5 block"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              className="input w-full bg-base-100 border border-base-300"
            />
          </div>

          {state.error && <p className="text-error text-xs">{state.error}</p>}

          <button type="submit" disabled={pending} className="btn btn-neutral w-full gap-2">
            {pending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <>
                Continue <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-base-content/30 mt-8">
          No password needed — we'll email you a link.
        </p>
      </div>
    </div>
  )
}
