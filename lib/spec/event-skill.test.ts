import assert from "node:assert/strict";
import { test } from "node:test";
import { eventSkillNames } from "./event-skill.ts";

const at = (iso: string) => Date.parse(iso);
// Titles as the event notice list had them on 2026-11-13.
const notices = [
  { title: "썬데이 메이플", date_event_start: "2026-11-15T00:00+09:00", date_event_end: "2026-11-15T23:59+09:00" },
  { title: "[출석 이벤트] - 프로텍트 아르고", date_event_start: "2026-09-17T10:00+09:00", date_event_end: "2026-11-18T23:59+09:00" },
  { title: "[이벤트 스킬] - 아르고 호의 가호", date_event_start: "2026-09-17T10:00+09:00", date_event_end: "2026-11-18T23:59+09:00" },
  { title: "[이벤트 샵] - 아르고 주화 상점", date_event_start: "2026-09-17T10:00+09:00", date_event_end: "2026-11-18T23:59+09:00" },
];

test("event skill: the name comes from a running [이벤트 스킬] notice", () => {
  assert.deepEqual(eventSkillNames(notices, at("2026-11-13T12:00+09:00")), ["아르고 호의 가호"]);
  // Before it starts and after it ends there is nothing to ask for.
  assert.deepEqual(eventSkillNames(notices, at("2026-09-17T09:59+09:00")), []);
  assert.deepEqual(eventSkillNames(notices, at("2026-11-19T00:00+09:00")), []);
});

test("event skill: other titles, missing dates and repeats give no name", () => {
  const now = at("2026-11-13T12:00+09:00");
  assert.deepEqual(eventSkillNames([{ title: "이벤트 스킬 안내" }, { title: "[이벤트 스킬] - 가호" }, {}], now), []);
  const twice = [notices[2], { ...notices[2], title: " [이벤트 스킬]  -  아르고 호의 가호 " }];
  assert.deepEqual(eventSkillNames(twice, now), ["아르고 호의 가호"]);
});
