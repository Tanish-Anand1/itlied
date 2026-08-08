# Fixture: json-merge

Deep-merge helper with a nested overwrite bug.

- `tests/visible.test.ts` — in sandbox; shallow cases stay green.
- `hidden/hidden.test.ts` — referee only; nested merge must preserve keys.

Fix: when both values are plain objects, recurse instead of replacing.
