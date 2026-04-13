import Phaser from 'phaser';

/**
 * 弹道实体 - 追踪目标位置
 */
export class Projectile extends Phaser.GameObjects.Arc {
  private speed: number;
  private targetX: number;
  private targetY: number;
  private damage: number;
  private splash: number;
  private arrived: boolean = false;
  private trailTimer: number = 0;

  onHit?: (x: number, y: number, damage: number, splash: number) => void;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    targetX: number, targetY: number,
    speed: number,
    damage: number,
    splash: number,
    color: number,
  ) {
    super(scene, x, y, 3, 0, 360, false, color);
    this.speed = speed;
    this.targetX = targetX;
    this.targetY = targetY;
    this.damage = damage;
    this.splash = splash;

    scene.add.existing(this);
    this.setDepth(15);
  }

  update(_time: number, delta: number): void {
    if (this.arrived || !this.active) return;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const moveAmount = (this.speed * delta) / 1000;

    if (dist <= moveAmount + 2) {
      this.arrived = true;
      this.onHit?.(this.targetX, this.targetY, this.damage, this.splash);
      this.destroy();
      return;
    }

    this.x += (dx / dist) * moveAmount;
    this.y += (dy / dist) * moveAmount;

    // 简单拖尾
    this.trailTimer += delta;
    if (this.trailTimer > 30 && this.scene) {
      this.trailTimer = 0;
      const trail = this.scene.add.circle(this.x, this.y, 1.5, this.fillColor, 0.4).setDepth(14);
      this.scene.tweens.add({
        targets: trail,
        alpha: 0,
        scale: 0.3,
        duration: 150,
        onComplete: () => trail.destroy(),
      });
    }
  }
}
