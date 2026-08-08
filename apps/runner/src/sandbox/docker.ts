/**
 * One fresh Docker container per agent per match. Destroyed after.
 * - No network at runtime
 * - Non-root
 * - Read-only root FS except /work
 * - Memory + CPU capped
 * - Deps installed in a networked one-shot Linux container (Windows-safe)
 */
import { MATCH_LIMITS, SHELL_WHITELIST } from "@agentarena/shared";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

export interface SandboxHandle {
  id: string;
  workDir: string;
  agentId: string;
}

function run(cmd: string, args: string[], cwd?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      windowsHide: true,
      // Windows .cmd shims need a shell; docker.exe does not.
      shell: process.platform === "win32" && /\.cmd$/i.test(cmd),
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.on("error", (err) =>
      resolve({ code: 1, stdout, stderr: String(err.message) }),
    );
  });
}

/** Docker Desktop on Windows accepts C:/... volume paths. */
export function toDockerVolumePath(hostPath: string): string {
  const resolved = path.resolve(hostPath);
  if (process.platform !== "win32") return resolved;
  return resolved.replace(/\\/g, "/");
}

export function dockerDisabled(): boolean {
  return config.dryRun || process.env.ARENA_NO_DOCKER === "1";
}

export async function prepareWorkDir(
  matchId: string,
  agentId: string,
  fixtureRoot: string,
): Promise<string> {
  const workDir = path.join(config.workRoot, matchId, agentId);
  await fs.rm(workDir, { recursive: true, force: true });
  await fs.mkdir(workDir, { recursive: true });
  await copyVisibleFixture(fixtureRoot, workDir);
  return workDir;
}

async function copyVisibleFixture(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "hidden" || entry.name === "node_modules") continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyVisibleFixture(from, to);
    } else {
      await fs.copyFile(from, to);
    }
  }
}

/**
 * Install deps as Linux binaries into the bind-mounted workDir.
 * Must run BEFORE the network-none sandbox starts.
 */
export async function installDepsInWorkDir(workDir: string): Promise<void> {
  if (dockerDisabled()) {
    const install = await run(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
      workDir,
    );
    if (install.code !== 0) {
      throw new Error(`Host npm install failed: ${install.stderr || install.stdout}`);
    }
    return;
  }

  const vol = toDockerVolumePath(workDir);
  const result = await run("docker", [
    "run",
    "--rm",
    "-v",
    `${vol}:/work:rw`,
    "-w",
    "/work",
    config.sandboxImage,
    "bash",
    "-lc",
    "npm install --ignore-scripts --no-audit --no-fund; code=$?; chown -R 10001:10001 /work 2>/dev/null || true; exit $code",
  ]);
  if (result.code !== 0) {
    throw new Error(
      `In-container npm install failed: ${result.stderr || result.stdout}`.slice(0, 800),
    );
  }
}

export async function assertMountAccepted(handle: SandboxHandle): Promise<void> {
  if (handle.id.startsWith("dry-")) return;
  const check = await execInSandbox(handle, "ls /work/package.json /work/node_modules");
  if (check.code !== 0) {
    throw new Error(
      `Sandbox mount rejected or deps missing (WORK_ROOT=${config.workRoot}). ` +
        `stdout=${check.stdout.slice(0, 200)} stderr=${check.stderr.slice(0, 200)}`,
    );
  }
}

export async function startSandbox(
  matchId: string,
  agentId: string,
  workDir: string,
): Promise<SandboxHandle> {
  await installDepsInWorkDir(workDir);

  if (dockerDisabled()) {
    return { id: `dry-${agentId}`, workDir, agentId };
  }

  const name = `arena-${matchId.slice(0, 8)}-${agentId.slice(0, 8)}`;
  await run("docker", ["rm", "-f", name]);

  const vol = toDockerVolumePath(workDir);
  const args = [
    "run",
    "-d",
    "--name",
    name,
    "--network",
    "none",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,size=64m",
    "--memory",
    `${MATCH_LIMITS.containerMemoryMb}m`,
    "--cpus",
    String(MATCH_LIMITS.containerCpus),
    "--user",
    "10001:10001",
    "--security-opt",
    "no-new-privileges",
    "-v",
    `${vol}:/work:rw`,
    "-w",
    "/work",
    config.sandboxImage,
    "sleep",
    "infinity",
  ];

  const result = await run("docker", args);
  if (result.code !== 0) {
    throw new Error(`Failed to start sandbox: ${result.stderr || result.stdout}`);
  }
  const id = result.stdout.trim() || name;
  const handle = { id: name, workDir, agentId };
  // Prefer stable name for exec; docker run -d may print hash
  if (id && id !== name) {
    handle.id = name;
  }
  await assertMountAccepted(handle);
  return handle;
}

export async function destroySandbox(handle: SandboxHandle): Promise<void> {
  if (handle.id.startsWith("dry-")) return;
  await run("docker", ["rm", "-f", handle.id]);
}

export function assertShellAllowed(cmd: string): void {
  const trimmed = cmd.trim();
  const binary = trimmed.split(/\s+/)[0]?.replace(/^.*[\\/]/, "") ?? "";
  const base = binary.replace(/\.exe$/i, "").replace(/\.cmd$/i, "");
  if (!(SHELL_WHITELIST as readonly string[]).includes(base)) {
    throw new Error(
      `Binary not whitelisted: ${base}. Allowed: ${SHELL_WHITELIST.join(", ")}`,
    );
  }
}

export async function execInSandbox(
  handle: SandboxHandle,
  cmd: string,
  timeoutMs = 30_000,
): Promise<{ code: number; stdout: string; stderr: string }> {
  assertShellAllowed(cmd);

  if (handle.id.startsWith("dry-")) {
    const shell = process.platform === "win32" ? "cmd.exe" : "bash";
    const args = process.platform === "win32" ? ["/c", cmd] : ["-lc", cmd];
    return execWithTimeout(shell, args, handle.workDir, timeoutMs);
  }

  return execWithTimeout(
    "docker",
    ["exec", handle.id, "bash", "-lc", cmd],
    undefined,
    timeoutMs,
  );
}

function execWithTimeout(
  cmd: string,
  args: string[],
  cwd: string | undefined,
  timeoutMs: number,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ code: 124, stdout, stderr: stderr + "\n[timeout]" });
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      stdout += d.toString();
      if (stdout.length > 80_000) stdout = stdout.slice(-80_000);
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 40_000) stderr = stderr.slice(-40_000);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: String(err.message) });
    });
  });
}

export async function readWorkFile(workDir: string, relPath: string): Promise<string> {
  const resolved = safeResolve(workDir, relPath);
  return fs.readFile(resolved, "utf8");
}

export async function writeWorkFile(
  workDir: string,
  relPath: string,
  contents: string,
): Promise<void> {
  const resolved = safeResolve(workDir, relPath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, contents, "utf8");
}

function safeResolve(workDir: string, relPath: string): string {
  const cleaned = relPath.replace(/^\/+/, "").replace(/^work\//, "");
  const resolved = path.resolve(workDir, cleaned);
  if (!resolved.startsWith(path.resolve(workDir))) {
    throw new Error("Path escapes /work");
  }
  return resolved;
}
