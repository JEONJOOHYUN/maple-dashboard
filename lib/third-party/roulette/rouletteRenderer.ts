// Based on lazygyu's roulette (MIT, see LICENSE). Changed for maple-dashboard: no ads, no keyword sprites,
// no bundled character images, the canvas goes into a container we pass in, and the winner banner is Korean.
import type { Camera } from './camera';
import { canvasHeight, canvasWidth, initialZoom, Themes, winnerAreaHeight } from './constants';
import type { GameObject } from './gameObject';
import type { Marble } from './marble';
import type { WinnerRange } from './options';
import type { ParticleManager } from './particleManager';
import type { StageDef } from './stage';
import type { ColorTheme } from './types/ColorTheme';
import type { MapEntityState } from './types/MapEntity.type';
import type { VectorLike } from './types/VectorLike';
import type { UIObject } from './UIObject';

export type RenderParameters = {
  camera: Camera;
  stage: StageDef;
  entities: MapEntityState[];
  marbles: Marble[];
  winners: Marble[];
  particleManager: ParticleManager;
  effects: GameObject[];
  winnerRange: WinnerRange;
  /** null while running, the winners once decided */
  result: Marble[] | null;
  size: VectorLike;
  theme: ColorTheme;
};

const MAX_DISPLAY_WIDTH = 1920;

export class RouletteRenderer {
  protected _canvas!: HTMLCanvasElement;
  protected _sceneCanvas!: HTMLCanvasElement;
  protected ctx!: CanvasRenderingContext2D;
  private _displayCtx!: CanvasRenderingContext2D;
  private _observer: ResizeObserver | null = null;
  public sizeFactor = 1;
  protected _theme: ColorTheme = Themes.dark;
  /** Label above the winner name (e.g. "1등 당첨"). */
  public winnerLabel = '당첨';

  get width() {
    return this._sceneCanvas.width;
  }

  get height() {
    return this._sceneCanvas.height;
  }

  get canvas() {
    return this._canvas;
  }

  init(container: HTMLElement) {
    this._canvas = document.createElement('canvas');
    this._canvas.width = canvasWidth;
    this._canvas.height = canvasHeight;
    this._canvas.style.width = '100%';
    this._canvas.style.height = '100%';
    this._canvas.style.display = 'block';
    this._canvas.style.touchAction = 'none';
    this._displayCtx = this._canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;

    this._sceneCanvas = document.createElement('canvas');
    this._sceneCanvas.width = canvasWidth;
    this._sceneCanvas.height = canvasHeight;
    this.ctx = this._sceneCanvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;

    container.appendChild(this._canvas);

    const resizing = (entries?: ResizeObserverEntry[]) => {
      const realSize = entries ? entries[0].contentRect : this._canvas.getBoundingClientRect();
      if (realSize.width <= 0 || realSize.height <= 0) return;
      // Scene resolution: at least 640 wide so thin lines stay visible on phones.
      const width = Math.max(realSize.width / 2, 640);
      const height = (width / realSize.width) * realSize.height;
      this._sceneCanvas.width = width;
      this._sceneCanvas.height = height;
      this.sizeFactor = width / realSize.width;

      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const displayWidth = Math.min(realSize.width * ratio, MAX_DISPLAY_WIDTH);
      this._canvas.width = displayWidth;
      this._canvas.height = (displayWidth / realSize.width) * realSize.height;
    };
    this._observer = new ResizeObserver(resizing);
    this._observer.observe(this._canvas);
    resizing();
  }

  destroy() {
    this._observer?.disconnect();
    this._canvas?.remove();
  }

  render(renderParameters: RenderParameters, uiObjects: UIObject[]) {
    this._theme = renderParameters.theme;
    this.ctx.fillStyle = this._theme.background;
    this.ctx.fillRect(0, 0, this._sceneCanvas.width, this._sceneCanvas.height);

    this.ctx.save();
    this.ctx.scale(initialZoom, initialZoom);
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.font = '0.4pt sans-serif';
    this.ctx.lineWidth = 3 / (renderParameters.camera.zoom + initialZoom);
    renderParameters.camera.renderScene(this.ctx, () => {
      this.renderGoal(renderParameters.stage);
      this.renderEntities(renderParameters.entities);
      this.renderEffects(renderParameters);
      this.renderMarbles(renderParameters);
    });
    this.ctx.restore();

    uiObjects.forEach((obj) => obj.render(this.ctx, renderParameters, this._sceneCanvas.width, this._sceneCanvas.height));
    renderParameters.particleManager.render(this.ctx);
    if (renderParameters.result?.length) this.renderWinner(renderParameters.result[0], renderParameters.theme);

    this._displayCtx.drawImage(this._sceneCanvas, 0, 0, this._canvas.width, this._canvas.height);
  }

