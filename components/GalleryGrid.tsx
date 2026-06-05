"use client";

import { useCallback, useEffect, useState } from "react";

export interface GalleryItem {
  url: string;
  downloadUrl: string;
  isVideo: boolean;
  uploader: string;
}

function pretty(uploader: string): string {
  return uploader.replace(/-/g, " ");
}

export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [previewBroke, setPreviewBroke] = useState(false);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (dir: number) =>
      setOpenIndex((i) =>
        i === null ? i : (i + dir + items.length) % items.length,
      ),
    [items.length],
  );

  // Reset the "preview failed" flag whenever a different item opens.
  useEffect(() => setPreviewBroke(false), [openIndex]);

  // Keyboard controls + lock background scroll while the lightbox is open.
  useEffect(() => {
    if (openIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openIndex, close, step]);

  const active = openIndex === null ? null : items[openIndex];

  return (
    <>
      <div className="columns-2 gap-3 sm:columns-3 md:columns-4 [&>*]:mb-3">
        {items.map((item, i) => (
          <button
            key={item.url}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="block w-full break-inside-avoid overflow-hidden rounded-2xl bg-white/60 text-left shadow-sm transition active:scale-[0.99]"
          >
            <span className="relative block">
              {item.isVideo ? (
                <video
                  src={item.url}
                  preload="metadata"
                  muted
                  playsInline
                  className="w-full"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={item.uploader ? `Shared by ${pretty(item.uploader)}` : ""}
                  loading="lazy"
                  className="w-full"
                />
              )}
              {item.isVideo && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden>
                    <circle cx="12" cy="12" r="12" fill="rgba(52,67,94,0.55)" />
                    <path d="M9 8l7 4-7 4z" fill="#FBF7EC" />
                  </svg>
                </span>
              )}
            </span>
            {item.uploader && item.uploader !== "guest" && (
              <span className="block px-3 py-2 text-xs capitalize text-ink/55">
                {pretty(item.uploader)}
              </span>
            )}
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex flex-col gap-3 bg-ink/95 p-4"
          onClick={close}
        >
          <div
            className="flex items-center justify-between text-cream"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-sm capitalize">
              {active.uploader && active.uploader !== "guest"
                ? pretty(active.uploader)
                : ""}
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="px-3 text-3xl leading-none"
            >
              ×
            </button>
          </div>

          <div
            className="flex min-h-0 flex-1 items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {active.isVideo ? (
              <video
                src={active.url}
                controls
                autoPlay
                playsInline
                className="max-h-full max-w-full rounded-lg"
              />
            ) : previewBroke ? (
              <p className="max-w-xs text-center text-cream/80">
                This photo can&apos;t preview on this device, but the download
                below saves the full original.
              </p>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.url}
                alt=""
                onError={() => setPreviewBroke(true)}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            )}
          </div>

          <div
            className="flex items-center justify-between gap-3 text-cream"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => step(-1)}
              className="rounded-full bg-white/15 px-5 py-2 text-sm"
            >
              Prev
            </button>
            <a
              href={active.downloadUrl}
              download
              className="rounded-full bg-cream px-6 py-2 text-sm font-semibold text-ink"
            >
              Download
            </a>
            <button
              type="button"
              onClick={() => step(1)}
              className="rounded-full bg-white/15 px-5 py-2 text-sm"
            >
              Next
            </button>
          </div>
          {!active.isVideo && (
            <p
              className="text-center text-xs text-cream/60"
              onClick={(e) => e.stopPropagation()}
            >
              On iPhone, long-press the photo to save it to your camera roll.
            </p>
          )}
        </div>
      )}
    </>
  );
}
