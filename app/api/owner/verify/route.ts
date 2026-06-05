import { NextResponse } from "next/server";
import { passcodeConfigured, passcodeOk } from "@/lib/owner";

export async function POST(request: Request): Promise<NextResponse> {
  if (!passcodeConfigured()) {
    return NextResponse.json(
      { error: "Owner access isn't set up yet." },
      { status: 503 },
    );
  }
  const { passcode } = (await request.json()) as { passcode?: unknown };
  if (!passcodeOk(passcode)) {
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
