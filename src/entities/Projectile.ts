import Phaser from 'phaser';

/**
 * 弹道实体 - 追踪目标位置，不同颜色不同视觉
 */
export class Projectile extends Phaser.GameObjects.Container {
  private speed: number;
  private targetX: number;
  private targetY: number;
  private damage: number;
  private splash: number;
  private arrived: boolean = false;
  private trailTimer: number = 0;
  private projColor: number;
  private projBody: Phaser.GameObjects.Arc;

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
    super(scene, x, y);
    this.speed = speed;
    this.targetX = targetX;
    this.targetY = targetY;
    this.damage = damage;
    this.splash = splash;
    this.projColor = color;

    // 弹体
    const size = splash > 0 ? 4 : 3;
    this.projBody = scene.add.circle(0, 0, size, color);
    this.projBody.setStrokeStyle(0.5, 0xFFFFFF, 0.4);
    this.add(this.projBody);

    // 高亮中心
    const core = scene.add.circle(0, 0, size * 0.4, 0xFFFFFF, 0.5);
    this.add(core);

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

    // 拖尾粒子
    this.trailTimer += delta;
    if (this.trailTimer > 25 && this.scene) {
      this.trailTimer = 0;
      const trail = this.scene.add.circle(this.x, this.y, 1.5, this.projColor, 0.5).setDepth(14);
      this.scene.tweens.add({
        targets: trail, alpha: 0, scale: 0.2, duration: 180,
        onComplete: () => trail.destroy(),
      });
    }
  }
}
