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

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewState = { type: "sip"; filterId: string | null } | { type: "insights"; accountId: string }

type Highlight = { emoji: string; text: string; tone: "positive" | "notable" | "warning" }

// ── Design tokens ─────────────────────────────────────────────────────────────
// Theme-adaptive colors use CSS vars; accent colors are hardcoded per reference.

const T = {
  surface: "var(--color-base-100)",
  bg: "var(--color-base-200)",
  text: "var(--color-base-content)",
  sub: "color-mix(in srgb, var(--color-base-content) 60%, transparent)",
  muted: "color-mix(in srgb, var(--color-base-content) 38%, transparent)",
  divider: "color-mix(in srgb, var(--color-base-content) 7%, transparent)",
  nav: "rgba(242,244,248,0.96)",
  blue: "#2563eb",
  // Insight card tokens
  greenBg: "#f0fdf4",
  greenBorder: "#bbf7d0",
  greenText: "#15803d",
  blueBg: "#f1f5ff",
  blueBorder: "#c7d7fd",
  blueText: "#2563eb",
  redBg: "#fef2f2",
  redBorder: "#fecaca",
  redText: "#dc2626",
  // Your Move tokens
  amberBg: "#fffbeb",
  amberBorder: "#fde68a",
  amberLabel: "#b45309",
  amberBody: "#92400e",
  amberIcon: "#fef3c7",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

function handle(raw: string): string {
  return raw.startsWith("@") ? raw : `@${raw}`
}

const AVATAR_PALETTE = [
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
  return AVATAR_PALETTE[v % AVATAR_PALETTE.length]
}

function todaysThread(accounts: FeedAccount[]): string | null {
  const briefed = accounts.filter((a) => a.briefing)
  if (briefed.length === 0) return null
  const themes = [...new Set(briefed.flatMap((a) => a.briefing?.themes ?? []))].slice(0, 4)
  if (themes.length >= 2) {
    return `${briefed.length} ${briefed.length === 1 ? "account" : "accounts"} covered today. Topics span: ${themes.join(", ")}.`
  }
  return briefed[0].briefing?.moment ?? null
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function AvatarCircle({ account, size }: { account: FeedAccount; size: number }) {
  const letter = (account.name ?? account.handle)[0].toUpperCase()
  const grad = avatarGrad(account.handle)
  if (account.avatarUrl) {
    return (
      <img
        src={account.avatarUrl}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          display: "block",
          objectFit: "cover",
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: grad,
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
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-2xl mx-auto px-5 pt-24 pb-10 animate-pulse space-y-5">
        <div className="h-3 bg-base-300 rounded w-40" />
        <div className="h-9 bg-base-300 rounded w-52" />
        <div className="h-20 bg-base-100 rounded-2xl" />
        <div className="bg-base-100 rounded-2xl h-56" />
      </div>
    </div>
  )
}

// ── Top bar ───────────────────────────────────────────────────────────────────

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
    <div
      style={{
        borderBottom: `1px solid ${T.divider}`,
        padding: "12px 0",
      }}
    >
      <div
        style={{
          maxWidth: 580,
          margin: "0 auto",
          padding: "0 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "'Playfair Display', serif",
            letterSpacing: "-0.02em",
            color: T.text,
          }}
        >
          TweetSip
        </span>
        <div style={{ display: "flex", gap: 5 }}>
          <button
            type="button"
            onClick={onRefresh}
            disabled={scanning}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: `1px solid ${T.divider}`,
              background: "transparent",
              color: T.muted,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Refresh"
          >
            <RefreshCw size={13} className={scanning || isFetching ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={cycle}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: `1px solid ${T.divider}`,
              background: "transparent",
              color: T.muted,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Toggle theme"
          >
            {THEME_ICON[pref]}
          </button>
          <Link
            to="/settings"
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: `1px solid ${T.divider}`,
              background: "transparent",
              color: T.muted,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Settings"
          >
            <Settings size={13} />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

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
    <div style={{ borderBottom: `1px solid ${T.divider}` }}>
      <div
        style={{
          maxWidth: 580,
          margin: "0 auto",
          padding: "0 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* The Sip tab */}
        <button
          type="button"
          onClick={onSip}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "11px 0",
            background: "none",
            border: "none",
            cursor: "pointer",
            borderBottom: sipActive ? `2px solid ${T.text}` : "2px solid transparent",
            marginBottom: -1,
            transition: "border-color 0.15s",
          }}
        >
          <span style={{ fontSize: 13 }}>☕</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: sipActive ? 600 : 400,
              color: sipActive ? T.text : T.muted,
            }}
          >
            The Sip
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              background: sipActive ? T.text : T.divider,
              color: sipActive ? "var(--color-base-100)" : T.muted,
              padding: "1px 6px",
              borderRadius: 99,
              transition: "all 0.15s",
            }}
          >
            {accounts.length}
          </span>
        </button>

        {/* Account tab — only in insights view, pushed to far right */}
        {insightsAccount && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "11px 0",
              borderBottom: `2px solid ${T.text}`,
              marginBottom: -1,
            }}
          >
            <AvatarCircle account={insightsAccount} size={18} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: "nowrap" }}>
              {handle(insightsAccount.handle)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Avatar strip ──────────────────────────────────────────────────────────────

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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 20px",
        borderBottom: `1px solid ${T.divider}`,
      }}
    >
      {/* All — wide, slight rounded corners */}
      <button
        type="button"
        onClick={() => onFilter(null)}
        style={{
          padding: "6px 20px",
          borderRadius: 8,
          flexShrink: 0,
          border: "none",
          cursor: "pointer",
          transition: "all 0.15s",
          background: filterId === null ? T.text : T.bg,
          color: filterId === null ? "var(--color-base-100)" : T.muted,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        All
      </button>

      {/* Spacer pushes avatars to the right */}
      <div style={{ flex: 1 }} />

      {/* Account avatars — far right */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {accounts.map((a) => {
          const active = filterId === a.id
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onFilter(active ? null : a.id)}
              title={handle(a.handle)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0 3px",
                flexShrink: 0,
                opacity: filterId !== null && !active ? 0.3 : 1,
                transition: "opacity 0.15s",
              }}
            >
              <div
                style={{
                  outline: active ? `2.5px solid ${T.text}` : "2.5px solid transparent",
                  outlineOffset: 2,
                  borderRadius: "50%",
                  transition: "outline 0.15s",
                  lineHeight: 0,
                }}
              >
                <AvatarCircle account={a} size={32} />
              </div>
              <span
                style={{
                  fontSize: 9,
                  color: active ? T.text : T.muted,
                  fontWeight: active ? 600 : 400,
                  maxWidth: 44,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {a.handle.replace("@", "")}
              </span>
            </button>
          )
        })}

        {/* Separator */}
        <div
          style={{
            width: 1,
            height: 20,
            background: T.divider,
            flexShrink: 0,
            marginLeft: 4,
            alignSelf: "center",
          }}
        />

        {/* Add account */}
        <Link
          to="/settings"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            flexShrink: 0,
            border: `1.5px dashed ${T.divider}`,
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: T.muted,
            fontSize: 15,
            alignSelf: "flex-start",
          }}
          aria-label="Add account"
        >
          +
        </Link>
      </div>
    </div>
  )
}

