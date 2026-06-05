// Single place to tweak everything. Edit here, not scattered through the app.

export const COUPLE = {
  names: "Katie & Conner",
  lastName: "Houlbrooke",
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

export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
];

export const MEDIA_PREFIX = "media/";
