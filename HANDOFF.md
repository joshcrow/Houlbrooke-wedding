# Handoff

Two things live here: a paste-ready note to send the couple, and operator notes
for whoever runs this (Josh). Replace the bracketed placeholders before sending.

---

## Note to send Katie & Conner

> **Your wedding photo album — how it works**
>
> Hi Katie & Conner!
>
> We set up a little site where guests can add their own photos and videos from
> the wedding — no app, no account. They scan the QR code on the tables (or tap
> the link) and upload. Everything collects in one place for you.
>
> **The link to share / the QR:** [LIVE_URL]
>
> **Your private control page:** [LIVE_URL]/manage
> **Passcode:** [OWNER_PASSCODE] — keep this private; it's the key to everything.
>
> On that **Manage** page you can:
>
> - **Download everything** — one button gives you a zip of every original photo
>   and video. (For a very large album with lots of video, tell me and I'll run
>   the bigger backup for you.)
> - **Hide or Delete any photo:**
>   - **Hide** removes a photo from the public gallery but *keeps it* — it's
>     still in your downloads. Use **Hide** for anything you want off the public
>     gallery during the wedding.
>   - **Delete** is *permanent*. Please **only Delete after we've backed
>     everything up.**
> - **Turn the whole gallery off or on** with one tap, instantly.
>
> **Two quick favors:**
> 1. Don't ask anyone to "delete the website/project" until we've saved a copy of
>    all the photos (I'll handle the backup a little after the wedding).
> 2. Keep the passcode to yourselves.
>
> **One thing to tell guests** (maybe have the MC mention it): *"When you upload,
> keep the page open and your screen on until it says done."* That's the only
> thing that trips people up.
>
> That's it — have the most beautiful day.

---

## Operator notes (Josh)

**Before sending the note**
- Confirm `NEXT_PUBLIC_SITE_URL` is set in Vercel so the link/QR resolve.
- Confirm `OWNER_PASSCODE` is strong but memorable (or save it to the couple's
  Notes for them). It controls **download and delete**.
- Set a Vercel **spend limit** (Settings → Billing).

**Day-of**
- Print + scan-test the QR (`npm run qr -- <LIVE_URL>` → `qr/table-card.html`).
- After your final live test, **stop pushing to the branch** — every push
  auto-deploys to production. Freeze it.
- Keep a Plan B link (a shared Google Photos album) in your pocket.

**After the wedding (the backup)**
- Run the verified export and keep the zip somewhere safe (e.g. Google Drive):
  ```
  BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx npm run export
  ```
  It writes `export/` + a `wedding-photos-<date>.zip`, plus `_manifest.txt`, and
  exits non-zero if anything is missing.
- Only after that archive is verified should anyone Delete photos or tear down
  the Vercel project / Blob store.
- The photos live in **one place** (Vercel Blob) until you export — don't delete
  the project or downgrade off Pro before the backup exists.
