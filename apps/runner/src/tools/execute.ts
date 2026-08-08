import type { ToolName } from "@agentarena/shared";
import {
  execInSandbox,
  readWorkFile,
  type SandboxHandle,
  writeWorkFile,
} from "../sandbox/docker.js";

const MAX_OUTPUT = 24_000;

export interface ToolExecution {
  ok: boolean;
  output: string;
  truncated?: boolean;
  /** Populated for run_tests */
  testMeta?: { passed: number; failed: number; duration_ms: number };
}

function truncate(s: string): { text: string; truncated: boolean } {
  if (s.length <= MAX_OUTPUT) return { text: s, truncated: false };
  return { text: s.slice(0, MAX_OUTPUT) + "\n…[truncated]", truncated: true };
}

export async function executeTool(
  handle: SandboxHandle,
  tool: ToolName,
  args: Record<string, unknown>,
): Promise<ToolExecution> {
  try {
    switch (tool) {
      case "read_file": {
        const path = String(args.path ?? "");
        const contents = await readWorkFile(handle.workDir, path);
        const t = truncate(contents);
        return { ok: true, output: t.text, truncated: t.truncated };
      }
      case "write_file": {
        const path = String(args.path ?? "");
        const contents = String(args.contents ?? "");
        await writeWorkFile(handle.workDir, path, contents);
        return { ok: true, output: `wrote ${path} (${contents.length} bytes)` };
      }
      case "run_shell": {
        const cmd = String(args.cmd ?? "");
        const result = await execInSandbox(handle, cmd);
        const combined = [
          result.stdout,
          result.stderr ? `stderr:\n${result.stderr}` : "",
          `exit=${result.code}`,
        ]
          .filter(Boolean)
          .join("\n");
        const t = truncate(combined);
        return { ok: result.code === 0, output: t.text, truncated: t.truncated };
      }
      case "run_tests": {
        const started = Date.now();
        const result = await execInSandbox(handle, "npm test", 60_000);
        const duration_ms = Date.now() - started;
        const { passed, failed } = parseNodeTestCounts(result.stdout + result.stderr);
        const t = truncate(result.stdout + "\n" + result.stderr);
        return {
          ok: result.code === 0 && failed === 0,
          output: t.text,
          truncated: t.truncated,
          testMeta: { passed, failed, duration_ms },
        };
      }
      default:
        return { ok: false, output: `Unknown tool: ${tool}` };
    }
  } catch (err) {
    return { ok: false, output: err instanceof Error ? err.message : String(err) };
  }
}

function parseNodeTestCounts(output: string): { passed: number; failed: number } {
  // node:test summary like "# pass 3" / "# fail 1"
  const pass = Number(/# pass (\d+)/.exec(output)?.[1] ?? NaN);
  const fail = Number(/# fail (\d+)/.exec(output)?.[1] ?? NaN);
  if (!Number.isNaN(pass) || !Number.isNaN(fail)) {
    return { passed: pass || 0, failed: fail || 0 };
  }
  // Fallback heuristics
  if (/fail/i.test(output) && !/pass/i.test(output)) return { passed: 0, failed: 1 };
  return { passed: 0, failed: 0 };
}
