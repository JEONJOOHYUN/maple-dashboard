// Member rules shared by the proxy, the login action and the callback (pure, no I/O, so it is unit-tested).
//
// Members sign in with Google through Supabase Auth. Nothing here reads a cookie or the network.

/** app_metadata.app value that marks a member of this site (the row policies of migration 007 ask for it). */
export const MEMBER_APP = "maple";

/** Readable by the header (not httpOnly): display only, never trusted for access. Value: one letter for the avatar. */
export const HINT_COOKIE = "maple_member";
/** Where to go after the round trip to Google (httpOnly). Kept out of the callback address, so that address is exact. */
export const NEXT_COOKIE = "maple_next";
export const CALLBACK_PATH = "/auth/callback";

/**
 * Where to go after login. Only same-site paths are allowed. URL parsers drop tabs and newlines and read "\" as
 * "/", so "/<tab>/evil.com" or "/\evil.com" would turn into "//evil.com" (another host): only printable ASCII
 * without a backslash passes, and the parsed result must still be on our own origin.
 */
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || !/^\/[\x21-\x5b\x5d-\x7e]*$/.test(raw) || raw.startsWith("//")) return "/";
  try {
    if (new URL(raw, "http://self.invalid").origin !== "http://self.invalid") return "/";
  } catch {
    return "/";
  }
  // Never back to the login page or into the callback: both would loop.
  for (const loop of ["/login", "/auth"]) {
    if (raw === loop || raw.startsWith(`${loop}?`) || raw.startsWith(`${loop}/`)) return "/";
  }
  return raw;
}

/** True when the token claims belong to a member of this site. */
export function isMemberClaims(claims: { app_metadata?: Record<string, unknown> } | null | undefined): boolean {
  return claims?.app_metadata?.app === MEMBER_APP;
}

/** NEXON accounts one member can connect. */
export const MAX_NEXON_ACCOUNTS = 10;

/** What a pasted API key can look like at all: one run of printable ASCII. Checked before NEXON is asked. */
export function isKeyShape(key: unknown): key is string {
  return typeof key === "string" && /^[\x21-\x7e]{20,300}$/.test(key);
}

/** "name|world" kept as the account's label (the main character when the key was saved). */
export function packLabel(name: string, world: string): string | null {
  return name ? `${name}|${world}`.slice(0, 30) : null;
}

export function unpackLabel(label: string | null | undefined): { name: string; world: string } {
  const [name = "", world = ""] = (label ?? "").split("|");
  return { name, world };
}

/** The letter shown in the header avatar. Falls back to a dot for an address that starts with something else. */
export function avatarLetter(email: unknown): string {
  const first = typeof email === "string" ? email.trim().charAt(0).toUpperCase() : "";
  return /^[A-Z0-9]$/.test(first) ? first : "·";
}
