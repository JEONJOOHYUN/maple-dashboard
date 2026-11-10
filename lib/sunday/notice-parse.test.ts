import assert from "node:assert/strict";
import { test } from "node:test";
import { noticeImages, pickSundayNotice, type EventNotice } from "./notice-parse.ts";

const ev = (notice_id: number, title: string, start: string, end: string): EventNotice => ({
  title,
  url: `https://maplestory.nexon.com/News/Event/${notice_id}`,
  notice_id,
  date: start,
  date_event_start: `${start}T00:00+09:00`,
  date_event_end: `${end}T23:59+09:00`,
});

test("picks the Sunday notice whose period covers the date", () => {
  const list = [
    ev(1404, "메이플 이스케이프: 사라진 네미", "2026-10-22", "2026-11-18"),
    ev(1410, "썬데이 메이플", "2026-11-15", "2026-11-15"),
    ev(1411, "스페셜 썬데이 메이플", "2026-11-22", "2026-11-22"),
  ];
  assert.equal(pickSundayNotice(list, "2026-11-15")?.notice_id, 1410);
  assert.equal(pickSundayNotice(list, "2026-11-22")?.notice_id, 1411);
  assert.equal(pickSundayNotice(list, "2026-11-29"), null);
});

test("a multi-week notice covers each of its Sundays", () => {
  const list = [ev(981, "썬데이 메이플", "2024-06-23", "2024-07-14")];
  assert.equal(pickSundayNotice(list, "2024-07-07")?.notice_id, 981);
});

test("keeps notice images in order and skips gifs and editor leftovers", () => {
  const html = `
    <p class="b_srch">썬데이 메이플</p>
    <img src="https://lwi.nexon.com/maplestory/2026/0417_board/22AB8272F220B975.png" alt="">
    <img src="s3://bucket/pre-lwis3/maplestory/2026/0417_board/x.png">
    <img src="https://lwi.nexon.com/maplestory/test/2026/0417_board/3E8772CDFEBD6FDA.gif">
    <IMG alt="" SRC='http://lwi.nexon.com/maplestory/2023/0921_board/188B6D44987F7E57_2.png'>
    <img src="https://lwi.nexon.com/maplestory/2026/0417_board/22AB8272F220B975.png">
    <img src="https://example.com/ad.png">`;
  assert.deepEqual(noticeImages(html), [
    "https://lwi.nexon.com/maplestory/2026/0417_board/22AB8272F220B975.png",
    "https://lwi.nexon.com/maplestory/2023/0921_board/188B6D44987F7E57_2.png",
  ]);
});
