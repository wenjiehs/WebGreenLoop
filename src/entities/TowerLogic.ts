import { TowerConfig } from '../config/towers';
import { TILE_SIZE } from '../utils/constants';
import { distanceBetween } from '../utils/helpers';
import { EnemyLogic } from './EnemyLogic';
import { ProjectileLogic } from './ProjectileLogic';
import { soundManager } from '../systems/SoundManager';

/**
 * 纯逻辑防御塔 — 无 Phaser 依赖
 */
export class TowerLogic {
  readonly config: TowerConfig;
  x: number;
  y: number;
  gridCol: number;
  gridRow: number;
  level: number = 0;
  active: boolean = true;

  currentDamage: number;
  currentRange: number;
  currentAttackSpeed: number;
  currentSplash: number;
  totalInvested: number;
  killCount: number = 0;
  heroLevel: number = 1;
  isSelected: boolean = false;
  justFired: boolean = false; // C3: 攻击动画触发标记

  // 光环 buff
  auraDamageBonus: number = 0;
  auraSpeedBonus: number = 0;

  private attackTimer: number = 0;
  private enemies: EnemyLogic[] = [];
  projectiles: ProjectileLogic[] = [];
  private lastTarget: EnemyLogic | null = null;

  // 3D 弹道触发回调
  onProjectileHit?: (x: number, y: number, damage: number, splash: number, attackType: string, special?: string) => void;
  onFireProjectile?: (fromX: number, fromY: number, toX: number, toY: number, color: number, isAOE: boolean) => void;
  onFireEffect?: (type: string, x: number, y: number, radius?: number) => void;

  constructor(config: TowerConfig, col: number, row: number) {
    this.config = config;
    this.gridCol = col;
    this.gridRow = row;
    this.x = col * TILE_SIZE + TILE_SIZE / 2;
    this.y = row * TILE_SIZE + TILE_SIZE / 2;
    this.currentDamage = config.damage;
    this.currentRange = config.range;
    this.currentAttackSpeed = config.attackSpeed;
    this.currentSplash = config.splash;
    this.totalInvested = config.cost;
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

  setAuraBuff(dmg: number, spd: number): void { this.auraDamageBonus = dmg; this.auraSpeedBonus = spd; }
  addAuraBuff(dmg: number, spd: number): void { this.auraDamageBonus += dmg; this.auraSpeedBonus += spd; }
  setEnemies(enemies: EnemyLogic[]): void { this.enemies = enemies; }

  upgrade(): { cost: number } | null {
    if (this.level >= this.config.upgrades.length) return null;
    const u = this.config.upgrades[this.level];
    this.level += 1;
    this.currentDamage = u.damage;
    this.currentRange = u.range;
    this.currentAttackSpeed = u.attackSpeed;
    this.currentSplash = u.splash;
    this.totalInvested += u.cost;
    return { cost: u.cost };
  }

  getUpgradeCost(): number | null {
    if (this.level >= this.config.upgrades.length) return null;
    return this.config.upgrades[this.level].cost;
  }

  select(): void { this.isSelected = true; }
  deselect(): void { this.isSelected = false; }

  addKill(): void {
    this.killCount += 1;
    if (this.config.special === 'hero_grow') {
      this.heroLevel = 1 + Math.floor(this.killCount / 10);
      const growBonus = 1 + (this.heroLevel - 1) * 0.08;
      let baseDmg = this.config.damage;
      let baseAS = this.config.attackSpeed;
      let baseRange = this.config.range;
      if (this.level > 0 && this.config.upgrades[this.level - 1]) {
        baseDmg = this.config.upgrades[this.level - 1].damage;
        baseAS = this.config.upgrades[this.level - 1].attackSpeed;
        baseRange = this.config.upgrades[this.level - 1].range;
      }
      this.currentDamage = Math.floor(baseDmg * growBonus);
      this.currentAttackSpeed = Math.max(400, baseAS - (this.heroLevel - 1) * 10);
      this.currentRange = baseRange + (this.heroLevel - 1) * 3;
    }
  }

  update(delta: number): void {
    this.attackTimer += delta;
    const effectiveAS = Math.max(200, this.currentAttackSpeed - this.auraSpeedBonus);
    if (this.attackTimer >= effectiveAS) {
      const target = this.findTarget();
      if (target) { this.attackTimer = 0; this.fireAt(target); }
    }

    // 更新弹道
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (proj.active) proj.update(delta);
      else this.projectiles.splice(i, 1);
    }
  }

  private canAttackEnemy(enemy: EnemyLogic): boolean {
    if (enemy.isDying() || !enemy.active) return false;
    if (enemy.isInvisible() && !enemy.isRevealed() && this.config.special !== 'detect') return false;
    if (enemy.isFlying() && this.config.special !== 'antiair' && this.config.special !== 'freeze_aura' && this.config.category !== 'support') return false;
    if (this.config.special === 'antiair' && this.level < this.config.upgrades.length && !enemy.isFlying()) return false;
    return true;
  }

