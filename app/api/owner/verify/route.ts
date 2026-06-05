import { NextResponse } from "next/server";
import { passcodeConfigured, passcodeOk } from "@/lib/owner";
import { OWNER_COOKIE, OWNER_COOKIE_OPTIONS, createSessionToken } from "@/lib/ownerSession";

// Best-effort throttle: caps attempts per IP. Resets on cold start, so it's not
// airtight — the real defense is a long random OWNER_PASSCODE — but it blunts
// trivial brute force.
const attempts = new Map<string, { n: number; t: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.t > 60_000) {
    attempts.set(ip, { n: 1, t: now });
    return false;
  }
  rec.n += 1;
  return rec.n > 10;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!passcodeConfigured()) {
    return NextResponse.json(
      { error: "Owner access isn't set up yet." },
      { status: 503 },
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts — wait a minute and try again." },
      { status: 429 },
    );
  }

  const { passcode } = (await request.json()) as { passcode?: unknown };
  if (!passcodeOk(passcode)) {
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(OWNER_COOKIE, createSessionToken(), OWNER_COOKIE_OPTIONS);
  return res;
}
