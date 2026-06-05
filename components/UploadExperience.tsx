"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import { MAX_FILE_BYTES, MEDIA_PREFIX } from "@/lib/config";
import { fileExtension, slugify } from "@/lib/slug";

// Switch to multipart (resilient chunked upload) for anything large, so big
// videos and full-size photos survive flaky venue wifi.
const MULTIPART_THRESHOLD = 8 * 1024 * 1024;

// staged = chosen but NOT yet shared; nothing is public until the guest taps
// Upload. uploading/done/error track the commit; removing = deleting from album.
type Status = "staged" | "uploading" | "done" | "error" | "removing";

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
  const [isUploading, setIsUploading] = useState(false);
  const [nameError, setNameError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // Keep the actual File for each item until it's uploaded (for the commit and
  // for "Retry" re-sending the exact same file).
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
    if (value.trim()) setNameError(false);
  }

  // Require a name before the picker opens — focus the field if it's empty.
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

  // Step 1: choose files. They are staged locally — nothing is uploaded yet.
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

  // Step 2: the guest explicitly commits everything staged to the public album.
  async function uploadAll() {
    if (isUploading) return;
    const queue = items.filter((it) => it.status === "staged");
    if (queue.length === 0) return;

    const uploaderSlug = slugify(name);
    setIsUploading(true);
    let cursor = 0;
    async function worker() {
      while (cursor < queue.length) {
        await uploadOne(queue[cursor++], uploaderSlug);
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker),
    );
    setIsUploading(false);
  }

  async function uploadOne(item: Item, uploaderSlug: string) {
    const file = filesRef.current.get(item.id);
    if (!file) {
      patch(item.id, {
        status: "error",
        error: "Something went wrong — please re-add this photo.",
      });
      return;
    }

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

      const ext = fileExtension(file.name, item.isVideo ? "mp4" : "jpg");
      const rawBase = file.name.replace(/\.[^.]+$/, "");
      const base = rawBase.replace(/[^\w.-]+/g, "_").slice(0, 60) || "photo";
      const pathname = `${MEDIA_PREFIX}${uploaderSlug}/${base}.${ext}`;

      patch(item.id, { status: "uploading", progress: 0, error: undefined });

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
      // Surface the true cause in the console; keep the on-screen text friendly.
      console.error("Upload failed:", err);
      patch(item.id, {
        status: "error",
        error: "Upload didn't go through — tap retry.",
      });
    }
  }

  function retry(item: Item) {
    if (filesRef.current.get(item.id)) {
      void uploadOne(item, slugify(name));
      return;
    }
    inputRef.current?.click();
  }

  // Remove a still-staged item before it's shared — purely local, no network.
  function unstageItem(item: Item) {
    filesRef.current.delete(item.id);
    if (item.preview) {
      URL.revokeObjectURL(item.preview);
      urlsRef.current = urlsRef.current.filter((u) => u !== item.preview);
    }
    setItems((prev) => prev.filter((it) => it.id !== item.id));
  }

  // Remove an already-uploaded item from the public album (server delete).
  async function removeUploaded(item: Item) {
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

  const stagedCount = items.filter((i) => i.status === "staged").length;
  const uploadingCount = items.filter((i) => i.status === "uploading").length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const visibleItems = items.slice(0, MAX_VISIBLE_TILES);
  const hiddenCount = items.length - visibleItems.length;

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

      {items.length > 0 && (
        <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
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

              {item.status === "staged" && (
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink/55 px-2 py-0.5 text-[10px] text-cream">
                  Not shared yet
                </span>
              )}

              {(item.status === "staged" && !isUploading) ||
              item.status === "done" ? (
                <button
                  type="button"
                  onClick={() =>
                    item.status === "done"
                      ? removeUploaded(item)
                      : unstageItem(item)
                  }
                  aria-label="Remove this photo"
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-base leading-none text-cream"
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {hiddenCount > 0 && (
        <p className="mt-3 text-center text-sm text-ink/60">
          + {hiddenCount} more below.
        </p>
      )}

      {stagedCount > 0 && (
        <button
          type="button"
          onClick={uploadAll}
          disabled={isUploading}
          className="mt-5 w-full rounded-2xl bg-blue-deep px-6 py-4 text-lg font-semibold text-cream shadow-card transition active:scale-[0.99] disabled:opacity-70"
        >
          {isUploading
            ? "Uploading…"
            : `Upload ${stagedCount} to the album`}
        </button>
      )}

      {doneCount > 0 && uploadingCount === 0 && stagedCount === 0 && (
        <div className="pop-in mt-6 rounded-2xl bg-lemon-soft/70 px-5 py-4 text-center text-blue-deep">
          <p className="text-lg">
            Thank you{name ? `, ${name.trim()}` : ""}. Add more photos anytime.
          </p>
          <p className="mt-1 text-sm text-blue-deep/80">
            Tap × on a photo to remove it from the album.
          </p>
        </div>
      )}
    </div>
  );
}
