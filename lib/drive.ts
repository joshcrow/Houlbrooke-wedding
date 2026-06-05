import "server-only";

// Minimal Google Drive client over raw fetch (no SDK dependency, so it can't
// affect the rest of the app's build). Used only by the backup cron route.

export function driveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GDRIVE_FOLDER_ID,
  );
}

export async function getDriveAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`drive token ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("drive token: no access_token");
  return data.access_token;
}

// Resumable upload, streaming the blob body straight through — the file is
// never held in memory.
export async function uploadToDrive(opts: {
  accessToken: string;
  name: string;
  size: number;
  contentType: string;
  body: ReadableStream<Uint8Array>;
}): Promise<void> {
  const folderId = process.env.GDRIVE_FOLDER_ID ?? "";

  const start = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": opts.contentType,
        "X-Upload-Content-Length": String(opts.size),
      },
      body: JSON.stringify({ name: opts.name, parents: [folderId] }),
    },
  );
  if (!start.ok) {
    throw new Error(`drive start ${start.status}: ${await start.text()}`);
  }
  const uploadUrl = start.headers.get("location");
  if (!uploadUrl) throw new Error("drive: no resumable upload URL");

  // duplex is required by undici to stream a request body; not in the TS lib.
  const init = {
    method: "PUT",
    headers: { "Content-Length": String(opts.size) },
    body: opts.body,
    duplex: "half",
  } as unknown as RequestInit;

  const put = await fetch(uploadUrl, init);
  if (!put.ok) {
    throw new Error(`drive put ${put.status}: ${await put.text()}`);
  }
}
