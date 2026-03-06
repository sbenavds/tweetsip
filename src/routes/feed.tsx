import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router"
import { Monitor, Moon, Plus, RefreshCw, Settings, Sun } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { getFeed } from "@/functions/feed"
import { triggerFetch } from "@/functions/scheduler"
import { feedQueryOptions } from "@/lib/queries/feed"
import type { ThemePref } from "@/lib/store"
import { useThemeStore } from "@/lib/store"
import type { FeedAccount } from "@/server/feed"

export const Route = createFileRoute("/feed")({
  validateSearch: (
    search: Record<string, unknown>
  ): { view?: "sip" | "insights"; account?: string } => ({
    view: search.view === "insights" ? "insights" : search.view === "sip" ? "sip" : undefined,
    account: typeof search.account === "string" ? search.account : undefined,
  }),
  loader: async () => {
    try {
      return await getFeed()
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e
      throw redirect({ to: "/login" })
    }
  },
  pendingMs: 300,
  pendingMinMs: 200,
  pendingComponent: FeedSkeleton,
  component: FeedPage,
})

// ── Types ──────────────────────────────────────────────────────────────────────

type ViewState = { type: "sip"; filterId: string | null } | { type: "insights"; accountId: string }

type Highlight = { emoji: string; text: string; tone: "positive" | "notable" | "warning" }

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Good morning."
  if (h < 17) return "Good afternoon."
  return "Good evening."
}

function dateLabel(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

function displayHandle(raw: string): string {
  return raw.startsWith("@") ? raw : `@${raw}`
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#1c3d5a,#2563eb)",
  "linear-gradient(135deg,#7c1d1d,#dc2626)",
  "linear-gradient(135deg,#1a3a2a,#16a34a)",
  "linear-gradient(135deg,#3b1f6e,#7c3aed)",
  "linear-gradient(135deg,#1a2a1a,#4a7c4a)",
  "linear-gradient(135deg,#0c3547,#0891b2)",
  "linear-gradient(135deg,#4a1a0a,#ea580c)",
]

function avatarGrad(h: string): string {
  let v = 0
  for (const c of h) v = (v * 31 + c.charCodeAt(0)) & 0x7fffffff
  return AVATAR_GRADIENTS[v % AVATAR_GRADIENTS.length]
}

function todaysThread(accounts: FeedAccount[]): string | null {
  const briefed = accounts.filter((a) => a.briefing)
  if (briefed.length === 0) return null
  const themes = [...new Set(briefed.flatMap((a) => a.briefing?.themes ?? []))].slice(0, 4)
  const n = briefed.length
  const total = accounts.length
  const coverage =
    n < total ? `${n} of ${total} accounts` : `${n} ${n === 1 ? "account" : "accounts"}`
  if (themes.length >= 2) {
    return `${coverage} covered today. Topics span: ${themes.join(", ")}.`
  }
  return briefed[0].briefing?.moment ?? null
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function AvatarCircle({ account, ring = false }: { account: FeedAccount; ring?: boolean }) {
  const letter = (account.name ?? account.handle)[0].toUpperCase()
  const ringCls = ring ? "ring-2 ring-base-content ring-offset-2 ring-offset-base-100" : ""

  if (account.avatarUrl) {
    return (
      <div className="avatar shrink-0">
        <div className={`mask mask-squircle w-8 ${ringCls}`}>
          <img src={account.avatarUrl} alt={account.name ?? account.handle} />
        </div>
      </div>
    )
  }

  return (
    <div className="avatar avatar-placeholder shrink-0">
      <div
        className={`mask mask-squircle w-8 text-xs font-bold ${ringCls}`}
        style={{ background: avatarGrad(account.handle) }}
      >
        <span className="text-white">{letter}</span>
      </div>
    </div>
  )
}

// ── Skeletons ──────────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-[580px] mx-auto px-[18px] pt-24 pb-10 animate-pulse space-y-5">
        <div className="h-3 bg-base-300 rounded w-40" />
        <div className="h-9 bg-base-300 rounded w-52" />
        <div className="h-20 bg-base-100 rounded-2xl" />
        <div className="bg-base-100 rounded-2xl h-56" />
      </div>
    </div>
  )
}

// ── Top bar ────────────────────────────────────────────────────────────────────
// No bottom border — tab bar owns the single divider below the sticky shell.

