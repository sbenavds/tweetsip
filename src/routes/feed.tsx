import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { Monitor, Moon, RefreshCw, Settings, Sun } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { getFeed } from "@/functions/feed"
import { triggerFetch } from "@/functions/scheduler"
import { feedQueryOptions } from "@/lib/queries/feed"
import type { ThemePref } from "@/lib/store"
import { useThemeStore } from "@/lib/store"
import type { FeedAccount } from "@/server/feed"

export const Route = createFileRoute("/feed")({
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

// ---- Types ----

type ViewState = { type: "sip"; filterId: string | null } | { type: "insights"; accountId: string }

type Highlight = { emoji: string; text: string; tone: "positive" | "notable" | "warning" }

// ---- Helpers ----

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

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
  return new Date()
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase()
}

const AVATAR_PALETTE = [
  "#1d4ed8",
  "#dc2626",
  "#16a34a",
  "#7c3aed",
  "#065f46",
  "#0891b2",
  "#b45309",
  "#be185d",
]

function avatarColor(handle: string): string {
  let h = 0
  for (const c of handle) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

function todaysThread(accounts: FeedAccount[]): string | null {
  const withBriefings = accounts.filter((a) => a.briefing)
  if (withBriefings.length === 0) return null
  const themes = withBriefings
    .flatMap((a) => a.briefing?.themes ?? [])
    .filter(Boolean)
    .slice(0, 4)
  if (themes.length >= 2) {
    return `${withBriefings.length} ${withBriefings.length === 1 ? "account" : "accounts"} covered today. Topics span: ${themes.join(", ")}.`
  }
  return withBriefings[0].briefing?.moment ?? null
}

// ---- Avatar component ----

function AccountAvatar({
  account,
  size,
  selected = false,
}: {
  account: FeedAccount
  size: number
  selected?: boolean
}) {
  const letter = (account.name ?? account.handle)[0].toUpperCase()
  const color = avatarColor(account.handle)
  const img = account.avatarUrl ? (
    <img
      src={account.avatarUrl}
      alt=""
      style={{ width: size, height: size, borderRadius: "50%", display: "block" }}
    />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: size * 0.38,
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {letter}
    </div>
  )

  if (!selected) return img
  return (
    <div
      style={{
        display: "inline-flex",
        borderRadius: "0.625rem",
        padding: 3,
        border: "2px solid var(--color-base-content)",
      }}
    >
      {img}
    </div>
  )
}

// ---- Skeletons ----

function FeedSkeleton() {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-2xl mx-auto px-5 pt-24 pb-10 animate-pulse space-y-5">
        <div className="h-3 bg-base-300 rounded w-40" />
        <div className="h-9 bg-base-300 rounded w-52" />
        <div className="h-20 bg-white rounded-2xl" />
        <div className="bg-white rounded-2xl h-48" />
        {[0, 1].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-5 space-y-2">
            <div className="h-3 bg-base-300 rounded w-28" />
            <div className="h-3 bg-base-300 rounded w-full" />
            <div className="h-3 bg-base-300 rounded w-4/5" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Top bar ----

const THEME_ICON: Record<ThemePref, React.ReactNode> = {
  tweetsip: <Sun size={16} />,
  "tweetsip-dark": <Moon size={16} />,
  system: <Monitor size={16} />,
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
    <div className="flex items-center justify-between py-4 px-5">
      <span className="text-xl font-bold tracking-tight text-base-content">TweetSip</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onRefresh}
          disabled={scanning}
          className="btn btn-ghost btn-square btn-sm text-base-content/40 hover:text-base-content"
          aria-label="Refresh"
        >
          <RefreshCw size={15} className={scanning || isFetching ? "animate-spin" : ""} />
        </button>
        <button
          type="button"
          onClick={cycle}
          className="btn btn-ghost btn-square btn-sm text-base-content/40 hover:text-base-content"
          aria-label="Toggle theme"
        >
          {THEME_ICON[pref]}
        </button>
        <Link
          to="/settings"
          className="btn btn-ghost btn-square btn-sm text-base-content/40 hover:text-base-content"
          aria-label="Settings"
        >
          <Settings size={15} />
        </Link>
      </div>
    </div>
  )
}

// ---- Tab bar ----

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

  return (
    <div className="flex items-end px-5 border-b border-base-content/[0.08]">
      {/* The Sip tab */}
      <button
        type="button"
        onClick={onSip}
        className={`flex items-center gap-2 pb-3 mr-6 text-sm font-semibold transition-colors ${
          view.type === "sip"
            ? "text-base-content border-b-2 border-base-content -mb-px"
            : "text-base-content/30"
        }`}
      >
        ☕ The Sip
        <span className="bg-base-content text-base-100 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
          {accounts.length}
        </span>
      </button>

      {/* Account tab — only when in insights view */}
      {insightsAccount && (
        <div className="flex items-center gap-2 pb-3 text-sm font-semibold text-base-content border-b-2 border-base-content -mb-px">
          <AccountAvatar account={insightsAccount} size={20} />
          <span>@{insightsAccount.handle}</span>
        </div>
      )}
    </div>
  )
}

// ---- Sip View ----

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
    <div className="flex items-start gap-3 p-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      {/* All button */}
      <button
        type="button"
        onClick={() => onFilter(null)}
        className={`flex flex-col items-center gap-1 shrink-0 transition-colors`}
      >
        <div
          className={`px-4 h-11 rounded-lg text-sm font-semibold flex items-center transition-colors ${
            filterId === null
              ? "bg-base-content text-base-100"
              : "bg-base-300/60 text-base-content/40"
          }`}
        >
          All
        </div>
      </button>

      {/* Account avatars */}
      {accounts.map((a) => {
        const active = filterId === a.id
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onFilter(a.id)}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <div className={active ? "" : "opacity-30"}>
              <AccountAvatar account={a} size={44} selected={active} />
            </div>
            <span
              className={`text-[10px] font-medium max-w-[52px] truncate ${active ? "text-base-content" : "text-base-content/40"}`}
            >
              {a.handle}
            </span>
          </button>
        )
      })}

      {/* Add account */}
      <Link
        to="/settings"
        className="flex flex-col items-center gap-1.5 shrink-0"
        aria-label="Add account"
      >
        <div className="w-11 h-11 rounded-full border-2 border-dashed border-base-content/15 flex items-center justify-center text-base-content/25 text-lg leading-none">
          +
        </div>
      </Link>
    </div>
  )
}

