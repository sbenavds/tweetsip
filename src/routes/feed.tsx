import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { Monitor, Moon, Plus, RefreshCw, Settings, Sun } from "lucide-react"
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

// ---- Skeletons ----

function AIBriefSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-2.5 bg-base-300 rounded w-24" />
        <div className="h-5 bg-base-300 rounded-full w-20" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-base-300 rounded w-full" />
        <div className="h-4 bg-base-300 rounded w-5/6" />
        <div className="h-4 bg-base-300 rounded w-4/5" />
      </div>
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 animate-pulse">
          <div className="space-y-1.5">
            <div className="h-6 bg-base-300 rounded w-24" />
            <div className="h-3 bg-base-300 rounded w-32" />
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-8 h-8 bg-base-300 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="flex gap-2 mb-4 animate-pulse">
          <div className="h-12 bg-base-300 rounded-2xl w-36" />
          <div className="h-12 bg-base-300 rounded-2xl w-36" />
          <div className="w-10 h-10 bg-base-300 rounded-2xl" />
        </div>
        <div className="space-y-3 animate-pulse">
          <div className="bg-base-100 rounded-box border border-base-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-2.5 bg-base-300 rounded w-24" />
              <div className="h-5 bg-base-300 rounded-full w-20" />
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-base-300 rounded w-full" />
              <div className="h-4 bg-base-300 rounded w-5/6" />
              <div className="h-4 bg-base-300 rounded w-4/5" />
            </div>
          </div>
          <div className="bg-base-100 rounded-box border border-base-200 p-4 flex gap-3">
            <div className="w-10 h-10 rounded-full bg-base-300 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-base-300 rounded w-full" />
              <div className="h-3 bg-base-300 rounded w-3/4" />
            </div>
          </div>
          <div className="bg-base-100 rounded-box border border-base-200 overflow-hidden">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="px-5 py-3.5 border-b border-base-200 last:border-0 flex justify-between gap-4"
              >
                <div className="h-3 bg-base-300 rounded flex-1" />
                <div className="h-3 bg-base-300 rounded w-10 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Sub-components ----

function ScoreCircle({ score }: { score: number }) {
  const r = 16
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 65 ? "#68d391" : score >= 30 ? "#f6ad55" : "#a0aec0"

  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      className="shrink-0"
      role="img"
      aria-label={`Score ${score}`}
    >
      <title>Engagement score {score}</title>
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-base-300"
      />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
      />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="currentColor"
        className="fill-base-content"
      >
        {score}
      </text>
    </svg>
  )
}

function Avatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string | null
  avatarUrl: string | null
  size?: "sm" | "md"
}) {
  const letter = (name ?? "?")[0].toUpperCase()
  const cls = size === "sm" ? "w-8 h-8 text-xs" : "w-12 h-12 text-base"
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name ?? ""} className={`${cls} rounded-full object-cover`} />
  }
  return (
    <div
      className={`${cls} rounded-full bg-base-200 flex items-center justify-center text-base-content/50 font-bold`}
    >
      {letter}
    </div>
  )
}

function SentimentBar({
  sentiment,
}: {
  sentiment: { positive: number; neutral: number; negative: number }
}) {
  const { positive, neutral, negative } = sentiment
  return (
    <div className="space-y-1.5">
      <div className="flex h-1 rounded-full overflow-hidden gap-px">
        {positive > 0 && <div className="bg-success" style={{ width: `${positive}%` }} />}
        {neutral > 0 && <div className="bg-base-content/20" style={{ width: `${neutral}%` }} />}
        {negative > 0 && <div className="bg-error/60" style={{ width: `${negative}%` }} />}
      </div>
      <div className="flex gap-3 text-[11px] text-base-content/35">
        {positive > 0 && <span>{positive}% pos</span>}
        {neutral > 0 && <span>{neutral}% neu</span>}
        {negative > 0 && <span>{negative}% neg</span>}
      </div>
    </div>
  )
}

// ---- Tab bar ----

