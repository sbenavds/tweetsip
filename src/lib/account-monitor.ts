import { DurableObject } from "cloudflare:workers";

type State = {
  lastPostAt: number | null;
  silenceAlertSent: boolean;
};

const SILENCE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48h
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

export class AccountMonitor extends DurableObject<Env> {
  private cached: State | null = null;

  private async load(): Promise<State> {
    if (!this.cached) {
      this.cached = (await this.ctx.storage.get<State>("state")) ?? {
        lastPostAt: null,
        silenceAlertSent: false,
      };
    }
    return this.cached;
  }

  private async save(state: State): Promise<void> {
    this.cached = state;
    await this.ctx.storage.put("state", state);
  }

  async recordPosts(latestPostAt: number): Promise<void> {
    const state = await this.load();
    await this.save({ ...state, lastPostAt: latestPostAt, silenceAlertSent: false });
    await this.ctx.storage.setAlarm(Date.now() + CHECK_INTERVAL_MS);
  }

  async alarm(): Promise<void> {
    const state = await this.load();
    if (!state.lastPostAt) return;

    const now = Date.now();

    if (now - state.lastPostAt > SILENCE_THRESHOLD_MS && !state.silenceAlertSent) {
      await this.save({ ...state, silenceAlertSent: true });
      // enqueue silence alert — US-018
    }

    await this.ctx.storage.setAlarm(now + CHECK_INTERVAL_MS);
  }
}
