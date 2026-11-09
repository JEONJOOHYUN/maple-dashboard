// Game loop, based on lazygyu's roulette (MIT, see LICENSE). Changed for maple-dashboard:
// no ads, no recording, no built-in rank / fast-forward overlays (the page shows those), the canvas
// lives in a container we pass in, one colour per person, finish order is exposed, and destroy() stops it.
import { Camera } from './camera';
import { initialZoom, Skills, Themes, zoomThreshold } from './constants';
import type { GameObject } from './gameObject';
import type { IPhysics } from './IPhysics';
import { Marble } from './marble';
import { Minimap } from './minimap';
import options, { type WinnerRange } from './options';
import { ParticleManager } from './particleManager';
import { Box2dPhysics } from './physics-box2d';
import { ProgressMap } from './progressMap';
import { RouletteRenderer } from './rouletteRenderer';
import { SkillEffect } from './skillEffect';
import { type StageDef, stages } from './stage';
import type { ColorTheme } from './types/ColorTheme';
import type { MouseEventHandlerName, MouseEventName } from './types/mouseEvents.type';
import type { UIObject } from './UIObject';
import { shuffle } from './utils/utils';
import { zoomZoneIntensity } from './zoomZone';

function clipWinnerRange({ start, end }: WinnerRange, marbleCount: number): WinnerRange {
  const last = Math.max(0, marbleCount - 1);
  const clippedStart = Math.min(Math.max(0, start), last);
  return { start: clippedStart, end: Math.min(Math.max(clippedStart, end), last) };
}

/** Rank smoothing: follow the distance-to-goal over this many seconds, swap only past RANK_MARGIN. */
const RANK_EMA_SEC = 0.4;
const RANK_MARGIN = 0.25;

export type PinballMember = { name: string; count: number; color: string; /** Picture URL for this person's marbles. */ skin?: string };

const skinCache = new Map<string, HTMLImageElement>();
function skinImage(src: string): HTMLImageElement {
  let img = skinCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    skinCache.set(src, img);
  }
  return img;
}

export class Roulette extends EventTarget {
  private _marbles: Marble[] = [];
  private _lastTime = 0;
  private _elapsed = 0;
  private _updateInterval = 10;
  private _timeScale = 1;
  private _speed = 1;
  private _winners: Marble[] = [];
  private _particleManager = new ParticleManager();
  private _stage: StageDef = stages[0];
  protected _camera: Camera = new Camera();
  protected _renderer = new RouletteRenderer();
  private _effects: GameObject[] = [];
  private _winnerRange: WinnerRange = { start: 0, end: 0 };
  private _goalDist = Infinity;
  private _zoomIntensity: number | null = null;
  private _focusOnRival = false;
  private _rankKeys = new Map<Marble, number>();
  private _isRunning = false;
  private _result: Marble[] | null = null;
  private _pendingRemovals: number[] = [];
  private _uiObjects: UIObject[] = [];
  private physics!: IPhysics;
  private _isReady = false;
  private _destroyed = false;
  private _raf = 0;
  private _members: PinballMember[] = [];
  protected _theme: ColorTheme = Themes.dark;
  private _cleanup: (() => void)[] = [];

  get isReady() {
    return this._isReady;
  }

  get isRunning() {
    return this._isRunning;
  }

  constructor(container: HTMLElement) {
    super();
    this._renderer.init(container);
    this._init().then(() => {
      if (this._destroyed) return;
      this._isReady = true;
      if (this._members.length) this.setMembers(this._members);
      this.dispatchEvent(new Event('ready'));
      this._update();
    }).catch((err) => {
      // Wasm download or start-up failed: let the page show its error state instead of "loading" forever.
      if (this._destroyed) return;
      console.error(err);
      this.dispatchEvent(new Event('error'));
    });
  }

  destroy() {
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    this._pendingRemovals.forEach((id) => window.clearTimeout(id));
    this._cleanup.forEach((fn) => fn());
    this._renderer.destroy();
  }

  private addUiObject(obj: UIObject) {
    this._uiObjects.push(obj);
  }

