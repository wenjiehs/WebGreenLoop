import Phaser from 'phaser';
import { TowerConfig } from '../config/towers';
import { TILE_SIZE } from '../utils/constants';
import { distanceBetween } from '../utils/helpers';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import { soundManager } from '../systems/SoundManager';

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

    const hs = (TILE_SIZE - 6) / 2; // half size
    const gfx = scene.add.graphics();

    // 不同类型不同底座形状
    const cat = config.category;
    const sp = config.special || '';

    if (cat === 'support') {
      // 辅助塔 - 菱形
      gfx.fillStyle(config.color, 0.85);
      gfx.fillPoints([
        new Phaser.Geom.Point(0, -hs), new Phaser.Geom.Point(hs, 0),
        new Phaser.Geom.Point(0, hs), new Phaser.Geom.Point(-hs, 0),
      ], true);
      gfx.lineStyle(1.5, 0xFFFFFF, 0.2);
      gfx.strokePoints([
        new Phaser.Geom.Point(0, -hs), new Phaser.Geom.Point(hs, 0),
        new Phaser.Geom.Point(0, hs), new Phaser.Geom.Point(-hs, 0),
      ], true);
    } else if (cat === 'aoe' || sp === 'aoe') {
      // AOE塔 - 八边形
      gfx.fillStyle(config.color, 0.85);
      const pts: Phaser.Geom.Point[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
        pts.push(new Phaser.Geom.Point(Math.cos(a) * hs, Math.sin(a) * hs));
      }
      gfx.fillPoints(pts, true);
      gfx.lineStyle(1, 0x000000, 0.4);
      gfx.strokePoints(pts, true);
    } else if (sp === 'execute' || sp === 'chaos') {
      // 特殊塔 - 六角星
      gfx.fillStyle(config.color, 0.85);
      const pts: Phaser.Geom.Point[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? hs : hs * 0.55;
        pts.push(new Phaser.Geom.Point(Math.cos(a) * r, Math.sin(a) * r));
      }
      gfx.fillPoints(pts, true);
      gfx.lineStyle(1.5, 0xFF4444, 0.3);
      gfx.strokePoints(pts, true);
    } else if (cat === 'hero') {
      // 英雄塔 - 圆形+十字
      gfx.fillStyle(config.color, 0.85);
      gfx.fillCircle(0, 0, hs);
      gfx.lineStyle(1.5, 0xFFD700, 0.4);
      gfx.strokeCircle(0, 0, hs);
      gfx.lineStyle(1, 0xFFD700, 0.2);
      gfx.moveTo(-hs * 0.5, 0); gfx.lineTo(hs * 0.5, 0);
      gfx.moveTo(0, -hs * 0.5); gfx.lineTo(0, hs * 0.5);
      gfx.strokePath();
    } else if (cat === 'slow') {
      // 减速塔 - 圆角方形
      gfx.fillStyle(config.color, 0.85);
      gfx.fillRoundedRect(-hs, -hs, hs * 2, hs * 2, 5);
      gfx.lineStyle(1, 0x66CCFF, 0.3);
      gfx.strokeRoundedRect(-hs, -hs, hs * 2, hs * 2, 5);
    } else {
      // 基础塔 - 普通方形
      gfx.fillStyle(config.color, 0.85);
      gfx.fillRect(-hs, -hs, hs * 2, hs * 2);
      gfx.lineStyle(1, 0x000000, 0.4);
      gfx.strokeRect(-hs, -hs, hs * 2, hs * 2);
    }
    this.add(gfx);

    // 用一个透明矩形做选中框（不显示但保持API兼容）
    this.towerBody = scene.add.rectangle(0, 0, TILE_SIZE - 4, TILE_SIZE - 4, 0x000000, 0);
    this.add(this.towerBody);

    // 塔类型图标
    const iconMap: Record<string, string> = {
      'aoe': '💥', 'bounce': '↗', 'critical': '⚡', 'poison': '☠',
      'freeze_aura': '❄', 'slow': '❄', 'armor_reduce': '🔻', 'aura_attack': '⚔',
      'aura_speed': '⏩', 'antiair': '✈', 'chaos': '☯', 'hero_grow': '⭐',
      'execute': '💀', 'detect': '👁', 'chain': '⚡',
    };
    const icon = iconMap[sp] || '';
    if (icon) {
      const iconText = scene.add.text(0, -3, icon, { fontSize: '10px' }).setOrigin(0.5);
      this.add(iconText);
    }

    // 炮口/中心点
    this.towerTop = scene.add.circle(0, icon ? 5 : 0, 3, config.projectileColor);
    this.towerTop.setStrokeStyle(0.5, 0xFFFFFF, 0.3);
    this.add(this.towerTop);

    // 光环塔 - 持续脉冲圆
    if (sp === 'aura_attack' || sp === 'aura_speed') {
      const auraColor = sp === 'aura_attack' ? 0xFF8844 : 0x44CCFF;
      const auraCircle = scene.add.circle(0, 0, config.range * 0.3, auraColor, 0.06);
      auraCircle.setStrokeStyle(1, auraColor, 0.15);
      this.add(auraCircle);
      scene.tweens.add({
        targets: auraCircle, scale: 1.3, alpha: 0.02,
        duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // 冰塔/毒塔/火塔 - 环境粒子
    if (sp === 'freeze_aura' || sp === 'slow') {
      this.startAmbientParticles(scene, 0x88CCFF, '❄', 2500);
    } else if (sp === 'poison') {
      this.startAmbientParticles(scene, 0x44FF44, '☁', 3000);
    } else if (cat === 'aoe' && config.attackType.toString().includes('magic')) {
      this.startAmbientParticles(scene, 0xFF6622, '🔥', 3500);
    }

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

  private startAmbientParticles(scene: Phaser.Scene, color: number, emoji: string, interval: number): void {
    scene.time.addEvent({
      delay: interval,
      loop: true,
      callback: () => {
        if (!this.active || !this.scene) return;
        const ox = Phaser.Math.Between(-8, 8);
        const oy = Phaser.Math.Between(-8, 8);
        const p = this.scene.add.text(this.x + ox, this.y + oy, emoji, {
          fontSize: '6px',
        }).setOrigin(0.5).setDepth(4).setAlpha(0.5);
        this.scene.tweens.add({
          targets: p, y: p.y - 12, alpha: 0, duration: 1200,
          onComplete: () => p.destroy(),
        });
      },
    });
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
    const is3D = (window as any).__3dEnabled;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (proj.active) {
        proj.update(_time, delta);
        // 3D 模式下隐藏 2D 弹道
        if (is3D) proj.setAlpha(0);
        else proj.setAlpha(1);
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
      // 3D 冰冻
      const bridgeIce = (window as any).__gameBridge;
      if (bridgeIce?.effects && (window as any).__3dEnabled) {
        bridgeIce.effects.spawnFreezeEffect(this.x, this.y, this.currentSplash);
      }
      return;
    }

    // 秒杀塔 - 直接秒杀非BOSS单位
    if (this.config.special === 'execute') {
      soundManager.playExecute();
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

    // 发射动画 + 后坐力
    this.scene.tweens.add({ targets: this.towerTop, scaleX: 1.4, scaleY: 1.4, duration: 60, yoyo: true });
    this.scene.tweens.add({ targets: this, y: this.y + 1, duration: 40, yoyo: true });

    // 塔类型音效
    const sp = this.config.special;
    if (sp === 'aoe') soundManager.playCannon();
    else if (sp === 'poison') soundManager.playPoison();
    else if (sp === 'chain') soundManager.playLightning();
    else if (sp === 'freeze_aura' || sp === 'slow') soundManager.playFreeze();
    else if (sp === 'critical') {} // 暴击时单独播
    else if (sp === 'bounce') soundManager.playBounce();
    else if (this.config.category === 'aoe') soundManager.playFire();
    else if (this.config.attackType.toString().includes('magic')) soundManager.playMagic();
    else soundManager.playArrow();

    // 重击塔暴击判定
    let damage = this.currentDamage + this.auraDamageBonus;
    let special = this.config.special;
    let projColor = this.config.projectileColor;

    if (this.config.special === 'critical') {
      const critChance = 0.15 + this.level * 0.05; // 15% base + 5%/level
      if (Math.random() < critChance) {
        damage = Math.floor(damage * (2.0 + this.level * 0.3));
        projColor = 0xFF4444;
        soundManager.playCritical();
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

      // 3D 主弹道
      const bridgeBounce = (window as any).__gameBridge;
      if (bridgeBounce && (window as any).__3dEnabled) {
        bridgeBounce.spawnProjectile(this.x, this.y, target.x, target.y, projColor, false);
      }

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
          // 3D 弹射弹道
          const bb = (window as any).__gameBridge;
          if (bb && (window as any).__3dEnabled) {
            bb.spawnProjectile(from.x, from.y, to.x, to.y, 0xAACC44, false);
          }
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

    // 3D 弹道
    const bridge = (window as any).__gameBridge;
    if (bridge && (window as any).__3dEnabled) {
      bridge.spawnProjectile(this.x, this.y, target.x, target.y, projColor, this.currentSplash > 0);
    }
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
