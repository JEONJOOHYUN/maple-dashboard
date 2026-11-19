import { Skills, STUCK_DELAY } from './constants';
import type { IPhysics } from './IPhysics';
import options from './options';
import type { ColorTheme } from './types/ColorTheme';
import type { VectorLike } from './types/VectorLike';
import { rad } from './utils/utils';

/** Picture size relative to the physics body. */
const SKIN_SCALE = 1.45;

export class Marble {
  type = 'marble' as const;
  name: string = '';
  size: number = 0.5;
  color: string = 'red';
  /** Fixed fill colour (one per person); falls back to the hue colour. */
  fill: string | null = null;
  /** Picture drawn instead of the plain ball (boss soul). */
  skin: CanvasImageSource | null = null;
  hue: number = 0;
  impact: number = 0;
  weight: number = 1;
  skill: Skills = Skills.None;
  isActive: boolean = false;

  private _skillRate = 0.0005;
  private _coolTime = 5000;
  private _maxCoolTime = 5000;
  private _stuckTime = 0;
  /** Where the last update() found the marble: the loop reads it again in the same step instead of asking the engine. */
  readonly lastPosition: VectorLike = { x: 0, y: 0 };
  /** update() has run once: lastPosition is where the body is (bodies move only in a step, and every step updates). */
  private _stepped = false;

  private physics: IPhysics;

  id: number;

  get position() {
    return this.physics.getMarblePosition(this.id) || { x: 0, y: 0, angle: 0 };
  }

  get x() {
    return this.position.x;
  }

  set x(v: number) {
    this.position.x = v;
  }

  get y() {
    return this.position.y;
  }

  set y(v: number) {
    this.position.y = v;
  }

  get angle() {
    return this.position.angle;
  }

  constructor(physics: IPhysics, order: number, max: number, name?: string, weight: number = 1) {
    this.name = name || `M${order}`;
    this.weight = weight;
    this.physics = physics;

    this._maxCoolTime = 1000 + (1 - this.weight) * 4000;
    this._coolTime = this._maxCoolTime * Math.random();
    this._skillRate = 0.2 * this.weight;

    const maxLine = Math.ceil(max / 10);
    const line = Math.floor(order / 10);
    const lineDelta = -Math.max(0, Math.ceil(maxLine - 5));
    this.hue = (360 / max) * order;
    this.color = `hsl(${this.hue} 100% 70%)`;
    this.id = order;

    physics.createMarble(order, 10.25 + (order % 10) * 0.6, maxLine - line + lineDelta);
  }

  /**
   * @param deltaTime 벽시계 기준 경과(ms). 스킬 쿨타임 등 연출 시간에 쓴다
   * @param timeScale 이 틱에서 물리가 실제로 진행된 비율(슬로모션이면 1 미만).
   *   정지 판정은 이동 거리로 하므로 물리 시간에 맞춰 문턱을 줄여야 한다. 안 그러면 슬로모션 중
   *   천천히 구르는 구슬이 멈춘 것으로 오판되어 골인 직전에 랜덤으로 튕겨진다
   */
  update(deltaTime: number, timeScale: number = 1) {
    const stuckThreshold = 0.00001 * timeScale * timeScale;
    // One read per step (each read asks the physics engine again), without the angle, and nothing allocated: this runs
    // for every marble at every step, five times as often at 5x (2026-11-20, 500 marbles).
    const { x, y } = this.physics.getMarbleXY(this.id);
    const last = this.lastPosition;
    const dx = x - last.x;
    const dy = y - last.y;
    if (this.isActive && dx * dx + dy * dy < stuckThreshold) {
      // 누적에는 timeScale 을 곱하지 않는다. 이건 화면이 굳는 걸 막는 워치독이라 관객 체감 시간이 기준이다.
      // 물리 시간으로 바꾸면 슬로모션이 깊을수록 발동이 늦어지는데, 타겟 구슬이 멈추면 _goalDist 가 고정되어
      // 슬로모션이 풀리지 않으므로 교착을 깨야 할 상황에서 워치독이 오히려 무뎌진다
      this._stuckTime += deltaTime;

      if (this._stuckTime > STUCK_DELAY) {
        this.physics.shakeMarble(this.id);
        this._stuckTime = 0;
      }
    } else {
      this._stuckTime = 0;
    }
    last.x = x;
    last.y = y;
    this._stepped = true;

    this.skill = Skills.None;
    if (this.impact) {
      this.impact = Math.max(0, this.impact - deltaTime);
    }
    if (!this.isActive) return;
    if (options.useSkills) {
      this._updateSkillInformation(deltaTime);
    }
  }

  private _updateSkillInformation(deltaTime: number) {
    if (this._coolTime > 0) {
      this._coolTime -= deltaTime;
    }

    if (this._coolTime <= 0) {
      this.skill = Math.random() < this._skillRate ? Skills.Impact : Skills.None;
      this._coolTime = this._maxCoolTime;
    }
  }

  /** Where the marble is, without asking the engine again when a step already did (drawing, ranks, map). */
  lastPositionOrRead(): VectorLike {
    return this._stepped ? this.lastPosition : this.physics.getMarbleXY(this.id);
  }

  /** Fill of the body: the person's colour, or the hue (lighter for a moment after an impact). */
  bodyColor(theme: ColorTheme): string {
    return this.fill ?? `hsl(${this.hue} 100% ${theme.marbleLightness + 25 * Math.min(1, this.impact / 500)}%)`;
  }

  /** How much of the skill cool-down is left, 0 ~ 1: the ring around the marble. */
  get coolRatio(): number {
    return Math.max(0, this._coolTime / this._maxCoolTime);
  }
}

