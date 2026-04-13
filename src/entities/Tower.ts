import Phaser from 'phaser';
import { TowerConfig } from '../config/towers';
import { TILE_SIZE } from '../utils/constants';
import { distanceBetween } from '../utils/helpers';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';

/**
 * 防御塔实体
 */
export class Tower extends Phaser.GameObjects.Container {
  private config: TowerConfig;
  private level: number = 0;
  private gridCol: number;
  private gridRow: number;
  private attackTimer: number = 0;
  private currentDamage: number;
  private currentRange: number;
  private currentAttackSpeed: number;
  private currentSplash: number;
  private totalInvested: number;
  private towerBody: Phaser.GameObjects.Rectangle;
  private towerTop: Phaser.GameObjects.Arc;
  private levelStars: Phaser.GameObjects.Text | null = null;
  private rangeCircle: Phaser.GameObjects.Arc | null = null;
  private isSelected: boolean = false;
  private killCount: number = 0;
  private heroLevel: number = 1;
  private lastTarget: Enemy | null = null;

  // 引用
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];

  // 回调
  onProjectileHit?: (x: number, y: number, damage: number, splash: number, attackType: string, special?: string) => void;

  constructor(scene: Phaser.Scene, config: TowerConfig, col: number, row: number) {
    const x = col * TILE_SIZE + TILE_SIZE / 2;
    const y = row * TILE_SIZE + TILE_SIZE / 2;
    super(scene, x, y);

    this.config = config;
    this.gridCol = col;
    this.gridRow = row;
    this.currentDamage = config.damage;
    this.currentRange = config.range;
    this.currentAttackSpeed = config.attackSpeed;
    this.currentSplash = config.splash;
    this.totalInvested = config.cost;

    // 塔底座
    this.towerBody = scene.add.rectangle(0, 0, TILE_SIZE - 4, TILE_SIZE - 4, config.color);
    this.towerBody.setStrokeStyle(1, 0x000000, 0.6);
    this.add(this.towerBody);

    // 塔中心标记（攻击类型对应颜色）
    this.towerTop = scene.add.circle(0, 0, 5, config.projectileColor);
    this.add(this.towerTop);

    // 等级星标
    this.levelStars = scene.add.text(0, TILE_SIZE / 2 - 2, '', {
      fontSize: '8px', color: '#FFD700',
    }).setOrigin(0.5, 1);
    this.add(this.levelStars);

    this.updateLevelDisplay();

    scene.add.existing(this);
    this.setDepth(5);
  }

  getConfig(): TowerConfig { return this.config; }
  getLevel(): number { return this.level; }
  getGridCol(): number { return this.gridCol; }
  getGridRow(): number { return this.gridRow; }
  getTotalInvested(): number { return this.totalInvested; }
  getRange(): number { return this.currentRange; }
  getDamage(): number { return this.currentDamage + this.auraDamageBonus; }
  getAttackSpeed(): number { return Math.max(200, this.currentAttackSpeed - this.auraSpeedBonus); }
  getKillCount(): number { return this.killCount; }
  getHeroLevel(): number { return this.heroLevel; }

  // 光环 buff
  private auraDamageBonus: number = 0;
  private auraSpeedBonus: number = 0;

  setAuraBuff(damageBonus: number, speedBonus: number): void {
    this.auraDamageBonus = damageBonus;
    this.auraSpeedBonus = speedBonus;
  }

  setEnemies(enemies: Enemy[]): void {
    this.enemies = enemies;
  }

  upgrade(): { cost: number } | null {
    if (this.level >= this.config.upgrades.length) return null;
    const upgradeData = this.config.upgrades[this.level];
    this.level += 1;
    this.currentDamage = upgradeData.damage;
    this.currentRange = upgradeData.range;
    this.currentAttackSpeed = upgradeData.attackSpeed;
    this.currentSplash = upgradeData.splash;
    this.totalInvested += upgradeData.cost;
    this.updateLevelDisplay();
    // 更新范围显示
    if (this.isSelected) {
      this.hideRange();
      this.showRange();
    }
    return { cost: upgradeData.cost };
  }

  getUpgradeCost(): number | null {
    if (this.level >= this.config.upgrades.length) return null;
    return this.config.upgrades[this.level].cost;
  }

  private updateLevelDisplay(): void {
    this.towerBody.setAlpha(Math.min(1, 0.8 + this.level * 0.07));
    // 等级星标
    if (this.levelStars) {
      this.levelStars.setText('★'.repeat(this.level));
    }
    // 微微变大
    this.setScale(1 + this.level * 0.04);
  }

  select(): void {
    this.isSelected = true;
    this.showRange();
    this.towerBody.setStrokeStyle(2, 0x44FF44);
  }

  deselect(): void {
    this.isSelected = false;
    this.hideRange();
    this.towerBody.setStrokeStyle(1, 0x000000, 0.6);
  }

  toggleSelection(): void {
    if (this.isSelected) this.deselect();
    else this.select();
  }

  private showRange(): void {
    if (this.rangeCircle) this.rangeCircle.destroy();
    this.rangeCircle = this.scene.add.circle(this.x, this.y, this.currentRange);
    this.rangeCircle.setStrokeStyle(1.5, 0x44FF44, 0.35);
    this.rangeCircle.setFillStyle(0x44FF44, 0.06);
    this.rangeCircle.setDepth(3);
  }

  private hideRange(): void {
    if (this.rangeCircle) {
      this.rangeCircle.destroy();
      this.rangeCircle = null;
    }
  }

  addKill(): void {
    this.killCount += 1;
    if (this.config.special === 'hero_grow') {
      this.heroLevel = 1 + Math.floor(this.killCount / 10);
      const growBonus = 1 + (this.heroLevel - 1) * 0.08;
      let baseDmg = this.config.damage;
      if (this.level > 0 && this.config.upgrades[this.level - 1]) {
        baseDmg = this.config.upgrades[this.level - 1].damage;
      }
      this.currentDamage = Math.floor(baseDmg * growBonus);
    }
  }

  update(_time: number, delta: number): void {
    this.attackTimer += delta;

    const effectiveAttackSpeed = Math.max(200, this.currentAttackSpeed - this.auraSpeedBonus);
    if (this.attackTimer >= effectiveAttackSpeed) {
      const target = this.findTarget();
      if (target) {
        this.attackTimer = 0;
        this.fireAt(target);
      }
    }

    // 更新弹道移动
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (proj.active) {
        proj.update(_time, delta);
      } else {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private canAttackEnemy(enemy: Enemy): boolean {
    if (enemy.isDying() || !enemy.active) return false;
    // 隐形检查：非侦查塔不能攻击未揭示的隐形单位
    if (enemy.isInvisible() && !enemy.isRevealed() && this.config.special !== 'detect') return false;
    // 飞行检查：只有防空塔和光环塔能攻击飞行单位
    if (enemy.isFlying() && this.config.special !== 'antiair' && this.config.special !== 'freeze_aura'
        && this.config.category !== 'support') return false;
    // 防空塔低等级只能打飞行
    if (this.config.special === 'antiair' && this.level < 4 && !enemy.isFlying()) return false;
    return true;
  }

  private findTarget(): Enemy | null {
    if (this.lastTarget && this.lastTarget.active && !this.lastTarget.isDying() && this.canAttackEnemy(this.lastTarget)) {
      const dist = distanceBetween(this.x, this.y, this.lastTarget.x, this.lastTarget.y);
      if (dist <= this.currentRange) return this.lastTarget;
    }

    let bestTarget: Enemy | null = null;
    let bestScore = -Infinity;

    for (const enemy of this.enemies) {
      if (!this.canAttackEnemy(enemy)) continue;
      const dist = distanceBetween(this.x, this.y, enemy.x, enemy.y);
      if (dist <= this.currentRange) {
        const score = enemy.getLaps() * 10000 + (this.currentRange - dist);
        if (score > bestScore) { bestScore = score; bestTarget = enemy; }
      }
    }

    this.lastTarget = bestTarget;
    return bestTarget;
  }

  private fireAt(target: Enemy): void {
    // 侦查塔：揭示范围内所有隐形单位
    if (this.config.special === 'detect') {
      for (const enemy of this.enemies) {
        if (enemy.isDying() || !enemy.active) continue;
        if (enemy.isInvisible() && distanceBetween(this.x, this.y, enemy.x, enemy.y) <= this.currentRange) {
          enemy.reveal(3000);
        }
      }
    }

    // 冰塔光环效果 - 不发弹道，直接范围减速
    if (this.config.special === 'freeze_aura') {
      const pulse = this.scene.add.circle(this.x, this.y, this.currentSplash, 0x66CCFF, 0.12).setDepth(4);
      this.scene.tweens.add({ targets: pulse, alpha: 0, scale: 1.2, duration: 400, onComplete: () => pulse.destroy() });
      this.onProjectileHit?.(this.x, this.y, this.currentDamage + this.auraDamageBonus, this.currentSplash, this.config.attackType.toString(), 'freeze_aura');
      return;
    }

    // 秒杀塔 - 直接秒杀非BOSS单位
    if (this.config.special === 'execute') {
      if (!target.getConfig().isBoss) {
        const executeText = this.scene.add.text(target.x, target.y - 10, '💀秒杀!', {
          fontSize: '12px', color: '#FF0000', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(30);
        this.scene.tweens.add({ targets: executeText, y: executeText.y - 20, alpha: 0, duration: 700, onComplete: () => executeText.destroy() });
        target.takeDamage(999999); // 秒杀
        this.addKill();
      } else {
        // 对 BOSS 造成大量伤害(10% 最大HP)
        const bossDmg = Math.floor(target.getMaxHp() * 0.1);
        target.takeDamage(bossDmg);
        this.onProjectileHit?.(target.x, target.y, bossDmg, 0, this.config.attackType.toString(), undefined);
      }
      this.scene.tweens.add({ targets: this.towerTop, scaleX: 1.8, scaleY: 1.8, duration: 100, yoyo: true });
      return;
    }

    // 发射动画
    this.scene.tweens.add({ targets: this.towerTop, scaleX: 1.4, scaleY: 1.4, duration: 60, yoyo: true });

    // 重击塔暴击判定
    let damage = this.currentDamage + this.auraDamageBonus;
    let special = this.config.special;
    let projColor = this.config.projectileColor;

    if (this.config.special === 'critical') {
      const critChance = 0.15 + this.level * 0.05; // 15% base + 5%/level
      if (Math.random() < critChance) {
        damage = Math.floor(damage * (2.0 + this.level * 0.3)); // 2x~3.5x crit
        projColor = 0xFF4444;
        const critText = this.scene.add.text(this.x, this.y - 12, '💥暴击!', {
          fontSize: '11px', color: '#FF4444', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(30);
        this.scene.tweens.add({ targets: critText, y: critText.y - 20, alpha: 0, duration: 600, onComplete: () => critText.destroy() });
      }
    }

    // 弹射塔 - 发射后弹射到多个目标
    if (this.config.special === 'bounce') {
      const bounceCount = 2 + this.level; // 2~6 次弹射
      let bounceTargets: Enemy[] = [target];
      const hitSet = new Set<Enemy>([target]);
      let current = target;

      for (let b = 0; b < bounceCount; b++) {
        let nearest: Enemy | null = null;
        let nearestDist = 150;
        for (const enemy of this.enemies) {
          if (enemy.isDying() || !enemy.active || hitSet.has(enemy)) continue;
          if (!this.canAttackEnemy(enemy)) continue;
          const dist = distanceBetween(current.x, current.y, enemy.x, enemy.y);
          if (dist < nearestDist) { nearestDist = dist; nearest = enemy; }
        }
        if (!nearest) break;
        hitSet.add(nearest);
        bounceTargets.push(nearest);
        current = nearest;
      }

      // 主弹道
      const mainProj = new Projectile(this.scene, this.x, this.y, target.x, target.y, this.config.projectileSpeed, damage, 0, projColor);
      mainProj.onHit = (hx, hy, dmg, sp) => {
        this.onProjectileHit?.(hx, hy, dmg, sp, this.config.attackType.toString(), undefined);
      };
      this.projectiles.push(mainProj);

      // 弹射弹道（延迟发射）
      for (let i = 1; i < bounceTargets.length; i++) {
        const from = bounceTargets[i - 1];
        const to = bounceTargets[i];
        const bounceDmg = Math.floor(damage * (1 - i * 0.1)); // 每次弹射-10%伤害
        this.scene.time.delayedCall(i * 150, () => {
          if (!to.active || to.isDying()) return;
          const bp = new Projectile(this.scene, from.x, from.y, to.x, to.y, this.config.projectileSpeed * 1.2, bounceDmg, 0, 0xAACC44);
          bp.onHit = (hx, hy, dmg, sp) => {
            this.onProjectileHit?.(hx, hy, dmg, sp, this.config.attackType.toString(), undefined);
          };
          this.projectiles.push(bp);
        });
      }
      return;
    }

    // 标准弹道发射
    const proj = new Projectile(
      this.scene, this.x, this.y, target.x, target.y,
      this.config.projectileSpeed, damage, this.currentSplash, projColor,
    );

    proj.onHit = (hx, hy, dmg, splash) => {
      this.onProjectileHit?.(hx, hy, dmg, splash, this.config.attackType.toString(), special);
    };

    this.projectiles.push(proj);
  }

  destroy(fromScene?: boolean): void {
    this.hideRange();
    for (const proj of this.projectiles) {
      if (proj.active) proj.destroy();
    }
    this.projectiles = [];
    super.destroy(fromScene);
  }
}
