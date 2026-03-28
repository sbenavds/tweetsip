import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, ArrowRight, Coffee, Loader2, Monitor, Moon, Sun } from "lucide-react"
import { useActionState, useState } from "react"
import { addDemoAccount, getDemoFeed } from "@/functions/feed"
import { demoFeedQueryOptions } from "@/lib/queries/feed"
import type { ThemePref } from "@/lib/store"
import { useThemeStore } from "@/lib/store"
import type { FeedAccount } from "@/server/feed"
import {
  AvatarCircle,
  dateLabel,
  displayHandle,
  FeedSkeleton,
  greeting,
  InsightsView,
  TabBar,
  todaysThread,
  type ViewState,
} from "./feed"

export const Route = createFileRoute("/demo")({
  validateSearch: (
    search: Record<string, unknown>
  ): { view?: "sip" | "insights"; account?: string } => ({
    view: search.view === "insights" ? "insights" : search.view === "sip" ? "sip" : undefined,
    account: typeof search.account === "string" ? search.account : undefined,
  }),
  loader: () => getDemoFeed(),
  pendingMs: 300,
  pendingMinMs: 200,
  pendingComponent: FeedSkeleton,
  component: DemoPage,
})

// ── Demo top bar ──────────────────────────────────────────────────────────────

const THEME_ICON: Record<ThemePref, React.ReactNode> = {
  tweetsip: <Sun size={14} />,
  "tweetsip-dark": <Moon size={14} />,
  system: <Monitor size={14} />,
}

function DemoTopBar() {
  const { pref, cycle } = useThemeStore()
  return (
    <div className="max-w-[580px] mx-auto px-[18px] py-3 flex items-center justify-between">
      <span className="font-serif text-base font-bold tracking-tight text-base-content">
        TweetSip
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={cycle}
          className="w-7 h-7 rounded-full border border-base-content/[0.12] bg-transparent flex items-center justify-center text-base-content/40 hover:text-base-content/60 transition-colors"
          aria-label="Toggle theme"
        >
          {THEME_ICON[pref]}
        </button>
        <Link
          to="/login"
          className="h-7 px-3 rounded-full border border-base-content/[0.12] flex items-center justify-center text-[11px] font-semibold text-base-content/50 hover:text-base-content/70 transition-colors"
        >
          Sign up
        </Link>
      </div>
    </div>
  )
}

// ── Demo banner ───────────────────────────────────────────────────────────────

function DemoBanner() {
  return (
    <div className="bg-base-100 rounded-2xl px-5 py-4 mb-4 flex items-center justify-between border border-base-content/[0.07]">
      <div>
        <p className="text-[13px] font-semibold text-base-content">You're viewing a live demo</p>
        <p className="text-[11px] text-base-content/40">
          Real AI briefings, refreshed daily. Sign up to track your own accounts.
        </p>
      </div>
      <Link to="/login" className="btn btn-neutral btn-sm shrink-0 ml-4">
        Get started <ArrowRight size={11} />
      </Link>
    </div>
  )
}

// ── Demo add account card ─────────────────────────────────────────────────────

function DemoAddCard({ onAdd }: { onAdd: (account: FeedAccount) => void }) {
  const [state, action, pending] = useActionState(
    async (_: string | undefined, formData: FormData) => {
      const handle = (formData.get("handle") as string).trim().replace(/^@/, "")
      if (!handle) return "Enter a valid handle"
      try {
        const account = await addDemoAccount({ data: { handle } })
        onAdd(account as FeedAccount)
        return undefined
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong"
        return msg
      }
    },
    undefined
  )

  return (
    <div className="bg-base-100 rounded-2xl px-5 py-4 mb-4 border border-dashed border-base-content/[0.12]">
      <p className="text-[11px] text-base-content/40 mb-2.5 font-medium">
        Try it — add any X account and get an AI briefing in seconds
      </p>
      <form action={action} className="flex gap-2">
        <input
          name="handle"
          type="text"
          placeholder="@handle"
          disabled={pending}
          className="input input-sm flex-1 bg-base-200"
        />
        <button type="submit" disabled={pending} className="btn btn-neutral btn-sm">
          {pending ? <Loader2 size={13} className="animate-spin" /> : "Analyze"}
        </button>
      </form>
      {state && (
        <p className="text-base-content/40 text-xs mt-2">
          {state.includes("not found") || state.includes("No recent")
            ? "Live account analysis is temporarily unavailable. Browse the demo feed to see what TweetSip can do."
            : state}
        </p>
      )}
    </div>
  )
}

// ── Demo sip view (no "+" button in avatar strip) ─────────────────────────────

