/**
 * Clip render job — hand-picked event seq range → text frames + ffmpeg → Storage path.
 * Without ffmpeg, writes a shareable text transcript artifact (dev fallback).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";

const MAX_SEQ_SPAN = 400;

export async function processClipJobs(
  db: SupabaseClient,
  clipId?: string,
): Promise<void> {
  let query = db.from("match_clips").select("*").eq("status", "queued");
  if (clipId) query = query.eq("id", clipId);
  const { data: clips } = await query.limit(5);
  if (!clips?.length) return;

  for (const clip of clips) {
    await renderOne(db, clip as ClipRow);
  }
}

interface ClipRow {
  id: string;
  match_id: string;
  start_seq: number;
  end_seq: number;
}

async function renderOne(db: SupabaseClient, clip: ClipRow): Promise<void> {
  const span = clip.end_seq - clip.start_seq;
  if (span < 0 || span > MAX_SEQ_SPAN) {
    await db
      .from("match_clips")
      .update({ status: "failed", error: "invalid_range" })
      .eq("id", clip.id);
    return;
  }

  await db.from("match_clips").update({ status: "rendering" }).eq("id", clip.id);

  try {
    const { data: events } = await db
      .from("match_events")
      .select("seq, type, payload, agent_id, created_at")
      .eq("match_id", clip.match_id)
      .gte("seq", clip.start_seq)
      .lte("seq", clip.end_seq)
      .order("seq", { ascending: true });

    const outDir = path.join(config.workRoot, "clips", clip.id);
    await fs.mkdir(outDir, { recursive: true });
    const transcriptPath = path.join(outDir, "clip.txt");
    const lines = (events ?? []).map((e) => {
      const payload = JSON.stringify(e.payload).slice(0, 200);
      return `[${e.seq}] ${e.type} ${payload}`;
    });
    await fs.writeFile(transcriptPath, lines.join("\n"), "utf8");

    const mp4Path = path.join(outDir, "clip.mp4");
    const hasFfmpeg = await which("ffmpeg");
    if (hasFfmpeg) {
      // Generate a simple scrolling text video from the transcript
      const concatList = path.join(outDir, "frames.txt");
      await fs.writeFile(
        path.join(outDir, "frame.txt"),
        lines.slice(0, 40).join("\\n") || "ItLied clip",
        "utf8",
      );
      await fs.writeFile(
        concatList,
        `file '${path.join(outDir, "frame.txt").replace(/\\/g, "/")}'\n`,
        "utf8",
      );
      const ff = await run(
        "ffmpeg",
        [
          "-y",
          "-f",
          "lavfi",
          "-i",
          `color=c=#07080C:s=1280x720:d=${Math.min(30, Math.max(3, lines.length * 0.4))}`,
          "-vf",
          `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:textfile=${transcriptPath.replace(/\\/g, "/")}:reload=0:fontsize=18:fontcolor=#F0EBE3:x=40:y=40`,
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          mp4Path,
        ],
        120_000,
      );
      if (ff.code !== 0) {
        // Fall back to transcript-only artifact
        console.warn("[clip] ffmpeg failed, storing transcript", ff.stderr.slice(0, 200));
      }
    }

    const storagePath = `clips/${clip.match_id}/${clip.id}.${hasFfmpeg && (await exists(mp4Path)) ? "mp4" : "txt"}`;
    const uploadBody =
      (await exists(mp4Path))
        ? await fs.readFile(mp4Path)
        : await fs.readFile(transcriptPath);

    const { error: upErr } = await db.storage
      .from("clips")
      .upload(storagePath, uploadBody, {
        contentType: (await exists(mp4Path)) ? "video/mp4" : "text/plain",
        upsert: true,
      });

    // Storage bucket may not exist in local — still mark ready with local path
    await db
      .from("match_clips")
      .update({
        status: "ready",
        storage_path: upErr ? `local:${outDir}` : storagePath,
        ready_at: new Date().toISOString(),
        error: upErr ? `storage: ${upErr.message}` : null,
      })
      .eq("id", clip.id);
  } catch (err) {
    await db
      .from("match_clips")
      .update({
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      })
      .eq("id", clip.id);
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function which(bin: string): Promise<boolean> {
  const r = await run(process.platform === "win32" ? "where" : "which", [bin], 5_000);
  return r.code === 0;
}

function run(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ code: 124, stdout, stderr: stderr + "\n[timeout]" });
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
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
