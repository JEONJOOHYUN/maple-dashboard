import assert from "node:assert/strict";
import { test } from "node:test";
import { avatarLetter, isKeyShape, isMemberClaims, packLabel, safeNext, unpackLabel } from "./rules.ts";

test("safeNext keeps same-site paths only", () => {
  assert.equal(safeNext("/income"), "/income");
  assert.equal(safeNext("/me?tab=key"), "/me?tab=key");
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("/\\evil.com"), "/");
  assert.equal(safeNext("https://evil.com"), "/");
  assert.equal(safeNext("/\t/evil.com"), "/", "parsers drop the tab: //evil.com");
  assert.equal(safeNext("/\n/evil.com"), "/");
  assert.equal(safeNext("/ /evil.com"), "/");
  assert.equal(safeNext("/spec?name=%ED%9D%91%EC%86%8C"), "/spec?name=%ED%9D%91%EC%86%8C");
  assert.equal(safeNext(undefined), "/");
});

test("safeNext never loops back into login or the callback", () => {
  assert.equal(safeNext("/login"), "/");
  assert.equal(safeNext("/login?next=/x"), "/");
  assert.equal(safeNext("/auth/callback"), "/");
  assert.equal(safeNext("/auth/callback?code=x"), "/");
  assert.equal(safeNext("/authors"), "/authors", "only the /auth segment itself is held back");
});

test("only members of this site pass the claims check", () => {
  assert.equal(isMemberClaims({ app_metadata: { app: "maple" } }), true);
  assert.equal(isMemberClaims({ app_metadata: { app: "other" } }), false);
  assert.equal(isMemberClaims({ app_metadata: { provider: "google" } }), false, "a fresh Google account is not marked yet");
  assert.equal(isMemberClaims({}), false);
  assert.equal(isMemberClaims(null), false);
});

test("avatar letter is one plain character", () => {
  assert.equal(avatarLetter("maple.user@example.com"), "M");
  assert.equal(avatarLetter(" 7days@example.com"), "7");
  assert.equal(avatarLetter("_x@example.com"), "·");
  assert.equal(avatarLetter(undefined), "·");
});

test("only one run of printable ASCII looks like an API key", () => {
  assert.equal(isKeyShape("test_" + "a".repeat(96)), true);
  assert.equal(isKeyShape("short"), false);
  assert.equal(isKeyShape("a".repeat(301)), false);
  assert.equal(isKeyShape("with space " + "a".repeat(30)), false);
  assert.equal(isKeyShape("한글" + "a".repeat(30)), false);
  assert.equal(isKeyShape("line\n" + "a".repeat(30)), false);
  assert.equal(isKeyShape(null), false);
});

test("the account label keeps the main character and its world", () => {
  assert.equal(packLabel("예시캐릭터", "스카니아"), "예시캐릭터|스카니아");
  assert.deepEqual(unpackLabel("예시캐릭터|스카니아"), { name: "예시캐릭터", world: "스카니아" });
  assert.equal(packLabel("", "스카니아"), null, "an account without characters has no label");
  assert.deepEqual(unpackLabel(null), { name: "", world: "" });
  assert.ok((packLabel("a".repeat(40), "b") ?? "").length <= 30, "never longer than the column allows");
});
