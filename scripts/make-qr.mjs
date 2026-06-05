// Generate a print-ready QR code (PNG + SVG) pointing at the live site.
// Usage: node scripts/make-qr.mjs https://your-deployment-url.vercel.app
import { mkdir, writeFile } from "node:fs/promises";
import QRCode from "qrcode";

const url = process.argv[2] || process.env.NEXT_PUBLIC_SITE_URL;
if (!url) {
  console.error(
    "Provide the site URL:\n  node scripts/make-qr.mjs https://your-url.vercel.app",
  );
  process.exit(1);
}

const outDir = "qr";
await mkdir(outDir, { recursive: true });

const opts = {
  errorCorrectionLevel: "M",
  margin: 2,
  color: { dark: "#3E5C8A", light: "#FBF7EC" }, // blue on cream, on theme
  width: 1200,
};

await QRCode.toFile(`${outDir}/wedding-qr.png`, url, opts);
const svg = await QRCode.toString(url, { ...opts, type: "svg" });
await writeFile(`${outDir}/wedding-qr.svg`, svg);

// A simple printable table card wrapping the QR.
const card = `<!doctype html><html><head><meta charset="utf-8">
<title>Scan to share photos</title>
<style>
  @page { size: 5in 7in; margin: 0; }
  body { margin:0; font-family: Georgia, serif; }
  .card { width:5in; height:7in; box-sizing:border-box; padding:0.6in 0.5in;
    background:#FBF7EC; color:#34435E; text-align:center;
    display:flex; flex-direction:column; align-items:center; justify-content:center; }
  h1 { font-size:34pt; color:#3E5C8A; margin:0 0 6pt; }
  p.sub { font-size:14pt; letter-spacing:2pt; text-transform:uppercase; color:#6E89B7; margin:0 0 18pt; }
  img { width:3in; height:3in; }
  p.foot { font-size:13pt; margin-top:18pt; }
  .url { font-size:9pt; color:#6E89B7; margin-top:6pt; word-break:break-all; }
</style></head><body><div class="card">
  <p class="sub">🍋 Katie &amp; Conner 🍋</p>
  <h1>Share Your Photos</h1>
  <img src="./wedding-qr.png" alt="QR code">
  <p class="foot">Scan with your camera<br>No app or account needed</p>
  <p class="url">${url}</p>
</div></body></html>`;
await writeFile(`${outDir}/table-card.html`, card);

console.log(`Done. Files in ./${outDir}/`);
console.log("  wedding-qr.png / .svg  — the raw code");
console.log("  table-card.html        — open in a browser and Print to PDF");
