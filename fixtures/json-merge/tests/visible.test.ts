import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { merge } from "../src/merge.ts";

describe("merge (visible)", () => {
  it("overwrites top-level keys from b", () => {
    assert.deepEqual(merge({ a: 1 }, { a: 2 }), { a: 2 });
  });

  it("adds new top-level keys", () => {
    assert.deepEqual(merge({ a: 1 }, { b: 2 }), { a: 1, b: 2 });
  });

  it("returns b when a is not an object", () => {
    assert.equal(merge(1 as never, { a: 1 }), { a: 1 });
  });
});