const THEME_ICON: Record<ThemePref, React.ReactNode> = {
  tweetsip: <Sun size={14} />,
  "tweetsip-dark": <Moon size={14} />,
  system: <Monitor size={14} />,
}

function TopBar({
  scanning,
  isFetching,
  onRefresh,
}: {
  scanning: boolean
  isFetching: boolean
  onRefresh: () => void
}) {
  const { pref, cycle } = useThemeStore()
  return (
    <div className="max-w-[580px] mx-auto px-[18px] py-3 flex items-center justify-between">
      <span className="font-serif text-base font-bold tracking-tight text-base-content">
        TweetSip
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onRefresh}
          disabled={scanning}
          className="w-7 h-7 rounded-full border border-base-content/[0.12] bg-transparent flex items-center justify-center text-base-content/40 hover:text-base-content/60 transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw size={13} className={scanning || isFetching ? "animate-spin" : ""} />
        </button>
        <button
          type="button"
          onClick={cycle}
          className="w-7 h-7 rounded-full border border-base-content/[0.12] bg-transparent flex items-center justify-center text-base-content/40 hover:text-base-content/60 transition-colors"
          aria-label="Toggle theme"
        >
          {THEME_ICON[pref]}
        </button>
        <Link
          to="/settings"
          className="w-7 h-7 rounded-full border border-base-content/[0.12] flex items-center justify-center text-base-content/40 hover:text-base-content/60 transition-colors"
          aria-label="Settings"
        >
          <Settings size={13} />
        </Link>
      </div>
    </div>
  )
}

// ── Tab bar ────────────────────────────────────────────────────────────────────

