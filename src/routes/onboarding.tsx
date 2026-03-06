import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ArrowRight, Loader2, Plus, X } from "lucide-react"
import { useActionState, useTransition } from "react"
import { create } from "zustand"
import { addAccount } from "@/functions/accounts"
import { guardOnboarding } from "@/functions/guards"

export const Route = createFileRoute("/onboarding")({
  loader: () => guardOnboarding(),
  component: OnboardingPage,
})

// ---- Zustand store ----

type OnboardingStore = {
  handles: string[]
  addHandle: (handle: string) => void
  removeHandle: (handle: string) => void
}

const useOnboarding = create<OnboardingStore>((set) => ({
  handles: [],
  addHandle: (handle) =>
    set((s) => ({
      handles: s.handles.includes(handle) ? s.handles : [...s.handles, handle],
    })),
  removeHandle: (handle) => set((s) => ({ handles: s.handles.filter((h) => h !== handle) })),
}))

// ---- Components ----

function HandleTag({ handle }: { handle: string }) {
  const removeHandle = useOnboarding((s) => s.removeHandle)

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-base-200 last:border-0 animate-[fadeUp_0.3s_ease_both]">
      <span className="text-sm text-base-content">{handle}</span>
      <button
        type="button"
        onClick={() => removeHandle(handle)}
        className="btn btn-ghost btn-circle btn-xs focus:outline-none text-base-content/30 hover:text-error hover:bg-transparent"
        aria-label={`Remove ${handle}`}
      >
        <X size={13} />
      </button>
    </div>
  )
}

function AddHandleForm() {
  const { handles, addHandle } = useOnboarding()

  const [error, action, pending] = useActionState(
    async (_: string | undefined, formData: FormData) => {
      const raw = (formData.get("handle") as string).trim().replace(/^@/, "")
      if (!raw) return "Enter a valid handle"
      if (handles.length >= 5) return "Maximum 5 accounts"
      if (handles.includes(`@${raw}`)) return "Already added"
      addHandle(`@${raw}`)
    },
    undefined
  )

  if (handles.length >= 5) return null

  return (
    <div className="space-y-2">
      <form action={action} className="flex gap-2">
        <label htmlFor="handle" className="sr-only">
          X handle
        </label>
        <input
          id="handle"
          name="handle"
          type="text"
          placeholder="@handle"
          className="input w-full bg-base-100 border border-base-300"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn btn-neutral btn-square"
          aria-label="Add account"
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
        </button>
      </form>
      {error && <p className="text-error text-xs">{error}</p>}
    </div>
  )
}

function StepAccounts() {
  const handles = useOnboarding((s) => s.handles)
  const navigate = useNavigate()
  const [saving, startTransition] = useTransition()

  function handleFinish() {
    if (handles.length === 0) return
    startTransition(async () => {
      for (const handle of handles) {
        await addAccount({ data: { handle } })
      }
      navigate({ to: "/feed" })
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold text-base-content tracking-tight">
          Who do you want to track?
        </h1>
        <p className="text-sm text-base-content/40 leading-relaxed">
          Add up to 5 X accounts. We'll brief you on every one.
        </p>
      </div>

      {handles.length > 0 && (
        <div className="bg-base-100 rounded-box border border-base-200 px-4">
          {handles.map((h) => (
            <HandleTag key={h} handle={h} />
          ))}
        </div>
      )}

      <AddHandleForm />

      <button
        type="button"
        disabled={handles.length === 0 || saving}
        onClick={handleFinish}
        className="btn btn-neutral w-full gap-2"
      >
        {saving ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <>
            Go to my feed <ArrowRight size={15} />
          </>
        )}
      </button>

      <p className="text-center text-xs text-base-content/30">{handles.length}/5 accounts</p>
    </div>
  )
}

// ---- Page ----

function OnboardingPage() {
  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
        <div className="w-full max-w-sm animate-[fadeUp_0.4s_ease_both]">
          <div className="mb-10">
            <p className="text-lg font-bold text-base-content tracking-tight">TweetSip</p>
            <p className="text-base-content/40 text-sm mt-0.5">Let's set up your feed</p>
          </div>
          <StepAccounts />
        </div>
      </div>
    </>
  )
}
