import { list } from "@vercel/blob";
import { MEDIA_PREFIX } from "@/lib/config";
import { getHiddenSet } from "@/lib/hidden";

const VIDEO_RE = /\.(mp4|mov|webm|m4v)$/i;

export interface MediaItem {
  url: string;
  downloadUrl: string;
  pathname: string;
  isVideo: boolean;
  uploader: string;
  size: number;
  hidden: boolean; // hidden from the public gallery (still kept + exported)
}

// Page through the whole store (list() caps at 1000 per call and sorts by
// pathname), then sort newest-first. Shared by the gallery and the owner page.
export async function listAllMedia(): Promise<MediaItem[]> {
  const blobs: {
    url: string;
    downloadUrl: string;
    pathname: string;
    uploadedAt: Date;
    size: number;
  }[] = [];
  let cursor: string | undefined;
  do {
    const res = await list({ prefix: MEDIA_PREFIX, limit: 1000, cursor });
    blobs.push(...res.blobs);
    cursor = res.cursor;
  } while (cursor); // page through everything so owner stats are never truncated

  blobs.sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );

  const hidden = await getHiddenSet();

  return blobs.map((b) => {
    const rawUploader = b.pathname.replace(MEDIA_PREFIX, "").split("/")[0] ?? "";
    let uploader = rawUploader;
    try {
      uploader = decodeURIComponent(rawUploader); // can throw on bad % encoding
    } catch {
      /* keep raw — never fail the whole listing over one bad name */
    }
    return {
      url: b.url,
      downloadUrl: b.downloadUrl,
      pathname: b.pathname,
      isVideo: VIDEO_RE.test(b.pathname),
      uploader,
      size: b.size,
      hidden: hidden.has(b.pathname),
    };
  });
}
