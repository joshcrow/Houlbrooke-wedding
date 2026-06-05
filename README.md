# Katie & Conner Houlbrooke — Wedding Photo Share

A dead-simple, no-login site where wedding guests add their photos & videos by
scanning a QR code. Built with Next.js + Vercel Blob. Designed so a phone-only,
non-technical guest can do it one-handed with zero instructions.

## How it works for a guest

1. Scan the QR code (or tap the link).
2. Type their name once (remembered after that; required before choosing files).
3. Tap **Choose Photos & Videos** and pick from the camera roll — they're
   **staged** locally so the guest can review and remove any before sharing.
4. Tap **Upload N to the album** to commit. A sticky bar shows overall progress;
   failures surface with a **Retry all**.

Nothing is public until the guest taps Upload. Files upload **at full quality,
untouched** — the couple gets the real originals — and large files use resilient
multipart chunked uploads to survive flaky venue wifi. Guests can't delete after
sharing; only the couple can, via `/manage`.

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

## Storage: plan for Vercel Pro

Originals are stored full-size, so a wedding's worth of photos + video will
exceed Hobby's ~1 GB free Blob allotment. Upgrade the Vercel project to **Pro
($20/mo)** — no code change needed. Per-file ceiling is `MAX_FILE_BYTES` in
[`lib/config.ts`](lib/config.ts) (currently 1 GB).

### One tradeoff of storing originals: iPhone HEIC previews

iPhones shoot **HEIC**, which most non-Apple browsers can't render in an
`<img>`. The originals are saved perfectly and download fine, but the
**`/gallery` page may show blank tiles for HEIC photos** on Android/desktop.
Two ways to handle it, if the gallery matters:

- Guests can set iPhone → Settings → Camera → Formats → **Most Compatible**
  (saves as JPEG), or
- ask me to add a small JPEG **preview** generated alongside each original —
  the gallery uses the preview, the download still gives the full HEIC.

---

## The owner page (`/manage`) — for the couple, no terminal

Set an `OWNER_PASSCODE` env var in Vercel — use a **long, random** passphrase
(it's the only thing protecting download/delete), then redeploy. Unlocking sets
a short-lived owner session cookie, so the passcode is never put in a URL. The
couple visits **`/manage`**, enters the passcode, and can:

- **Download everything as one `.zip`** — one click, straight from the browser.
- **Remove any photo/video** from the album (no time limit).
- **Copy the family share link** to the gallery.

This is the no-terminal path. One caveat: the one-click zip runs inside a single
request, so a *very* large archive (lots of HD video) can exceed the function's
time limit. For typical photo-heavy sets it's fine; if it ever stalls, fall back
to the bulk-export script below.

## After the wedding: download everything (backup / power path)

Grab the `BLOB_READ_WRITE_TOKEN` from Vercel → Storage → your Blob store →
`.env.local` tab, then:

```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx npm run export
```

Downloads every original file into `./export/`, organized by uploader, **and**
bundles them into a single `wedding-photos-<date>.zip` — ready to drop into a
Google Drive folder the couple owns.

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
| `app/gallery/page.tsx` | Everyone's photos (tap to expand + download) |
| `app/manage/page.tsx` | Owner-only: download-all zip, remove anything |
| `lib/config.ts` | Names, limits, allowed types — tweak here |
| `lib/listMedia.ts` | Shared blob listing for gallery + manage |
| `lib/ownerSession.ts` | Owner passcode session (signed cookie) |
| `scripts/make-qr.mjs` | QR code + printable table card |
| `scripts/export.mjs` | Verified download-all + zip after the wedding |