function SipView({
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
    <div className="space-y-4">
      {/* Date + greeting */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-base-content/35 mb-2">
          {dateLabel()} · Daily Sip
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-base-content">{greeting()} ☕</h2>
      </div>

      {/* Today's Thread */}
      {thread && (
        <div className="bg-white rounded-2xl p-5" style={{ borderLeft: "4px solid #3b82f6" }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-500 mb-2">
            Today's Thread
          </p>
          <p className="text-sm text-base-content/65 leading-relaxed">{thread}</p>
        </div>
      )}

      {/* Feed panel — single white card */}
      {accounts.length > 0 ? (
        <div className="bg-white rounded-2xl overflow-hidden">
          <AvatarStrip accounts={accounts} filterId={filterId} onFilter={onFilter} />
          <div className="border-t border-base-content/[0.06]" />
          {visible.map((a, i) => (
            <div key={a.id}>
              {i > 0 && <div className="border-t border-base-content/[0.06] mx-5" />}
              <div className="px-5 py-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-base-content">@{a.handle}</span>
                  {a.briefing && (
                    <span className="bg-base-200 text-base-content/45 text-[11px] font-medium px-2.5 py-0.5 rounded-full">
                      AI Summary
                    </span>
                  )}
                </div>
                {a.briefing?.moment ? (
                  <p className="text-sm text-base-content/65 leading-relaxed mb-3">
                    {a.briefing.moment}
                  </p>
                ) : (
                  <p className="text-sm text-base-content/30 italic mb-3">Briefing pending…</p>
                )}
                {a.briefing && (
                  <button
                    type="button"
                    onClick={() => onReadThread(a.id)}
                    className="text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors"
                  >
                    Read thread →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-10 text-center">
          <p className="text-sm text-base-content/40 mb-4">No accounts tracked yet.</p>
          <Link to="/settings" className="btn btn-neutral btn-sm">
            Add your first account
          </Link>
        </div>
      )}

      {accounts.length > 0 && (
        <p className="text-center text-[11px] text-base-content/25 italic pt-2 pb-4">
          "Curated by TweetSip AI. Stay informed, stay focused."
        </p>
      )}
    </div>
  )
}

// ---- Insights View ----

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
      ?.split(/[+,]/)
      .map((s) => s.trim())
      .filter(Boolean) ?? []

  const toneStyle: Record<Highlight["tone"], { bg: string; text: string }> = {
    positive: { bg: "rgba(22,163,74,0.08)", text: "#15803d" },
    notable: { bg: "rgba(59,130,246,0.08)", text: "#1d4ed8" },
    warning: { bg: "rgba(220,38,38,0.08)", text: "#dc2626" },
  }

  return (
    <div className="space-y-4">
      {/* Account header — outside any card */}
      <div className="flex items-center gap-4">
        <AccountAvatar account={account} size={48} />
        <div>
          <p className="text-base font-bold text-base-content">{account.name ?? account.handle}</p>
          <p className="text-sm text-base-content/45">
            @{account.handle}
            {posts.length > 0 && ` · ${posts.length} posts today`}
          </p>
        </div>
      </div>

      {/* Summary card */}
      {briefing && (
        <div className="bg-white rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full bg-emerald-500 ${scanning ? "animate-pulse" : ""}`}
              />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-base-content/35">
                Summary
              </span>
            </div>
            {moods.length > 0 && (
              <span className="bg-base-200 text-base-content/45 text-[11px] font-medium px-3 py-1 rounded-full uppercase tracking-wide">
                {moods.join(" · ")}
              </span>
            )}
          </div>
          <p
            className="text-xl font-bold leading-snug text-base-content"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {briefing.moment}
          </p>
        </div>
      )}

      {/* What Stood Out */}
      {highlights.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-base-content/35 mb-3 px-0.5">
            What Stood Out
          </p>
          <div className="space-y-2">
            {highlights.map((h, i) => (
              <div
                key={`${h.tone}-${i}`}
                className="rounded-2xl p-4 flex items-start gap-3"
                style={{ background: toneStyle[h.tone].bg }}
              >
                <span className="text-lg leading-none shrink-0 mt-0.5">{h.emoji}</span>
                <p className="text-sm leading-relaxed" style={{ color: toneStyle[h.tone].text }}>
                  {h.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Posts Today */}
      {posts.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-base-content/35 px-5 pt-5 pb-4">
            Top Posts Today
          </p>
          {posts.slice(0, 5).map((post, i) => (
            <div
              key={post.id}
              className={`flex items-start gap-4 px-5 py-4 ${i > 0 ? "border-t border-base-content/[0.06]" : ""}`}
            >
              <p className="text-sm text-base-content/65 leading-relaxed flex-1 min-w-0">
                {post.text.length > 150 ? `${post.text.slice(0, 150)}…` : post.text}
              </p>
              <span
                className="text-sm text-base-content/35 shrink-0 tabular-nums"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {fmtNum(post.likes)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Your Move */}
      {briefing?.forYou && (
        <div className="rounded-2xl p-5" style={{ background: "rgba(251,191,36,0.12)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(251,191,36,0.25)" }}
            >
              <span className="text-base leading-none">⚡</span>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-600">
              Your Move
            </p>
          </div>
          <p className="text-sm leading-relaxed text-amber-900/80">{briefing.forYou}</p>
        </div>
      )}

      {/* Back link at bottom */}
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-base-content/35 hover:text-base-content/55 transition-colors pb-4"
      >
        ← Back to The Sip
      </button>
    </div>
  )
}

// ---- Page ----

type ScanStatus = "idle" | "scanning" | "done_new" | "done_same"

function FeedPage() {
  const loaderData = Route.useLoaderData()
  const queryClient = useQueryClient()
  const [, startTransition] = useTransition()
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle")
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null)
  const [view, setView] = useState<ViewState>({ type: "sip", filterId: null })

  const { data: accounts = [], isFetching } = useQuery({
    ...feedQueryOptions(),
    initialData: loaderData,
    refetchInterval: (query) => {
      const data = query.state.data ?? []
      if (data.some((a) => !a.briefing)) return 3000
      if (scanStatus === "scanning") return 3000
      return false
    },
  })

  useEffect(() => {
    if (scanStatus !== "scanning" || isFetching || !refreshedAt) return
    const hasNew = accounts.some(
      (a) => a.briefing?.generatedAt && new Date(a.briefing.generatedAt).getTime() > refreshedAt
    )
    if (!hasNew) return
    setScanStatus("done_new")
    setRefreshedAt(null)
  }, [accounts, isFetching, scanStatus, refreshedAt])

  useEffect(() => {
    if (scanStatus === "idle") return
    const ms = scanStatus === "scanning" ? 45000 : 3000
    const t = setTimeout(() => {
      setScanStatus("idle")
      setRefreshedAt(null)
    }, ms)
    return () => clearTimeout(t)
  }, [scanStatus])

  function handleRefresh() {
    const now = Date.now()
    setRefreshedAt(now)
    setScanStatus("scanning")
    startTransition(async () => {
      await triggerFetch()
      queryClient.invalidateQueries({ queryKey: ["feed"] })
    })
  }

  const scanning = scanStatus === "scanning"

  const insightsAccount =
    view.type === "insights" ? (accounts.find((a) => a.id === view.accountId) ?? null) : null

  return (
    <div className="min-h-screen bg-base-200">
      {/* Sticky header: top bar + tab bar */}
      <div
        className="sticky top-0 z-50"
        style={{ background: "rgba(242,244,248,0.92)", backdropFilter: "blur(12px)" }}
      >
        <div className="max-w-2xl mx-auto">
          <TopBar scanning={scanning} isFetching={isFetching} onRefresh={handleRefresh} />
          <TabBar
            accounts={accounts}
            view={view}
            onSip={() => setView({ type: "sip", filterId: null })}
          />
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-2xl mx-auto px-5 pt-6 pb-16">
        {view.type === "sip" ? (
          <SipView
            accounts={accounts}
            filterId={view.filterId}
            onFilter={(id) => setView({ type: "sip", filterId: id })}
            onReadThread={(id) => setView({ type: "insights", accountId: id })}
          />
        ) : insightsAccount ? (
          <InsightsView
            account={insightsAccount}
            scanning={scanning}
            onBack={() => setView({ type: "sip", filterId: null })}
          />
        ) : (
          <div className="text-center py-16">
            <button
              type="button"
              onClick={() => setView({ type: "sip", filterId: null })}
              className="text-sm text-base-content/40 hover:text-base-content/60 transition-colors"
            >
              ← Back to feed
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
