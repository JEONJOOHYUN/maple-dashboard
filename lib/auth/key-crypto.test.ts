import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { openKey, ouidHash, sealKey } from "./key-crypto.ts";

const secret = randomBytes(32).toString("base64");
const member = "3f0c1f6e-0000-4000-8000-000000000001";
const key = "test_" + "k".repeat(96);

test("a sealed key opens again, and fits the column", () => {
  const sealed = sealKey(key, secret, member);
  assert.match(sealed, /^v1:[A-Za-z0-9_-]+$/);
  assert.ok(sealed.length <= 2000);
  assert.ok(!sealed.includes(key));
  assert.equal(openKey(sealed, secret, member), key);
});

test("sealing twice never gives the same value", () => {
  assert.notEqual(sealKey(key, secret, member), sealKey(key, secret, member));
});

test("another member, another secret or a changed value does not open", () => {
  const sealed = sealKey(key, secret, member);
  assert.throws(() => openKey(sealed, secret, "3f0c1f6e-0000-4000-8000-000000000002"));
  assert.throws(() => openKey(sealed, randomBytes(32).toString("base64"), member));
  const last = sealed.at(-1) === "A" ? "B" : "A";
  assert.throws(() => openKey(sealed.slice(0, -1) + last, secret, member));
  assert.throws(() => openKey("v2:" + sealed.slice(3), secret, member));
  assert.throws(() => openKey("v1:AAAA", secret, member));
});

test("a secret that is not 32 bytes stops both ways", () => {
  assert.throws(() => sealKey(key, "short", member));
  assert.throws(() => sealKey(key, undefined, member));
  assert.throws(() => openKey(sealKey(key, secret, member), "", member));
});

test("ouidHash is the 64 hex characters the table asks for", () => {
  assert.match(ouidHash("0123456789abcdef0123456789abcdef"), /^[0-9a-f]{64}$/);
  assert.notEqual(ouidHash("a"), ouidHash("b"));
});
