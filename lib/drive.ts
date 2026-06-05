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

// Resumable upload of an in-memory buffer. We buffer (rather than stream) so the
// declared length always matches the bytes sent — Drive validates against it, so
// a truncated/short read can never be silently accepted as a complete file. The
// caller caps file size before buffering, so memory stays bounded.
export async function uploadToDrive(opts: {
  accessToken: string;
  name: string;
  contentType: string;
  data: Uint8Array;
}): Promise<void> {
  const folderId = process.env.GDRIVE_FOLDER_ID ?? "";
  const length = opts.data.byteLength;

  const start = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": opts.contentType,
        "X-Upload-Content-Length": String(length),
      },
      body: JSON.stringify({ name: opts.name, parents: [folderId] }),
    },
  );
  if (!start.ok) {
    throw new Error(`drive start ${start.status}: ${await start.text()}`);
  }
  const uploadUrl = start.headers.get("location");
  if (!uploadUrl) throw new Error("drive: no resumable upload URL");

  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: opts.data as unknown as BodyInit,
  });
  if (!put.ok) {
    throw new Error(`drive put ${put.status}: ${await put.text()}`);
  }
}