  /** Finish line so the goal is visible. */
  private renderGoal(stage: StageDef) {
    if (!stage.goalLine) return;
    const [x1, x2] = stage.goalLine;
    this.ctx.save();
    this.ctx.strokeStyle = this._theme.goal;
    this.ctx.setLineDash([0.3, 0.3]);
    this.ctx.beginPath();
    this.ctx.moveTo(x1, stage.goalY);
    this.ctx.lineTo(x2, stage.goalY);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private renderEntities(entities: MapEntityState[]) {
    this.ctx.save();
    entities.forEach((entity) => {
      const transform = this.ctx.getTransform();
      this.ctx.translate(entity.x, entity.y);
      this.ctx.rotate(entity.angle);
      this.ctx.fillStyle = entity.shape.color ?? this._theme.entity[entity.shape.type].fill;
      this.ctx.strokeStyle = entity.shape.color ?? this._theme.entity[entity.shape.type].outline;
      this.ctx.shadowBlur = this._theme.entity[entity.shape.type].bloomRadius;
      this.ctx.shadowColor = entity.shape.bloomColor ?? entity.shape.color ?? this._theme.entity[entity.shape.type].bloom;
      const shape = entity.shape;
      switch (shape.type) {
        case 'polyline':
          if (shape.points.length > 0) {
            this.ctx.beginPath();
            this.ctx.moveTo(shape.points[0][0], shape.points[0][1]);
            for (let i = 1; i < shape.points.length; i++) this.ctx.lineTo(shape.points[i][0], shape.points[i][1]);
            this.ctx.stroke();
          }
          break;
        case 'box': {
          const w = shape.width * 2;
          const h = shape.height * 2;
          this.ctx.rotate(shape.rotation);
          this.ctx.fillRect(-w / 2, -h / 2, w, h);
          this.ctx.strokeRect(-w / 2, -h / 2, w, h);
          break;
        }
        case 'circle':
          this.ctx.beginPath();
          this.ctx.arc(0, 0, shape.radius, 0, Math.PI * 2, false);
          this.ctx.fill();
          this.ctx.stroke();
          break;
      }
      this.ctx.setTransform(transform);
    });
    this.ctx.restore();
  }

  private renderEffects({ effects, camera }: RenderParameters) {
    effects.forEach((effect) => effect.render(this.ctx, camera.zoom * initialZoom, this._theme));
  }

  private renderMarbles({ marbles, camera, winnerRange, winners, size }: RenderParameters) {
    const firstIndex = winnerRange.start - winners.length;
    const lastIndex = winnerRange.end - winners.length;
    const viewPort = { x: camera.x, y: camera.y, w: size.x, h: size.y, zoom: camera.zoom * initialZoom };
    marbles.forEach((marble, i) => {
      marble.render(this.ctx, camera.zoom * initialZoom, i >= firstIndex && i <= lastIndex, false, marble.skin ?? undefined, viewPort, this._theme);
    });
  }

  private renderWinner(winner: Marble, theme: ColorTheme) {
    const w = this._sceneCanvas.width;
    const h = this._sceneCanvas.height;
    this.ctx.save();
    this.ctx.fillStyle = theme.winnerBackground;
    this.ctx.fillRect(0, h - winnerAreaHeight, w, winnerAreaHeight);
    const cx = w / 2;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = theme.winnerText;
    this.ctx.font = "bold 30px 'Pretendard Variable', sans-serif";
    this.ctx.fillText(this.winnerLabel, cx, h - winnerAreaHeight + 44);
    this.ctx.font = "bold 64px 'Pretendard Variable', sans-serif";
    if (winner.skin) {
      const tw = this.ctx.measureText(winner.name).width;
      this.ctx.drawImage(winner.skin, cx - tw / 2 - 84, h - winnerAreaHeight / 2 + 22 - 36, 72, 72);
    }
    this.ctx.fillStyle = winner.fill ?? `hsl(${winner.hue} 90% ${theme.marbleLightness}%)`;
    if (theme.winnerOutline) {
      this.ctx.lineWidth = 4;
      this.ctx.strokeStyle = theme.winnerOutline;
      this.ctx.strokeText(winner.name, cx, h - winnerAreaHeight / 2 + 22);
    }
    this.ctx.fillText(winner.name, cx, h - winnerAreaHeight / 2 + 22);
    this.ctx.restore();
  }
}
