import { initialZoom } from './constants';
import type { StageDef } from './stage';
import type { RenderParameters } from './rouletteRenderer';
import type { ColorTheme } from './types/ColorTheme';
import type { MapEntityState } from './types/MapEntity.type';
import type { Rect } from './types/rect.type';
import type { VectorLike } from './types/VectorLike';
import type { UIObject } from './UIObject';

/** 미니맵 최대 배율. 맵이 길거나 넓으면 이보다 작아진다 */
const MINIMAP_SCALE = 4;
/** 기본으로 보여주는 가로 범위 (공식 맵 크기). 맵 공유마당의 넓은 맵은 장애물이 있는 만큼 넓혀 보여준다 */
const MINIMAP_MIN_X = 0;
const MINIMAP_UNITS = 26;
/** 미니맵은 세로로 긴 스트립이다. maple-dashboard: 오른쪽 끝에 붙이고(user, 2026-11-13) 숨길 수 있다 */
export const MINIMAP_INSET = 10;
export const MINIMAP_WIDTH = MINIMAP_UNITS * MINIMAP_SCALE;

export class Minimap implements UIObject {
  private ctx!: CanvasRenderingContext2D;
  private lastParams: RenderParameters | null = null;

  private _onViewportChangeHandler: ((pos?: VectorLike) => void) | null = null;
  private boundingBox: Rect;
  private mousePosition: { x: number; y: number } | null = null;
  private scale = MINIMAP_SCALE;
  /** 지금 맵의 가로 범위. 맵이 바뀔 때만 다시 계산한다 */
  private rangeStage: StageDef | null = null;
  private range = { minX: MINIMAP_MIN_X, maxX: MINIMAP_MIN_X + MINIMAP_UNITS };
  private visible = true;

  constructor() {
    this.boundingBox = {
      x: MINIMAP_INSET,
      y: MINIMAP_INSET,
      w: MINIMAP_WIDTH,
      h: 0,
    };
  }

  getBoundingBox(): Rect | null {
    // Hidden: a box no pointer can be in. (null would mean "the whole canvas" to the mouse handler.)
    return this.visible ? this.boundingBox : { x: -1, y: -1, w: 0, h: 0 };
  }

  /** Show or hide the map. Hiding gives the camera back if the pointer was on it. */
  setVisible(visible: boolean) {
    if (this.visible === visible) return;
    this.visible = visible;
    if (!visible) this.onMouseMove(undefined);
  }

  onViewportChange(callback: (pos?: VectorLike) => void) {
    this._onViewportChangeHandler = callback;
  }

  update(): void {
    // nothing to do
  }

  onMouseMove = (e?: { x: number; y: number }) => {
    if (!e) {
      this.mousePosition = null;
      if (this._onViewportChangeHandler) {
        this._onViewportChangeHandler();
      }
      return;
    }
    if (!this.lastParams) return;
    this.mousePosition = {
      x: e.x,
      y: e.y,
    };
    if (this._onViewportChangeHandler) {
      this._onViewportChangeHandler({
        x: this.mousePosition.x / this.scale + this.range.minX,
        y: this.mousePosition.y / this.scale,
      });
    }
  };

  /** 맵의 가로 범위. 기본 범위(0 ~ 26) 와 장애물이 있는 범위를 합친다. 공식 맵은 기본 범위 그대로다 */
  private updateRange(stage: StageDef) {
    if (stage === this.rangeStage) return;
    this.rangeStage = stage;
    let minX = MINIMAP_MIN_X;
    let maxX = MINIMAP_MIN_X + MINIMAP_UNITS;
    for (const entity of stage.entities ?? []) {
      const { x } = entity.position;
      const shape = entity.shape;
      let xs: number[];
      if (shape.type === 'polyline') {
        xs = shape.points.map((p) => x + p[0]);
      } else if (shape.type === 'circle') {
        xs = [x - shape.radius, x + shape.radius];
      } else {
        const reach = Math.hypot(shape.width, shape.height);
        xs = [x - reach, x + reach];
      }
      for (const v of xs) {
        if (!Number.isFinite(v)) continue;
        minX = Math.min(minX, v);
        maxX = Math.max(maxX, v);
      }
    }
    this.range = { minX: Math.floor(minX), maxX: Math.ceil(maxX) };
  }