  private _update = () => {
    if (this._destroyed) return;
    if (!this._lastTime) this._lastTime = Date.now();
    const currentTime = Date.now();
    // After a hidden tab, do not try to catch up hundreds of steps at once: cap the real gap, then apply the speed.
    this._elapsed += Math.min(currentTime - this._lastTime, 100) * this._speed;
    this._lastTime = currentTime;

    const timeScale = this._timeScale;
    const interval = (this._updateInterval / 1000) * timeScale;
    let simSeconds = 0;
    while (this._elapsed >= this._updateInterval) {
      simSeconds += interval;
      this.physics.step(interval);
      this._updateMarbles(this._updateInterval, timeScale);
      this._particleManager.update(this._updateInterval);
      this._updateEffects(this._updateInterval);
      this._elapsed -= this._updateInterval;
      this._uiObjects.forEach((obj) => obj.update(this._updateInterval));
    }

    if (this._marbles.length > 1) this._sortMarbles(simSeconds);

    const cameraTargetIndex = this._winners.length > 0 ? this._targetIndex : 0;
    this._camera.update({
      marbles: this._marbles,
      stage: this._stage,
      intensity: this._zoomIntensity ?? Math.max(0, 1 - this._goalDist / zoomThreshold),
      targetIndex: cameraTargetIndex,
      focusOnRival: cameraTargetIndex === this._targetIndex && this._focusOnRival,
      viewSize: { x: this._renderer.width / initialZoom, y: this._renderer.height / initialZoom },
    });

    this._render();
    this._raf = window.requestAnimationFrame(this._update);
  };

  private _sortMarbles(dt: number) {
    const map = ProgressMap.for(this._stage);
    let known = 0;
    const alpha = 1 - Math.exp(-dt / RANK_EMA_SEC);
    const keys = new Map<Marble, number>();
    for (const m of this._marbles) {
      const raw = map.distanceAt(m.x, m.y);
      const prev = this._rankKeys.get(m);
      if (prev !== undefined) known++;
      keys.set(m, prev !== undefined ? prev + (raw - prev) * alpha : raw);
    }
    this._rankKeys = keys;
    if (known < this._marbles.length / 2) {
      this._marbles.sort((a, b) => keys.get(a)! - keys.get(b)! || b.y - a.y);
      return;
    }
    const list = this._marbles;
    for (let i = 1; i < list.length; i++) {
      const m = list[i];
      const k = keys.get(m)! + RANK_MARGIN;
      let j = i;
      while (j > 0 && k < keys.get(list[j - 1])!) {
        list[j] = list[j - 1];
        j--;
      }
      list[j] = m;
    }
  }

  private _updateMarbles(deltaTime: number, timeScale: number) {
    for (let i = 0; i < this._marbles.length; i++) {
      const marble = this._marbles[i];
      marble.update(deltaTime, timeScale);
      if (marble.skill === Skills.Impact) {
        this._effects.push(new SkillEffect(marble.x, marble.y));
        this.physics.impact(marble.id);
      }
      if (marble.y > this._stage.goalY) {
        this._winners.push(marble);
        this.dispatchEvent(new CustomEvent('finish', { detail: { name: marble.name, rank: this._winners.length } }));
        if (this._isRunning && this._isWinningRank(this._winners.length - 1)) {
          this._particleManager.shot(this._renderer.width, this._renderer.height);
        }
        this._pendingRemovals.push(window.setTimeout(() => this.physics.removeMarble(marble.id), 500));
      }
    }

    const stage = this._stage;
    const zones = stage.zoomZones?.length ? stage.zoomZones : null;
    const intensityOf = (m: Marble) =>
      zones ? zoomZoneIntensity(zones, m.x, m.y) : Math.max(0, 1 - Math.abs(stage.zoomY - m.y) / zoomThreshold);
    const target = this._marbles[this._targetIndex];
    const rival = this._marbles[this._rivalIndex];
    this._focusOnRival = !!target && !!rival && intensityOf(rival) > intensityOf(target);
    const focus = this._focusOnRival ? rival : target;
    this._goalDist = Math.abs(stage.zoomY - (focus ? focus.y : 0));
    this._zoomIntensity = zones ? (focus ? intensityOf(focus) : 0) : null;
    this._timeScale = this._calcTimeScale();
    this._marbles = this._marbles.filter((marble) => marble.y <= this._stage.goalY);
    this._checkFinish();
  }

