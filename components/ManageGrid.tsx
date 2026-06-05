"use client";

import { useEffect, useState } from "react";
import type { MediaItem } from "@/lib/listMedia";

const PASS_KEY = "kc-owner-pass";

function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function ManageGrid({
  initialItems,
  shareUrl,
}: {
  initialItems: MediaItem[];
  shareUrl: string;
}) {
  const [passcode, setPasscode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(PASS_KEY);
    if (saved) {
      setPasscode(saved);
      setUnlocked(true); // delete/download re-check server-side anyway
    }
  }, []);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/owner/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Couldn't unlock.");
        return;
      }
      sessionStorage.setItem(PASS_KEY, passcode);
      setUnlocked(true);
    } catch {
      setError("Network error — try again.");
    }
  }

  async function remove(item: MediaItem) {
    if (!window.confirm("Permanently remove this from the album?")) return;
    setDeleting(item.url);
    try {
      const res = await fetch("/api/owner/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.url, passcode }),
      });
      if (res.status === 401) {
        setUnlocked(false);
        sessionStorage.removeItem(PASS_KEY);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      setItems((prev) => prev.filter((it) => it.url !== item.url));
    } catch {
      window.alert("Couldn't remove that — try again.");
    } finally {
      setDeleting(null);
    }
  }

  function copyShare() {
    navigator.clipboard?.writeText(`${shareUrl}/gallery`).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => undefined,
    );
  }

  if (!unlocked) {
    return (
      <form onSubmit={unlock} className="mx-auto mt-10 max-w-sm text-center">
        <label className="mb-2 block text-sm font-medium text-blue-deep">
          Enter the owner passcode
        </label>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="w-full rounded-2xl border border-blue-soft/60 bg-white/70 px-4 py-3 text-lg text-ink outline-none focus:border-blue-deep focus:ring-2 focus:ring-blue-soft/50"
        />
        {error && <p className="mt-2 text-sm text-blue-deep">{error}</p>}
        <button
          type="submit"
          className="mt-4 w-full rounded-2xl bg-blue-deep px-6 py-3 text-lg font-semibold text-cream shadow-card active:scale-[0.99]"
        >
          Unlock
        </button>
      </form>
    );
  }

  const totalBytes = items.reduce((sum, it) => sum + (it.size || 0), 0);

  return (
    <div>
      <div className="mb-6 rounded-2xl bg-white/60 p-5 shadow-sm">
        <p className="text-ink/80">
          <strong>{items.length}</strong>{" "}
          {items.length === 1 ? "item" : "items"} · {formatSize(totalBytes)}{" "}
          total
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <a
            href={`/api/owner/download-all?passcode=${encodeURIComponent(
              passcode,
            )}`}
            className="flex-1 rounded-2xl bg-blue-deep px-6 py-3 text-center text-lg font-semibold text-cream shadow-card active:scale-[0.99]"
          >
            Download everything (.zip)
          </a>
          <button
            type="button"
            onClick={copyShare}
            className="flex-1 rounded-2xl border-2 border-blue-deep/70 bg-white/50 px-6 py-3 text-center text-base font-medium text-blue-deep active:scale-[0.99]"
          >
            {copied ? "Link copied" : "Copy family share link"}
          </button>
        </div>

        <p className="mt-3 text-xs text-ink/55">
          Tip: if the .zip is very large (lots of video) and the download
          doesn&apos;t finish, use the bulk-export script as a backup. Removing
          an item here is permanent.
        </p>
      </div>

      <div className="columns-2 gap-3 sm:columns-3 md:columns-4 [&>*]:mb-3">
        {items.map((item) => (
          <figure
            key={item.url}
            className="relative break-inside-avoid overflow-hidden rounded-2xl bg-white/60 shadow-sm"
          >
            {item.isVideo ? (
              <video
                src={item.url}
                controls
                preload="metadata"
                playsInline
                className="w-full"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt="" loading="lazy" className="w-full" />
            )}
            {item.uploader && item.uploader !== "guest" && (
              <figcaption className="px-3 py-2 text-xs capitalize text-ink/55">
                {item.uploader.replace(/-/g, " ")}
              </figcaption>
            )}
            <button
              type="button"
              onClick={() => remove(item)}
              disabled={deleting === item.url}
              className="absolute right-2 top-2 rounded-full bg-ink/75 px-3 py-1 text-xs text-cream disabled:opacity-50"
            >
              {deleting === item.url ? "…" : "Remove"}
            </button>
          </figure>
        ))}
      </div>
    </div>
  );
}
