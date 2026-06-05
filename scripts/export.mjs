// Download every uploaded photo & video, grouped by uploader, into ./export,
// then bundle them into one zip. This is the VERIFIED archive path: it retries,
// writes a manifest, and exits non-zero if anything is missing — so a partial
// export can never look complete.
//
// Usage:
//   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx node scripts/export.mjs
//
// Get the token from Vercel → Storage → your Blob store → ".env.local" tab.
import { list } from "@vercel/blob";
import archiver from "archiver";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Set BLOB_READ_WRITE_TOKEN (from your Vercel Blob store).");
  process.exit(1);
}

const outRoot = "export";
const outRootAbs = resolve(outRoot) + sep;

// Keep every export path strictly inside ./export/ (defense against odd names).
function safeDest(pathname) {
  const relative = pathname
    .replace(/^media\//, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((seg) => seg && seg !== "." && seg !== "..")
    .join("/");
  const dest = resolve(outRoot, relative);
  if (!dest.startsWith(outRootAbs)) return null;
  return { dest, relative };
}

async function fetchWithRetry(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok && r.body) return r;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  return null;
}

const manifest = [];
const failed = [];
let cursor;
let count = 0;

do {
  const res = await list({ prefix: "media/", cursor, limit: 1000 });
  for (const blob of res.blobs) {
    const safe = safeDest(blob.pathname);
    if (!safe) {
      failed.push(`${blob.pathname}\tREJECTED_UNSAFE_PATH`);
      continue;
    }
    await mkdir(dirname(safe.dest), { recursive: true });
    const response = await fetchWithRetry(blob.url);
    if (!response) {
      failed.push(`${blob.pathname}\tFETCH_FAILED`);
      console.warn(`  FAILED: ${blob.pathname}`);
      continue;
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(safe.dest));
    manifest.push(`${blob.pathname}\t${blob.size}`);
    count += 1;
    if (count % 25 === 0) console.log(`  ${count} files...`);
  }
  cursor = res.cursor;
} while (cursor);

await writeFile(
  join(outRoot, "_manifest.txt"),
  `Downloaded: ${count}\nFailed: ${failed.length}\n\nOK (pathname\\tbytes):\n` +
    manifest.join("\n") +
    (failed.length ? `\n\nFAILED:\n${failed.join("\n")}` : ""),
);

console.log(`Downloaded ${count} files into ./${outRoot}/`);

// Bundle everything into a single archive for an easy handoff to Google Drive.
const zipName = `wedding-photos-${new Date().toISOString().slice(0, 10)}.zip`;
await new Promise((resolvePromise, reject) => {
  const output = createWriteStream(zipName);
  const archive = archiver("zip", { store: true }); // already-compressed media
  output.on("close", resolvePromise);
  archive.on("error", reject);
  archive.pipe(output);
  archive.directory(`${outRoot}/`, false);
  archive.finalize();
});
console.log(`Zipped everything into ./${zipName}`);

if (failed.length > 0) {
  console.error(
    `\n${failed.length} file(s) could NOT be exported — see export/_manifest.txt. ` +
      `Re-run before handing off.`,
  );
  process.exit(1);
}
console.log("All files exported and verified.");
