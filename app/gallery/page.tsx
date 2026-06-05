import { list } from "@vercel/blob";
import Link from "next/link";
import GalleryGrid, { type GalleryItem } from "@/components/GalleryGrid";
import { COUPLE, MEDIA_PREFIX } from "@/lib/config";

// Always fresh — new uploads should show on reload.
export const dynamic = "force-dynamic";

const VIDEO_RE = /\.(mp4|mov|webm|m4v)$/i;

export default async function Gallery() {
  let items: GalleryItem[] = [];
  let error = "";

  try {
    // list() returns up to 1000 sorted by pathname, so page through the whole
    // store (cap at 10k) before sorting by date — otherwise late-alphabet
    // uploaders would be dropped once there are more than 1000 files.
    const blobs: { url: string; downloadUrl: string; pathname: string; uploadedAt: Date }[] =
      [];
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

    items = blobs.map((blob) => ({
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      isVideo: VIDEO_RE.test(blob.pathname),
      uploader: decodeURIComponent(
        blob.pathname.replace(MEDIA_PREFIX, "").split("/")[0] ?? "",
      ),
    }));
  } catch {
    error = "Gallery isn't ready yet — check back once photos are added.";
  }

  return (
    <main className="bg-wash min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 text-center">
          <h1 className="font-script text-5xl text-blue-deep">
            {COUPLE.names}
          </h1>
          <p className="font-serif text-xl text-ink/70">Everyone&apos;s photos</p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm font-medium text-blue-deep underline underline-offset-4"
          >
            ← Add yours
          </Link>
        </div>

        {error && <p className="text-center text-ink/60">{error}</p>}

        {!error && items.length === 0 && (
          <p className="text-center text-ink/60">
            No photos yet — be the first to add one!
          </p>
        )}

        {!error && items.length > 0 && (
          <>
            <p className="mb-5 text-center text-sm text-ink/55">
              Tap any photo to view it full size and download it. A
              download-everything option will be available after the wedding.
            </p>
            <GalleryGrid items={items} />
          </>
        )}
      </div>
    </main>
  );
}
