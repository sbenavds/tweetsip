import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router"
import { ArrowLeft, Loader2, Plus, X } from "lucide-react"
import { useActionState, useOptimistic, useState, useTransition } from "react"
import { addAccount, deleteAccount as deleteTrackedAccount } from "@/functions/accounts"
import {
  deleteAccount,
  getSettings,
  updateNotifications,
  updateProfile,
} from "@/functions/settings"
import { signOut } from "@/lib/auth-client"
import type { UserSettings } from "@/server/settings"

export const Route = createFileRoute("/settings")({
  loader: async () => {
    try {
      return await getSettings()
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e
      throw redirect({ to: "/login" })
    }
  },
  component: SettingsPage,
})

// ---- Timezone list ----

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
]

// ---- Sections ----

type SaveState = { ok?: boolean; error?: string } | null

function ProfileSection({ profile }: { profile: UserSettings["profile"] }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(async (_, formData) => {
    try {
      await updateProfile({
        data: {
          name: formData.get("name") as string,
          timezone: formData.get("timezone") as string,
        },
      })
      return { ok: true }
    } catch {
      return { error: "Failed to save changes" }
    }
  }, null)

  return (
    <section className="bg-base-100 rounded-box border border-base-200 p-5 space-y-4">
      <h2 className="font-bold text-base-content">Profile</h2>
      <form action={action} className="space-y-3">
        <div>
          <label className="text-xs font-medium text-base-content/60 mb-1 block" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={profile.name}
            required
            className="input input-bordered w-full"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-base-content/60 mb-1 block" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={profile.email}
            disabled
            className="input input-bordered w-full opacity-50"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-base-content/60 mb-1 block" htmlFor="timezone">
            Timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue={profile.timezone ?? "America/New_York"}
            className="select select-bordered w-full"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        {state?.error && <p className="text-error text-xs">{state.error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="btn btn-neutral btn-sm">
            {pending ? <Loader2 size={13} className="animate-spin" /> : "Save"}
          </button>
          {state?.ok && <span className="text-success text-xs">Saved</span>}
        </div>
      </form>
    </section>
  )
}

function AccountsSection({ accounts }: { accounts: UserSettings["accounts"] }) {
  const router = useRouter()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const [optimisticAccounts, addOptimistic] = useOptimistic(accounts, (state, handle: string) => [
    ...state,
    { id: `optimistic-${handle}`, handle: `@${handle}`, name: handle, avatarUrl: null },
  ])

  const [addState, addAction, addPending] = useActionState(
    async (_: string | undefined, formData: FormData) => {
      const raw = (formData.get("handle") as string).trim().replace(/^@/, "")
      if (!raw) return "Enter a valid handle"
      if (accounts.length >= 5) return "Maximum 5 accounts"
      try {
        addOptimistic(raw)
        await addAccount({ data: { handle: raw } })
        router.invalidate()
      } catch (e) {
        return e instanceof Error ? e.message : "Failed to add account"
      }
    },
    undefined
  )

  function handleDelete(accountId: string) {
    setDeleteError(null)
    startDelete(async () => {
      try {
        await deleteTrackedAccount({ data: { accountId } })
        router.invalidate()
      } catch {
        setDeleteError("Failed to remove account")
      }
    })
  }

  return (
    <section className="bg-base-100 rounded-box border border-base-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-base-content">Accounts</h2>
        <span className="text-xs text-base-content/40">{optimisticAccounts.length}/5</span>
      </div>

      {optimisticAccounts.length > 0 && (
        <ul className="space-y-2">
          {optimisticAccounts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between py-2 border-b border-base-200 last:border-0"
            >
              <div>
                <p
                  className={`text-sm font-medium text-base-content ${a.id.startsWith("optimistic-") ? "opacity-50" : ""}`}
                >
                  {a.name ?? a.handle}
                </p>
                <p className="text-xs text-base-content/40">{a.handle}</p>
              </div>
              {!a.id.startsWith("optimistic-") && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => handleDelete(a.id)}
                  className="btn btn-ghost btn-circle btn-xs text-base-content/30 hover:text-error hover:bg-transparent"
                  aria-label={`Remove ${a.handle}`}
                >
                  <X size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {deleteError && <p className="text-error text-xs">{deleteError}</p>}

      {accounts.length < 5 && (
        <form action={addAction} className="flex gap-2">
          <input
            name="handle"
            type="text"
            placeholder="@handle"
            className="input input-bordered input-sm flex-1"
          />
          <button
            type="submit"
            disabled={addPending}
            className="btn btn-neutral btn-square btn-sm"
            aria-label="Add account"
          >
            {addPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          </button>
        </form>
      )}
      {addState && <p className="text-error text-xs">{addState}</p>}
    </section>
  )
}

function NotificationsSection({ current }: { current: "daily" | "weekly" | "never" | null }) {
  const options = [
    { value: "daily", label: "Daily digest" },
    { value: "weekly", label: "Weekly digest" },
    { value: "never", label: "Never" },
  ] as const

  const [state, action, pending] = useActionState<SaveState, FormData>(async (_, formData) => {
    try {
      await updateNotifications({
        data: { frequency: formData.get("frequency") as "daily" | "weekly" | "never" },
      })
      return { ok: true }
    } catch {
      return { error: "Failed to save" }
    }
  }, null)

  return (
    <section className="bg-base-100 rounded-box border border-base-200 p-5 space-y-4">
      <h2 className="font-bold text-base-content">Notifications</h2>
      <form action={action} className="space-y-3">
        <div className="space-y-2">
          {options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="frequency"
                value={opt.value}
                defaultChecked={(current ?? "daily") === opt.value}
                className="radio radio-sm"
              />
              <span className="text-sm text-base-content">{opt.label}</span>
            </label>
          ))}
        </div>
        {state?.error && <p className="text-error text-xs">{state.error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="btn btn-neutral btn-sm">
            {pending ? <Loader2 size={13} className="animate-spin" /> : "Save"}
          </button>
          {state?.ok && <span className="text-success text-xs">Saved</span>}
        </div>
      </form>
    </section>
  )
}

function DangerZone() {
  const [confirming, setConfirming] = useState(false)
  const [deleting, startDelete] = useTransition()

  function handleDelete() {
    startDelete(async () => {
      await deleteAccount()
    })
  }

  async function handleSignOut() {
    await signOut()
    window.location.href = "/login"
  }

  return (
    <section className="bg-base-100 rounded-box border border-error/20 p-5 space-y-4">
      <h2 className="font-bold text-base-content">Danger zone</h2>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleSignOut}
          className="btn btn-ghost btn-sm self-start text-base-content/60"
        >
          Sign out
        </button>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="btn btn-sm self-start text-error border-error/30 hover:bg-error hover:text-white hover:border-error"
          >
            Delete account
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-base-content/60">
              This will permanently delete your account and all data. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="btn btn-error btn-sm"
              >
                {deleting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  "Yes, delete everything"
                )}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// ---- Page ----

function SettingsPage() {
  const { profile, accounts } = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Link to="/feed" className="btn btn-ghost btn-square btn-sm text-base-content/50">
            <ArrowLeft size={15} />
          </Link>
          <h1 className="text-xl font-extrabold text-base-content tracking-tight">Settings</h1>
        </div>

        <ProfileSection profile={profile} />
        <AccountsSection accounts={accounts} />
        <NotificationsSection current={profile.notificationFrequency} />
        <DangerZone />
      </div>
    </div>
  )
}
