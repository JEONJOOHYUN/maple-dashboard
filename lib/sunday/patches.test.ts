import assert from "node:assert/strict";
import { test } from "node:test";
import { SUNDAYS } from "./history.ts";
import { mlDataHash } from "./ml.ts";
import { checkSeasonPatch, eventSpans, mergePatches, seasonKey, type EventSpan, type StoredPatch } from "./patches.ts";
import { SEASON_PATCHES, seasonCall, type SeasonPatch } from "./predict.ts";

// The NEXON notice-event list on 2026-11-17 (dates only, a few of its 13 events).
const NOV17: EventSpan[] = [
  { title: "VIP 사우나", start: "2026-06-18", end: "2026-12-16" },
  { title: "하이퍼 버닝 부스터를 드려요!", start: "2026-09-17", end: "2026-12-16" },
  { title: "[출석 이벤트] - 프로텍트 아르고", start: "2026-09-17", end: "2026-11-18" },
  { title: "직업 추천 AWARDS", start: "2026-11-12", end: "2026-12-09" },
];
const WITHOUT_WINTER = SEASON_PATCHES.filter((p) => p.date !== "2026-12-17");
const winter = (date: string, confirmed: boolean): SeasonPatch => ({ date, season: "winter", confirmed });

test("the bundled list ends with the winter patch estimated by hand: confirmed history, then 2026-12-17", () => {
  assert.deepEqual(SEASON_PATCHES.at(-1), winter("2026-12-17", false));
  assert.ok(SEASON_PATCHES.slice(0, -1).every((p) => p.confirmed));
});

test("today's notices give the same winter patch as the hand estimate: nothing to write", () => {
  assert.deepEqual(checkSeasonPatch(SEASON_PATCHES, NOV17, "2026-11-17"), { action: "skip", reason: "unchanged", date: "2026-12-17" });
});

test("without the estimate, the events that started on the summer patch give it: the day after they end", () => {
  const r = checkSeasonPatch(WITHOUT_WINTER, NOV17, "2026-11-17");
  assert.equal(r.action, "write");
  if (r.action !== "write") return;
  assert.deepEqual(r.patch, winter("2026-12-17", false));
  assert.equal(r.key, "2026-winter");
  assert.equal(r.basis, "season-events");
  // Only the season-long event counts: the 09-17 events started on a mid-season update.
  assert.deepEqual(r.evidence.map((e) => e.title), ["VIP 사우나"]);
});

test("an event extended to 12-23 moves the estimate to the next Thursday", () => {
  const moved = NOV17.map((e) => (e.title === "VIP 사우나" ? { ...e, end: "2026-12-23" } : e));
  const r = checkSeasonPatch(SEASON_PATCHES, moved, "2026-11-20");
  assert.equal(r.action, "write");
  if (r.action === "write") assert.deepEqual(r.patch, winter("2026-12-24", false));
});

test("on the patch day the next season's events start: confirmed, even after the old events left the list", () => {
  const dec17: EventSpan[] = [
    { title: "겨울 시즌 이벤트", start: "2026-12-17", end: "2027-06-16" },
    { title: "짧은 이벤트", start: "2026-12-17", end: "2027-01-13" },
  ];
  const r = checkSeasonPatch(SEASON_PATCHES, dec17, "2026-12-17");
  assert.equal(r.action, "write");
  if (r.action !== "write") return;
  assert.deepEqual(r.patch, winter("2026-12-17", true));
  assert.equal(r.basis, "patch-day");
  // Still listed the day before (it ends 12-16): the estimate stands, not confirmed yet.
  assert.deepEqual(checkSeasonPatch(SEASON_PATCHES, NOV17, "2026-12-16"), { action: "skip", reason: "unchanged", date: "2026-12-17" });
});

test("a patch that came a week later than estimated: the day passed without events, the long ones that started show it", () => {
  const late: EventSpan[] = [{ title: "겨울 시즌 이벤트", start: "2026-12-24", end: "2027-06-23" }];
  assert.deepEqual(checkSeasonPatch(SEASON_PATCHES, [], "2026-12-20"), { action: "skip", reason: "patch-day-no-events" });
  const r = checkSeasonPatch(SEASON_PATCHES, late, "2026-12-26");
  assert.equal(r.action, "write");
  if (r.action === "write") {
    assert.deepEqual(r.patch, winter("2026-12-24", true));
    assert.equal(r.basis, "season-started");
  }
});

test("once the winter patch is confirmed, its season-long events give the next summer patch", () => {
  const known = mergePatches(SEASON_PATCHES, [{ season_key: "2026-winter", date: "2026-12-17", season: "winter", confirmed: true }]);
  const events: EventSpan[] = [{ title: "겨울 시즌 이벤트", start: "2026-12-17", end: "2027-06-16" }];
  const r = checkSeasonPatch(known, events, "2027-01-08");
  assert.equal(r.action, "write");
  if (r.action !== "write") return;
  assert.deepEqual(r.patch, { date: "2027-06-17", season: "summer", confirmed: false });
  assert.equal(r.key, "2027-summer");
});

