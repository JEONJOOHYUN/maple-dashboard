// How a member's NEXON API key is kept (public.nexon_accounts, migration 007). Pure: the secret is passed in, so
// this file is unit-tested; lib/auth/nexon-key.ts reads it from the environment.
//
//   key_cipher = "v1:" + base64url(iv 12 bytes | auth tag 16 bytes | ciphertext), AES-256-GCM.
//   The member's id is authenticated with it: a row copied under another member does not open.
//   ouid_hash  = SHA-256 of NEXON's account id (32 characters, opaque). The id itself is never stored.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** MAPLE_KEY_SECRET: 32 random bytes in base64. Anything else is a setup mistake and stops here. */
function secretBytes(secret: string | undefined): Buffer {
  const bytes = Buffer.from(secret ?? "", "base64");
  if (bytes.length !== 32) throw new Error("MAPLE_KEY_SECRET must be 32 bytes in base64.");
  return bytes;
}

const bound = (memberId: string) => Buffer.from(`maple-key:v1:${memberId}`);

export function sealKey(key: string, secret: string | undefined, memberId: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", secretBytes(secret), iv);
  cipher.setAAD(bound(memberId));
  const body = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return VERSION + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** Throws when the value was changed, belongs to another member or was sealed with another secret. */
export function openKey(sealed: string, secret: string | undefined, memberId: string): string {
  if (!sealed.startsWith(VERSION)) throw new Error("Unknown key format.");
  const raw = Buffer.from(sealed.slice(VERSION.length), "base64url");
  if (raw.length <= IV_BYTES + TAG_BYTES) throw new Error("Key value too short.");
  const decipher = createDecipheriv("aes-256-gcm", secretBytes(secret), raw.subarray(0, IV_BYTES));
  decipher.setAAD(bound(memberId));
  decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
}

export function ouidHash(ouid: string): string {
  return createHash("sha256").update(ouid).digest("hex");
}
