// Default values the user can change on the page. Prices move with patches and the market:
// update them here together with the date.
export const DEFAULTS_UPDATED = "2026-11-11";

/** Star force items by level. Icons are Nexon Open API item icon codes (item_icon of character item-equipment, the same for every
 * character; found 2026-11-09 on 청운적운 · 푸소 · 귤민 incl. presets). Shown straight from Nexon, never stored here.
 * Job-specific gear uses one job as the picture (메이지 에테르넬 · 아스트라 아케인 실드 · 데스티니 스태프); 가디언 엔젤 링 uses
 * 여명의 가디언 엔젤 링 (same picture, user 2026-11-09). No icon = text.
 * spare price = 노작값 in 억 메소 (from the user, 2026-11-08; 블랙빈 · 트와일라이트 · 에스텔라 · 도미네이터 added 2026-11-11,
 * icons from 푸소). 아케인셰이드 shows gloves · shoes · cape (user, 2026-11-11). */
export type StarItem = { id: string; name: string; icons: string[]; spareEok: number; /** Item-specific cap below the level rule. */ maxStar?: number };
export const STAR_ITEMS: { level: number; items: StarItem[] }[] = [
  { level: 135, items: [
    { id: "blackbean", name: "블랙빈 마크", icons: ["KEPAJFND"], spareEok: 1.5 },
  ] },
  { level: 140, items: [
    { id: "mring", name: "마이스터 링", icons: ["KEODIHLE"], spareEok: 0.3 },
    { id: "dpendant", name: "데이브레이크 펜던트", icons: ["KEOAJDKC"], spareEok: 0.1 },
    { id: "twilight", name: "트와일라이트 마크", icons: ["KEPDJALG"], spareEok: 0.005 },
    { id: "dominator", name: "도미네이터 펜던트", icons: ["KEOAJGLB"], spareEok: 10.5 },
  ] },
  { level: 160, items: [
    { id: "gaen", name: "가디언 엔젤 링", icons: ["KEODIEPH"], spareEok: 0.15 },
    { id: "estella", name: "에스텔라 이어링", icons: ["KEPBJENB"], spareEok: 0.0075 },
    { id: "loose", name: "루즈 컨트롤 머신 마크", icons: ["KEPDJBND"], spareEok: 11 },
    { id: "eye", name: "마력이 깃든 안대", icons: ["KEPAJFJJ"], spareEok: 26 },
    { id: "pain", name: "고통의 근원", icons: ["KEOAJDNB"], spareEok: 46 },
  ] },
  { level: 200, items: [
    { id: "arcane", name: "아케인셰이드 장비", icons: ["KEPKJBHE", "KEPFIGLJ", "KEOCJOKB"], spareEok: 0.05 },
    { id: "dream", name: "몽환의 벨트", icons: ["KEOBJEOJ"], spareEok: 34 },
    { id: "commander", name: "커맨더 포스 이어링", icons: ["KEPBJEPH"], spareEok: 11 },
    { id: "terror", name: "거대한 공포", icons: ["KEODIEOH"], spareEok: 36 },
    { id: "under", name: "컴플리트 언더컨트롤", icons: ["KEJFJHHE"], spareEok: 170 },
    { id: "astra", name: "아스트라 보조무기", icons: ["KEPLJGMJ"], spareEok: 10 },
  ] },
  { level: 250, items: [
    { id: "eterArmor", name: "에테르넬 모자 · 상의 · 하의 · 견장", icons: ["KEPCOOGA", "KEPGJDNF", "KEPEJFGH", "KEOHJFPC"], spareEok: 0.1 },
    { id: "eterAcc", name: "에테르넬 장갑 · 신발 · 망토", icons: ["KEPKJAIA", "KEPFIBNB", "KEOCIDNF"], spareEok: 15 },
    // The second-liberation Destiny weapon stops at 25 stars (user, 2026-11-11).
    { id: "destiny", name: "데스티니 무기(2차)", icons: ["KEMKJFGG"], spareEok: 100, maxStar: 25 },
    { id: "whisper", name: "근원의 속삭임", icons: ["KEODIEKA"], spareEok: 500 },
    { id: "oath", name: "죽음의 맹세", icons: ["KEOAJDKG"], spareEok: 600 },
    { id: "nightmare", name: "황홀한 악몽", icons: ["KEODIEIB"], spareEok: 500 },
    { id: "sin", name: "오만의 원죄", icons: ["KEPDJOPA"], spareEok: 3500 },
    { id: "soulblood", name: "굶주리는 핏빛 원혼", icons: ["KEPAJEHG"], spareEok: 450 },
  ] },
];
export const itemImage = (code: string) => `https://open.api.nexon.com/static/maplestory/item/icon/${code}`;
/** Level for "목록에 없는 장비" when the page opens. */
export const CUSTOM_LEVEL = 130;

