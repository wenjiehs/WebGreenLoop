/**
 * 纯逻辑弹道 — 无 Phaser 依赖
 */
export class ProjectileLogic {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  damage: number;
  splash: number;
  color: number;
  active: boolean = true;
  arrived: boolean = false;

  onHit?: (x: number, y: number, damage: number, splash: number) => void;

  constructor(x: number, y: number, targetX: number, targetY: number, speed: number, damage: number, splash: number, color: number) {
    this.x = x; this.y = y;
    this.targetX = targetX; this.targetY = targetY;
    this.speed = speed; this.damage = damage; this.splash = splash; this.color = color;
  }

  update(delta: number): void {
    if (this.arrived || !this.active) return;
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const moveAmount = (this.speed * delta) / 1000;

    if (dist <= moveAmount + 2) {
      this.arrived = true;
      this.active = false;
      this.onHit?.(this.targetX, this.targetY, this.damage, this.splash);
      return;
    }

    this.x += (dx / dist) * moveAmount;
    this.y += (dy / dist) * moveAmount;
  }
}
