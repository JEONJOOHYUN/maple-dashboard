import { test } from "node:test";
import assert from "node:assert/strict";
import type { Period } from "./check.ts";
import { periodGroups } from "./period-rows.ts";

const P = (kind: Period["kind"], name: string, slot: string, days: number, at: string): Period => ({ kind, name, slot, days, at });

test("남은 기간 box: one title per kind, same-day things on one row, red where 놓친 스펙 has it (흑소 11/17)", () => {
  const periods = [
    P("label", "청몽선율", "상의", 179, "2027-05-14"),
    P("label", "청몽운", "신발", 179, "2027-05-14"),
    P("label", "환호지선", "무기", 179, "2027-05-14"),
    P("label", "달빛 눈물", "망토", 185, "2027-05-20"),
    P("pet", "쁘띠 스노우", "", 194, "2027-05-29"),
    P("pet", "카이", "", 194, "2027-05-29"),
    P("pet", "아델레", "", 194, "2027-05-30"),
    P("label", "청몽잠", "모자", 276, "2027-08-20"),
  ];
  assert.deepEqual(periodGroups(periods, ["성장 플러스 · 마라벨 5개", "전투 플러스 · 마라벨 5개"]), [
    {
      title: "마스터라벨 능력치",
      warn: false,
      rows: [
        { what: "상의 · 신발 · 무기", date: "5/14", days: "179일", warn: false },
        { what: "망토", date: "5/20", days: "185일", warn: false },
        { what: "모자", date: "8/20", days: "276일", warn: false },
      ],
      notes: [],
    },
    {
      title: "펫 3마리",
      warn: false,
      rows: [
        { what: "쁘띠 스노우 · 카이", date: "5/29", days: "194일", warn: false },
        { what: "아델레", date: "5/30", days: "194일", warn: false },
      ],
      notes: [],
    },
    { title: "마스터라벨 플러스", value: "켜짐", warn: false, rows: [], notes: ["성장 · 전투 · 마라벨 5개 기준"] },
  ]);
});

test("남은 기간 box: warnings — a 기간제 item under 7 days, a pet over, labels without 전투 플러스", () => {
  const g = periodGroups(
    [P("pet", "쁘띠 플로라", "", -1, "2026-11-17"), P("cashItem", "오로라 반지", "반지1", 3, "2026-11-20"), P("label", "청몽잠", "모자", 30, "2026-12-17")],
    ["성장 플러스 · 마라벨 1개"],
  );
  assert.deepEqual(
    g.map((x) => [x.title, x.value ?? "", x.warn, x.rows.map((r) => `${r.what} ${r.date} ${r.days}${r.warn ? "!" : ""}`)]),
    [
      ["마스터라벨 능력치", "", false, ["모자 12/17 30일"]],
      ["캐시 장비 기간", "", true, ["오로라 반지 11/20 3일!"]],
      ["펫 1마리", "", true, ["쁘띠 플로라 11/17 끝남!"]],
      ["마스터라벨 플러스", "성장만", true, []],
    ],
  );
  // Nothing worn, nothing running: no box at all; other-stat missing: no plus group.
  assert.deepEqual(periodGroups([], []), []);
  assert.deepEqual(periodGroups([P("label", "청몽잠", "모자", 30, "2026-12-17")], null).map((x) => x.title), ["마스터라벨 능력치"]);
});
