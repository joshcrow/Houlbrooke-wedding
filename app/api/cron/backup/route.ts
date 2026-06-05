import { list, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { MEDIA_PREFIX } from "@/lib/config";
import { driveConfigured, getDriveAccessToken, uploadToDrive } from "@/lib/drive";

// Incremental Blob -> Google Drive backup. Runs on a schedule (vercel.json).
// Designed to be fully isolated: it only reads media, writes its own markers,
// no-ops when unconfigured, and never throws out of the handler — so a failure
// here cannot affect uploads, the gallery, or /manage.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SYNCED = "synced/"; // backed up OK
const SKIPPED = "synced-skip/"; // intentionally skipped (too large for the cron)
const BATCH = 25; // files per run
const MAX_BYTES = 200 * 1024 * 1024; // bigger files are left to the export script
const TIME_BUDGET_MS = 240_000; // stop well before the 300s ceiling

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
  "3gp": "video/3gpp",
};
function mimeFor(pathname: string): string {
  const ext = pathname.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return (ext && MIME[ext]) || "application/octet-stream";
}

async function markerSet(prefix: string): Promise<Set<string>> {
  const set = new Set<string>();
  let cursor: string | undefined;
  do {
    const res = await list({ prefix, cursor, limit: 1000 });
    for (const b of res.blobs) {
      try {
        set.add(decodeURIComponent(b.pathname.slice(prefix.length)));
      } catch {
        /* skip */
      }
    }
    cursor = res.cursor;
  } while (cursor);
  return set;
}

async function mark(prefix: string, pathname: string): Promise<void> {
  await put(prefix + encodeURIComponent(pathname), "1", {
    access: "public",
    addRandomSuffix: false,
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Require CRON_SECRET (Vercel sends it as a bearer token on cron requests).
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return NextResponse.json({ ok: true, skipped: "CRON_SECRET not set" });
    }
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (!driveConfigured()) {
      return NextResponse.json({ ok: true, skipped: "drive not configured" });
    }

    const [synced, skipped] = await Promise.all([
      markerSet(SYNCED),
      markerSet(SKIPPED),
    ]);

    const media: { url: string; pathname: string; size: number }[] = [];
    let cursor: string | undefined;
    do {
      const res = await list({ prefix: MEDIA_PREFIX, cursor, limit: 1000 });
      media.push(...res.blobs);
      cursor = res.cursor;
    } while (cursor);

    const pending = media.filter(
      (b) => !synced.has(b.pathname) && !skipped.has(b.pathname),
    );
    if (pending.length === 0) {
      return NextResponse.json({ ok: true, backedUp: 0, remaining: 0 });
    }

    const token = await getDriveAccessToken();
    const startedAt = Date.now();
    let backedUp = 0;
    let skippedLarge = 0;
    let errors = 0;

    for (const b of pending) {
      if (backedUp + skippedLarge >= BATCH) break;
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;
      try {
        if (b.size > MAX_BYTES) {
          await mark(SKIPPED, b.pathname);
          skippedLarge++;
          continue;
        }
        const res = await fetch(b.url);
        if (!res.ok) {
          errors++;
          continue;
        }
        const data = new Uint8Array(await res.arrayBuffer());
        const name = b.pathname.slice(MEDIA_PREFIX.length).replace(/\//g, "__");
        await uploadToDrive({
          accessToken: token,
          name,
          contentType: mimeFor(b.pathname),
          data,
        });
        await mark(SYNCED, b.pathname);
        backedUp++;
      } catch (err) {
        console.error("backup item failed:", b.pathname, err);
        errors++;
      }
    }

    return NextResponse.json({
      ok: true,
      backedUp,
      skippedLarge,
      errors,
      remaining: pending.length - backedUp - skippedLarge,
    });
  } catch (err) {
    // Never let a backup failure surface as anything but a logged 200.
    console.error("backup run failed:", err);
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
