import { del, head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { MEDIA_PREFIX } from "@/lib/config";

// Guests can remove a photo they just shared — but ONLY very recent ones. The
// gallery exposes every photo's URL publicly, so without this window anyone
// could script-delete the whole album. Legit "oops, remove that" happens within
// seconds, so a 30-minute ceiling costs real users nothing while preventing a
// mass wipe of older photos.
const DELETE_WINDOW_MS = 30 * 60 * 1000;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { url } = (await request.json()) as { url?: unknown };
    if (typeof url !== "string" || !url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    let meta;
    try {
      meta = await head(url);
    } catch {
      // Already gone, or not a real blob — treat as success so the UI clears.
      return NextResponse.json({ ok: true });
    }

    if (!meta.pathname.startsWith(MEDIA_PREFIX)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const ageMs = Date.now() - new Date(meta.uploadedAt).getTime();
    if (ageMs > DELETE_WINDOW_MS) {
      return NextResponse.json(
        { error: "This photo can no longer be removed here." },
        { status: 403 },
      );
    }

    await del(url);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
