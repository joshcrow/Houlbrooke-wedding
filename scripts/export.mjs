// Download every uploaded photo & video, grouped by uploader, into ./export.
// Run after the wedding to hand the couple one tidy folder.
//
// Usage:
//   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx node scripts/export.mjs
//
// Get the token from Vercel → Storage → your Blob store → ".env.local" tab.
import { list } from "@vercel/blob";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Set BLOB_READ_WRITE_TOKEN (from your Vercel Blob store).");
  process.exit(1);
}

const outRoot = "export";
let cursor;
let count = 0;

do {
  const res = await list({ prefix: "media/", cursor, limit: 1000 });
  for (const blob of res.blobs) {
    const relative = blob.pathname.replace(/^media\//, "");
    const dest = join(outRoot, relative);
    await mkdir(dirname(dest), { recursive: true });
    const response = await fetch(blob.url);
    if (!response.ok || !response.body) {
      console.warn(`  skipped (${response.status}): ${blob.pathname}`);
      continue;
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));
    count += 1;
    if (count % 25 === 0) console.log(`  ${count} files...`);
  }
  cursor = res.cursor;
} while (cursor);

console.log(`Done. Downloaded ${count} files into ./${outRoot}/`);
