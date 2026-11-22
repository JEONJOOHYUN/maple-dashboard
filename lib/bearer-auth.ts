import { timingSafeEqual } from "node:crypto";

/**
 * True only when the Authorization header is exactly "Bearer <secret>". No secret set → nobody gets in.
 * The whole header is compared in constant time; the lengths are checked first because timingSafeEqual throws on
 * buffers of different lengths.
 */
export function bearerAuthorized(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}