// ---------- drawing (2026-11-20) ----------
// The board drew every marble on its own: a body, its name as text (stroke + fill, the font set each time), a ring.
// With hundreds of marbles ("이름*100") that was most of a phone's frame. Now every body of one colour is one path,
// each name is drawn once into a small picture and stamped, and the rings and outlines are one stroke each.
// Layers as before: bodies, names, winner outlines, rings.

const NAME_FONT = "600 12pt 'Pretendard Variable', sans-serif";
const NAME_PAD = 2;
const stamps = new Map<string, HTMLCanvasElement>();
let fontWatch = false;

/** A name in its colour with the black edge, as the board drew it, in canvas pixels. */
function nameStamp(name: string, color: string): HTMLCanvasElement {
  const key = `${color}\n${name}`;
  const hit = stamps.get(key);
  if (hit) return hit;
  if (!fontWatch && typeof document !== 'undefined' && document.fonts) {
    fontWatch = true;
    // A stamp made before the font arrived is in the fallback font: make them again once a font has loaded.
    document.fonts.addEventListener('loadingdone', () => stamps.clear());
  }
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d')!;
  g.font = NAME_FONT;
  const m = g.measureText(name);
  canvas.width = Math.max(1, Math.ceil(m.width) + NAME_PAD * 2);
  canvas.height = Math.ceil(Math.max(m.actualBoundingBoxDescent || 0, m.fontBoundingBoxDescent || 0, 20)) + NAME_PAD * 2;
  // (Setting the size resets the context.)
  g.font = NAME_FONT;
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.strokeStyle = 'black';
  g.lineWidth = 2;
  g.fillStyle = color;
  g.strokeText(name, NAME_PAD, NAME_PAD);
  g.fillText(name, NAME_PAD, NAME_PAD);
  if (stamps.size >= 256) stamps.clear();
  stamps.set(key, canvas);
  return canvas;
}

type Shown = { m: Marble; x: number; y: number; winner: boolean };

/**
 * Every marble in view, in the scene's world transform. zoom = world units to canvas pixels; marbles at
 * winnerFrom ~ winnerTo get the winning outline.
 */
export function drawMarbles(
  ctx: CanvasRenderingContext2D,
  marbles: readonly Marble[],
  zoom: number,
  viewPort: { x: number; y: number; w: number; h: number; zoom: number },
  theme: ColorTheme,
  winnerFrom: number,
  winnerTo: number
) {
  const hw = viewPort.w / viewPort.zoom / 2;
  const hh = viewPort.h / viewPort.zoom / 2;
  const left = viewPort.x - hw;
  const right = viewPort.x + hw;
  const top = viewPort.y - hh;
  const bottom = viewPort.y + hh;
  const shown: Shown[] = [];
  for (let i = 0; i < marbles.length; i++) {
    const m = marbles[i];
    // One read each (every read asks the physics engine); the angle is never drawn.
    const { x, y } = m.lastPositionOrRead();
    const r = m.size / 2;
    if (x + r < left || x - r > right || y + r < top || y - r > bottom) continue;
    shown.push({ m, x, y, winner: i >= winnerFrom && i <= winnerTo });
  }
  if (!shown.length) return;
  ctx.shadowColor = '';
  ctx.shadowBlur = 0;

  const byColor = new Map<string, Shown[]>();
  for (const s of shown) {
    if (s.m.skin) {
      // Soul pictures stay upright and a bit bigger than the body (the icon has a transparent margin).
      const skin = s.m.skin as HTMLImageElement;
      const iw = skin.naturalWidth || 1;
      const ih = skin.naturalHeight || 1;
      const k = ((s.m.size / 2) * SKIN_SCALE * 2) / Math.max(iw, ih);
      ctx.drawImage(s.m.skin, s.x - (iw * k) / 2, s.y - (ih * k) / 2, iw * k, ih * k);
      continue;
    }
    const color = s.m.bodyColor(theme);
    const same = byColor.get(color);
    if (same) same.push(s);
    else byColor.set(color, [s]);
  }
  for (const [color, list] of byColor) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const s of list) {
      const r = s.m.size / 2;
      ctx.moveTo(s.x + r, s.y);
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // Names in canvas pixels: the world transform has no rotation and the same scale both ways (zoom), so a name
  // stamped 1:1 at its place is the text the board drew under scale(1 / zoom). Whole pixels keep it sharp.
  const base = ctx.getTransform();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const s of shown) {
    const stamp = nameStamp(s.m.name, s.m.color);
    const ny = s.y + (s.m.skin ? 0.42 : 0.25);
    const px = base.a * s.x + base.c * ny + base.e;
    const py = base.b * s.x + base.d * ny + base.f;
    ctx.drawImage(stamp, Math.round(px - NAME_PAD), Math.round(py - NAME_PAD));
  }
  ctx.setTransform(base);

  const winners = shown.filter((s) => s.winner);
  if (winners.length) {
    ctx.strokeStyle = theme.marbleWinningBorder;
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    for (const s of winners) {
      const r = s.m.size / 2;
      ctx.moveTo(s.x + r, s.y);
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  if (options.useSkills) {
    ctx.strokeStyle = theme.coolTimeIndicator;
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    for (const s of shown) {
      const r = s.m.size / 2 + 2 / zoom;
      // the ring starts at the top (270 degrees)
      ctx.moveTo(s.x, s.y - r);
      ctx.arc(s.x, s.y, r, rad(270), rad(270 + 360 * s.m.coolRatio));
    }
    ctx.stroke();
  }
}
