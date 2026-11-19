import type { StageDef } from './stage';
import type { MapEntityState } from './types/MapEntity.type';

export interface IPhysics {
  init(): Promise<void>;

  clear(): void;

  clearMarbles(): void;

  createStage(stage: StageDef): void;

  createMarble(id: number, x: number, y: number): void;

  shakeMarble(id: number): void;

  removeMarble(id: number): void;

  getMarblePosition(id: number): { x: number; y: number; angle: number };

  /** getMarblePosition without the angle: one call less into the engine, for the per-step loop. */
  getMarbleXY(id: number): { x: number; y: number };

  getEntities(): MapEntityState[];

  impact(id: number): void;

  start(): void;

  step(deltaSeconds: number): void;
}
