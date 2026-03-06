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

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
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
    <div className="space-y-3 animate-pulse">
      <div className="h-2 bg-base-300 rounded w-28" />
      <div className="space-y-1.5">
        <div className="h-3 bg-base-300 rounded w-full" />
        <div className="h-3 bg-base-300 rounded w-5/6" />
        <div className="h-3 bg-base-300 rounded w-4/5" />
      </div>
      <div className="bg-base-200 rounded-xl p-4 flex gap-3">
        <div className="w-10 h-10 rounded-full bg-base-300 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-base-300 rounded w-full" />
          <div className="h-3 bg-base-300 rounded w-3/4" />
        </div>
      </div>
      <div className="h-1.5 bg-base-300 rounded-full w-full" />
      <div className="flex gap-1.5">
        <div className="h-5 bg-base-300 rounded-full w-20" />
        <div className="h-5 bg-base-300 rounded-full w-16" />
        <div className="h-5 bg-base-300 rounded-full w-24" />
      </div>
    </div>
  )
}

function AccountCardSkeleton() {
  return (
    <div className="bg-base-100 rounded-box border border-base-200 overflow-hidden animate-pulse">
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-base-300 shrink-0" />
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
    return <img src={avatarUrl} alt={name ?? ""} className="w-12 h-12 rounded-full object-cover" />
  }
  return (
    <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center text-base-content/50 font-bold text-base">
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
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        {positive > 0 && (
          <div className="bg-success rounded-l-full" style={{ width: `${positive}%` }} />
        )}
        {neutral > 0 && <div className="bg-base-content/20" style={{ width: `${neutral}%` }} />}
        {negative > 0 && (
          <div className="bg-error/60 rounded-r-full" style={{ width: `${negative}%` }} />
        )}
      </div>
      <div className="flex gap-3 text-[11px] text-base-content/40">
        {positive > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
            {positive}% pos
          </span>
        )}
        {neutral > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-base-content/20 inline-block" />
            {neutral}% neu
          </span>
        )}
        {negative > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-error/60 inline-block" />
            {negative}% neg
          </span>
        )}
      </div>
    </div>
  )
}

function PostCard({
  post,
}: {
  post: { id: string; text: string; likes: number; reposts: number; postedAt: string | null }
}) {
  const truncated = post.text.length > 100 ? `${post.text.slice(0, 100)}…` : post.text
  return (
    <div className="bg-base-100 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
      <p className="text-xs text-base-content/70 leading-relaxed min-w-0">{truncated}</p>
      <div className="shrink-0 text-right space-y-0.5">
        <p className="text-xs text-base-content/40 tabular-nums">{fmtNum(post.likes)}</p>
        {post.reposts > 0 && (
          <p className="text-[10px] text-base-content/25 tabular-nums">{fmtNum(post.reposts)} rt</p>
        )}
      </div>
    </div>
  )
}

function AccountCard({ account, scanning }: { account: FeedAccount; scanning: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const { briefing, posts } = account

  return (
    <div className="bg-base-100 rounded-box border border-base-200 overflow-hidden">
      {/* Scanning indicator */}
      {scanning && briefing && <div className="h-px bg-base-content/10 animate-pulse" />}

      {/* Header */}
      <div className="p-5 pb-4 flex items-center gap-3">
        <Avatar name={account.name} avatarUrl={account.avatarUrl} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base-content leading-tight truncate">
            {account.name ?? account.handle}
          </p>
          <p className="text-xs text-base-content/40 mt-0.5">{account.handle}</p>
        </div>
        <StatusBadge score={briefing?.engagementScore ?? null} />
      </div>

      {/* Briefing body */}
      <div className="px-5 pb-5 space-y-3">
        {briefing ? (
          <>
            {/* Mood */}
            {briefing.mood && (
              <p className="text-[11px] font-semibold uppercase tracking-widest text-base-content/30">
                {briefing.mood}
              </p>
            )}

            {/* Moment — primary narrative */}
            <p className="text-sm text-base-content/80 leading-relaxed">{briefing.moment}</p>

            {/* Score + top post */}
            {briefing.topPostSummary && (
              <div className="bg-base-200 rounded-xl p-4 flex gap-3 items-start">
                <ScoreCircle score={briefing.engagementScore} />
                <p className="text-xs text-base-content/60 leading-relaxed pt-0.5">
                  {briefing.topPostSummary}
                </p>
              </div>
            )}

            {/* Sentiment bar */}
            {briefing.sentiment && <SentimentBar sentiment={briefing.sentiment} />}

            {/* Theme tags */}
            {briefing.themes && briefing.themes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {briefing.themes.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-base-200 text-base-content/50"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* For you */}
            {briefing.forYou && (
              <div className="border-l-2 border-base-content/15 pl-3">
                <p className="text-xs text-base-content/50 leading-relaxed">{briefing.forYou}</p>
              </div>
            )}
          </>
        ) : (
          <BriefingSkeleton />
        )}
      </div>

      {/* Posts toggle */}
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

      {/* Posts expanded — sunken tray with elevated cards */}
      {expanded && posts.length > 0 && (
        <div className="bg-base-200/60 px-3 pt-2 pb-3 space-y-2">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
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

  // Auto-dismiss done states; timeout scanning after 45s
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

  const subtitle = (() => {
    const n = accounts.length
    const base = `${n} ${n === 1 ? "account" : "accounts"}`
    if (scanStatus === "scanning") return `${base} · fetching…`
    if (scanStatus === "done_new") return `${base} · briefings updated`
    if (scanStatus === "done_same") return `${base} · nothing new`
    return latestUpdate ? `${base} · updated ${timeAgo(latestUpdate)}` : base
  })()

  const scanning = scanStatus === "scanning"

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

        {/* Cards */}
        {accounts.map((account) => (
          <AccountCard key={account.id} account={account} scanning={scanning} />
        ))}
      </div>
    </div>
  )
}