test("anything odd keeps the date as it is: not a Thursday, out of season, no season-long events, a confirmed date", () => {
  const end = (d: string) => NOV17.map((e) => (e.title === "VIP 사우나" ? { ...e, end: d } : e));
  assert.deepEqual(checkSeasonPatch(SEASON_PATCHES, end("2026-12-17"), "2026-11-20"), { action: "skip", reason: "not-thursday", date: "2026-12-18" });
  assert.deepEqual(checkSeasonPatch(SEASON_PATCHES, end("2026-11-11"), "2026-11-05"), { action: "skip", reason: "out-of-season", date: "2026-11-12" });
  // Ending in October it is no season-long event (132 days): ignored, the estimate kept stands.
  assert.deepEqual(checkSeasonPatch(SEASON_PATCHES, end("2026-10-28"), "2026-10-20"), { action: "skip", reason: "unchanged", date: "2026-12-17" });
  const handChecked = [...WITHOUT_WINTER, winter("2026-12-17", true)];
  assert.deepEqual(checkSeasonPatch(handChecked, end("2026-12-23"), "2026-11-20"), { action: "skip", reason: "keep-confirmed", date: "2026-12-24" });
  assert.deepEqual(checkSeasonPatch([], NOV17, "2026-11-17"), { action: "skip", reason: "no-confirmed-patch" });
});

test("event lengths do not matter: 1 ~ 4 month events are ignored; with no season-long event, 26 weeks after the last patch", () => {
  // Every season patch so far came exactly 26 weeks after the one before.
  const confirmed = SEASON_PATCHES.filter((p) => p.confirmed);
  for (let i = 1; i < confirmed.length; i++) {
    assert.equal((Date.parse(confirmed[i].date) - Date.parse(confirmed[i - 1].date)) / 86_400_000, 26 * 7, confirmed[i].date);
  }
  const short: EventSpan[] = [
    { title: "1달", start: "2026-10-22", end: "2026-11-18" },
    { title: "2달", start: "2026-09-17", end: "2026-11-18" },
    { title: "3달", start: "2026-09-17", end: "2026-12-16" },
    { title: "4달", start: "2026-07-23", end: "2026-11-25" },
  ];
  const r = checkSeasonPatch(WITHOUT_WINTER, short, "2026-11-17");
  assert.equal(r.action, "write");
  if (r.action !== "write") return;
  assert.deepEqual(r.patch, winter("2026-12-17", false));
  assert.equal(r.basis, "26-weeks");
  assert.deepEqual(r.evidence, []);
  // The same short events next to the season-long one change nothing.
  assert.deepEqual(checkSeasonPatch(SEASON_PATCHES, [...NOV17, ...short], "2026-11-17"), { action: "skip", reason: "unchanged", date: "2026-12-17" });
});

test("merging: a stored row replaces the estimate of its season, never a confirmed bundled date; new seasons join in order", () => {
  const stored: StoredPatch[] = [
    { season_key: "2026-winter", date: "2026-12-24", season: "winter", confirmed: false },
    { season_key: "2026-summer", date: "2026-06-25", season: "summer", confirmed: true },
    { season_key: "2027-summer", date: "2027-06-17", season: "summer", confirmed: false },
  ];
  const merged = mergePatches(SEASON_PATCHES, stored);
  assert.deepEqual(merged.slice(-3), [
    { date: "2026-06-18", season: "summer", confirmed: true },
    winter("2026-12-24", false),
    { date: "2027-06-17", season: "summer", confirmed: false },
  ]);
  assert.deepEqual(mergePatches(SEASON_PATCHES, []), SEASON_PATCHES);
});

test("season keys and event dates", () => {
  assert.equal(seasonKey(winter("2026-12-17", false)), "2026-winter");
  assert.equal(seasonKey(winter("2027-01-07", false)), "2026-winter");
  assert.equal(seasonKey({ date: "2027-06-17", season: "summer" }), "2027-summer");
  assert.deepEqual(
    eventSpans([
      { title: "VIP 사우나", date_event_start: "2026-06-18T10:00+09:00", date_event_end: "2026-12-16T23:59+09:00" },
      { title: "날짜 없음", date_event_start: null, date_event_end: "" },
    ]),
    [{ title: "VIP 사우나", start: "2026-06-18", end: "2026-12-16" }],
  );
});

test("the predictions follow the merged dates: a moved patch changes the season call and the model fingerprint, confirming does not", () => {
  const moved = mergePatches(SEASON_PATCHES, [{ season_key: "2026-winter", date: "2026-12-24", season: "winter", confirmed: false }]);
  const sure = mergePatches(SEASON_PATCHES, [{ season_key: "2026-winter", date: "2026-12-17", season: "winter", confirmed: true }]);
  // Winter +2 Sundays: 2027-01-03 after a 12-17 patch, 2027-01-10 after 12-24.
  assert.equal(seasonCall(SUNDAYS, "2027-01-03")?.kind, "hit");
  assert.equal(seasonCall(SUNDAYS, "2027-01-03", moved)?.kind, "quiet");
  assert.equal(seasonCall(SUNDAYS, "2027-01-10", moved)?.kind, "hit");
  assert.notEqual(mlDataHash(SUNDAYS, "2026-11-22", moved), mlDataHash(SUNDAYS, "2026-11-22"));
  assert.equal(mlDataHash(SUNDAYS, "2026-11-22", sure), mlDataHash(SUNDAYS, "2026-11-22"));
});
