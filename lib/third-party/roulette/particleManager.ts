import { Particle } from './particle';

export class ParticleManager {
  private _particles: Particle[] = [];

  /** Particles still on screen (0 = the confetti is over). */
  get count() {
    return this._particles.length;
  }

  update(deltaTime: number) {
    this._particles.forEach((particle) => {
      particle.update(deltaTime);
    });
    this._particles = this._particles.filter((particle) => !particle.isDestroy);
  }

  render(ctx: CanvasRenderingContext2D) {
    this._particles.forEach((particle) => particle.render(ctx));
  }

  shot(x: number, y: number) {
    for (let i = 0; i < 200; i++) {
      this._particles.push(new Particle(x, y));
    }
  }
}
