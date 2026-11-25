// Boss revenue data: crystal prices, party caps and what each boss gives. Prices move with patches: change them here
// together with the date below. Item defaults the expected-value calculator also has are read from there (one place).
// Checked: 2026-11-23.
import { STAR_ITEMS } from "../ev/defaults.ts";

/** Scheduler difficulty words → the names the game shows. */
export const DIFFICULTY: Record<string, string> = { easy: "이지", normal: "노멀", hard: "하드", chaos: "카오스", extreme: "익스트림" };

/**
 * Sale price of one crystal (meso), by "boss|difficulty". NEXON update notice 2026-09-17; rows that notice leaves out
 * are from 2026-06-18, except those read off the in-game shop list (user, 2026-11-24): 림보 · 발드릭스 익스트림 and
 * 벨로나 하드 (in no notice), 유피테르 하드 and 카링 익스트림 (the game has the 2026-06-18 values the other way round).
 * Bosses below 스우 (most of them daily, only weekly · monthly ones are shown): a price list that matched every
 * row of the in-game list it overlaps. 메이린: no price → shown as unknown.
 */
export const CRYSTAL: Record<string, number> = {
  "자쿰|이지": 114_000, "자쿰|노멀": 349_000, "자쿰|카오스": 4_040_000,
  "매그너스|이지": 411_000, "매그너스|노멀": 1_160_000, "매그너스|하드": 4_280_000,
  "힐라|노멀": 455_000, "힐라|하드": 1_280_000, "카웅|노멀": 712_000,
  "파풀라투스|이지": 390_000, "파풀라투스|노멀": 1_200_000, "파풀라투스|카오스": 6_550_000,
  "피에르|노멀": 551_000, "피에르|카오스": 4_080_000, "반반|노멀": 551_000, "반반|카오스": 4_070_000,
  "블러디퀸|노멀": 551_000, "블러디퀸|카오스": 4_070_000, "벨룸|노멀": 551_000, "벨룸|카오스": 4_640_000,
  "반 레온|이지": 602_000, "반 레온|노멀": 830_000, "반 레온|하드": 1_070_000,
  "혼테일|이지": 502_000, "혼테일|노멀": 576_000, "혼테일|카오스": 770_000,
  "아카이럼|이지": 656_000, "아카이럼|노멀": 1_110_000,
  "핑크빈|노멀": 799_000, "핑크빈|카오스": 1_320_000, "시그너스|노멀": 1_360_000,
  "스우|노멀": 8_350_000, "스우|하드": 48_900_000, "스우|익스트림": 545_000_000,
  "데미안|노멀": 8_750_000, "데미안|하드": 46_400_000,
  "가디언 엔젤 슬라임|노멀": 12_700_000, "가디언 엔젤 슬라임|카오스": 71_300_000,
  "루시드|이지": 14_900_000, "루시드|노멀": 17_800_000, "루시드|하드": 59_700_000,
  "윌|이지": 16_100_000, "윌|노멀": 20_500_000, "윌|하드": 73_200_000,
  "더스크|노멀": 22_000_000, "더스크|카오스": 66_300_000,
  "듄켈|노멀": 23_700_000, "듄켈|하드": 89_600_000,
  "진 힐라|노멀": 67_600_000, "진 힐라|하드": 100_000_000,
  "선택받은 세렌|노멀": 167_000_000, "선택받은 세렌|하드": 302_000_000, "선택받은 세렌|익스트림": 1_840_000_000,
  "감시자 칼로스|이지": 238_000_000, "감시자 칼로스|노멀": 479_000_000, "감시자 칼로스|카오스": 1_230_000_000, "감시자 칼로스|익스트림": 4_104_000_000,
  "최초의 대적자|이지": 261_000_000, "최초의 대적자|노멀": 532_000_000, "최초의 대적자|하드": 1_390_000_000, "최초의 대적자|익스트림": 4_712_000_000,
  "카링|이지": 320_000_000, "카링|노멀": 593_000_000, "카링|하드": 1_560_000_000, "카링|익스트림": 4_845_000_000,
  "찬란한 흉성|노멀": 576_000_000, "찬란한 흉성|하드": 2_678_000_000,
  "림보|노멀": 995_000_000, "림보|하드": 2_385_000_000, "림보|익스트림": 7_500_000_000,
  "발드릭스|노멀": 1_320_000_000, "발드릭스|하드": 3_078_000_000, "발드릭스|익스트림": 9_600_000_000,
  "유피테르|노멀": 1_560_000_000, "유피테르|하드": 5_387_000_000,
  "벨로나|이지": 396_000_000, "벨로나|노멀": 824_000_000, "벨로나|하드": 2_950_000_000,
  "검은 마법사|하드": 465_000_000, "검은 마법사|익스트림": 5_680_000_000,
};

