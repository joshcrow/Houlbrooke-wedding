import { list } from "@vercel/blob";
import archiver from "archiver";
import { Readable } from "node:stream";
import { MEDIA_PREFIX } from "@/lib/config";
import { isOwnerAuthed } from "@/lib/ownerSession";

// Stream a .zip of every original to the browser — one click from /manage, no
// terminal. Auth is the owner session cookie (set by /api/owner/verify), so the
// passcode never appears in a URL.
//
// Integrity: each file is retried, and the zip always ends with a manifest. If
// anything couldn't be fetched, the manifest is named _INCOMPLETE_... and lists
// the missing files, so a partial archive can never masquerade as complete.
export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds (Vercel Pro ceiling)

// Defense-in-depth: even though upload validates pathnames, never let a name
// escape its folder in the zip.
function safeEntryName(pathname: string): string {
  return pathname
    .replace(/^media\//, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((seg) => seg && seg !== "." && seg !== "..")
    .join("/");
}

async function fetchWithRetry(url: string, tries = 3): Promise<Response | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok && r.body) return r;
    } catch {
      /* retry */
    }
    await new Promise((res) => setTimeout(res, 250 * (i + 1)));
  }
  return null;
}

export async function GET(): Promise<Response> {
  if (!isOwnerAuthed()) {
    return new Response("Unauthorized", { status: 401 });
  }

  const archive = archiver("zip", { store: true });

  (async () => {
    const expected: string[] = [];
    const failed: string[] = [];
    try {
      let cursor: string | undefined;
      do {
        const res = await list({ prefix: MEDIA_PREFIX, limit: 1000, cursor });
        for (const blob of res.blobs) {
          expected.push(blob.pathname);
          const r = await fetchWithRetry(blob.url);
          if (r?.body) {
            archive.append(Readable.fromWeb(r.body as never), {
              name: safeEntryName(blob.pathname),
            });
          } else {
            failed.push(blob.pathname);
          }
        }
        cursor = res.cursor;
      } while (cursor);

      const ok = expected.length - failed.length;
      const manifest =
        `Expected: ${expected.length}\nIncluded: ${ok}\nFailed: ${failed.length}\n\n` +
        (failed.length
          ? `MISSING (re-run, or use the export script):\n${failed.join("\n")}\n`
          : "All files included.\n");
      archive.append(manifest, {
        name: failed.length
          ? `_INCOMPLETE_${failed.length}_missing.txt`
          : "_manifest.txt",
      });
      await archive.finalize();
    } catch (err) {
      archive.destroy(err as Error);
    }
  })();

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(Readable.toWeb(archive) as never, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="wedding-photos-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
