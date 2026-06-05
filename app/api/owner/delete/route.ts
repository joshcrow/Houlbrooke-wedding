import { del, head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { MEDIA_PREFIX } from "@/lib/config";
import { passcodeOk } from "@/lib/owner";

// Owner deletion: no time window (unlike the guest /api/delete). The couple can
// curate the album at any point, as long as they have the passcode.
export async function POST(request: Request): Promise<NextResponse> {
  const { url, passcode } = (await request.json()) as {
    url?: unknown;
    passcode?: unknown;
  };

  if (!passcodeOk(passcode)) {
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }
  if (typeof url !== "string" || !url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    const meta = await head(url);
    if (!meta.pathname.startsWith(MEDIA_PREFIX)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
  } catch {
    // Already gone — treat as success so the UI clears.
    return NextResponse.json({ ok: true });
  }

  await del(url);
  return NextResponse.json({ ok: true });
}
