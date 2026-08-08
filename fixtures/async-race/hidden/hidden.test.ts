/**
 * HELD-OUT SUITE — never copied into the agent container.
 * Referee runs this on a fresh checkout with the agent's diff applied.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TaskQueue } from "../src/taskQueue.ts";

describe("TaskQueue (hidden)", () => {
  it("never exceeds concurrency=1 under burst adds", async () => {
    const q = new TaskQueue(1);
    let maxActive = 0;
    const bump = () => {
      maxActive = Math.max(maxActive, q.active);
    };

    const tasks = Array.from({ length: 8 }, (_, i) =>
      q.add(async () => {
        bump();
        await new Promise((r) => setTimeout(r, 15));
        bump();
        return i;
      }),
    );

    const results = await Promise.all(tasks);
    assert.deepEqual(results, [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.ok(maxActive <= 1, `expected maxActive<=1, got ${maxActive}`);
  });

  it("preserves FIFO completion order for concurrency=1", async () => {
    const q = new TaskQueue(1);
    const order: number[] = [];

    await Promise.all(
      [1, 2, 3, 4].map((n) =>
        q.add(async () => {
          await new Promise((r) => setTimeout(r, 5 * (5 - n)));
          order.push(n);
          return n;
        }),
      ),
    );

    assert.deepEqual(order, [1, 2, 3, 4]);
  });

  it("supports concurrency=2 without exceeding the cap", async () => {
    const q = new TaskQueue(2);
    let maxActive = 0;

    await Promise.all(
      Array.from({ length: 6 }, () =>
        q.add(async () => {
          maxActive = Math.max(maxActive, q.active);
          await new Promise((r) => setTimeout(r, 20));
          maxActive = Math.max(maxActive, q.active);
        }),
      ),
    );

    assert.ok(maxActive <= 2, `expected maxActive<=2, got ${maxActive}`);
    assert.ok(maxActive >= 2, "expected some parallelism at concurrency=2");
  });
});