function TabBar({
  accounts,
  view,
  onSip,
}: {
  accounts: FeedAccount[]
  view: ViewState
  onSip: () => void
}) {
  const insightsAccount =
    view.type === "insights" ? accounts.find((a) => a.id === view.accountId) : null
  const sipActive = view.type === "sip"

  return (
    <div className="border-b border-base-content/[0.07]">
      <div className="max-w-[580px] mx-auto px-[18px] flex items-center justify-between">
        {/* Left: The Sip tab */}
        <button
          type="button"
          onClick={onSip}
          className={`flex items-center gap-2 py-[11px] -mb-px border-b-2 transition-colors ${
            sipActive
              ? "border-base-content text-base-content"
              : "border-transparent text-base-content/30"
          }`}
        >
          <span className="text-[13px]">☕</span>
          <span className={`text-[13px] ${sipActive ? "font-semibold" : "font-normal"}`}>
            The Sip
          </span>
          <span
            className={`text-[10px] font-bold px-1.5 py-px rounded-full transition-colors ${
              sipActive
                ? "bg-base-content text-base-100"
                : "bg-base-content/[0.10] text-base-content/40"
            }`}
          >
            {accounts.length}
          </span>
        </button>

        {/* Right: Account tab — only in insights, pinned far right */}
        {insightsAccount && (
          <div className="flex items-center gap-2 py-[11px] -mb-px border-b-2 border-base-content">
            <AvatarCircle account={insightsAccount} />
            <span className="text-[13px] font-semibold text-base-content whitespace-nowrap">
              {displayHandle(insightsAccount.handle)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Avatar strip ───────────────────────────────────────────────────────────────

function AvatarStrip({
  accounts,
  filterId,
  onFilter,
}: {
  accounts: FeedAccount[]
  filterId: string | null
  onFilter: (id: string | null) => void
}) {
  return (
    <div className="flex items-center px-5 py-3 border-b border-base-content/[0.07]">
      {/* All — left, wide, slightly rounded */}
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

      {/* Spacer */}
      <div className="flex-1" />

      {/* Avatars — far right, scrollable */}
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

        <div className="w-px h-5 bg-base-content/[0.10] self-center mx-1 shrink-0" />

        <Link to="/settings" className="shrink-0 self-start group" aria-label="Add account">
          <div className="avatar avatar-placeholder">
            <div className="mask mask-squircle w-8 bg-base-content/[0.07] group-hover:bg-base-content/[0.13] transition-colors text-base-content/30 group-hover:text-base-content/50">
              <Plus size={13} />
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}

// ── Sip view ───────────────────────────────────────────────────────────────────

function SipView({
  accounts,
  filterId,
  scanning,
  onFilter,
  onReadThread,
}: {
  accounts: FeedAccount[]
  filterId: string | null
  scanning: boolean
  onFilter: (id: string | null) => void
  onReadThread: (id: string) => void
}) {
  const visible = filterId ? accounts.filter((a) => a.id === filterId) : accounts
  const thread = todaysThread(accounts)
  const pendingCount = accounts.filter((a) => !a.briefing).length

  return (
    <div>
      {/* Date + greeting — suppressHydrationWarning because new Date() differs
          between Cloudflare Worker (UTC) and browser (user timezone). This is an
          expected, harmless mismatch per rendering-hydration-suppress-warning. */}
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
          {greeting()} ☕
        </h2>
      </div>

      {/* Sync status — shown while briefings are pending */}
      {(scanning || pendingCount > 0) && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <p className="text-[11px] text-base-content/40">
            {scanning
              ? "Fetching posts and generating briefings… this takes ~5s"
              : `${pendingCount} ${pendingCount === 1 ? "briefing" : "briefings"} generating…`}
          </p>
        </div>
      )}

      {/* Today's Thread */}
      {thread && (
        <div className="bg-base-100 rounded-[14px] px-[18px] py-[14px] mb-3 border-l-[3px] border-blue-500">
          <p className="text-[10px] text-blue-600 tracking-[0.10em] uppercase font-semibold mb-1.5">
            Today's thread
          </p>
          <p className="text-[13px] text-base-content/60 leading-relaxed">{thread}</p>
        </div>
      )}

      {/* Feed panel — single white card */}
      {accounts.length > 0 ? (
        <div className="bg-base-100 rounded-2xl overflow-hidden">
          <AvatarStrip accounts={accounts} filterId={filterId} onFilter={onFilter} />
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
                  Read thread →
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-base-100 rounded-2xl p-12 text-center">
          <p className="text-sm text-base-content/40 mb-4">No accounts tracked yet.</p>
          <Link to="/settings" className="btn btn-neutral btn-sm">
            Add your first account
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

// ── Post row ───────────────────────────────────────────────────────────────────

function PostRow({ post, isLast }: { post: FeedAccount["posts"][number]; isLast: boolean }) {
  return (
    <div
      className={`flex items-start justify-between gap-4 px-5 py-[11px] hover:bg-base-content/[0.025] transition-colors ${
        isLast ? "" : "border-b border-base-content/[0.07]"
      }`}
    >
      <p className="text-[13px] text-base-content/60 leading-[1.5] flex-1 line-clamp-2">
        {post.text}
      </p>
      <span className="font-mono text-[12px] text-base-content/35 shrink-0">
        {fmtNum(post.likes)}
      </span>
    </div>
  )
}

// ── Insights view ──────────────────────────────────────────────────────────────

function InsightsView({
  account,
  scanning,
  onBack,
}: {
  account: FeedAccount
  scanning: boolean
  onBack: () => void
}) {
  const { briefing, posts } = account
  const highlights = (briefing?.highlights ?? []) as Highlight[]
  const moods =
    briefing?.mood
      ?.split(/[+·,]/)
      .map((s) => s.trim())
      .filter(Boolean) ?? []

  // Full class strings are required for Tailwind to detect them at build time
  const toneClass: Record<Highlight["tone"], string> = {
    positive: "bg-green-50 border border-green-200 text-green-700",
    notable: "bg-blue-50 border border-blue-200 text-blue-700",
    warning: "bg-red-50 border border-red-200 text-red-600",
  }

  return (
    <div className="space-y-2.5">
      {/* Account header — outside any card */}
      <div className="flex items-center gap-3 mb-5">
        <AvatarCircle account={account} />
        <div>
          <p className="text-[14px] font-semibold text-base-content">
            {account.name ?? account.handle}
          </p>
          <p className="text-[11px] text-base-content/40">
            {displayHandle(account.handle)}
            {posts.length > 0 && ` · ${posts.length} posts today`}
          </p>
        </div>
      </div>

      {/* Summary */}
      {briefing && (
        <div className="bg-base-100 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  scanning ? "bg-base-content/30 animate-pulse" : "bg-green-500"
                }`}
              />
              <span className="text-[10px] uppercase tracking-[0.10em] font-semibold text-base-content/35">
                Summary
              </span>
            </div>
            {moods.length > 0 && (
              <span className="text-[10px] text-base-content/50 bg-base-200 px-2.5 py-[3px] rounded-full font-medium uppercase tracking-[0.05em]">
                {moods.join(" · ")}
              </span>
            )}
          </div>
          <p className="font-serif text-[19px] font-bold leading-[1.45] text-base-content tracking-[-0.01em]">
            {briefing.moment}
          </p>
        </div>
      )}

      {/* What Stood Out */}
      <div className="bg-base-100 rounded-2xl px-5 pt-5 pb-3">
        <p className="text-[10px] uppercase tracking-[0.10em] font-semibold text-base-content/35 mb-3.5">
          What stood out
        </p>
        {highlights.length > 0 ? (
          <div className="space-y-2 pb-2">
            {highlights.map((h, i) => (
              <div
                key={`${h.tone}-${i}`}
                className={`flex items-start gap-2.5 rounded-xl py-[10px] px-[13px] ${toneClass[h.tone]}`}
              >
                <span className="text-[13px] leading-none mt-0.5 shrink-0">{h.emoji}</span>
                <span className="text-[13px] leading-[1.55]">{h.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-base-content/35 italic pb-2">
            Highlights will appear after the next briefing is generated.
          </p>
        )}
      </div>

      {/* Top Posts Today */}
      {posts.length > 0 && (
        <div className="bg-base-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-base-content/[0.07]">
            <span className="text-[10px] uppercase tracking-[0.10em] font-semibold text-base-content/35">
              Top posts today
            </span>
          </div>
          {posts.slice(0, 5).map((post, i) => (
            <PostRow key={post.id} post={post} isLast={i === Math.min(posts.length, 5) - 1} />
          ))}
        </div>
      )}

      {/* Your Move */}
      {briefing?.forYou && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 py-[18px] px-5 flex items-start gap-3.5">
          <div className="w-[34px] h-[34px] rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-[15px] shrink-0 mt-0.5">
            ⚡
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.10em] font-semibold text-amber-700 mb-1.5">
              Your move
            </p>
            <p className="text-[13px] text-amber-900/80 leading-[1.6]">{briefing.forYou}</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        className="text-[12px] text-base-content/35 hover:text-base-content/55 transition-colors py-3 block bg-transparent border-0 cursor-pointer"
      >
        ← Back to The Sip
      </button>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

function FeedPage() {
  const loaderData = Route.useLoaderData()
  const queryClient = useQueryClient()
  const [isPending, startTransition] = useTransition()
  const [scanning, setScanning] = useState(false)
  const search = Route.useSearch()
  const navigate = useNavigate({ from: "/feed" })

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

  const { data: accounts = [], isFetching } = useQuery({
    ...feedQueryOptions(),
    initialData: loaderData,
    refetchInterval: (query) => {
      if (scanning) return 3000
      const data = query.state.data ?? []
      return data.some((a) => !a.briefing) ? 3000 : false
    },
  })

  // Stop scanning once all briefings are ready or after 60s timeout
  useEffect(() => {
    if (!scanning) return
    if (accounts.length > 0 && accounts.every((a) => a.briefing)) {
      setScanning(false)
      return
    }
    const t = setTimeout(() => setScanning(false), 60_000)
    return () => clearTimeout(t)
  }, [scanning, accounts])

  function handleRefresh() {
    setScanning(true)
    startTransition(async () => {
      await triggerFetch()
      queryClient.invalidateQueries({ queryKey: ["feed"] })
    })
  }

  const insightsAccount =
    view.type === "insights" ? (accounts.find((a) => a.id === view.accountId) ?? null) : null

  return (
    <div className="min-h-screen bg-base-200 font-sans">
      {/* Sticky nav — top bar + tab bar share one backdrop */}
      <div className="sticky top-0 z-50 bg-base-200/95 backdrop-blur-xl">
        <TopBar
          scanning={isPending || scanning}
          isFetching={isFetching}
          onRefresh={handleRefresh}
        />
        <TabBar accounts={accounts} view={view} onSip={goBack} />
      </div>

      <div className="max-w-[580px] mx-auto px-[18px] pt-6 pb-16">
        {view.type === "sip" ? (
          <SipView
            accounts={accounts}
            filterId={view.filterId}
            scanning={scanning}
            onFilter={setFilter}
            onReadThread={goInsights}
          />
        ) : insightsAccount ? (
          <InsightsView account={insightsAccount} scanning={scanning} onBack={goBack} />
        ) : (
          <div className="text-center py-16">
            <button
              type="button"
              onClick={goBack}
              className="text-sm text-base-content/35 hover:text-base-content/55 transition-colors"
            >
              ← Back to feed
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
