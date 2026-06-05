import { NextResponse } from "next/server";
import { setGalleryHidden } from "@/lib/gallerySetting";
import { isOwnerAuthed } from "@/lib/ownerSession";

// Flip the whole public gallery on/off (no redeploy).
export async function POST(request: Request): Promise<NextResponse> {
  if (!isOwnerAuthed()) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const { hidden } = (await request.json()) as { hidden?: unknown };
  await setGalleryHidden(Boolean(hidden));
  return NextResponse.json({ ok: true });
}
