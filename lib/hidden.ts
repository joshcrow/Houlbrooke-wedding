import "server-only";
import { del, list, put } from "@vercel/blob";

// "Hide" without a database: for each hidden photo we store a tiny marker blob
// under hidden/<encoded media pathname>. The gallery filters these out, but the
// original stays in media/ — so hidden photos are kept and still export/download.
// We use list() (metadata, not CDN-cached content) so changes show immediately.
const PREFIX = "hidden/";
const keyFor = (pathname: string) => PREFIX + encodeURIComponent(pathname);

export async function getHiddenSet(): Promise<Set<string>> {
  const hidden = new Set<string>();
  let cursor: string | undefined;
  do {
    const res = await list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const blob of res.blobs) {
      try {
        hidden.add(decodeURIComponent(blob.pathname.slice(PREFIX.length)));
      } catch {
        /* skip a malformed marker */
      }
    }
    cursor = res.cursor;
  } while (cursor);
  return hidden;
}

export async function setHidden(
  pathname: string,
  hidden: boolean,
): Promise<void> {
  if (hidden) {
    await put(keyFor(pathname), "1", {
      access: "public",
      addRandomSuffix: false,
    });
  } else {
    const { blobs } = await list({ prefix: keyFor(pathname), limit: 1 });
    if (blobs.length) await del(blobs[0].url);
  }
}
