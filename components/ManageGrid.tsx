"use client";

import { useEffect, useState } from "react";
import type { MediaItem } from "@/lib/listMedia";

function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function ManageGrid({
  authed,
  initialItems,
}: {
  authed: boolean;
  initialItems: MediaItem[];
}) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
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
      // Session cookie is set — reload so the server renders the album.
      window.location.reload();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(item: MediaItem) {
    if (!window.confirm("Permanently remove this from the album?")) return;
    setDeleting(item.url);
    try {
      const res = await fetch("/api/owner/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.url }),
      });
      if (res.status === 401) {
        window.location.reload(); // session expired → back to passcode
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
    navigator.clipboard?.writeText(`${origin}/gallery`).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => undefined,
    );
  }

  if (!authed) {
    return (
      <form onSubmit={unlock} className="mx-auto mt-10 max-w-sm text-center">
        <label className="mb-2 block text-sm font-medium text-blue-deep">
          Enter the owner passcode
        </label>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-2xl border border-blue-soft/60 bg-white/70 px-4 py-3 text-lg text-ink outline-none focus:border-blue-deep focus:ring-2 focus:ring-blue-soft/50"
        />
        {error && <p className="mt-2 text-sm text-blue-deep">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full rounded-2xl bg-blue-deep px-6 py-3 text-lg font-semibold text-cream shadow-card active:scale-[0.99] disabled:opacity-60"
        >
          {submitting ? "Unlocking…" : "Unlock"}
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
            href="/api/owner/download-all"
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
          The zip ends with a manifest listing every file (and flags any it
          couldn&apos;t include). For a very large archive, the export script is
          the verified backup. Removing an item here is permanent.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => (
          <figure
            key={item.url}
            className="relative aspect-square overflow-hidden rounded-2xl bg-white/60 shadow-sm"
          >
            {item.isVideo ? (
              <video
                src={item.url}
                controls
                preload="metadata"
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            )}
            {item.uploader && item.uploader !== "guest" && (
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent px-2 pb-1.5 pt-5 text-xs capitalize text-cream">
                {item.uploader.replace(/-/g, " ")}
              </figcaption>
            )}
            <button
              type="button"
              onClick={() => remove(item)}
              disabled={deleting === item.url}
              className="absolute right-2 top-2 rounded-full bg-ink/75 px-3 py-1.5 text-xs text-cream disabled:opacity-50"
            >
              {deleting === item.url ? "…" : "Remove"}
            </button>
          </figure>
        ))}
      </div>
    </div>
  );
}
