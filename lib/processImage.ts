import { IMAGE_MAX_DIM, IMAGE_QUALITY } from "@/lib/config";

// Downscale + re-encode a photo to JPEG on the guest's device.
// Why: keeps files tiny (Hobby-friendly storage), and because iOS Safari can
// decode HEIC, this also converts iPhone HEIC -> JPEG so the gallery previews
// on every device. If decoding fails for any reason, we return the original
// file untouched so the upload still succeeds.
export async function processImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });

    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, IMAGE_MAX_DIM / longest);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY),
    );
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    // Couldn't decode (e.g. HEIC on a non-Apple browser) — upload as-is.
    return file;
  }
}