// ── Sip view ──────────────────────────────────────────────────────────────────

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
    <div>
      {/* Date + greeting */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 10,
            color: T.muted,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontWeight: 500,
            marginBottom: 3,
          }}
        >
          {dateLabel()} · Daily Sip
        </div>
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: T.text,
          }}
        >
          {greeting()} ☕
        </div>
      </div>

      {/* Today's Thread */}
      {thread && (
        <div
          style={{
            background: T.surface,
            borderRadius: 14,
            padding: "14px 18px",
            marginBottom: 12,
            borderLeft: `3px solid ${T.blue}`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: T.blue,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 5,
            }}
          >
            Today's thread
          </div>
          <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.6, margin: 0 }}>{thread}</p>
        </div>
      )}

      {/* Single feed panel */}
      {accounts.length > 0 ? (
        <div style={{ background: T.surface, borderRadius: 16, overflow: "hidden" }}>
          <AvatarStrip accounts={accounts} filterId={filterId} onFilter={onFilter} />
          {visible.map((a, i) => (
            <div
              key={a.id}
              style={{
                borderBottom: i === visible.length - 1 ? "none" : `1px solid ${T.divider}`,
                padding: "20px 20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                  {handle(a.handle)}
                </span>
                {a.briefing && (
                  <span
                    style={{
                      fontSize: 10,
                      color: T.muted,
                      background: T.bg,
                      padding: "2px 8px",
                      borderRadius: 99,
                    }}
                  >
                    AI Summary
                  </span>
                )}
              </div>
              {a.briefing?.moment ? (
                <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.65, margin: "0 0 12px" }}>
                  {a.briefing.moment}
                </p>
              ) : (
                <p
                  style={{
                    fontSize: 13,
                    color: T.muted,
                    fontStyle: "italic",
                    margin: "0 0 12px",
                  }}
                >
                  Briefing pending…
                </p>
              )}
              {a.briefing && (
                <button
                  type="button"
                  onClick={() => onReadThread(a.id)}
                  style={{
                    fontSize: 12,
                    color: T.blue,
                    fontWeight: 600,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Read thread →
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            background: T.surface,
            borderRadius: 16,
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>No accounts tracked yet.</p>
          <Link to="/settings" className="btn btn-neutral btn-sm">
            Add your first account
          </Link>
        </div>
      )}

      {accounts.length > 0 && (
        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: T.muted,
            marginTop: 28,
            fontStyle: "italic",
          }}
        >
          "Curated by TweetSip AI. Stay informed, stay focused."
        </p>
      )}
    </div>
  )
}

// ── Post row ──────────────────────────────────────────────────────────────────

function PostRow({ post, isLast }: { post: FeedAccount["posts"][number]; isLast: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-only visual feedback row
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "11px 20px",
        gap: 16,
        borderBottom: isLast ? "none" : `1px solid ${T.divider}`,
        background: hov
          ? "color-mix(in srgb, var(--color-base-content) 3%, transparent)"
          : "transparent",
        transition: "background 0.1s",
      }}
    >
      <p
        style={{
          fontSize: 13,
          color: T.sub,
          margin: 0,
          lineHeight: 1.5,
          flex: 1,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {post.text}
      </p>
      <span
        style={{
          fontSize: 12,
          fontFamily: "'DM Mono', monospace",
          color: T.muted,
          flexShrink: 0,
        }}
      >
        {fmtNum(post.likes)}
      </span>
    </div>
  )
}

// ── Insights view ─────────────────────────────────────────────────────────────

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

  const toneStyle: Record<Highlight["tone"], { bg: string; border: string; color: string }> = {
    positive: { bg: T.greenBg, border: `1px solid ${T.greenBorder}`, color: T.greenText },
    notable: { bg: T.blueBg, border: `1px solid ${T.blueBorder}`, color: T.blueText },
    warning: { bg: T.redBg, border: `1px solid ${T.redBorder}`, color: T.redText },
  }

  return (
    <div>
      {/* Account header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <AvatarCircle account={account} size={36} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
            {account.name ?? account.handle}
          </div>
          <div style={{ fontSize: 11, color: T.muted }}>
            {handle(account.handle)}
            {posts.length > 0 && ` · ${posts.length} posts today`}
          </div>
        </div>
      </div>

      {/* Summary card */}
      {briefing && (
        <div
          style={{
            background: T.surface,
            borderRadius: 16,
            marginBottom: 10,
            padding: "22px 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: scanning ? "#9ca3af" : "#22c55e",
                  transition: "background 0.3s",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: T.muted,
                  fontWeight: 600,
                }}
              >
                Summary
              </span>
            </div>
            {moods.length > 0 && (
              <span
                style={{
                  fontSize: 10,
                  color: T.sub,
                  background: T.bg,
                  padding: "3px 10px",
                  borderRadius: 99,
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                {moods.join(" · ")}
              </span>
            )}
          </div>
          <p
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 19,
              lineHeight: 1.45,
              fontWeight: 700,
              color: T.text,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {briefing.moment}
          </p>
        </div>
      )}

      {/* What Stood Out */}
      <div
        style={{
          background: T.surface,
          borderRadius: 16,
          marginBottom: 10,
          padding: "20px 20px 12px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: T.muted,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: 13,
          }}
        >
          What stood out
        </div>
        {highlights.length > 0 ? (
          highlights.map((h, i) => (
            <div
              key={`${h.tone}-${i}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 13px",
                borderRadius: 11,
                background: toneStyle[h.tone].bg,
                border: toneStyle[h.tone].border,
                marginBottom: 7,
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>
                {h.emoji}
              </span>
              <span style={{ fontSize: 13, color: toneStyle[h.tone].color, lineHeight: 1.55 }}>
                {h.text}
              </span>
            </div>
          ))
        ) : (
          <p style={{ fontSize: 12, color: T.muted, fontStyle: "italic", margin: 0 }}>
            Highlights will appear after the next briefing is generated.
          </p>
        )}
      </div>

      {/* Top Posts Today */}
      {posts.length > 0 && (
        <div
          style={{
            background: T.surface,
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              padding: "13px 20px 11px",
              borderBottom: `1px solid ${T.divider}`,
            }}
          >
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.muted,
                fontWeight: 600,
              }}
            >
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
        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${T.amberBorder}`,
            background: T.amberBg,
            padding: "18px 20px",
            display: "flex",
            alignItems: "flex-start",
            gap: 13,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: T.amberIcon,
              border: `1px solid ${T.amberBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            ⚡
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.amberLabel,
                fontWeight: 600,
                marginBottom: 5,
              }}
            >
              Your move
            </div>
            <p style={{ fontSize: 13, color: T.amberBody, lineHeight: 1.6, margin: 0 }}>
              {briefing.forYou}
            </p>
          </div>
        </div>
      )}

      {/* Back */}
      <button
        type="button"
        onClick={onBack}
        style={{
          fontSize: 12,
          color: T.muted,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "8px 0 24px",
          display: "block",
        }}
      >
        ← Back to The Sip
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Sticky nav shell */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: T.nav,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <TopBar scanning={scanning} isFetching={isFetching} onRefresh={handleRefresh} />
        <TabBar
          accounts={accounts}
          view={view}
          onSip={() => setView({ type: "sip", filterId: null })}
        />
      </div>

      {/* Content */}
      <div style={{ maxWidth: 580, margin: "0 auto", padding: "24px 18px 0" }}>
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
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <button
              type="button"
              onClick={() => setView({ type: "sip", filterId: null })}
              style={{
                fontSize: 13,
                color: T.muted,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              ← Back to feed
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
