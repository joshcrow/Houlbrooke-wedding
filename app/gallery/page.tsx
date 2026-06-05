import Link from "next/link";
import GalleryGrid, { type GalleryItem } from "@/components/GalleryGrid";
import { COUPLE } from "@/lib/config";
import { listAllMedia } from "@/lib/listMedia";

// Always fresh — new uploads should show on reload.
export const dynamic = "force-dynamic";

export default async function Gallery() {
  let items: GalleryItem[] = [];
  let error = "";

  try {
    items = await listAllMedia();
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