/** Party cap by boss, every difficulty (checked in game by the user, 2026-11-23). The rest: 6. */
const MAX_PARTY: Record<string, number> = { "최초의 대적자": 3, "찬란한 흉성": 3, "림보": 3, "발드릭스": 3, "유피테르": 3, "벨로나": 3, "시즌 보스 메이린": 1 };
export const maxParty = (boss: string): number => MAX_PARTY[boss] ?? 6;

/** Where a reward's picture is: a file of ours, or a NEXON Open API item icon code. */
export type Icon = { file: string } | { code: string };
export const iconSrc = (icon: Icon): string =>
  "file" in icon ? `/revenue/items/${icon.file}.png` : `https://open.api.nexon.com/static/maplestory/item/icon/${icon.code}`;

export type Category = "ring" | "stone" | "pitch" | "glow" | "eter" | "soul";
export type Item = { name: string; cat: Category; icon: Icon; /** Default price, 만 메소. */ price: number; level?: string };

/**
 * Boss rewards priced as a star force item of the expected-value calculator (reward → that list's id): one price in
 * one place, so changing the item's spare price changes the reward too (lib/site-values/values.ts rewardPrices).
 * Each Eternel box gives a fixed part group (NEXON notices; 갈망 · 광기 = user): 모자 · 상의 · 하의 · 어깨 side is worth
 * the calculator's 에테르넬 armor, 신발 · 장갑 · 망토 its accessories.
 */
export const SPARE_LINK = {
  rcm: "loose", patch: "eye", dream: "dream", fear: "terror", commander: "commander", pain: "pain",
  whisper: "whisper", nightmare: "nightmare", oath: "oath", sin: "sin", wraith: "soulblood",
  eterWill: "eterArmor", eterBeast: "eterArmor", eterFantasy: "eterArmor", eterAncient: "eterArmor",
  eterDesire: "eterAcc", eterOath: "eterAcc", eterCraving: "eterAcc", eterMadness: "eterAcc",
} as const;

/** Spare-item prices of the expected-value calculator, 억 → 만 메소. */
const ev = (id: string): number => {
  for (const g of STAR_ITEMS) for (const it of g.items) if (it.id === id) return Math.round(it.spareEok * 10_000);
  throw new Error(`expected-value item ${id} is missing`);
};

