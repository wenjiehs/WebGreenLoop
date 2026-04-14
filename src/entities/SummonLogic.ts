import { TILE_SIZE } from '../utils/constants';
import { distanceBetween } from '../utils/helpers';
import { EnemyLogic } from './EnemyLogic';
import { ProjectileLogic } from './ProjectileLogic';

/**
 * 召唤物逻辑 — 英雄召唤的临时战斗单位
 *
 * 召唤物作为独立的小塔存在，有：
 * - 独立伤害、攻速、射程
 * - 存活时间（到期消散）
 * - 自动攻击最近敌人
 * - 3D 模型（由 EntityRenderer 管理）
 */

export type SummonType = 'water_elemental' | 'hawk' | 'bear' | 'imp';

export interface SummonConfig {
  type: SummonType;
  name: string;
  damage: number;
  range: number;
  attackSpeed: number; // ms
  duration: number;    // ms 存活时间
  color: number;
  projectileColor: number;
  splash: number;
  isMelee: boolean;    // 近战不发弹道
}

// 不同召唤物的基础配置（技能等级会乘以倍率加成）
export const SUMMON_CONFIGS: Record<SummonType, SummonConfig> = {
  water_elemental: {
    type: 'water_elemental', name: '水元素',
    damage: 12, range: 160, attackSpeed: 1200, duration: 30000,
    color: 0x44AAEE, projectileColor: 0x66CCFF, splash: 0, isMelee: false,
  },
  hawk: {
    type: 'hawk', name: '战鹰',
    damage: 8, range: 200, attackSpeed: 800, duration: 25000,
    color: 0xBB8844, projectileColor: 0xDDAA66, splash: 0, isMelee: false,
  },
  bear: {
    type: 'bear', name: '巨熊',
    damage: 25, range: 80, attackSpeed: 1500, duration: 30000,
    color: 0x886622, projectileColor: 0xAA8844, splash: 0, isMelee: true,
  },
  imp: {
    type: 'imp', name: '小鬼',
    damage: 10, range: 150, attackSpeed: 1000, duration: 20000,
    color: 0x990066, projectileColor: 0xCC0088, splash: 0, isMelee: false,
  },
};

export class SummonLogic {
  readonly config: SummonConfig;
  readonly skillLevel: number;
  x: number;
  y: number;
  active: boolean = true;
  justFired: boolean = false;

  private enemies: EnemyLogic[] = [];
  private attackTimer: number = 0;
  private lifeTimer: number;
  projectiles: ProjectileLogic[] = [];

  // 回调
  onFireProjectile?: (fx: number, fy: number, tx: number, ty: number, color: number, isAOE: boolean) => void;
  onProjectileHit?: (x: number, y: number, damage: number, splash: number, attackType: string) => void;
  onDeath?: () => void;

  constructor(config: SummonConfig, skillLevel: number, x: number, y: number) {
    this.config = config;
    this.skillLevel = skillLevel;
    this.x = x;
    this.y = y;
    this.lifeTimer = config.duration;
  }

  getDamage(): number {
    return Math.floor(this.config.damage * (1 + (this.skillLevel - 1) * 0.4));
  }

  getRange(): number {
    return this.config.range + this.skillLevel * 5;
  }

  getAttackSpeed(): number {
    return Math.max(400, this.config.attackSpeed - this.skillLevel * 30);
  }

  getRemainingTime(): number { return this.lifeTimer; }

  setEnemies(enemies: EnemyLogic[]): void {
    this.enemies = enemies;
  }

  update(delta: number): void {
    if (!this.active) return;

    // 存活时间
    this.lifeTimer -= delta;
    if (this.lifeTimer <= 0) {
      this.active = false;
      this.onDeath?.();
      return;
    }

    // 攻击
    this.attackTimer += delta;
    if (this.attackTimer >= this.getAttackSpeed()) {
      const target = this.findTarget();
      if (target) {
        this.attackTimer = 0;
        this.fireAt(target);
      }
    }

    // 更新弹道
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (this.projectiles[i].active) this.projectiles[i].update(delta);
      else this.projectiles.splice(i, 1);
    }
  }

  private findTarget(): EnemyLogic | null {
    let best: EnemyLogic | null = null;
    let bestDist = this.getRange();
    for (const e of this.enemies) {
      if (!e.active || e.isDying()) continue;
      const d = distanceBetween(this.x, this.y, e.x, e.y);
      if (d <= bestDist) { best = e; bestDist = d; }
    }
    return best;
  }

  private fireAt(target: EnemyLogic): void {
    this.justFired = true;
    const dmg = this.getDamage();

    if (this.config.isMelee) {
      // 近战直接扣血
      target.takeDamage(dmg);
      this.onProjectileHit?.(target.x, target.y, dmg, 0, 'normal');
    } else {
      // 远程发弹道
      const proj = new ProjectileLogic(this.x, this.y, target.x, target.y, 400, dmg, this.config.splash, this.config.projectileColor);
      proj.onHit = (px, py) => this.onProjectileHit?.(px, py, dmg, this.config.splash, 'normal');
      this.projectiles.push(proj);
      this.onFireProjectile?.(this.x, this.y, target.x, target.y, this.config.projectileColor, false);
    }
  }
}
