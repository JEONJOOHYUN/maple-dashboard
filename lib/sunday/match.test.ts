import assert from "node:assert/strict";
import { test } from "node:test";
import benefits from "./data/benefits.json" with { type: "json" };
import history from "./data/history.json" with { type: "json" };
import { IGNORED_TITLES } from "./ignored.ts";
import fixtures from "./match.fixtures.json" with { type: "json" };
import { knownBenefits, matchKey, matchNotice, type OcrLine } from "./match.ts";

// Real PaddleOCR lines of one week per matcher rule (C:/dev/_work/sunday-ocr-test/bench/pick-fixtures.mjs).
// The full 167-week benchmark lives in eval-match.mjs there (2026-11-10: 145 saved automatically, 0 of them wrong).
const F = fixtures as Record<string, { why: string; lines: OcrLine[] }>;
const known = knownBenefits(
  benefits.map((b) => b.name),
  history.weeks,
);
const truth = (date: string) => history.weeks.find((w) => w.date === date)!.items.map((i) => i.name).sort();
const run = (date: string, sunday = date) => matchNotice(F[date].lines, sunday, known, IGNORED_TITLES);

for (const date of ["2026-10-25", "2024-06-30", "2026-03-22", "2026-08-09", "2024-03-10"]) {
  test(`${date} is saved automatically and matches the record (${F[date].why})`, () => {
    const r = run(date);
    assert.deepEqual(r.review, []);
    assert.deepEqual(r.items.map((i) => i.name).sort(), truth(date));
  });
}

test("a multi-week notice gives each Sunday its own section, and none for a Sunday it does not cover", () => {
  const r = run("2024-06-30", "2024-07-07");
  assert.deepEqual(r.items.map((i) => i.name).sort(), truth("2024-07-07"));
  assert.deepEqual(r.sundays, ["2024-06-23", "2024-06-30", "2024-07-07", "2024-07-14"]);
  const none = run("2024-06-30", "2024-07-21");
  assert.deepEqual(none.items, []);
  assert.equal(none.review[0].kind, "no-section");
});

test("rewards under the 솔 에르다 타임 heading carry its tag", () => {
  const sol = run("2026-08-09").items.filter((i) => /솔 에르다/.test(i.name));
  assert.equal(sol.length, 4);
  for (const i of sol) assert.deepEqual(i.tags, ["솔 에르다 타임"]);
});

test("event-linked titles in the ignore list are neither saved nor sent to review", () => {
  const r = run("2023-11-05");
  const all = [...r.items.map((i) => i.name), ...r.review.map((n) => n.line)].join(" ");
  assert.doesNotMatch(all, /패션위크/);
  assert.deepEqual(r.items.map((i) => i.name).sort(), truth("2023-11-05"));
});

test("a title whose number OCR dropped goes to review instead of a guessed variant", () => {
  const r = run("2024-08-18"); // image says 경험치 2배, OCR read 경험치 배
  assert.ok(r.review.some((n) => n.kind === "number" && /불꽃늑대/.test(n.guess ?? "")));
  assert.ok(!r.items.some((i) => /불꽃늑대/.test(i.name)));
});

test("a two-column layout mixed by OCR goes to review", () => {
  const r = run("2024-07-28");
  assert.ok(r.review.length > 0);
});

// Codex review 2026-11-10: both cases below used to be saved without review.
test("digits inside brackets must match too: a coupon whose minutes OCR dropped goes to review", () => {
  const lines = [{ t: "이벤트 기간 2023년 9월 17일(일) 오전 0시 ~ 오후 11시 59분" }, { t: "경험치 3배 쿠폰(분) 4장 지급" }];
  const r = matchNotice(lines, "2023-09-17", known, IGNORED_TITLES);
  assert.deepEqual(r.items, []);
  assert.equal(r.review[0].kind, "number");
  const ok = matchNotice([lines[0], { t: "경험치 3배 쿠폰(30분) 4장 지급" }], "2023-09-17", known, IGNORED_TITLES);
  assert.deepEqual(ok.items.map((i) => i.name), ["경험치 3배 쿠폰(30분) 4장 지급"]);
});

test("the challengers-only block is cut even when OCR missed the date line", () => {
  const lines = F["2026-03-22"].lines.filter((l) => !/이벤트\s*기간/.test(l.t));
  const r = matchNotice(lines, "2026-03-22", known, IGNORED_TITLES);
  assert.deepEqual(r.items.map((i) => i.name).sort(), truth("2026-03-22"));
});

test("matchKey reads a letter O between digits as zero and drops short notes in brackets", () => {
  assert.equal(matchKey("접속 시 'VIP 부스터' 1O개 지급"), "접속시VIP부스터10개지급");
  assert.equal(matchKey("룬 경험치 버프 효과 +100%(기본 경험치의 3배)"), "룬경험치버프효과+100%");
});
