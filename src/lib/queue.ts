import { z } from "zod";

const jobSchemas = {
  FETCH_ACCOUNT: z.object({
    accountId: z.string(),
    handle: z.string(),
  }),
  GENERATE_BRIEFING: z.object({
    accountId: z.string(),
    userId: z.string(),
  }),
  SEND_NOTIFICATION: z.object({
    userId: z.string(),
    notificationType: z.enum(["daily_digest", "strong_signal", "silence_alert"]),
    accountId: z.string().optional(),
  }),
} as const;

export const queueMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("FETCH_ACCOUNT"),
    payload: jobSchemas.FETCH_ACCOUNT,
  }),
  z.object({
    type: z.literal("GENERATE_BRIEFING"),
    payload: jobSchemas.GENERATE_BRIEFING,
  }),
  z.object({
    type: z.literal("SEND_NOTIFICATION"),
    payload: jobSchemas.SEND_NOTIFICATION,
  }),
]);

export type QueueMessage = z.infer<typeof queueMessageSchema>;
export type JobPayload<T extends QueueMessage["type"]> = Extract<
  QueueMessage,
  { type: T }
>["payload"];

export const enqueue = {
  fetchAccount: (queue: Queue, payload: JobPayload<"FETCH_ACCOUNT">) =>
    queue.send({ type: "FETCH_ACCOUNT", payload }),

  generateBriefing: (queue: Queue, payload: JobPayload<"GENERATE_BRIEFING">) =>
    queue.send({ type: "GENERATE_BRIEFING", payload }),

  sendNotification: (queue: Queue, payload: JobPayload<"SEND_NOTIFICATION">) =>
    queue.send({ type: "SEND_NOTIFICATION", payload }),
} as const;
