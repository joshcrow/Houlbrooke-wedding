// Single place to tweak everything. Edit here, not scattered through the app.

export const COUPLE = {
  names: "Katie & Conner",
  lastName: "Turco / Houlbrooke",
  year: "2026",
};

// Set in Vercel after the first deploy (Project → Settings → Environment Variables).
// Used to build the QR code target and absolute links.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";

// ---- Upload limits -------------------------------------------------------
// Originals are uploaded untouched (full quality). Plan to run on Vercel Pro,
// since a wedding's worth of full-size photos + video will blow past Hobby's
// ~1 GB free Blob allotment. Raise this ceiling if needed.
export const MAX_FILE_BYTES = 1024 * 1024 * 1024; // 1 GB per file

// Explicit list (no wildcards — Vercel may reject malformed MIME entries).
// Blob also infers the type from the file extension in the pathname, so the
// extension we attach is the real safety net for odd iPhone/Android types.
export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/3gpp",
];

export const MEDIA_PREFIX = "media/";