  private findTarget(): EnemyLogic | null {
    if (this.lastTarget?.active && !this.lastTarget.isDying() && this.canAttackEnemy(this.lastTarget)) {
      if (distanceBetween(this.x, this.y, this.lastTarget.x, this.lastTarget.y) <= this.currentRange) return this.lastTarget;
    }
    let best: EnemyLogic | null = null, bestScore = -Infinity;
    for (const e of this.enemies) {
      if (!this.canAttackEnemy(e)) continue;
      const dist = distanceBetween(this.x, this.y, e.x, e.y);
      if (dist <= this.currentRange) {
        const score = e.getLaps() * 10000 + (this.currentRange - dist);
        if (score > bestScore) { bestScore = score; best = e; }
      }
    }
    this.lastTarget = best;
    return best;
  }

  private fireAt(target: EnemyLogic): void {
    this.justFired = true; // C3: 触发攻击动画
    // 侦查塔
    if (this.config.special === 'detect') {
      for (const e of this.enemies) {
        if (e.isDying() || !e.active) continue;
        if (e.isInvisible() && distanceBetween(this.x, this.y, e.x, e.y) <= this.currentRange) e.reveal(3000);
      }
    }

    // 冰塔光环
    if (this.config.special === 'freeze_aura') {
      this.onProjectileHit?.(this.x, this.y, this.currentDamage + this.auraDamageBonus, this.currentSplash, this.config.attackType.toString(), 'freeze_aura');
      this.onFireEffect?.('freeze', this.x, this.y, this.currentSplash);
      return;
    }

    // 秒杀塔
    if (this.config.special === 'execute') {
      soundManager.playExecute();
      if (!target.getConfig().isBoss) {
        target.takeDamage(999999);
        this.addKill();
      } else {
        const bossDmg = Math.floor(target.getMaxHp() * 0.1);
        target.takeDamage(bossDmg);
        this.onProjectileHit?.(target.x, target.y, bossDmg, 0, this.config.attackType.toString(), undefined);
      }
      this.onFireEffect?.('execute', target.x, target.y);
      return;
    }

    // 音效
    const sp = this.config.special;
    if (sp === 'aoe') soundManager.playCannon();
    else if (sp === 'poison') soundManager.playPoison();
    else if (sp === 'chain') soundManager.playLightning();
    else if (sp === 'freeze_aura' || sp === 'slow') soundManager.playFreeze();
    else if (sp === 'critical') {}
    else if (sp === 'bounce') soundManager.playBounce();
    else if (this.config.category === 'aoe') soundManager.playFire();
    else if (this.config.attackType.toString().includes('magic')) soundManager.playMagic();
    else soundManager.playArrow();

    // 暴击
    let damage = this.currentDamage + this.auraDamageBonus;
    let special = this.config.special;
    let projColor = this.config.projectileColor;

    if (this.config.special === 'critical') {
      const critChance = 0.15 + this.level * 0.05;
      if (Math.random() < critChance) {
        damage = Math.floor(damage * (2.0 + this.level * 0.3));
        projColor = 0xFF4444;
        soundManager.playCritical();
        this.onFireEffect?.('critical', this.x, this.y);
      }
    }

    // 弹射塔
    if (this.config.special === 'bounce') {
      const bounceCount = 2 + this.level;
      const bounceTargets: EnemyLogic[] = [target];
      const hitSet = new Set<EnemyLogic>([target]);
      let current = target;
      for (let b = 0; b < bounceCount; b++) {
        let nearest: EnemyLogic | null = null, nearestDist = 150;
        for (const e of this.enemies) {
          if (e.isDying() || !e.active || hitSet.has(e) || !this.canAttackEnemy(e)) continue;
          const dist = distanceBetween(current.x, current.y, e.x, e.y);
          if (dist < nearestDist) { nearestDist = dist; nearest = e; }
        }
        if (!nearest) break;
        hitSet.add(nearest);
        bounceTargets.push(nearest);
        current = nearest;
      }

      // 主弹道
      this.createProjectile(this.x, this.y, target.x, target.y, damage, 0, projColor, undefined);
      this.onFireProjectile?.(this.x, this.y, target.x, target.y, projColor, false);

      // 弹射
      for (let i = 1; i < bounceTargets.length; i++) {
        const from = bounceTargets[i - 1], to = bounceTargets[i];
        const bDmg = Math.floor(damage * (1 - i * 0.1));
        // 延迟弹射用 setTimeout 代替 Phaser.time.delayedCall
        setTimeout(() => {
          if (!to.active || to.isDying()) return;
          this.createProjectile(from.x, from.y, to.x, to.y, bDmg, 0, 0xAACC44, undefined);
          this.onFireProjectile?.(from.x, from.y, to.x, to.y, 0xAACC44, false);
        }, i * 150);
      }
      return;
    }

    // 标准弹道
    this.createProjectile(this.x, this.y, target.x, target.y, damage, this.currentSplash, projColor, special);
    this.onFireProjectile?.(this.x, this.y, target.x, target.y, projColor, this.currentSplash > 0);
  }

  private createProjectile(fx: number, fy: number, tx: number, ty: number, dmg: number, splash: number, color: number, special: string | undefined): void {
    const proj = new ProjectileLogic(fx, fy, tx, ty, this.config.projectileSpeed, dmg, splash, color);
    proj.onHit = (hx, hy, d, s) => {
      this.onProjectileHit?.(hx, hy, d, s, this.config.attackType.toString(), special);
    };
    this.projectiles.push(proj);
  }

  destroy(): void {
    this.active = false;
    this.projectiles = [];
  }
}
