import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TaskQueue } from "../src/taskQueue.ts";

describe("TaskQueue (visible)", () => {
  it("runs a single task and returns its value", async () => {
    const q = new TaskQueue(1);
    const result = await q.add(async () => 42);
    assert.equal(result, 42);
  });

  it("reports active count while a task is running", async () => {
    const q = new TaskQueue(1);
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });

    const p = q.add(async () => {
      assert.equal(q.active, 1);
      await gate;
      return "ok";
    });

    // Give the task a tick to start
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(q.active, 1);
    release();
    assert.equal(await p, "ok");
    assert.equal(q.active, 0);
  });

  it("eventually completes two sequential adds", async () => {
    const q = new TaskQueue(1);
    const a = await q.add(async () => "a");
    const b = await q.add(async () => "b");
    assert.equal(a, "a");
    assert.equal(b, "b");
  });
});