/** 1억 메소 = n원 (used to show won next to meso). */
export const MESO_RATE_WON = 2900;
/** Spare item price for star force (억 메소). */
export const SPARE_EOK = 10;
/** Multipliers offered for "expected value × n". */
export const MULTIPLIERS = [1, 1.07, 1.12];

/** MVP: items to buy with cash and sell on the auction house (cash price, auction price in 억). From the user, 2026-11-08. */
export const MVP_ITEMS: { id: string; chip: string; name: string; cash: number; auctionEok: number }[] = [
  { id: "pga", chip: "플가", name: "플래티넘 카르마의 가위", cash: 5900, auctionEok: 3 },
  { id: "royal", chip: "로얄", name: "로얄스타일 쿠폰 10개", cash: 22000, auctionEok: 12 },
  { id: "berry", chip: "원더베리", name: "위습의 원더베리", cash: 54000, auctionEok: 28 },
  { id: "boutique", chip: "부티크", name: "부티크", cash: 33000, auctionEok: 17 },
];
/** MVP: charge methods people use most (user, 2026-11-08). Gift cards 5만원권, 월 20만 each, 60만 together. */
export const MVP_METHODS = [
  { id: "book", name: "도서문화상품권", note: "5만원권 · 월 20만", discountPct: 6, monthlyCap: 200_000, unit: 50_000 },
  { id: "nexon", name: "넥슨카드", note: "5만원권 · 월 20만", discountPct: 6, monthlyCap: 200_000, unit: 50_000 },
  { id: "culture", name: "컬쳐랜드", note: "5만원권 · 월 20만", discountPct: 6, monthlyCap: 200_000, unit: 50_000 },
  // Paying with earned card points 1:1 (확인 필요).
  { id: "hyundai", name: "현대카드 포인트", note: "적립 포인트로 충전 · 한도 없음", discountPct: 0, monthlyCap: Infinity, unit: 1 },
  { id: "plain", name: "일반 충전", note: "할인 없음 · 한도 없음", discountPct: 0, monthlyCap: Infinity, unit: 1 },
];
/** MVP: meso sale price (1억당 원, design Version 64) and meso market (maple points per 1억, user 2026-11-09), editable. */
export const MVP_MESO_WON = 1500;
export const MESO_MARKET_MP = 2100;

/**
 * Potential "main stat" goal: how much other lines are worth, in maplescouter.com terms
 * (result page → 스펙 효율 → 세부 스펙 효율). Example character 청운적운 (Lv.296 아크메이지(썬,콜)), 2026-11-09.
 * Every value differs per character, so the page lets people type their own.
 */
export const STAT_CONV_DEFAULT = { level: 296, v9: 6.31, cd3: 11.9, atk1: 2.29, all1: 11.6 };

/** MVP gift route: won received per 10,000 cash gifted as maple points (user, 2026-11-09). No credit for gifts. */
export const GIFT_WON_PER_10K = 7000;
/** MVP: credit earned per cash spent in the cash shop, % — fixed in game (user, 2026-11-09), not editable on the page. */
export const CREDIT_PCT = 5;
/** MVP: credit shop items to buy with credit and sell on the auction house (credit, auction price in 억). User, 2026-11-09. */
export const CREDIT_SHOP: { id: string; name: string; credit: number; auctionEok: number }[] = [
  { id: "primeAddi", name: "프라임 에디셔널 큐브", credit: 20_000, auctionEok: 14.5 },
  { id: "prime", name: "프라임 큐브", credit: 10_000, auctionEok: 7.4 },
  { id: "pga", name: "플래티넘 카르마의 가위", credit: 5_900, auctionEok: 3 },
  { id: "circulator", name: "심연의 서큘레이터", credit: 4_900, auctionEok: 2.6 },
];
