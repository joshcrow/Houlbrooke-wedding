"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import { MAX_FILE_BYTES, MEDIA_PREFIX } from "@/lib/config";
import { fileExtension, slugify } from "@/lib/slug";

// Switch to multipart (resilient chunked upload) for anything large, so big
// videos and full-size photos survive flaky venue wifi.
const MULTIPART_THRESHOLD = 8 * 1024 * 1024;

// staged = chosen but NOT shared yet; nothing is public until the guest taps
// Upload. After upload there is no guest delete — only the couple can remove
// from the album (via /manage). Staging is the guests' review step.
type Status = "staged" | "uploading" | "done" | "error";

interface Item {
  id: string;
  name: string;
  isVideo: boolean;
  preview?: string;
  status: Status;
  progress: number;
  error?: string;
  uploaderSlug?: string; // stamped at first upload so retries keep attribution
}

const NAME_KEY = "kc-uploader-name";
const CONCURRENCY = 3;
const MAX_VISIBLE_TILES = 30;

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
    /* ignore (iOS Private Mode) */
  }
}
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
  const [isUploading, setIsUploading] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<Map<string, File>>(new Map());
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
    if (value.trim()) setNameError(false);
  }

  function openPicker() {
    if (!name.trim()) {
      setNameError(true);
      nameInputRef.current?.focus();
      return;
    }
    inputRef.current?.click();
  }

  function patch(id: string, next: Partial<Item>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...next } : it)),
    );
  }

  // Step 1: choose files — staged locally, nothing uploaded yet.
  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const staged: Item[] = Array.from(fileList).map((file) => {
      const id = newId();
      const preview = URL.createObjectURL(file);
      urlsRef.current.push(preview);
      filesRef.current.set(id, file);
      return {
        id,
        name: file.name,
        isVideo: file.type.startsWith("video/"),
        preview,
        status: "staged" as Status,
        progress: 0,
      };
    });
    setItems((prev) => [...staged, ...prev]);
  }

  async function runUploads(queue: Item[], fallbackSlug: string) {
    if (queue.length === 0) return;
    setIsUploading(true);
    setProgress({ done: 0, total: queue.length });
    let cursor = 0;
    async function worker() {
      while (cursor < queue.length) {
        await uploadOne(queue[cursor++], fallbackSlug);
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker),
    );
    setIsUploading(false);
    setProgress(null);
  }

  // Step 2: commit everything staged to the album.
  async function uploadAll() {
    if (isUploading) return;
    const queue = items.filter((it) => it.status === "staged");
    await runUploads(queue, slugify(name));
  }

  async function retryAll() {
    if (isUploading) return;
    const queue = items.filter((it) => it.status === "error");
    await runUploads(queue, slugify(name));
  }

  async function uploadOne(item: Item, fallbackSlug: string) {
    const file = filesRef.current.get(item.id);
    if (!file) {
      patch(item.id, { status: "error", error: "Please re-add this photo." });
      return;
    }
    const slug = item.uploaderSlug ?? fallbackSlug;

    try {
      if (file.size > MAX_FILE_BYTES) {
        patch(item.id, {
          status: "error",
          uploaderSlug: slug,
          error: item.isVideo
            ? "This video's a bit too big — try a shorter clip."
            : "This file's too big to upload.",
        });
        return;
      }

      const ext = fileExtension(file.name, item.isVideo ? "mp4" : "jpg");
      const rawBase = file.name.replace(/\.[^.]+$/, "");
      const base =
        rawBase.replace(/[^\w.-]+/g, "_").replace(/\.\.+/g, "_").slice(0, 60) ||
        "photo";
      const pathname = `${MEDIA_PREFIX}${slug}/${base}.${ext}`;

      patch(item.id, {
        status: "uploading",
        progress: 0,
        error: undefined,
        uploaderSlug: slug,
      });

      await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: file.type || undefined,
        multipart: item.isVideo || file.size > MULTIPART_THRESHOLD,
        onUploadProgress: ({ percentage }) =>
          patch(item.id, { progress: Math.round(percentage) }),
      });

      filesRef.current.delete(item.id);
      patch(item.id, { status: "done", progress: 100 });
    } catch (err) {
      console.error("Upload failed:", err);
      patch(item.id, {
        status: "error",
        uploaderSlug: slug,
        error: "Upload didn't go through — tap retry.",
      });
    }
  }

  function retry(item: Item) {
    if (filesRef.current.get(item.id)) {
      void runUploads([item], slugify(name));
      return;
    }
    inputRef.current?.click();
  }

  // Discard a staged or failed item locally (it isn't in the album).
  function discard(item: Item) {
    filesRef.current.delete(item.id);
    if (item.preview) {
      URL.revokeObjectURL(item.preview);
      urlsRef.current = urlsRef.current.filter((u) => u !== item.preview);
    }
    setItems((prev) => prev.filter((it) => it.id !== item.id));
  }

  const stagedCount = items.filter((i) => i.status === "staged").length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  // Always show failed tiles (never hide a failure behind the cap).
  const errorItems = items.filter((i) => i.status === "error");
  const others = items.filter((i) => i.status !== "error");
  const visibleOthers = others.slice(0, MAX_VISIBLE_TILES);
  const visibleItems = [...errorItems, ...visibleOthers];
  const hiddenCount = others.length - visibleOthers.length;
  const showBar = stagedCount > 0 || isUploading;

  return (
    <div className="w-full max-w-xl">
      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium text-blue-deep">
          Enter your first and last name
        </span>
        <input
          ref={nameInputRef}
          value={name}
          onChange={(e) => rememberName(e.target.value)}
          placeholder="So Katie & Conner can say thanks"
          className={`w-full rounded-2xl border bg-white/70 px-4 py-3 text-lg text-ink outline-none transition focus:ring-2 focus:ring-blue-soft/50 ${
            nameError
              ? "border-blue-deep ring-2 ring-blue-soft/50"
              : "border-blue-soft/60 focus:border-blue-deep"
          }`}
        />
        {nameError && (
          <span className="mt-1 block text-sm text-blue-deep">
            Please add your name first.
          </span>
        )}
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
        onClick={openPicker}
        disabled={isUploading}
        className={
          stagedCount === 0
            ? "w-full rounded-2xl bg-blue-deep px-6 py-4 text-lg font-semibold text-cream shadow-card transition active:scale-[0.99] disabled:opacity-60"
            : "w-full rounded-2xl border-2 border-blue-deep/70 bg-white/50 px-6 py-3 text-base font-medium text-blue-deep transition active:scale-[0.99] disabled:opacity-60"
        }
      >
        {items.length === 0 ? "Choose Photos & Videos" : "Add more"}
      </button>

      <p className="mt-3 text-center text-sm text-ink/60">
        Pick as many as you like. Nothing is shared until you tap Upload.
      </p>

      {errorCount > 0 && !isUploading && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-ink/10 px-4 py-3">
          <span className="text-sm text-ink/80">
            {errorCount} didn&apos;t upload.
          </span>
          <button
            type="button"
            onClick={retryAll}
            className="rounded-full bg-blue-deep px-5 py-2 text-sm font-semibold text-cream active:scale-[0.99]"
          >
            Retry all
          </button>
        </div>
      )}

      {items.length > 0 && (
        <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
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

              {item.isVideo && item.status !== "error" && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden>
                    <circle cx="12" cy="12" r="12" fill="rgba(52,67,94,0.55)" />
                    <path d="M9 8l7 4-7 4z" fill="#FBF7EC" />
                  </svg>
                </span>
              )}

              {item.status === "uploading" && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full bg-ink/60 px-2 py-1 text-xs text-cream">
                    {item.progress}%
                  </span>
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

              {item.status === "staged" && (
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink/55 px-2 py-0.5 text-[10px] text-cream">
                  Not shared yet
                </span>
              )}
              {item.status === "done" && (
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-blue-deep/85 px-2 py-0.5 text-[10px] text-cream">
                  Shared
                </span>
              )}

              {(item.status === "staged" || item.status === "error") &&
                !isUploading && (
                  <button
                    type="button"
                    onClick={() => discard(item)}
                    aria-label="Remove this photo"
                    className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-xl leading-none text-cream"
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
          + {hiddenCount} more below.
        </p>
      )}

      {doneCount > 0 && !isUploading && stagedCount === 0 && errorCount === 0 && (
        <div className="pop-in mt-6 rounded-2xl bg-lemon-soft/70 px-5 py-4 text-center text-lg text-blue-deep">
          Thank you{name ? `, ${name.trim()}` : ""}. Add more photos anytime.
        </div>
      )}

      {/* Sticky action bar: always-reachable Upload + overall progress. */}
      {showBar && <div className="h-24" />}
      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-soft/40 bg-cream/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-xl">
            {isUploading && progress ? (
              <>
                <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-blue-soft/30">
                  <div
                    className="h-full bg-blue-deep transition-all"
                    style={{
                      width: `${Math.round(
                        (progress.done / progress.total) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-center text-sm font-medium text-blue-deep">
                  Uploading {progress.done} of {progress.total}… keep this page
                  open
                </p>
              </>
            ) : (
              <button
                type="button"
                onClick={uploadAll}
                className="w-full rounded-2xl bg-blue-deep px-6 py-4 text-lg font-semibold text-cream shadow-card active:scale-[0.99]"
              >
                Upload {stagedCount} to the album
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