  private get _targetIndex() {
    return this._winnerRange.end - this._winners.length;
  }

  private get _rivalIndex() {
    const i = this._targetIndex;
    return this._marbles[i + 1] ? i + 1 : i - 1;
  }

  private _isWinningRank(rank: number) {
    return rank >= this._winnerRange.start && rank <= this._winnerRange.end;
  }

  private _checkFinish() {
    if (!this._isRunning) return;
    const { start, end } = this._winnerRange;
    const early = this._winners.length > 0 && this._marbles.length === 1;
    const ranked = early ? [...this._winners, this._marbles[0]] : this._winners;
    if (ranked.length <= end) return;
    if (early && this._isWinningRank(this._winners.length)) {
      this._particleManager.shot(this._renderer.width, this._renderer.height);
    }
    this._result = ranked.slice(start, end + 1);
    this._isRunning = false;
    this.dispatchEvent(new CustomEvent('goal', { detail: { winner: this._result[0].name } }));
  }

  private _calcTimeScale(): number {
    const targetIndex = this._targetIndex;
    if (this._zoomIntensity !== null) {
      if (
        this._winners.length < this._winnerRange.end + 1 &&
        this._zoomIntensity > 0 &&
        (this._marbles[targetIndex - 1] || this._marbles[targetIndex + 1])
      ) {
        return Math.max(0.2, 1 - this._zoomIntensity);
      }
      return 1;
    }
    if (this._winners.length < this._winnerRange.end + 1 && this._goalDist < zoomThreshold) {
      const m = this._marbles[this._focusOnRival ? this._rivalIndex : targetIndex];
      if (m && m.y > this._stage.zoomY - zoomThreshold * 1.2 && (this._marbles[targetIndex - 1] || this._marbles[targetIndex + 1])) {
        return Math.max(0.2, this._goalDist / zoomThreshold);
      }
    }
    return 1;
  }

  private _updateEffects(deltaTime: number) {
    this._effects.forEach((effect) => effect.update(deltaTime));
    this._effects = this._effects.filter((effect) => !effect.isDestroy);
  }

  private _render() {
    this._renderer.render(
      {
        camera: this._camera,
        stage: this._stage,
        entities: this.physics.getEntities(),
        marbles: this._marbles,
        winners: this._winners,
        particleManager: this._particleManager,
        effects: this._effects,
        winnerRange: this._winnerRange,
        result: this._result,
        size: { x: this._renderer.width, y: this._renderer.height },
        theme: this._theme,
      },
      this._uiObjects
    );
  }

  private async _init() {
    this.physics = new Box2dPhysics();
    await this.physics.init();
    if (this._destroyed) return;
    this.attachEvent();
    const minimap = new Minimap();
    minimap.onViewportChange((pos) => {
      if (pos) {
        this._camera.setPosition(pos, false);
        this._camera.lock(true);
      } else {
        this._camera.lock(false);
      }
    });
    this.addUiObject(minimap);
    this._loadMap();
  }

  private mouseHandler(eventName: MouseEventName, e: MouseEvent) {
    const handlerName = `on${eventName}` as MouseEventHandlerName;
    const sizeFactor = this._renderer.sizeFactor;
    const pos = { x: e.offsetX * sizeFactor, y: e.offsetY * sizeFactor };
    this._uiObjects.forEach((obj) => {
      if (!obj[handlerName]) return;
      const bounds = obj.getBoundingBox();
      if (!bounds) {
        obj[handlerName]({ ...pos, button: e.button });
      } else if (pos.x >= bounds.x && pos.y >= bounds.y && pos.x <= bounds.x + bounds.w && pos.y <= bounds.y + bounds.h) {
        obj[handlerName]({ x: pos.x - bounds.x, y: pos.y - bounds.y, button: e.button });
      } else {
        obj[handlerName](undefined);
      }
    });
  }

