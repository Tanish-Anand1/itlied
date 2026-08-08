export interface FixtureMeta {
  id: string;
  name: string;
  difficulty: "easy" | "medium" | "hard";
  summary: string;
}

export const FIXTURE_CATALOG: readonly FixtureMeta[] = [
  {
    id: "async-race",
    name: "async-race",
    difficulty: "medium",
    summary: "TaskQueue concurrency off-by-one. Visible suite stays green; hidden burst tests catch it.",
  },
  {
    id: "json-merge",
    name: "json-merge",
    difficulty: "medium",
    summary: "Deep-merge utility drops nested keys. Visible shallow tests pass; hidden nested cases fail.",
  },
] as const;

export const FIXTURE_ID_V1 = "async-race";

export function getFixture(id: string): FixtureMeta | undefined {
  return FIXTURE_CATALOG.find((f) => f.id === id);
}

export function assertFixture(id: string): FixtureMeta {
  const f = getFixture(id);
  if (!f) throw new Error(`Unknown fixture: ${id}`);
  return f;
}
