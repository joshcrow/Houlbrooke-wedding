import Link from "next/link";
import ManageGrid from "@/components/ManageGrid";
import { COUPLE, SITE_URL } from "@/lib/config";
import { listAllMedia } from "@/lib/listMedia";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `${COUPLE.names} — Manage`,
  robots: { index: false, follow: false },
};

export default async function Manage() {
  let items = [] as Awaited<ReturnType<typeof listAllMedia>>;
  try {
    items = await listAllMedia();
  } catch {
    // Leave empty; the page still renders with the passcode gate.
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

        <ManageGrid initialItems={items} shareUrl={SITE_URL} />
      </div>
    </main>
  );
}