function TabBar({
  accounts,
  selectedId,
  onSelect,
}: {
  accounts: FeedAccount[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto pb-1"
      style={{ scrollbarWidth: "none" }}
    >
      {accounts.map((account) => {
        const active = account.id === selectedId
        return (
          <button
            key={account.id}
            type="button"
            onClick={() => onSelect(account.id)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl transition-colors shrink-0 ${
              active ? "bg-base-100 border border-base-200 shadow-sm" : "hover:bg-base-100/50"
            }`}
          >
            <Avatar name={account.name} avatarUrl={account.avatarUrl} size="sm" />
            <div className="text-left">
              <p
                className={`text-xs font-semibold leading-tight ${active ? "text-base-content" : "text-base-content/40"}`}
              >
                {account.name ?? account.handle}
              </p>
              <p
                className={`text-[10px] leading-tight ${active ? "text-base-content/40" : "text-base-content/25"}`}
              >
                {account.handle}
              </p>
            </div>
          </button>
        )
      })}
      <Link
        to="/settings"
        className="flex items-center justify-center w-10 h-10 rounded-2xl border border-dashed border-base-content/20 text-base-content/30 hover:text-base-content/50 hover:border-base-content/30 transition-colors shrink-0"
        aria-label="Add account"
      >
        <Plus size={14} />
      </Link>
    </div>
  )
}

// ---- Account view ----

const POSTS_PER_PAGE = 5

function AccountView({ account, scanning }: { account: FeedAccount; scanning: boolean }) {
  const [page, setPage] = useState(0)
  const { briefing, posts } = account
  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE)
  const pagePosts = posts.slice(page * POSTS_PER_PAGE, (page + 1) * POSTS_PER_PAGE)

  return (
    <div className="space-y-3">
      {/* AI Brief */}
      <div className="bg-base-100 rounded-box border border-base-200 p-5">
        {briefing ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <span
                className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary transition-opacity ${scanning ? "opacity-50" : ""}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full bg-primary ${scanning ? "animate-pulse" : ""}`}
                />
                AI Brief · Today
              </span>
              {briefing.mood && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-widest bg-base-200 text-base-content/50">
                  {briefing.mood}
                </span>
              )}
            </div>
            <p className="text-base font-semibold text-base-content leading-relaxed">
              {briefing.moment}
            </p>
          </>
        ) : (
          <AIBriefSkeleton />
        )}
      </div>

      {/* Score + top post reason */}
      {briefing?.topPostSummary && (
        <div className="bg-base-100 rounded-box border border-base-200 p-4 flex gap-3 items-center">
          <ScoreCircle score={briefing.engagementScore} />
          <p className="text-xs text-base-content/60 leading-relaxed">{briefing.topPostSummary}</p>
        </div>
      )}

      {/* Sentiment + themes */}
      {briefing && (briefing.sentiment || (briefing.themes && briefing.themes.length > 0)) && (
        <div className="space-y-2.5 px-1">
          {briefing.sentiment && <SentimentBar sentiment={briefing.sentiment} />}
          {briefing.themes && briefing.themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {briefing.themes.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-base-100 border border-base-200 text-base-content/40"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Posts */}
      {posts.length > 0 && (
        <div className="bg-base-100 rounded-box border border-base-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-base-200 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-base-content/30">
              Posts
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-xs text-base-content/40 hover:text-base-content/60 disabled:opacity-25 transition-colors"
                >
                  Prev
                </button>
                <span className="text-xs text-base-content/30 tabular-nums">
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page === totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-xs text-base-content/40 hover:text-base-content/60 disabled:opacity-25 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
          {pagePosts.map((post) => (
            <div
              key={post.id}
              className="px-5 py-3.5 border-b border-base-200 last:border-0 flex items-start justify-between gap-4"
            >
              <p className="text-sm text-base-content/70 leading-relaxed min-w-0">
                {post.text.length > 120 ? `${post.text.slice(0, 120)}…` : post.text}
              </p>
              <span className="text-sm text-base-content/30 tabular-nums shrink-0">
                {fmtNum(post.likes)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Your Move */}
      {briefing?.forYou && (
        <div className="bg-base-100 rounded-box border border-base-200 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-base-content/30 mb-3">
            Your Move
          </p>
          <p className="text-sm text-base-content/70 leading-relaxed">{briefing.forYou}</p>
        </div>
      )}
    </div>
  )
}

// ---- Page ----

type ScanStatus = "idle" | "scanning" | "done_new" | "done_same"

const THEME_ICON: Record<ThemePref, React.ReactNode> = {
  tweetsip: <Sun size={15} />,
  "tweetsip-dark": <Moon size={15} />,
  system: <Monitor size={15} />,
}

function FeedPage() {
  const loaderData = Route.useLoaderData()
  const queryClient = useQueryClient()
  const { pref, cycle } = useThemeStore()
  const [, startTransition] = useTransition()
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle")
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

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

  const selectedAccount = accounts.find((a) => a.id === selectedId) ?? accounts[0] ?? null

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

  const latestUpdate = accounts
    .map((a) => a.briefing?.generatedAt)
    .filter(Boolean)
    .sort()
    .at(-1)

  const scanning = scanStatus === "scanning"

  const subtitle = (() => {
    const n = accounts.length
    const base = `${n} ${n === 1 ? "account" : "accounts"}`
    if (scanning) return `${base} · fetching…`
    if (scanStatus === "done_new") return `${base} · briefings updated`
    if (scanStatus === "done_same") return `${base} · nothing new`
    return latestUpdate ? `${base} · updated ${timeAgo(latestUpdate)}` : base
  })()

  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-base-content tracking-tight">TweetSip</h1>
            <p className="text-xs text-base-content/50 mt-0.5">{subtitle}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={scanning}
              className="btn btn-ghost btn-square btn-sm text-base-content/40 hover:text-base-content"
              aria-label="Refresh feed"
            >
              <RefreshCw size={14} className={scanning || isFetching ? "animate-spin" : ""} />
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
              <Settings size={14} />
            </Link>
          </div>
        </div>

        {/* Tab bar */}
        {accounts.length > 0 && (
          <TabBar
            accounts={accounts}
            selectedId={selectedAccount?.id ?? null}
            onSelect={setSelectedId}
          />
        )}

        {/* Account view */}
        {selectedAccount ? (
          <div className="mt-4">
            <AccountView key={selectedAccount.id} account={selectedAccount} scanning={scanning} />
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-sm text-base-content/40 mb-4">No accounts yet.</p>
            <Link to="/settings" className="btn btn-neutral btn-sm">
              Add your first account
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