function DemoSipView({
  accounts,
  filterId,
  onFilter,
  onReadThread,
}: {
  accounts: FeedAccount[]
  filterId: string | null
  onFilter: (id: string | null) => void
  onReadThread: (id: string) => void
}) {
  const visible = filterId ? accounts.filter((a) => a.id === filterId) : accounts
  const thread = todaysThread(accounts)

  return (
    <div>
      <div className="mb-5">
        <p
          suppressHydrationWarning
          className="text-[10px] text-base-content/40 tracking-[0.08em] uppercase font-medium mb-1"
        >
          {dateLabel()} · Daily Sip
        </p>
        <h2
          suppressHydrationWarning
          className="font-serif text-[26px] font-bold tracking-tight text-base-content"
        >
          {greeting()} <Coffee size={22} className="inline-block align-[-3px]" />
        </h2>
      </div>

      {thread && (
        <div className="bg-base-100 rounded-[14px] px-[18px] py-[14px] mb-3 border-l-[3px] border-blue-500">
          <p className="text-[10px] text-blue-600 tracking-[0.10em] uppercase font-semibold mb-1.5">
            Today's thread
          </p>
          <p className="text-[13px] text-base-content/60 leading-relaxed">{thread}</p>
        </div>
      )}

      {accounts.length > 0 ? (
        <div className="bg-base-100 rounded-2xl overflow-hidden">
          {/* Avatar strip without the "+" add button */}
          <div className="flex items-center px-5 py-3 border-b border-base-content/[0.07]">
            <button
              type="button"
              onClick={() => onFilter(null)}
              className={`px-5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                filterId === null
                  ? "bg-base-content text-base-100"
                  : "bg-base-200 text-base-content/40 hover:text-base-content/60"
              }`}
            >
              All
            </button>
            <div className="flex-1" />
            <div className="flex items-start gap-1.5 overflow-x-auto [scrollbar-width:none]">
              {accounts.map((a) => {
                const active = filterId === a.id
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onFilter(active ? null : a.id)}
                    title={displayHandle(a.handle)}
                    className={`flex flex-col items-center gap-1 shrink-0 px-[3px] bg-transparent border-0 cursor-pointer transition-opacity ${
                      filterId !== null && !active ? "opacity-30" : "opacity-100"
                    }`}
                  >
                    <AvatarCircle account={a} ring={active} />
                    <span
                      className={`text-[9px] max-w-[44px] truncate ${
                        active ? "text-base-content font-semibold" : "text-base-content/40"
                      }`}
                    >
                      {a.handle.replace("@", "")}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {visible.map((a, i) => (
            <div
              key={a.id}
              className={`px-5 py-5 ${i < visible.length - 1 ? "border-b border-base-content/[0.07]" : ""}`}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[13px] font-semibold text-base-content">
                  {displayHandle(a.handle)}
                </span>
                {a.briefing && (
                  <span className="text-[10px] text-base-content/40 bg-base-200 px-2 py-0.5 rounded-full">
                    AI Summary
                  </span>
                )}
              </div>
              {a.briefing?.moment ? (
                <p className="text-[13px] text-base-content/60 leading-[1.65] mb-3">
                  {a.briefing.moment}
                </p>
              ) : (
                <p className="text-[13px] text-base-content/30 italic mb-3">Briefing pending…</p>
              )}
              {a.briefing && (
                <button
                  type="button"
                  onClick={() => onReadThread(a.id)}
                  className="text-[12px] text-blue-600 font-semibold bg-transparent border-0 cursor-pointer p-0 hover:text-blue-700 transition-colors"
                >
                  Read thread <ArrowRight size={11} className="inline-block" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-base-100 rounded-2xl p-12 text-center">
          <p className="text-sm text-base-content/40 mb-4">No accounts tracked yet.</p>
          <Link to="/login" className="btn btn-neutral btn-sm">
            Sign up to get started
          </Link>
        </div>
      )}

      {accounts.length > 0 && (
        <p className="text-center text-[11px] text-base-content/30 italic mt-7 mb-4">
          "Curated by TweetSip AI. Stay informed, stay focused."
        </p>
      )}
    </div>
  )
}

// ── Demo page ─────────────────────────────────────────────────────────────────

function DemoPage() {
  const loaderData = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: "/demo" })
  const [demoAccounts, setDemoAccounts] = useState<FeedAccount[]>([])

  const view: ViewState =
    search.view === "insights" && search.account
      ? { type: "insights", accountId: search.account }
      : { type: "sip", filterId: search.account ?? null }

  function setFilter(id: string | null) {
    navigate({
      search: id ? { view: "sip", account: id } : { view: undefined, account: undefined },
    })
  }
  function goInsights(id: string) {
    navigate({ search: { view: "insights", account: id } })
  }
  function goBack() {
    navigate({ search: { view: undefined, account: undefined } })
  }

  const { data: serverAccounts = [] } = useQuery({
    ...demoFeedQueryOptions(),
    initialData: loaderData,
  })

  const accounts = [...serverAccounts, ...demoAccounts]

  function handleDemoAdd(account: FeedAccount) {
    setDemoAccounts((prev) => [...prev, account])
  }

  const insightsAccount =
    view.type === "insights" ? (accounts.find((a) => a.id === view.accountId) ?? null) : null

  return (
    <div className="min-h-screen bg-base-200 font-sans">
      <div className="sticky top-0 z-50 bg-base-200/95 backdrop-blur-xl">
        <DemoTopBar />
        <TabBar accounts={accounts} view={view} onSip={goBack} />
      </div>

      <div className="max-w-[580px] mx-auto px-[18px] pt-6 pb-16">
        {view.type === "sip" && (
          <>
            <DemoBanner />
            {demoAccounts.length === 0 && <DemoAddCard onAdd={handleDemoAdd} />}
          </>
        )}

        {view.type === "sip" ? (
          <DemoSipView
            accounts={accounts}
            filterId={view.filterId}
            onFilter={setFilter}
            onReadThread={goInsights}
          />
        ) : insightsAccount ? (
          <InsightsView account={insightsAccount} scanning={false} onBack={goBack} />
        ) : (
          <div className="text-center py-16">
            <button
              type="button"
              onClick={goBack}
              className="text-sm text-base-content/35 hover:text-base-content/55 transition-colors"
            >
              <ArrowLeft size={12} className="inline-block mr-1" /> Back to feed
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
