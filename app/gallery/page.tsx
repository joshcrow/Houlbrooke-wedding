import { list } from "@vercel/blob";
import Link from "next/link";
import { COUPLE, MEDIA_PREFIX } from "@/lib/config";

// Always fresh — new uploads should show on reload.
export const dynamic = "force-dynamic";

const VIDEO_RE = /\.(mp4|mov|webm|m4v)$/i;

export default async function Gallery() {
  let blobs: { url: string; pathname: string; uploadedAt: Date }[] = [];
  let error = "";

  try {
    // list() returns up to 1000 sorted by pathname, so page through the whole
    // store (cap at 10k) before sorting by date — otherwise late-alphabet
    // uploaders would be dropped once there are more than 1000 files.
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

        {!error && blobs.length === 0 && (
          <p className="text-center text-ink/60">
            No photos yet — be the first to add one!
          </p>
        )}

        <div className="columns-2 gap-3 sm:columns-3 md:columns-4 [&>*]:mb-3">
          {blobs.map((blob) => {
            const uploader = decodeURIComponent(
              blob.pathname.replace(MEDIA_PREFIX, "").split("/")[0] ?? "",
            );
            const isVideo = VIDEO_RE.test(blob.pathname);
            return (
              <figure
                key={blob.url}
                className="break-inside-avoid overflow-hidden rounded-2xl bg-white/60 shadow-sm"
              >
                {isVideo ? (
                  <video
                    src={blob.url}
                    controls
                    preload="metadata"
                    playsInline
                    className="w-full"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={blob.url}
                    alt={`Shared by ${uploader}`}
                    loading="lazy"
                    className="w-full"
                  />
                )}
                {uploader && uploader !== "guest" && (
                  <figcaption className="px-3 py-2 text-xs capitalize text-ink/55">
                    {uploader.replace(/-/g, " ")}
                  </figcaption>
                )}
              </figure>
            );
          })}
        </div>
      </div>
    </main>
  );
}
