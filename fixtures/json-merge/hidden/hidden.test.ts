import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { merge } from "../src/merge.ts";

describe("merge (hidden)", () => {
  it("deep-merges nested objects without dropping keys", () => {
    assert.deepEqual(merge({ a: { x: 1 } }, { a: { y: 2 } }), {
      a: { x: 1, y: 2 },
    });
  });

  it("preserves sibling nested branches", () => {
    assert.deepEqual(
      merge({ a: { x: 1 }, b: { z: 3 } }, { a: { y: 2 } }),
      { a: { x: 1, y: 2 }, b: { z: 3 } },
    );
  });

  it("still replaces arrays wholesale", () => {
    assert.deepEqual(merge({ a: [1] }, { a: [2, 3] }), { a: [2, 3] });
  });
});
