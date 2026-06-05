"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import { MAX_FILE_BYTES, MEDIA_PREFIX } from "@/lib/config";
import { fileExtension, slugify } from "@/lib/slug";

// Switch to multipart (resilient chunked upload) for anything large, so big
// videos and full-size photos survive flaky venue wifi.
const MULTIPART_THRESHOLD = 8 * 1024 * 1024;

type Status = "processing" | "uploading" | "done" | "error";

interface Item {
  id: string;
  name: string;
  isVideo: boolean;
  preview?: string;
  status: Status;
  progress: number;
  error?: string;
}

const NAME_KEY = "kc-uploader-name";
const CONCURRENCY = 3;

export default function UploadExperience() {
  const [name, setName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  // Keep the actual File for each in-flight item so "Retry" re-uploads the
  // exact same file instead of re-opening the picker (avoids duplicates).
  const filesRef = useRef<Map<string, File>>(new Map());

  useEffect(() => {
    setName(localStorage.getItem(NAME_KEY) ?? "");
  }, []);

  function rememberName(value: string) {
    setName(value);
    localStorage.setItem(NAME_KEY, value.trim());
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
        id: crypto.randomUUID(),
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
      const ext = fileExtension(file.name, item.isVideo ? "mp4" : "jpg");
      const rawBase = file.name.replace(/\.[^.]+$/, "");
      const base =
        rawBase.replace(/[^\w.-]+/g, "_").slice(0, 60) || "photo";
      const pathname = `${MEDIA_PREFIX}${uploaderSlug}/${base}.${ext}`;

      patch(item.id, { status: "uploading", preview });

      await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        // Empty on some iPhone files — let Blob infer from the .ext in pathname.
        contentType: file.type || undefined,
        multipart: item.isVideo || file.size > MULTIPART_THRESHOLD,
        onUploadProgress: ({ percentage }) =>
          patch(item.id, { progress: Math.round(percentage) }),
      });

      filesRef.current.delete(item.id);
      patch(item.id, { status: "done", progress: 100 });
    } catch {
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

  const doneCount = items.filter((i) => i.status === "done").length;
  const activeCount = items.filter(
    (i) => i.status === "uploading" || i.status === "processing",
  ).length;

  return (
    <div className="w-full max-w-xl">
      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium text-blue-deep">
          Your first name
        </span>
        <input
          value={name}
          onChange={(e) => rememberName(e.target.value)}
          placeholder="So Katie & Conner can say thanks 💛"
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
        className="flex w-full items-center justify-center gap-3 rounded-3xl bg-blue-deep px-6 py-6 text-2xl font-semibold text-cream shadow-card transition active:scale-[0.99]"
      >
        <span className="text-3xl">📷</span>
        Add Photos &amp; Videos
      </button>

      <p className="mt-3 text-center text-sm text-ink/60">
        Pick as many as you like — they upload automatically.
      </p>

      {doneCount > 0 && activeCount === 0 && (
        <div className="pop-in mt-6 rounded-2xl bg-lemon-soft/70 px-5 py-4 text-center text-lg text-blue-deep">
          🎉 Thank you{name ? `, ${name.trim()}` : ""}! {doneCount}{" "}
          {doneCount === 1 ? "memory" : "memories"} added. Add more anytime.
        </div>
      )}

      {items.length > 0 && (
        <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {items.map((item) => (
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
                {item.status === "done" && (
                  <span className="rounded-full bg-blue-deep/85 px-2 py-1 text-xs text-cream">
                    ✓
                  </span>
                )}
                {(item.status === "uploading" ||
                  item.status === "processing") && (
                  <span className="rounded-full bg-ink/60 px-2 py-1 text-xs text-cream">
                    {item.status === "processing"
                      ? "…"
                      : `${item.progress}%`}
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
