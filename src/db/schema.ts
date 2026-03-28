import { relations, sql } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

// ---- Better Auth tables ----

export const magicLink = sqliteTable("magic_link", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
})

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
  image: text("image"),
  timezone: text("timezone").default("UTC"),
  notificationFrequency: text("notification_frequency", {
    enum: ["daily", "weekly", "never"],
  }).default("daily"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
  lastFetchAt: integer("last_fetch_at", { mode: "timestamp_ms" }),
})

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
)

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
)

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
)

// ---- App tables ----

export const trackedAccounts = sqliteTable("tracked_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  handle: text("handle").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  xUserId: text("x_user_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
})

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => trackedAccounts.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  likes: integer("likes").default(0),
  reposts: integer("reposts").default(0),
  replies: integer("replies").default(0),
  postedAt: integer("posted_at", { mode: "timestamp_ms" }),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
})

export const briefings = sqliteTable("briefings", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => trackedAccounts.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  moment: text("moment"),
  topPostSummary: text("top_post_summary"),
  forYou: text("for_you"),
  engagementScore: integer("engagement_score").default(0),
  mood: text("mood"),
  sentiment: text("sentiment"), // JSON: {"positive":n,"neutral":n,"negative":n}
  themes: text("themes"), // JSON: string[]
  highlights: text("highlights"), // JSON: [{emoji,text,tone}]
  postsHash: text("posts_hash"),
  generatedAt: integer("generated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
})

export const demoUsage = sqliteTable("demo_usage", {
  date: text("date").primaryKey(),
  count: integer("count").default(0),
})

// ---- Relations ----

export const trackedAccountsRelations = relations(trackedAccounts, ({ many }) => ({
  posts: many(posts),
  briefings: many(briefings),
}))

export const postsRelations = relations(posts, ({ one }) => ({
  account: one(trackedAccounts, { fields: [posts.accountId], references: [trackedAccounts.id] }),
}))

export const briefingsRelations = relations(briefings, ({ one }) => ({
  account: one(trackedAccounts, {
    fields: [briefings.accountId],
    references: [trackedAccounts.id],
  }),
}))

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").references(() => trackedAccounts.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["daily_digest", "strong_signal", "silence_alert"],
  }).notNull(),
  sentAt: integer("sent_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
})