  render(ctx: CanvasRenderingContext2D, params: RenderParameters, width: number, height: number) {
    if (!ctx || !this.visible) return;
    const { stage } = params;
    if (!stage) return;
    this.updateRange(stage);
    const units = this.range.maxX - this.range.minX;
    // 맵이 길어도 화면 세로 안에, 넓어도 원래 미니맵 폭 안에 전부 들어가도록 배율을 줄인다
    // (다른 HUD 가 MINIMAP_WIDTH 를 기준으로 자리를 잡으므로 폭은 넘지 않게 한다)
    const maxHeight = Math.max(0, height - MINIMAP_INSET * 2);
    this.scale = Math.min(MINIMAP_SCALE, maxHeight / stage.goalY, MINIMAP_WIDTH / units);
    this.boundingBox.w = units * this.scale;
    this.boundingBox.h = stage.goalY * this.scale;
    // Against the right edge of the canvas, whatever its width.
    this.boundingBox.x = Math.max(MINIMAP_INSET, width - MINIMAP_INSET - this.boundingBox.w);

    this.lastParams = params;

    this.ctx = ctx;
    ctx.save();
    ctx.fillStyle = params.theme.minimapBackground;
    ctx.translate(this.boundingBox.x, MINIMAP_INSET);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.range.minX, 0);
    ctx.fillRect(this.range.minX, 0, units, stage.goalY);

    this.ctx.lineWidth = 3 / (params.camera.zoom + initialZoom);
    this.drawEntities(params.entities, params.theme);
    this.drawMarbles(params);
    this.drawViewport(params);

    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.boundingBox.x, this.boundingBox.y, this.boundingBox.w, this.boundingBox.h);
    ctx.restore();
  }

  private drawViewport(params: RenderParameters) {
    this.ctx.save();
    const { camera, size } = params;
    const zoom = camera.zoom * initialZoom;
    const w = size.x / zoom;
    const h = size.y / zoom;
    this.ctx.strokeStyle = params.theme.minimapViewport;
    this.ctx.lineWidth = 1 / zoom;
    this.ctx.strokeRect(camera.x - w / 2, camera.y - h / 2, w, h);
    this.ctx.restore();
  }

  private drawEntities(entities: MapEntityState[], theme: ColorTheme) {
    this.ctx.save();
    entities.forEach((entity) => {
      this.ctx.save();
      this.ctx.fillStyle = entity.shape.color ?? theme.entity[entity.shape.type].fill;
      this.ctx.strokeStyle = entity.shape.color ?? theme.entity[entity.shape.type].outline;
      this.ctx.translate(entity.x, entity.y);
      this.ctx.rotate(entity.angle);

      this.ctx.save();
      const shape = entity.shape;
      switch (shape.type) {
        case 'box': {
          const w = shape.width * 2;
          const h = shape.height * 2;
          this.ctx.rotate(shape.rotation);
          this.ctx.fillRect(-w / 2, -h / 2, w, h);
          break;
        }
        case 'circle':
          this.ctx.beginPath();
          this.ctx.arc(0, 0, shape.radius, 0, Math.PI * 2, false);
          this.ctx.stroke();
          break;
        case 'polyline':
          if (shape.points.length > 0) {
            this.ctx.beginPath();
            this.ctx.moveTo(shape.points[0][0], shape.points[0][1]);
            for (let i = 1; i < shape.points.length; i++) {
              this.ctx.lineTo(shape.points[i][0], shape.points[i][1]);
            }
            this.ctx.stroke();
          }
          break;
      }
      this.ctx.restore();
      this.ctx.restore();
    });
    this.ctx.restore();
  }

  private drawMarbles(params: RenderParameters) {
    const { marbles } = params;
    const viewPort = {
      x: params.camera.x,
      y: params.camera.y,
      w: params.size.x,
      h: params.size.y,
      zoom: params.camera.zoom * initialZoom,
    };
    marbles.forEach((marble) => {
      marble.render(this.ctx, 1, false, true, undefined, viewPort, params.theme);
    });
  }
}
