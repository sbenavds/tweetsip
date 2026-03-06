import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { ChevronDown, ChevronUp, Monitor, Moon, RefreshCw, Settings, Sun } from "lucide-react"
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

function fmtLikes(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)
}

function getStatus(score: number | null): "hot" | "pivot" | "silence" {
  if (!score || score < 30) return "silence"
  if (score < 65) return "pivot"
  return "hot"
}

const STATUS_LABEL: Record<string, string> = {
  hot: "Active",
  pivot: "Shifting",
  silence: "Quiet",
}

const STATUS_COLOR: Record<string, string> = {
  hot: "text-success",
  pivot: "text-warning",
  silence: "text-base-content/30",
}

// ---- Skeletons ----

function BriefingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 bg-base-300 rounded w-full" />
        <div className="h-3 bg-base-300 rounded w-4/5" />
      </div>
      <div className="bg-base-200 rounded-xl p-4 flex gap-3">
        <div className="w-10 h-10 rounded-full bg-base-300 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-base-300 rounded w-full" />
          <div className="h-3 bg-base-300 rounded w-3/4" />
        </div>
      </div>
      <div className="border-l-2 border-base-300 pl-3 space-y-2">
        <div className="h-3 bg-base-300 rounded w-full" />
        <div className="h-3 bg-base-300 rounded w-2/3" />
      </div>
    </div>
  )
}

function AccountCardSkeleton() {
  return (
    <div className="bg-base-100 rounded-box border border-base-200 overflow-hidden animate-pulse">
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-base-300 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-base-300 rounded w-32" />
            <div className="h-3 bg-base-300 rounded w-20" />
          </div>
          <div className="h-3 bg-base-300 rounded w-14" />
        </div>
        <BriefingSkeleton />
      </div>
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1.5 animate-pulse">
            <div className="h-6 bg-base-300 rounded w-24" />
            <div className="h-3 bg-base-300 rounded w-32" />
          </div>
          <div className="flex gap-2 animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-8 h-8 bg-base-300 rounded" />
            ))}
          </div>
        </div>
        <AccountCardSkeleton />
        <AccountCardSkeleton />
        <AccountCardSkeleton />
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

function StatusBadge({ score }: { score: number | null }) {
  const s = getStatus(score)
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${STATUS_COLOR[s]}`}>
      <span className="w-2 h-2 rounded-full bg-current shrink-0" />
      {STATUS_LABEL[s]}
    </span>
  )
}

function Avatar({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  const letter = (name ?? "?")[0].toUpperCase()
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name ?? ""} className="w-11 h-11 rounded-full object-cover" />
  }
  return (
    <div className="w-11 h-11 rounded-full bg-base-200 flex items-center justify-center text-base-content/50 font-bold text-base">
      {letter}
    </div>
  )
}

function PostRow({ text, likes }: { text: string; likes: number }) {
  const truncated = text.length > 60 ? `${text.slice(0, 60)}…` : text
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-base-200 last:border-0">
      <span className="text-xs text-base-content/60 leading-relaxed min-w-0">{truncated}</span>
      <span className="text-xs text-base-content/35 shrink-0 tabular-nums">{fmtLikes(likes)}</span>
    </div>
  )
}

function AccountCard({ account }: { account: FeedAccount }) {
  const [expanded, setExpanded] = useState(false)
  const { briefing, posts } = account
  const score = briefing?.engagementScore ?? null

  return (
    <div className="bg-base-100 rounded-box border border-base-200 overflow-hidden">
      {/* Status accent — only for hot accounts */}

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Avatar name={account.name} avatarUrl={account.avatarUrl} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base-content leading-tight truncate">
              {account.name ?? account.handle}
            </p>
            <p className="text-xs text-base-content/40 mt-0.5">{account.handle}</p>
          </div>
          <StatusBadge score={score} />
        </div>

        {briefing ? (
          <>
            {/* Moment — primary content */}
            <p className="text-sm text-base-content/80 leading-relaxed">{briefing.moment}</p>

            {/* Top post — score anchors the block visually */}
            {briefing.topPostSummary && (
              <div className="bg-base-200 rounded-xl p-4 flex gap-3 items-center">
                <ScoreCircle score={briefing.engagementScore} />
                <p className="text-xs text-base-content/70 leading-relaxed">
                  {briefing.topPostSummary}
                </p>
              </div>
            )}

            {/* For you — editorial left rule, no background */}
            {briefing.forYou && (
              <div className="border-l-2 border-base-content/15 pl-3">
                <p className="text-sm text-base-content/60 leading-relaxed">{briefing.forYou}</p>
              </div>
            )}
          </>
        ) : (
          <BriefingSkeleton />
        )}
      </div>

      {posts.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full px-5 py-3 border-t border-base-200 text-xs text-base-content/40 hover:text-base-content/60 transition-colors flex items-center justify-between"
        >
          <span>{posts.length} posts</span>
          <span className="flex items-center gap-1">
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? "close" : "view"}
          </span>
        </button>
      )}

      {expanded && posts.length > 0 && (
        <div className="px-5 pt-1 pb-4">
          {posts.map((p) => (
            <PostRow key={p.id} text={p.text} likes={p.likes} />
          ))}
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

  // Detect new briefings after manual refresh
  useEffect(() => {
    if (scanStatus !== "scanning" || isFetching || !refreshedAt) return
    const hasNew = accounts.some(
      (a) => a.briefing?.generatedAt && new Date(a.briefing.generatedAt).getTime() > refreshedAt
    )
    if (!hasNew) return
    setScanStatus("done_new")
    setRefreshedAt(null)
  }, [accounts, isFetching, scanStatus, refreshedAt])

  // Auto-dismiss done states after 3s; timeout scanning after 45s
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

  // Scan status flows through the subtitle — no separate element needed
  const subtitle = (() => {
    const n = accounts.length
    const base = `${n} ${n === 1 ? "account" : "accounts"}`
    if (scanStatus === "scanning") return `${base} · sipping fresh intel…`
    if (scanStatus === "done_new") return `${base} · briefings updated`
    if (scanStatus === "done_same") return `${base} · nothing new`
    return latestUpdate ? `${base} · updated ${timeAgo(latestUpdate)}` : base
  })()

  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-4">
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
              disabled={scanStatus === "scanning"}
              className="btn btn-ghost btn-square btn-sm text-base-content/40 hover:text-base-content"
              aria-label="Refresh feed"
            >
              <RefreshCw
                size={14}
                className={scanStatus === "scanning" || isFetching ? "animate-spin" : ""}
              />
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

        {/* Cards */}
        {accounts.map((account) => (
          <AccountCard key={account.id} account={account} />
        ))}
      </div>
    </div>
  )
}
