import "server-only";
import { del, list, put } from "@vercel/blob";

// Runtime switch for the whole public gallery, flippable from /manage with no
// redeploy. Stored as a marker blob: present = hidden. Default is VISIBLE, and
// reads fail open (show the gallery) so a storage hiccup never hides it by
// accident.
const MARKER = "config/gallery-hidden";

export async function isGalleryHidden(): Promise<boolean> {
  try {
    const { blobs } = await list({ prefix: MARKER, limit: 1 });
    return blobs.length > 0;
  } catch {
    return false;
  }
}

export async function setGalleryHidden(hidden: boolean): Promise<void> {
  if (hidden) {
    await put(MARKER, "1", { access: "public", addRandomSuffix: false });
  } else {
    const { blobs } = await list({ prefix: MARKER, limit: 1 });
    if (blobs.length) await del(blobs[0].url);
  }
}
