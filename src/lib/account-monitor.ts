import { DurableObject } from "cloudflare:workers";
import { enqueue } from "@/lib/queue";

type State = {
  userId: string;
  accountId: string;
  lastPostAt: number | null;
  silenceAlertSent: boolean;
};

const SILENCE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48h
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

export class AccountMonitor extends DurableObject<Env> {
  private cached: State | null = null;

  private async load(): Promise<State | null> {
    if (!this.cached) {
      this.cached = (await this.ctx.storage.get<State>("state")) ?? null;
    }
    return this.cached;
  }

  private async save(state: State): Promise<void> {
    this.cached = state;
    await this.ctx.storage.put("state", state);
  }

  async recordPosts(userId: string, accountId: string, latestPostAt: number): Promise<void> {
    const prev = await this.load();
    await this.save({
      userId,
      accountId,
      lastPostAt: latestPostAt,
      silenceAlertSent: prev?.silenceAlertSent === true && prev.lastPostAt === latestPostAt
        ? true  // same post, preserve flag
        : false, // new post — reset silence flag
    });
    await this.ctx.storage.setAlarm(Date.now() + CHECK_INTERVAL_MS);
  }

  async alarm(): Promise<void> {
    const state = await this.load();
    if (!state?.lastPostAt) return;

    const now = Date.now();

    if (now - state.lastPostAt > SILENCE_THRESHOLD_MS && !state.silenceAlertSent) {
      await this.save({ ...state, silenceAlertSent: true });
      await enqueue.sendNotification(this.env.QUEUE, {
        userId: state.userId,
        notificationType: "silence_alert",
        accountId: state.accountId,
      });
    }

    await this.ctx.storage.setAlarm(now + CHECK_INTERVAL_MS);
  }
}
