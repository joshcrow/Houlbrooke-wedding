import { list } from "@vercel/blob";
import archiver from "archiver";
import { Readable } from "node:stream";
import { MEDIA_PREFIX } from "@/lib/config";
import { passcodeOk } from "@/lib/owner";

// Stream a .zip of every original straight to the browser — no terminal, one
// click from the owner page. GET (not POST) so it's a plain browser download
// the OS can save directly. Passcode travels in the query for the same reason.
//
// Trade-off to know: this runs inside a single request, so a very large archive
// (lots of HD video) can exceed the function's time limit. For typical photo
// sets it's fine; the bulk-export script remains as the heavy-duty backup.
export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds (Vercel Pro ceiling)

export async function GET(request: Request): Promise<Response> {
  const passcode = new URL(request.url).searchParams.get("passcode");
  if (!passcodeOk(passcode)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const archive = archiver("zip", { store: true }); // photos/videos don't recompress

  // Feed the archive in the background; backpressure from the client download
  // keeps memory bounded (entries are read one at a time).
  (async () => {
    try {
      let cursor: string | undefined;
      do {
        const res = await list({ prefix: MEDIA_PREFIX, limit: 1000, cursor });
        for (const blob of res.blobs) {
          const r = await fetch(blob.url);
          if (r.ok && r.body) {
            archive.append(Readable.fromWeb(r.body as never), {
              name: blob.pathname.replace(/^media\//, ""),
            });
          }
        }
        cursor = res.cursor;
      } while (cursor);
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
