"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import { MAX_FILE_BYTES, MEDIA_PREFIX } from "@/lib/config";
import { fileExtension, slugify } from "@/lib/slug";

// Switch to multipart (resilient chunked upload) for anything large, so big
// videos and full-size photos survive flaky venue wifi.
const MULTIPART_THRESHOLD = 8 * 1024 * 1024;

type Status = "processing" | "uploading" | "done" | "error" | "removing";

interface Item {
  id: string;
  name: string;
  isVideo: boolean;
  preview?: string;
  status: Status;
  progress: number;
  error?: string;
  url?: string; // the public blob URL, once uploaded (needed to remove it)
}

const NAME_KEY = "kc-uploader-name";
const CONCURRENCY = 3;
// Cap rendered thumbnails so a guest selecting hundreds of photos can't run the
// phone out of memory. Newest items render first; the rest still upload.
const MAX_VISIBLE_TILES = 30;

// localStorage throws in iOS Private Mode — never let that break the page.
function safeGet(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
// crypto.randomUUID is missing on older iOS Safari; fall back gracefully.
function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export default function UploadExperience() {
  const [name, setName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  // Keep the actual File for each in-flight item so "Retry" re-uploads the
  // exact same file instead of re-opening the picker (avoids duplicates).
  const filesRef = useRef<Map<string, File>>(new Map());
  // Track created object URLs so we can free them when the page unmounts.
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    setName(safeGet(NAME_KEY));
    return () => {
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  function rememberName(value: string) {
    setName(value);
    safeSet(NAME_KEY, value.trim());
  }

  function patch(id: string, next: Partial<Item>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...next } : it)),
    );
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const uploaderSlug = slugify(name);

    const queued: { item: Item; file: File }[] = files.map((file) => ({
      item: {
        id: newId(),
        name: file.name,
        isVideo: file.type.startsWith("video/"),
        status: "processing",
        progress: 0,
      },
      file,
    }));

    for (const q of queued) filesRef.current.set(q.item.id, q.file);
    setItems((prev) => [...queued.map((q) => q.item), ...prev]);

    // Upload with a small concurrency pool so bad venue wifi doesn't choke.
    let cursor = 0;
    async function worker() {
      while (cursor < queued.length) {
        const current = queued[cursor++];
        await uploadOne(current.item, current.file, uploaderSlug);
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queued.length) }, worker),
    );
  }

  async function uploadOne(item: Item, file: File, uploaderSlug: string) {
    try {
      if (file.size > MAX_FILE_BYTES) {
        patch(item.id, {
          status: "error",
          error: item.isVideo
            ? "This video's a bit too big — try a shorter clip."
            : "This file's too big to upload.",
        });
        return;
      }

      const preview = URL.createObjectURL(file);
      urlsRef.current.push(preview);
      const ext = fileExtension(file.name, item.isVideo ? "mp4" : "jpg");
      const rawBase = file.name.replace(/\.[^.]+$/, "");
      const base =
        rawBase.replace(/[^\w.-]+/g, "_").slice(0, 60) || "photo";
      const pathname = `${MEDIA_PREFIX}${uploaderSlug}/${base}.${ext}`;

      patch(item.id, { status: "uploading", preview });

      const result = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        // Empty on some iPhone files — let Blob infer from the .ext in pathname.
        contentType: file.type || undefined,
        multipart: item.isVideo || file.size > MULTIPART_THRESHOLD,
        onUploadProgress: ({ percentage }) =>
          patch(item.id, { progress: Math.round(percentage) }),
      });

      filesRef.current.delete(item.id);
      patch(item.id, { status: "done", progress: 100, url: result.url });
    } catch (err) {
      // Surface the true cause in the console for debugging; keep the on-screen
      // message friendly for guests.
      console.error("Upload failed:", err);
      patch(item.id, {
        status: "error",
        error: "Upload didn't go through — tap retry.",
      });
    }
  }

  function retry(item: Item) {
    const file = filesRef.current.get(item.id);
    if (file) {
      patch(item.id, { status: "processing", progress: 0, error: undefined });
      void uploadOne(item, file, slugify(name));
      return;
    }
    // File no longer held (e.g. after a reload) — fall back to the picker.
    inputRef.current?.click();
  }

  async function removeItem(item: Item) {
    if (!item.url) return;
    if (!window.confirm("Remove this photo from the album?")) return;

    patch(item.id, { status: "removing" });
    try {
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.url }),
      });
      if (!res.ok) throw new Error(await res.text());
      setItems((prev) => prev.filter((it) => it.id !== item.id));
    } catch (err) {
      console.error("Remove failed:", err);
      patch(item.id, { status: "done" });
      window.alert("Couldn't remove that photo — please try again.");
    }
  }

  const doneCount = items.filter((i) => i.status === "done").length;
  const activeCount = items.filter(
    (i) => i.status === "uploading" || i.status === "processing",
  ).length;
  const visibleItems = items.slice(0, MAX_VISIBLE_TILES);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <div className="w-full max-w-xl">
      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium text-blue-deep">
          Enter your first and last name
        </span>
        <input
          value={name}
          onChange={(e) => rememberName(e.target.value)}
          placeholder="So Katie & Conner can say thanks"
          className="w-full rounded-2xl border border-blue-soft/60 bg-white/70 px-4 py-3 text-lg text-ink outline-none transition focus:border-blue-deep focus:ring-2 focus:ring-blue-soft/50"
        />
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-2xl bg-blue-deep px-6 py-4 text-lg font-semibold text-cream shadow-card transition active:scale-[0.99]"
      >
        Add Photos &amp; Videos
      </button>

      <p className="mt-3 text-center text-sm text-ink/60">
        Pick as many as you like. Keep this page open until each photo shows a
        check.
      </p>

      {doneCount > 0 && activeCount === 0 && (
        <div className="pop-in mt-6 rounded-2xl bg-lemon-soft/70 px-5 py-4 text-center text-lg text-blue-deep">
          Thank you{name ? `, ${name.trim()}` : ""}. Add more photos anytime.
        </div>
      )}

      {doneCount > 0 && (
        <p className="mt-6 text-center text-sm text-ink/60">
          These are now in the album. Tap × on any photo you didn&apos;t mean to
          share.
        </p>
      )}

      {items.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {visibleItems.map((item) => (
            <li
              key={item.id}
              className="pop-in relative aspect-square overflow-hidden rounded-2xl bg-white/60 shadow-sm"
            >
              {item.preview &&
                (item.isVideo ? (
                  <video
                    src={item.preview}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.preview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ))}

              <div className="absolute inset-0 flex items-center justify-center">
                {(item.status === "uploading" ||
                  item.status === "processing" ||
                  item.status === "removing") && (
                  <span className="rounded-full bg-ink/60 px-2 py-1 text-xs text-cream">
                    {item.status === "uploading" ? `${item.progress}%` : "…"}
                  </span>
                )}
                {item.status === "error" && (
                  <button
                    type="button"
                    onClick={() => retry(item)}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-ink/70 p-1 text-center text-[11px] leading-tight text-cream"
                  >
                    {item.error}
                    <span className="mt-1 underline">Retry</span>
                  </button>
                )}
              </div>

              {item.status === "done" && (
                <button
                  type="button"
                  onClick={() => removeItem(item)}
                  aria-label="Remove this photo from the album"
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-base leading-none text-cream"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {hiddenCount > 0 && (
        <p className="mt-3 text-center text-sm text-ink/60">
          + {hiddenCount} more uploading below the fold.
        </p>
      )}
    </div>
  );
}