/** What a boss can give that is counted. 리레 · 컨티 = level 4 only (user: level 3 is not tracked). `price` is the code's default. */
export const ITEMS = {
  rr4: { name: "리스트레인트 링 4레벨", cat: "ring", icon: { code: "KEODIHHJ" }, price: 330_000, level: "4" },
  ct4: { name: "컨티뉴어스 링 4레벨", cat: "ring", icon: { code: "KEODIEMI" }, price: 230_000, level: "4" },
  lifeStone: { name: "생명의 연마석", cat: "stone", icon: { file: "stone-life" }, price: 70_000 },
  faithStone: { name: "신념의 연마석", cat: "stone", icon: { file: "stone-faith" }, price: 270_000 },
  rcm: { name: "루즈 컨트롤 머신 마크", cat: "pitch", icon: { code: "KEPDJBND" }, price: ev(SPARE_LINK.rcm) },
  patch: { name: "마력이 깃든 안대", cat: "pitch", icon: { code: "KEPAJFJJ" }, price: ev(SPARE_LINK.patch) },
  dream: { name: "몽환의 벨트", cat: "pitch", icon: { code: "KEOBJEOJ" }, price: ev(SPARE_LINK.dream) },
  grimoire: { name: "저주받은 마도서 선택 상자", cat: "pitch", icon: { file: "grimoire-box" }, price: 360_000 },
  fear: { name: "거대한 공포", cat: "pitch", icon: { code: "KEODIEOH" }, price: ev(SPARE_LINK.fear) },
  commander: { name: "커맨더 포스 이어링", cat: "pitch", icon: { code: "KEPBJEPH" }, price: ev(SPARE_LINK.commander) },
  pain: { name: "고통의 근원", cat: "pitch", icon: { code: "KEOAJDNB" }, price: ev(SPARE_LINK.pain) },
  mitra: { name: "미트라의 분노 선택 상자", cat: "pitch", icon: { file: "mitra-box" }, price: 160_000 },
  genesis: { name: "창세의 뱃지", cat: "pitch", icon: { code: "KEOKJFGE" }, price: 1_800_000 },
  whisper: { name: "근원의 속삭임", cat: "glow", icon: { code: "KEODIEKA" }, price: ev(SPARE_LINK.whisper) },
  nightmare: { name: "황홀한 악몽", cat: "glow", icon: { code: "KEODIEIB" }, price: ev(SPARE_LINK.nightmare) },
  oath: { name: "죽음의 맹세", cat: "glow", icon: { code: "KEOAJDKG" }, price: ev(SPARE_LINK.oath) },
  legacy: { name: "불멸의 유산", cat: "glow", icon: { file: "legacy" }, price: 6_700_000 },
  sin: { name: "오만의 원죄", cat: "glow", icon: { code: "KEPDJOPA" }, price: ev(SPARE_LINK.sin) },
  wraith: { name: "굶주리는 핏빛 원혼", cat: "glow", icon: { code: "KEPAJEHG" }, price: ev(SPARE_LINK.wraith) },
  eterWill: { name: "의지의 에테르넬 방어구 상자", cat: "eter", icon: { file: "eter-will" }, price: ev(SPARE_LINK.eterWill) },
  eterBeast: { name: "흉수의 에테르넬 방어구 상자", cat: "eter", icon: { file: "eter-beast" }, price: ev(SPARE_LINK.eterBeast) },
  eterFantasy: { name: "환상의 에테르넬 방어구 상자", cat: "eter", icon: { file: "eter-fantasy" }, price: ev(SPARE_LINK.eterFantasy) },
  eterAncient: { name: "고대의 에테르넬 방어구 상자", cat: "eter", icon: { file: "eter-ancient" }, price: ev(SPARE_LINK.eterAncient) },
  eterDesire: { name: "욕망의 에테르넬 방어구 상자", cat: "eter", icon: { file: "eter-desire" }, price: ev(SPARE_LINK.eterDesire) },
  eterOath: { name: "맹세의 에테르넬 방어구 상자", cat: "eter", icon: { file: "eter-oath" }, price: ev(SPARE_LINK.eterOath) },
  eterCraving: { name: "갈망의 에테르넬 방어구 상자", cat: "eter", icon: { file: "eter-craving" }, price: ev(SPARE_LINK.eterCraving) },
  eterMadness: { name: "광기의 에테르넬 방어구 상자", cat: "eter", icon: { file: "eter-madness" }, price: ev(SPARE_LINK.eterMadness) },
  soul1: { name: "1단계 소울 에테르", cat: "soul", icon: { file: "soul-1" }, price: 10_000 },
  soul2: { name: "2단계 소울 에테르", cat: "soul", icon: { file: "soul-2" }, price: 30_000 },
  soul3: { name: "3단계 소울 에테르", cat: "soul", icon: { file: "soul-3" }, price: 40_000 },
  soul4: { name: "4단계 소울 에테르", cat: "soul", icon: { file: "soul-4" }, price: 330_000 },
} satisfies Record<string, Item>;
export type ItemId = keyof typeof ITEMS;
export const item = (id: ItemId): Item => ITEMS[id];

/** Boxes the user opens: the cell asks what came out. Only what is counted is offered. */
export type Box = { name: string; cat: Category; icon: Icon; opts: ItemId[] };
export const BOXES = {
  ringLife: { name: "생명의 보스 반지 상자", cat: "ring", icon: { file: "ring-life" }, opts: ["rr4", "ct4", "lifeStone"] },
  ringJade: { name: "보스 반지 상자", cat: "ring", icon: { file: "ring-white" }, opts: ["rr4", "ct4"] },
  chaos: { name: "혼돈의 칠흑 장신구 상자", cat: "pitch", icon: { file: "chaos-box" }, opts: ["rcm", "patch", "dream", "grimoire", "fear", "commander", "pain"] },
} satisfies Record<string, Box>;
export type BoxId = keyof typeof BOXES;
export type Drop = ItemId | BoxId;
export const isBox = (d: Drop): d is BoxId => d in BOXES;
export const dropCategory = (d: Drop): Category => (isBox(d) ? BOXES[d].cat : ITEMS[d].cat);

/** The columns of the cleared-boss table. */
export const CATEGORIES: { cat: Category; label: string; icon: Icon }[] = [
  { cat: "ring", label: "반지 상자", icon: { file: "ring-life" } },
  { cat: "stone", label: "연마석", icon: { file: "stone-faith" } },
  { cat: "pitch", label: "칠흑", icon: { file: "chaos-box" } },
  { cat: "glow", label: "광휘", icon: { code: "KEODIEKA" } },
  { cat: "eter", label: "에테 상자", icon: { file: "eter-beast" } },
  { cat: "soul", label: "소울", icon: { file: "soul-1" } },
];

const JADE_PITCH = (pitch: ItemId): Drop[] => ["ringJade", pitch];
/**
 * What each boss · difficulty can give, at most one per column per clear. 스우 ~ 검은 마법사 = NEXON guide "보스별 주요
 * 보상" (칠흑 drops at hard / chaos, notice 2025-08-21); 칼로스 and later = a per-difficulty reward list (sources in the
 * project notes), 카링 하드 신념 = the user in game.
 */
