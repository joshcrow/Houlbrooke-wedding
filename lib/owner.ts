// Server-only: validates the owner passcode (set as OWNER_PASSCODE in Vercel).
// If the env var isn't set, owner access is closed by default.
export function passcodeOk(input: unknown): boolean {
  const expected = process.env.OWNER_PASSCODE;
  if (!expected) return false;
  return typeof input === "string" && input === expected;
}

export function passcodeConfigured(): boolean {
  return Boolean(process.env.OWNER_PASSCODE);
}
