import { createFileRoute } from "@tanstack/react-router";
import { useActionState } from "react";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type State = { sent: boolean; email: string; error?: string };

async function sendMagicLink(_: State, formData: FormData): Promise<State> {
  const email = formData.get("email") as string;
  const { error } = await authClient.signIn.magicLink({
    email,
    callbackURL: "/feed",
  });
  if (error) return { sent: false, email, error: error.message };
  return { sent: true, email };
}

function LoginPage() {
  const [state, action, pending] = useActionState(sendMagicLink, {
    sent: false,
    email: "",
  });

  if (state.sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="max-w-sm w-full px-6 text-center">
          <div className="text-4xl mb-6">✉️</div>
          <h1 className="text-2xl font-bold text-base-content mb-3">
            Check your email
          </h1>
          <p className="text-base-content/60 text-sm leading-relaxed">
            We sent a magic link to <strong>{state.email}</strong>. Open it to continue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="max-w-sm w-full px-6">
        <div className="text-center mb-10">
          <div className="text-3xl font-extrabold text-base-content tracking-tight mb-2">
            TweetSip ☕
          </div>
          <p className="text-base-content/50 text-sm">Your daily X digest</p>
        </div>

        <form action={action} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="text-sm font-medium text-base-content/70 mb-2 block"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@email.com"
              required
              className="input input-bordered w-full bg-white border-base-300"
            />
          </div>

          {state.error && <p className="text-error text-sm">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="btn btn-neutral w-full"
          >
            {pending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              "Continue with magic link →"
            )}
          </button>
        </form>

        <p className="text-center text-xs text-base-content/30 mt-8">
          No passwords. Just a link in your inbox.
        </p>
      </div>
    </div>
  );
}