export const DROPS: Record<string, Drop[]> = {
  "스우|하드": JADE_PITCH("rcm"), "스우|익스트림": JADE_PITCH("rcm"),
  "데미안|하드": JADE_PITCH("patch"), "가디언 엔젤 슬라임|카오스": ["ringJade"],
  "루시드|하드": JADE_PITCH("dream"), "윌|하드": JADE_PITCH("grimoire"), "더스크|카오스": JADE_PITCH("fear"),
  "진 힐라|하드": JADE_PITCH("pain"), "듄켈|하드": JADE_PITCH("commander"),
  "선택받은 세렌|하드": JADE_PITCH("mitra"), "선택받은 세렌|익스트림": JADE_PITCH("mitra"),
  "검은 마법사|하드": JADE_PITCH("genesis"), "검은 마법사|익스트림": JADE_PITCH("genesis"),
  "감시자 칼로스|노멀": ["ringJade", "lifeStone"], "감시자 칼로스|카오스": ["ringLife", "lifeStone", "eterWill"],
  "감시자 칼로스|익스트림": ["ringLife", "lifeStone", "eterWill"],
  "최초의 대적자|노멀": ["ringJade", "lifeStone", "soul1"], "최초의 대적자|하드": ["ringLife", "lifeStone", "legacy", "eterAncient", "soul1"],
  "최초의 대적자|익스트림": ["ringLife", "lifeStone", "legacy", "eterAncient", "soul1"],
  "카링|노멀": ["ringJade", "lifeStone", "chaos", "soul1"], "카링|하드": ["ringLife", "faithStone", "chaos", "eterBeast", "soul1"],
  "카링|익스트림": ["ringLife", "faithStone", "chaos", "eterBeast", "soul1"],
  "찬란한 흉성|노멀": ["ringJade", "lifeStone", "chaos", "soul2"], "찬란한 흉성|하드": ["ringLife", "faithStone", "chaos", "nightmare", "eterFantasy", "soul2"],
  "림보|노멀": ["ringLife", "faithStone", "chaos", "soul3"], "림보|하드": ["ringLife", "faithStone", "chaos", "whisper", "eterDesire", "soul3"],
  "림보|익스트림": ["ringLife", "faithStone", "chaos", "whisper", "eterDesire", "soul3"],
  "발드릭스|노멀": ["ringLife", "faithStone", "chaos", "soul3"], "발드릭스|하드": ["ringLife", "faithStone", "chaos", "oath", "eterOath", "soul3"],
  "발드릭스|익스트림": ["ringLife", "faithStone", "chaos", "oath", "eterOath", "soul3"],
  "유피테르|노멀": ["ringLife", "faithStone", "chaos", "soul4"], "유피테르|하드": ["ringLife", "faithStone", "chaos", "sin", "eterCraving", "soul4"],
  "벨로나|노멀": ["ringJade", "lifeStone", "chaos", "soul2"], "벨로나|하드": ["ringLife", "faithStone", "chaos", "wraith", "eterMadness", "soul2"],
};

/**
 * Materials counted as revenue: only where they are a personal reward (user 2026-11-23), 10 of them trade for that
 * boss's box so each is worth a tenth of it. Party-shared ones (칼로스 · 카링 · 대적자 · 흉성) are left out.
 */
export type Material = { name: string; count: number; box: ItemId };
export const PER_BOX = 10;
export const MATERIALS: Record<string, Material> = {
  "림보|노멀": { name: "왜곡된 욕망의 결정", count: 1, box: "eterDesire" },
  "림보|하드": { name: "왜곡된 욕망의 결정", count: 2, box: "eterDesire" },
  "림보|익스트림": { name: "왜곡된 욕망의 결정", count: 5, box: "eterDesire" },
  "발드릭스|노멀": { name: "영원한 충성의 흔적", count: 1, box: "eterOath" },
  "발드릭스|하드": { name: "영원한 충성의 흔적", count: 2, box: "eterOath" },
  "발드릭스|익스트림": { name: "영원한 충성의 흔적", count: 5, box: "eterOath" },
  "유피테르|노멀": { name: "뒤틀린 갈망의 편린", count: 1, box: "eterCraving" },
  "유피테르|하드": { name: "뒤틀린 갈망의 편린", count: 2, box: "eterCraving" },
  "벨로나|노멀": { name: "저주받은 원혼의 잔재", count: 1, box: "eterMadness" },
  "벨로나|하드": { name: "저주받은 원혼의 잔재", count: 2, box: "eterMadness" },
};

/** Characters a weekly boss list is looked for when picking (lower ones have no weekly boss). */
export const SCAN_MIN_LEVEL = 190;
/** Most characters the revenue page follows (user, 2026-11-07). */
export const MAX_PICKED = 36;
/** Characters one call to our server asks NEXON about (a member's accounts): the page sends more in several calls. */
export const MAX_ASKED = 300;
