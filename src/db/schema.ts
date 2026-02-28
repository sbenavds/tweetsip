import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Users
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  timezone: text("timezone").default("UTC"),
  notificationFrequency: text("notification_frequency", {
    enum: ["daily", "weekly", "never"],
  }).default("daily"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

// Accounts to track
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  handle: text("handle").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  xUserId: text("x_user_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

// Posts fetched from X
export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  likes: integer("likes").default(0),
  reposts: integer("reposts").default(0),
  replies: integer("replies").default(0),
  postedAt: integer("posted_at", { mode: "timestamp" }),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

// AI generated briefings
export const briefings = sqliteTable("briefings", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  moment: text("moment"),
  topPostSummary: text("top_post_summary"),
  forYou: text("for_you"),
  engagementScore: integer("engagement_score").default(0),
  generatedAt: integer("generated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

// Notifications sent
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["daily_digest", "strong_signal", "silence_alert"],
  }).notNull(),
  sentAt: integer("sent_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});
