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
  hot: "Moving",
  pivot: "Shifting",
  silence: "Silence",
}

const STATUS_COLOR: Record<string, string> = {
  hot: "text-success",
  pivot: "text-warning",
  silence: "text-base-content/40",
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
          <div className="h-2 bg-base-300 rounded w-16" />
          <div className="h-3 bg-base-300 rounded w-full" />
          <div className="h-3 bg-base-300 rounded w-3/4" />
        </div>
      </div>
      <div className="bg-base-200/60 rounded-xl p-4">
        <div className="h-3 bg-base-300 rounded w-full" />
        <div className="h-3 bg-base-300 rounded w-2/3 mt-2" />
      </div>
    </div>
  )
}

function AccountCardSkeleton() {
  return (
    <div className="bg-base-100 rounded-box shadow-sm border border-base-200 overflow-hidden animate-pulse">
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
        <div className="flex items-start justify-between mb-2">
          <div className="space-y-2 animate-pulse">
            <div className="h-7 bg-base-300 rounded w-28" />
            <div className="h-3 bg-base-300 rounded w-24" />
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
    <span className={`flex items-center gap-1 text-xs font-semibold ${STATUS_COLOR[s]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
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
    <div className="w-11 h-11 rounded-full bg-base-200 flex items-center justify-center text-base-content/60 font-bold text-base">
      {letter}
    </div>
  )
}

function PostRow({ text, likes }: { text: string; likes: number }) {
  const truncated = text.length > 60 ? `${text.slice(0, 60)}...` : text
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-base-200 last:border-0">
      <div className="flex items-start gap-2 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-base-300 mt-1.5 shrink-0" />
        <span className="text-xs text-base-content/70 leading-relaxed">{truncated}</span>
      </div>
      <span className="text-xs text-base-content/40 shrink-0 font-medium">{fmtLikes(likes)}</span>
    </div>
  )
}

function AccountCard({ account }: { account: FeedAccount }) {
  const [expanded, setExpanded] = useState(false)
  const { briefing, posts } = account
  const score = briefing?.engagementScore ?? null

  return (
    <div className="bg-base-100 rounded-box shadow-sm border border-base-200 overflow-hidden">
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={account.name} avatarUrl={account.avatarUrl} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base-content leading-tight truncate">
              {account.name ?? account.handle}
            </p>
            <p className="text-xs text-base-content/40">{account.handle}</p>
          </div>
          <StatusBadge score={score} />
        </div>

        {briefing ? (
          <>
            <p className="text-sm text-base-content leading-relaxed">{briefing.moment}</p>
            {briefing.topPostSummary && (
              <div className="bg-base-200 rounded-xl p-4 flex gap-3">
                <ScoreCircle score={briefing.engagementScore} />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-base-content/40 tracking-widest uppercase mb-1">
                    Top post
                  </p>
                  <p className="text-xs text-base-content/80 leading-relaxed">
                    {briefing.topPostSummary}
                  </p>
                </div>
              </div>
            )}
            {briefing.forYou && (
              <div className="bg-base-200/60 rounded-xl p-4 flex gap-2">
                <span className="text-base-content/40 text-sm mt-0.5">→</span>
                <p className="text-sm text-base-content/80 leading-relaxed">{briefing.forYou}</p>
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
          <span className="font-bold uppercase tracking-widest">{posts.length} posts</span>
          <span className="flex items-center gap-1">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? "close" : "view"}
          </span>
        </button>
      )}

      {expanded && posts.length > 0 && (
        <div className="px-5 pb-4">
          {posts.map((p) => (
            <PostRow key={p.id} text={p.text} likes={p.likes} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Scan status banner ----

type ScanStatus = "idle" | "scanning" | "done_new" | "done_same"

function ScanBanner({ status }: { status: ScanStatus }) {
  if (status === "idle") return null
  return (
    <div className="flex items-center gap-2 text-xs text-base-content/50 transition-all">
      {status === "scanning" && <RefreshCw size={11} className="animate-spin shrink-0" />}
      {status === "scanning" && "Sipping fresh intel…"}
      {status === "done_new" && (
        <>
          <span className="text-success">✦</span> Briefings updated
        </>
      )}
      {status === "done_same" && "All caught up · nothing new"}
    </div>
  )
}

// ---- Page ----

const THEME_ICON: Record<ThemePref, React.ReactNode> = {
  tweetsip: <Sun size={15} />,
  "tweetsip-dark": <Moon size={15} />,
  system: <Monitor size={15} />,
}

function FeedPage() {
  const loaderData = Route.useLoaderData()
  const queryClient = useQueryClient()
  const { pref, cycle } = useThemeStore()
  const [isPending, startTransition] = useTransition()
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

  // Auto-dismiss done states after 3s, and timeout scanning after 45s
  useEffect(() => {
    if (scanStatus === "idle") return
    const timeout = scanStatus === "scanning" ? 45000 : 3000
    const timer = setTimeout(() => {
      setScanStatus("idle")
      setRefreshedAt(null)
    }, timeout)
    return () => clearTimeout(timer)
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

  const topInsight = accounts
    .filter((a) => a.briefing?.forYou)
    .sort((a, b) => (b.briefing?.engagementScore ?? 0) - (a.briefing?.engagementScore ?? 0))
    .at(0)?.briefing?.forYou

  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-extrabold text-base-content tracking-tight">TweetSip</h1>
            <p className="text-xs text-base-content/40 mt-0.5">
              {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
              {latestUpdate ? ` · updated ${timeAgo(latestUpdate)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isPending || scanStatus === "scanning"}
              className="btn btn-ghost btn-square btn-sm text-base-content/50 hover:text-base-content"
              aria-label="Refresh feed"
            >
              <RefreshCw
                size={15}
                className={scanStatus === "scanning" || isFetching ? "animate-spin" : ""}
              />
            </button>
            <button
              type="button"
              onClick={cycle}
              className="btn btn-ghost btn-square btn-sm text-base-content/50 hover:text-base-content"
              aria-label="Toggle theme"
            >
              {THEME_ICON[pref]}
            </button>
            <Link
              to="/settings"
              className="btn btn-ghost btn-square btn-sm text-base-content/50 hover:text-base-content"
              aria-label="Settings"
            >
              <Settings size={15} />
            </Link>
          </div>
        </div>

        {/* Scan status banner */}
        <ScanBanner status={scanStatus} />

        {/* Global insight */}
        {topInsight && scanStatus === "idle" && (
          <div className="bg-base-100 rounded-box border border-base-200 px-4 py-3">
            <p className="text-sm text-base-content/60 italic">◇ {topInsight}</p>
          </div>
        )}

        {/* Cards */}
        {accounts.map((account) => (
          <AccountCard key={account.id} account={account} />
        ))}
      </div>
    </div>
  )
}
