import { NextResponse } from "next/server";
import { MEDIA_PREFIX } from "@/lib/config";
import { setHidden } from "@/lib/hidden";
import { isOwnerAuthed } from "@/lib/ownerSession";

// Hide/show a single photo in the public gallery (keeps the original).
export async function POST(request: Request): Promise<NextResponse> {
  if (!isOwnerAuthed()) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const { pathname, hidden } = (await request.json()) as {
    pathname?: unknown;
    hidden?: unknown;
  };
  if (typeof pathname !== "string" || !pathname.startsWith(MEDIA_PREFIX)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  await setHidden(pathname, Boolean(hidden));
  return NextResponse.json({ ok: true });
}
