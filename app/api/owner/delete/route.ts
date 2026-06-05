import { del, head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { MEDIA_PREFIX } from "@/lib/config";
import { isOwnerAuthed } from "@/lib/ownerSession";

// Owner deletion: requires a valid owner session cookie (no passcode in the
// body). No time window — the couple can curate at any point.
export async function POST(request: Request): Promise<NextResponse> {
  if (!isOwnerAuthed()) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { url } = (await request.json()) as { url?: unknown };
  if (typeof url !== "string" || !url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let meta;
  try {
    meta = await head(url);
  } catch {
    // Genuinely can't look it up — report it rather than pretending success,
    // so a transient error doesn't make the UI think a photo is gone.
    return NextResponse.json(
      { error: "Couldn't reach storage — try again." },
      { status: 502 },
    );
  }

  if (!meta.pathname.startsWith(MEDIA_PREFIX)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  await del(url);
  return NextResponse.json({ ok: true });
}
