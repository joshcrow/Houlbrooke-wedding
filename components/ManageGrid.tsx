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
  galleryHidden,
}: {
  authed: boolean;
  initialItems: MediaItem[];
  galleryHidden: boolean;
}) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [hideGallery, setHideGallery] = useState(galleryHidden);
  const [togglingGallery, setTogglingGallery] = useState(false);

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
      window.location.reload();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(item: MediaItem) {
    if (!window.confirm("Permanently delete this? It can't be undone.")) return;
    setBusy(item.url);
    try {
      const res = await fetch("/api/owner/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.url }),
      });
      if (res.status === 401) return void window.location.reload();
      if (!res.ok) throw new Error(await res.text());
      setItems((prev) => prev.filter((it) => it.url !== item.url));
    } catch {
      window.alert("Couldn't delete that — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleHide(item: MediaItem) {
    setBusy(item.url);
    try {
      const res = await fetch("/api/owner/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathname: item.pathname, hidden: !item.hidden }),
      });
      if (res.status === 401) return void window.location.reload();
      if (!res.ok) throw new Error(await res.text());
      setItems((prev) =>
        prev.map((it) =>
          it.url === item.url ? { ...it, hidden: !it.hidden } : it,
        ),
      );
    } catch {
      window.alert("Couldn't update that — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleGallery() {
    setTogglingGallery(true);
    try {
      const res = await fetch("/api/owner/gallery-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: !hideGallery }),
      });
      if (res.status === 401) return void window.location.reload();
      if (!res.ok) throw new Error(await res.text());
      setHideGallery((v) => !v);
    } catch {
      window.alert("Couldn't update the gallery — try again.");
    } finally {
      setTogglingGallery(false);
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
      <div className="mb-4 rounded-2xl bg-white/60 p-5 shadow-sm">
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
          The zip ends with a manifest listing every file. Deleting is permanent;
          hiding keeps the photo (and its place in the download) but removes it
          from the public gallery.
        </p>
      </div>

      {/* Whole-gallery switch — flips instantly, no redeploy. */}
      <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl bg-white/60 p-4 shadow-sm">
        <div>
          <p className="font-medium text-ink">Public gallery</p>
          <p className="text-xs text-ink/55">
            {hideGallery
              ? "Hidden from guests right now"
              : "Visible to anyone with the link"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleGallery}
          disabled={togglingGallery}
          className="shrink-0 rounded-full border-2 border-blue-deep/70 px-5 py-2 text-sm font-semibold text-blue-deep disabled:opacity-50"
        >
          {togglingGallery ? "…" : hideGallery ? "Show gallery" : "Hide gallery"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => (
          <figure
            key={item.url}
            className={`relative aspect-square overflow-hidden rounded-2xl bg-white/60 shadow-sm ${
              item.hidden ? "opacity-50" : ""
            }`}
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

            {item.hidden && (
              <span className="absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-[10px] text-cream">
                Hidden
              </span>
            )}

            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-ink/80 to-transparent px-2 pb-2 pt-6">
              <button
                type="button"
                onClick={() => toggleHide(item)}
                disabled={busy === item.url}
                className="rounded-full bg-cream/90 px-3 py-1 text-xs font-medium text-ink disabled:opacity-50"
              >
                {busy === item.url ? "…" : item.hidden ? "Show" : "Hide"}
              </button>
              <button
                type="button"
                onClick={() => remove(item)}
                disabled={busy === item.url}
                className="rounded-full bg-ink/80 px-3 py-1 text-xs text-cream disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}
