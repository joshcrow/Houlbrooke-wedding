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
// Hobby tier note: Vercel Blob's free allotment is small (~1 GB). Downscaled
// photos are tiny so thousands fit, but video eats space fast. These caps keep
// us inside Hobby as long as possible; raise them if you upgrade to Pro.

// Hard ceiling per file, enforced both client-side and in the token route.
export const MAX_FILE_BYTES = 150 * 1024 * 1024; // 150 MB

// Photos are downscaled on the guest's device before upload (also converts
// iPhone HEIC -> JPEG so every gallery shows previews everywhere).
export const IMAGE_MAX_DIM = 2048; // longest edge, px
export const IMAGE_QUALITY = 0.82; // JPEG quality

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
