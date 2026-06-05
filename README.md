# Katie & Conner Houlbrooke — Wedding Photo Share

A dead-simple, no-login site where wedding guests add their photos & videos by
scanning a QR code. Built with Next.js + Vercel Blob. Designed so a phone-only,
non-technical guest can do it one-handed with zero instructions.

## How it works for a guest

1. Scan the QR code (or tap the link).
2. Type their first name once (remembered after that).
3. Tap **Add Photos & Videos**, pick from their camera roll — done. Files
   upload automatically with a progress indicator and a thank-you.

Photos are downscaled **on the phone** before upload (smaller storage, and it
converts iPhone HEIC → JPEG so previews work everywhere). Videos upload as-is
via resilient multipart chunks.

---

## Deploy (≈10 minutes)

1. **Push this repo to GitHub** (already on your branch).
2. In **Vercel → Add New → Project**, import the repo. Framework auto-detects
   as Next.js. Deploy.
3. **Create the storage:** Project → **Storage** → **Create** → **Blob**.
   Vercel adds `BLOB_READ_WRITE_TOKEN` to the project automatically.
4. **Set the URL:** Project → Settings → Environment Variables →
   add `NEXT_PUBLIC_SITE_URL` = your deployment URL (e.g.
   `https://houlbrooke-wedding.vercel.app`). **Redeploy** so it takes effect.
5. **Make the QR code & table card:**
   ```bash
   npm install
   npm run qr -- https://your-deployment-url.vercel.app
   ```
   Outputs to `./qr/` — open `table-card.html` in a browser and Print → Save as
   PDF for a 5×7 table card. Print and place on reception tables.

That's it. Share the link / QR with guests.

---

## Heads-up: the Hobby storage limit

This runs on Vercel's free **Hobby** tier. Blob's free allotment is small
(~1 GB). Because photos are downscaled on-device, **thousands of photos fit
fine** — but **video fills space fast** (a single phone clip can be 50–150 MB).

If uploads start failing on the day, that's storage filling up. The one-click
fix is upgrading the Vercel project to **Pro ($20/mo)**; nothing in the code
needs to change. Tune the caps in [`lib/config.ts`](lib/config.ts)
(`MAX_FILE_BYTES`, `IMAGE_MAX_DIM`, `IMAGE_QUALITY`) anytime.

---

## After the wedding: download everything

Grab the `BLOB_READ_WRITE_TOKEN` from Vercel → Storage → your Blob store →
`.env.local` tab, then:

```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx npm run export
```

Downloads every original file into `./export/`, organized by uploader — ready
to hand to Katie & Conner.

---

## Local development

```bash
npm install
# put BLOB_READ_WRITE_TOKEN in .env.local (from your Vercel Blob store)
npm run dev
```

## Project map

| Path | What it is |
| --- | --- |
| `app/page.tsx` | The upload page guests land on |
| `components/UploadExperience.tsx` | The whole upload UX |
| `app/api/upload/route.ts` | No-login upload-token gatekeeper |
| `app/gallery/page.tsx` | Everyone's photos |
| `lib/config.ts` | Names, limits, allowed types — tweak here |
| `lib/processImage.ts` | On-device downscale + HEIC→JPEG |
| `scripts/make-qr.mjs` | QR code + printable table card |
| `scripts/export.mjs` | Download-all after the wedding |
