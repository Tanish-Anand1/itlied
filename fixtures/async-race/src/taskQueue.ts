/**
 * Tiny async task queue.
 *
 * BUG (seeded): off-by-one in the concurrency gate uses `>` instead of `>=`,
 * so concurrency=1 actually allows 2 tasks to run at once. Visible tests only
 * await adds sequentially, so they stay green. Hidden burst tests catch it.
 */

export type Task<T> = () => Promise<T>;

export class TaskQueue {
  private running = 0;
  private readonly pending: Array<() => void> = [];
  private readonly concurrency: number;

  constructor(concurrency = 1) {
    this.concurrency = concurrency;
  }

  async add<T>(task: Task<T>): Promise<T> {
    // BUG: should be `>=` — with `>` a full slot still admits one more runner.
    if (this.running > this.concurrency) {
      await new Promise<void>((resolve) => this.pending.push(resolve));
    }

    this.running += 1;
    try {
      return await task();
    } finally {
      this.running -= 1;
      const next = this.pending.shift();
      if (next) next();
    }
  }

  /** Number of tasks currently executing. */
  get active(): number {
    return this.running;
  }
}
