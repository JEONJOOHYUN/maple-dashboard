import assert from "node:assert/strict";
import { test } from "node:test";
import { nexonUrl, shapeNews, type RawNews } from "./news-parse.ts";

const EVENT = "https://maplestory.nexon.com/News/Event/";
const IMG = "https://file.nexon.com/NxFile/download/FileDownloader.aspx?oidFile=";
const raw: RawNews = {
  notice: [
    { title: "11/12(목) 넥슨 정기점검 안내", url: "https://maplestory.nexon.com/News/Notice/1", notice_id: 1, date: "2026-11-10T17:00+09:00" },
    { title: "주소가 이상한 공지", url: "javascript:alert(1)", notice_id: 2, date: "2026-11-09T17:00+09:00" },
  ],
  update: Array.from({ length: 8 }, (_, i) => ({ title: `클라이언트 1.2.${420 - i} 업데이트 안내`, url: `https://maplestory.nexon.com/News/Update/${i + 1}`, notice_id: i + 1, date: "2026-10-22T10:00+09:00" })),
  event: [
    { title: "썬데이 메이플", url: EVENT + "1409", thumbnail_url: IMG + "1", notice_id: 1409, date_event_end: "2026-11-15T23:59+09:00" },
    { title: "직업 추천 AWARDS", url: EVENT + "1408", thumbnail_url: IMG + "2", notice_id: 1408, date_event_end: "2026-12-09T23:59+09:00" },
    { title: "모멘텀 패스 PLUS", url: EVENT + "1400", thumbnail_url: IMG + "3", notice_id: 1400, date_event_end: "2026-11-18T23:59+09:00" },
    { title: "오늘 끝나는 이벤트", url: EVENT + "1390", thumbnail_url: IMG + "4", notice_id: 1390, date_event_start: "2026-10-22T10:00+09:00", date_event_end: "2026-11-13T23:59+09:00" },
    { title: "오늘 아침에 끝난 이벤트", url: EVENT + "1391", thumbnail_url: IMG + "9", notice_id: 1391, date_event_end: "2026-11-13T09:59+09:00" },
    { title: "다음 주에 시작하는 이벤트", url: EVENT + "1410", thumbnail_url: IMG + "10", notice_id: 1410, date_event_start: "2026-11-19T10:00+09:00", date_event_end: "2026-12-16T23:59+09:00" },
    { title: "끝난 이벤트", url: EVENT + "1300", thumbnail_url: IMG + "5", notice_id: 1300, date_event_end: "2026-11-12T23:59+09:00" },
    { title: "그림 없는 이벤트", url: EVENT + "1301", notice_id: 1301, date_event_end: "2026-11-20T23:59+09:00" },
    { title: "다른 곳의 그림", url: EVENT + "1302", thumbnail_url: "https://example.com/a.png", notice_id: 1302, date_event_end: "2026-11-20T23:59+09:00" },
  ],
  cashshop: [
    { title: "10월 22일 캐시아이템 업데이트 - 부티크 기프트", url: "https://maplestory.nexon.com/News/CashShop/651", thumbnail_url: IMG + "6", notice_id: 651, date: "2026-10-22T10:00+09:00", date_sale_start: "2026-10-22T10:00+09:00", date_sale_end: "2026-11-18T23:59+09:00" },
    { title: "10월 22일 캐시아이템 업데이트 - 로얄스타일 & 마스터피스", url: "https://maplestory.nexon.com/News/CashShop/650", thumbnail_url: IMG + "7", notice_id: 650, date: "2026-10-22T10:00+09:00" },
    { title: "9월 17일 캐시아이템 업데이트 - 끝난 판매", url: "https://maplestory.nexon.com/News/CashShop/640", thumbnail_url: IMG + "8", notice_id: 640, date: "2026-09-17T10:00+09:00", date_sale_end: "2026-10-21T23:59+09:00" },
    { title: "11월 19일 캐시아이템 업데이트 - 아직 안 파는 것", url: "https://maplestory.nexon.com/News/CashShop/660", thumbnail_url: IMG + "11", notice_id: 660, date: "2026-11-13T10:00+09:00", date_sale_start: "2026-11-19T10:00+09:00", date_sale_end: "2026-12-16T23:59+09:00" },
  ],
};

test("addresses from the API are used only when they are https on nexon.com", () => {
  assert.equal(nexonUrl("https://maplestory.nexon.com/News/Event/1409"), "https://maplestory.nexon.com/News/Event/1409");
  assert.equal(nexonUrl("https://file.nexon.com/NxFile/download/FileDownloader.aspx?oidFile=1"), "https://file.nexon.com/NxFile/download/FileDownloader.aspx?oidFile=1");
  for (const bad of ["http://maplestory.nexon.com/x", "https://nexon.com.example.org/x", "https://evilnexon.com/x", "javascript:alert(1)", "", undefined]) assert.equal(nexonUrl(bad), "");
});

test("home news: events by the day they end, cash shop newest first, five rows of each text list", () => {
  // Friday 2026-11-13 12:00 in Korea.
  const news = shapeNews(raw, new Date("2026-11-13T03:00:00Z"));
  // Events on right now, soonest end first: the Sunday notice, ended ones (one ended at 09:59 this morning), one
  // that starts next week and ones without a NEXON picture are out.
  assert.deepEqual(news.events.map((e) => [e.title, e.badge, e.meta]), [
    ["오늘 끝나는 이벤트", "오늘 마감", "~ 11월 13일(금)"],
    ["모멘텀 패스 PLUS", "D-5", "~ 11월 18일(수)"],
    ["직업 추천 AWARDS", "D-26", "~ 12월 9일(수)"],
  ]);
  // The date prefix of a cash shop title goes; a sale shows the day it ends, the rest the day it was added.
  assert.deepEqual(news.cashshop.map((c) => [c.title, c.badge, c.meta]), [
    ["부티크 기프트", "D-5", "~ 11월 18일(수)"],
    ["로얄스타일 & 마스터피스", "", "10월 22일 업데이트"],
  ]);
  assert.equal(news.updates.length, 5);
  assert.deepEqual(news.updates[0], { id: 1, title: "클라이언트 1.2.420 업데이트 안내", url: "https://maplestory.nexon.com/News/Update/1", date: "10월 22일" });
  // A row whose address is not NEXON's is dropped.
  assert.deepEqual(news.notices.map((n) => n.title), ["11/12(목) 넥슨 정기점검 안내"]);
  // An hour before midnight the event that ends today is still listed; a minute after its end it is not.
  assert.equal(shapeNews(raw, new Date("2026-11-13T14:00:00Z")).events[0].title, "오늘 끝나는 이벤트");
  assert.equal(shapeNews(raw, new Date("2026-11-13T15:00:00Z")).events[0].title, "모멘텀 패스 PLUS");
});
