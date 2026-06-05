import Link from "next/link";
import UploadExperience from "@/components/UploadExperience";
import { COUPLE } from "@/lib/config";

export default function Home() {
  return (
    <main className="bg-wash flex min-h-screen flex-col items-center px-5 py-10">
      <header className="mb-8 mt-4 text-center">
        <h1 className="font-script text-6xl text-blue-deep sm:text-7xl">
          {COUPLE.names}
        </h1>
        <p className="mt-1 font-serif text-2xl text-ink/70">
          {COUPLE.lastName} &middot; {COUPLE.year}
        </p>
        <p className="mt-4 font-serif text-xl text-ink/70">Share your photos</p>
      </header>

      <UploadExperience />

      <Link
        href="/gallery"
        className="mt-6 flex w-full max-w-xl items-center justify-center rounded-2xl border-2 border-blue-deep/70 bg-white/50 px-6 py-3.5 text-lg font-medium text-blue-deep transition active:scale-[0.99]"
      >
        See gallery
      </Link>
    </main>
  );
}
