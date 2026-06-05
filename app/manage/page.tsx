import Link from "next/link";
import ManageGrid from "@/components/ManageGrid";
import { COUPLE } from "@/lib/config";
import { isGalleryHidden } from "@/lib/gallerySetting";
import { listAllMedia, type MediaItem } from "@/lib/listMedia";
import { isOwnerAuthed } from "@/lib/ownerSession";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `${COUPLE.names} — Manage`,
  robots: { index: false, follow: false },
};

export default async function Manage() {
  // Only list (and send) media once the owner session is verified server-side.
  const authed = isOwnerAuthed();
  let items: MediaItem[] = [];
  let galleryHidden = false;
  if (authed) {
    try {
      [items, galleryHidden] = await Promise.all([
        listAllMedia(),
        isGalleryHidden(),
      ]);
    } catch {
      /* render empty; the grid still works */
    }
  }

  return (
    <main className="bg-wash min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 text-center">
          <h1 className="font-script text-5xl text-blue-deep">
            {COUPLE.names}
          </h1>
          <p className="font-serif text-xl text-ink/70">Manage the album</p>
          <Link
            href="/gallery"
            className="mt-3 inline-block text-sm font-medium text-blue-deep underline underline-offset-4"
          >
            View the gallery
          </Link>
        </div>

        <ManageGrid
          authed={authed}
          initialItems={items}
          galleryHidden={galleryHidden}
        />
      </div>
    </main>
  );
}
