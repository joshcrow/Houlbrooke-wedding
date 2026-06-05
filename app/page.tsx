import Link from "next/link";
import UploadExperience from "@/components/UploadExperience";
import { COUPLE } from "@/lib/config";

export default function Home() {
  return (
    <main className="bg-wash flex min-h-screen flex-col items-center px-5 py-10">
      <header className="mb-8 mt-4 text-center">
        <p className="font-serif text-lg uppercase tracking-[0.25em] text-blue/80">
          🍋 Share Your Photos 🍋
        </p>
        <h1 className="font-script text-6xl text-blue-deep sm:text-7xl">
          {COUPLE.names}
        </h1>
        <p className="mt-1 font-serif text-2xl text-ink/70">
          {COUPLE.lastName} &middot; {COUPLE.year}
        </p>
        <p className="mx-auto mt-4 max-w-md text-pretty text-ink/70">
          Help us remember every moment. Add the photos and videos you took —
          no app, no account, just tap below.
        </p>
      </header>

      <UploadExperience />

      <Link
        href="/gallery"
        className="mt-8 text-sm font-medium text-blue-deep underline underline-offset-4"
      >
        See everyone&apos;s photos →
      </Link>

      <footer className="mt-10 text-center text-xs text-ink/40">
        Made with 💛 for {COUPLE.names}
      </footer>
    </main>
  );
}
