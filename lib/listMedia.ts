import { list } from "@vercel/blob";
import { MEDIA_PREFIX } from "@/lib/config";

const VIDEO_RE = /\.(mp4|mov|webm|m4v)$/i;

export interface MediaItem {
  url: string;
  downloadUrl: string;
  pathname: string;
  isVideo: boolean;
  uploader: string;
  size: number;
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
  } while (cursor && blobs.length < 10000);

  blobs.sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );

  return blobs.map((b) => ({
    url: b.url,
    downloadUrl: b.downloadUrl,
    pathname: b.pathname,
    isVideo: VIDEO_RE.test(b.pathname),
    uploader: decodeURIComponent(
      b.pathname.replace(MEDIA_PREFIX, "").split("/")[0] ?? "",
    ),
    size: b.size,
  }));
}