  /** Pointer gone (touch ended, cancelled or left the canvas): every UI object sees "no position", so the minimap unlocks the camera. */
  private releasePointer() {
    this._uiObjects.forEach((obj) => obj.onMouseMove?.(undefined));
  }

  private attachEvent() {
    const canvas = this._renderer.canvas;
    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      canvas.addEventListener(type, fn);
      this._cleanup.push(() => canvas.removeEventListener(type, fn));
    };
    on('pointerdown', (e) => this.mouseHandler('MouseDown', e));
    on('pointerup', (e) => {
      this.mouseHandler('MouseUp', e);
      // A finger lifted off the minimap must give the camera back (a mouse keeps hovering, so it stays).
      if (e.pointerType !== 'mouse') this.releasePointer();
    });
    on('pointermove', (e) => this.mouseHandler('MouseMove', e));
    on('pointerleave', () => this.releasePointer());
    on('pointercancel', () => this.releasePointer());
    on('contextmenu', (e) => e.preventDefault());
  }

  private _loadMap() {
    this.physics.createStage(this._stage);
    this._camera.initializePosition();
  }

  private clearMarbles() {
    this._pendingRemovals.forEach((id) => window.clearTimeout(id));
    this._pendingRemovals = [];
    this.physics.clearMarbles();
    this._result = null;
    this._winners = [];
    this._marbles = [];
    this._rankKeys = new Map();
  }

  /** Drop the marbles at the top. `last` = winner is the last marble to finish. */
  start(last: boolean, label: string) {
    if (!this._isReady || this._marbles.length === 0) return;
    this._renderer.winnerLabel = label;
    const n = this._marbles.length;
    this.setWinnerRange(last ? n - 1 : 0, last ? n - 1 : 0);
    this._isRunning = true;
    this._camera.startFollowingMarbles();
    this.physics.start();
    this._marbles.forEach((marble) => (marble.isActive = true));
  }

  setSpeed(value: number) {
    if (value > 0) this._speed = value;
  }

  setTheme(name: keyof typeof Themes) {
    this._theme = Themes[name];
  }

  private setWinnerRange(start: number, end: number) {
    options.winnerRange = { start, end };
    this._winnerRange = clipWinnerRange(options.winnerRange, this._marbles.length);
  }

  /** Names in the order they crossed the finish line. */
  finishOrder(): string[] {
    return this._winners.map((m) => m.name);
  }

  /** Names of the marbles still on the course, front first. */
  liveOrder(): string[] {
    return this._marbles.map((m) => m.name);
  }

  /** Put the members' marbles at the start. Each person gets one colour for all of their marbles. */
  setMembers(members: PinballMember[]) {
    this._members = members;
    if (!this._isReady) return;
    this.reset();
    const total = members.reduce((s, m) => s + m.count, 0);
    const orders = shuffle(Array.from({ length: total }, (_, i) => i));
    members.forEach((member) => {
      for (let j = 0; j < member.count; j++) {
        const order = orders.pop() ?? 0;
        const marble = new Marble(this.physics, order, total, member.name, 1);
        marble.fill = member.color;
        marble.color = member.color;
        // drawImage on a not-yet-loaded image draws nothing for a frame or two; that is fine.
        marble.skin = member.skin ? skinImage(member.skin) : null;
        this._marbles.push(marble);
      }
    });
    if (total > 0) {
      const cols = Math.min(total, 10);
      const rows = Math.ceil(total / 10);
      const lineDelta = -Math.max(0, Math.ceil(rows - 5));
      this._camera.initializePosition({ x: 10.25 + (cols - 1) * 0.3, y: (1 + rows) / 2 + lineDelta }, 2);
    }
  }

  private reset() {
    this.clearMarbles();
    this.physics.clear();
    this._marbles = [];
    this._loadMap();
    this._goalDist = Infinity;
    this._focusOnRival = false;
    this._isRunning = false;
  }
}
