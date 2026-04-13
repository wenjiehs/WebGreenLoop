import { TILE_SIZE } from '../utils/constants';
import { distanceBetween } from '../utils/helpers';
import { HeroTowerConfig, HeroSkill } from '../config/heroTowers';
import { EnemyLogic } from './EnemyLogic';
import { ProjectileLogic } from './ProjectileLogic';

interface ActiveSkillState { skill: HeroSkill; level: number; cdTimer: number; buffTimer: number; }

/**
 * 纯逻辑英雄塔 — 无 Phaser 依赖
 */
export class HeroTowerLogic {
  readonly config: HeroTowerConfig;
  x: number; y: number;
  gridCol: number; gridRow: number;
  active: boolean = true;
  isSelected: boolean = false;
  isMoving: boolean = false;

  heroLevel: number = 1;
  experience: number = 0;
  expToNextLevel: number = 20;
  str: number = 10; agi: number = 10; int: number = 10;
  freePoints: number = 5;
  learnedSkills: { skill: HeroSkill; level: number }[] = [];
  private activeSkillStates: Map<string, ActiveSkillState> = new Map();
  skillPoints: number = 1;

  currentDamage: number;
  currentRange: number;
  currentAttackSpeed: number;
  currentSplash: number = 0;
  private attackTimer: number = 0;
  killCount: number = 0;
  critChance: number = 0;
  critMultiplier: number = 1.5;
  private tempAtkSpeedBonus: number = 0;
  private tempDamageBonus: number = 0;

  private enemies: EnemyLogic[] = [];
  projectiles: ProjectileLogic[] = [];
  private lastTarget: EnemyLogic | null = null;

  onProjectileHit?: (x: number, y: number, damage: number, splash: number, attackType: string, special?: string) => void;
  onLevelUp?: (hero: HeroTowerLogic) => void;
  onFireProjectile?: (fx: number, fy: number, tx: number, ty: number, color: number, isAOE: boolean) => void;

  constructor(config: HeroTowerConfig, col: number, row: number) {
    this.config = config;
    this.gridCol = col; this.gridRow = row;
    this.x = col * TILE_SIZE + TILE_SIZE / 2;
    this.y = row * TILE_SIZE + TILE_SIZE / 2;
    this.currentDamage = config.baseDamage;
    this.currentRange = config.baseRange;
    this.currentAttackSpeed = config.baseAttackSpeed;
    this.recalculateStats();
  }

  getConfig(): HeroTowerConfig { return this.config; }
  getGridCol(): number { return this.gridCol; }
  getGridRow(): number { return this.gridRow; }
  getHeroLevel(): number { return this.heroLevel; }
  getExperience(): number { return this.experience; }
  getExpToNext(): number { return this.expToNextLevel; }
  getStr(): number { return this.str; }
  getAgi(): number { return this.agi; }
  getInt(): number { return this.int; }
  getFreePoints(): number { return this.freePoints; }
  getSkillPoints(): number { return this.skillPoints; }
  getLearnedSkills() { return [...this.learnedSkills]; }
  getDamage(): number { return this.currentDamage; }
  getRange(): number { return this.currentRange; }
  getAttackSpeed(): number { return this.currentAttackSpeed; }
  getKillCount(): number { return this.killCount; }
  getCritChance(): number { return this.critChance; }
  getCritMultiplier(): number { return this.critMultiplier; }
  hasPointsToSpend(): boolean { return this.freePoints > 0 || this.skillPoints > 0; }
  getIsMoving(): boolean { return this.isMoving; }

  setEnemies(enemies: EnemyLogic[]): void { this.enemies = enemies; }
  select(): void { this.isSelected = true; }
  deselect(): void { this.isSelected = false; }
  startMoving(): void { this.isMoving = true; }
  cancelMoving(): void { this.isMoving = false; }

  relocate(col: number, row: number): void {
    this.gridCol = col; this.gridRow = row;
    this.x = col * TILE_SIZE + TILE_SIZE / 2;
    this.y = row * TILE_SIZE + TILE_SIZE / 2;
    this.isMoving = false;
  }

  addExperience(amount: number): void {
    this.experience += amount;
    while (this.experience >= this.expToNextLevel) {
      this.experience -= this.expToNextLevel;
      this.levelUp();
    }
  }

  private levelUp(): void {
    this.heroLevel += 1;
    this.expToNextLevel = Math.floor(20 * Math.pow(1.12, this.heroLevel - 1));
    this.freePoints += 3;
    if (this.heroLevel % 2 === 0) this.skillPoints += 1;
    const totalGrowth = this.config.strGrowth + this.config.agiGrowth + this.config.intGrowth;
    this.str += Math.round(this.config.strGrowth / totalGrowth * 2);
    this.agi += Math.round(this.config.agiGrowth / totalGrowth * 2);
    this.int += Math.round(this.config.intGrowth / totalGrowth * 2);
    this.recalculateStats();
    this.onLevelUp?.(this);
  }

  addStr(pts: number = 1): boolean { if (this.freePoints < pts) return false; this.str += pts; this.freePoints -= pts; this.recalculateStats(); return true; }
  addAgi(pts: number = 1): boolean { if (this.freePoints < pts) return false; this.agi += pts; this.freePoints -= pts; this.recalculateStats(); return true; }
  addInt(pts: number = 1): boolean { if (this.freePoints < pts) return false; this.int += pts; this.freePoints -= pts; this.recalculateStats(); return true; }

  learnSkill(skillIndex: number): boolean {
    if (this.skillPoints <= 0 || skillIndex < 0 || skillIndex >= this.config.skills.length) return false;
    const skill = this.config.skills[skillIndex];
    const existing = this.learnedSkills.find(s => s.skill.id === skill.id);
    if (existing) {
      if (existing.level >= skill.maxLevel) return false;
      existing.level += 1;
      if (skill.isActive) { const st = this.activeSkillStates.get(skill.id); if (st) st.level = existing.level; }
    } else {
      this.learnedSkills.push({ skill, level: 1 });
      if (skill.isActive) this.activeSkillStates.set(skill.id, { skill, level: 1, cdTimer: 0, buffTimer: 0 });
    }
    this.skillPoints -= 1;
    this.recalculateStats();
    return true;
  }

  getSkillLevel(skillIndex: number): number {
    if (skillIndex < 0 || skillIndex >= this.config.skills.length) return 0;
    return this.learnedSkills.find(s => s.skill.id === this.config.skills[skillIndex].id)?.level || 0;
  }

  canLearnSkill(skillIndex: number): boolean {
    if (this.skillPoints <= 0 || skillIndex < 0 || skillIndex >= this.config.skills.length) return false;
    const skill = this.config.skills[skillIndex];
    const existing = this.learnedSkills.find(s => s.skill.id === skill.id);
    return !(existing && existing.level >= skill.maxLevel);
  }

  getActiveSkillCD(skillId: string): { remaining: number; total: number } | null {
    const state = this.activeSkillStates.get(skillId);
    if (!state) return null;
    return { remaining: Math.max(0, state.cdTimer), total: state.skill.cooldown || 0 };
  }

  private recalculateStats(): void {
    this.currentDamage = this.config.baseDamage + Math.floor(this.str * 0.8);
    this.currentSplash = 0;
    this.critChance = 0;
    this.critMultiplier = 1.5;

    for (const ls of this.learnedSkills) {
      if (ls.skill.isActive) continue;
      const eff = ls.skill.effect;
      const scaling = this.getScalingValue(eff.scaling);
      const val = eff.baseValue + eff.perLevel * (ls.level - 1);

      switch (eff.type) {
        case 'damage_boost':
          if (val < 1) this.currentDamage = Math.floor(this.currentDamage * (1 + val + scaling * 0.001));
          else this.currentDamage += Math.floor(val + scaling * 0.3);
          break;
        case 'splash': this.currentSplash = Math.max(this.currentSplash, 40 + ls.level * 12); this.currentDamage += Math.floor(val * 0.15 + scaling * 0.1); break;
        case 'aoe': this.currentSplash = Math.max(this.currentSplash, 36 + ls.level * 10); this.currentDamage += Math.floor(val * 0.1 + scaling * 0.08); break;
        case 'critical': this.critChance = Math.min(0.6, 0.1 + ls.level * 0.08 + this.agi * 0.001); this.critMultiplier = val; break;
        case 'chain': this.currentDamage += Math.floor(val * 0.5 + scaling * 0.2); break;
        case 'multishot': this.currentDamage += Math.floor(scaling * 0.1); break;
        case 'dot': this.currentDamage += Math.floor(val * 0.15); break;
        case 'armor_reduce': this.currentDamage += Math.floor(val * 1.5); break;
        case 'summon': this.currentDamage += Math.floor(val * 5 + scaling * 0.1); break;
      }
    }

    this.currentAttackSpeed = Math.max(200, this.config.baseAttackSpeed - this.agi * 2.5 - this.tempAtkSpeedBonus);
    this.currentRange = this.config.baseRange + Math.floor(this.int * 0.25);
    this.currentDamage += this.tempDamageBonus;
  }

  private getScalingValue(scaling?: string): number {
    switch (scaling) { case 'str': return this.str; case 'agi': return this.agi; case 'int': return this.int; default: return 0; }
  }

  addKill(): void { this.killCount += 1; this.addExperience(3 + Math.floor(this.heroLevel * 0.5)); }

  update(delta: number): void {
    this.tryFireActiveSkills(delta);

    this.attackTimer += delta;
    if (this.attackTimer >= this.currentAttackSpeed) {
      const target = this.findTarget();
      if (target) { this.attackTimer = 0; this.fireAt(target); }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (this.projectiles[i].active) this.projectiles[i].update(delta);
      else this.projectiles.splice(i, 1);
    }

    this.applyPassiveEffects();
  }

  private findTarget(): EnemyLogic | null {
    if (this.lastTarget?.active && !this.lastTarget.isDying()) {
      if (distanceBetween(this.x, this.y, this.lastTarget.x, this.lastTarget.y) <= this.currentRange) return this.lastTarget;
    }
    let best: EnemyLogic | null = null, bestScore = -Infinity;
    for (const e of this.enemies) {
      if (e.isDying() || !e.active) continue;
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
    const isCrit = this.critChance > 0 && Math.random() < this.critChance;
    let damage = this.currentDamage;
    if (isCrit) damage = Math.floor(damage * this.critMultiplier);

    let special: string | undefined;
    let projColor = isCrit ? 0xFF4444 : this.config.projectileColor;
    for (const ls of this.learnedSkills) {
      if (ls.skill.isActive) continue;
      const t = ls.skill.effect.type;
      if (t === 'chain') { special = 'chain'; projColor = isCrit ? 0xFF4444 : 0x4488FF; break; }
      if (t === 'slow') { special = 'slow'; projColor = isCrit ? 0xFF4444 : 0x66CCFF; break; }
      if (t === 'dot') { special = 'poison'; projColor = isCrit ? 0xFF4444 : 0x44FF44; break; }
      if (t === 'armor_reduce') { special = 'armor_reduce'; projColor = isCrit ? 0xFF4444 : 0xAA8844; break; }
    }

    const proj = new ProjectileLogic(this.x, this.y, target.x, target.y, 650 + this.agi * 0.5, damage, this.currentSplash, projColor);
    proj.onHit = (hx, hy, dmg, sp) => { this.onProjectileHit?.(hx, hy, dmg, sp, this.config.baseAttackType, special); };
    this.projectiles.push(proj);
    this.onFireProjectile?.(this.x, this.y, target.x, target.y, projColor, this.currentSplash > 0);

    // 多重箭
    let multishotCount = 0;
    for (const ls of this.learnedSkills) {
      if (!ls.skill.isActive && ls.skill.effect.type === 'multishot') {
        multishotCount = Math.floor(ls.skill.effect.baseValue + ls.skill.effect.perLevel * (ls.level - 1));
      }
    }
    if (multishotCount > 0) {
      const extras: EnemyLogic[] = [];
      for (const e of this.enemies) {
        if (e === target || e.isDying() || !e.active) continue;
        if (distanceBetween(this.x, this.y, e.x, e.y) <= this.currentRange) extras.push(e);
        if (extras.length >= multishotCount) break;
      }
      for (const et of extras) {
        const ep = new ProjectileLogic(this.x, this.y, et.x, et.y, 600, Math.floor(damage * 0.6), 0, projColor);
        ep.onHit = (hx, hy, d, s) => { this.onProjectileHit?.(hx, hy, d, s, this.config.baseAttackType, undefined); };
        this.projectiles.push(ep);
        this.onFireProjectile?.(this.x, this.y, et.x, et.y, projColor, false);
      }
    }
  }

  private tryFireActiveSkills(delta: number): void {
    for (const [, state] of this.activeSkillStates) {
      if (state.cdTimer > 0) { state.cdTimer -= delta; continue; }
      if (state.buffTimer > 0) {
        state.buffTimer -= delta;
        if (state.buffTimer <= 0) { this.tempAtkSpeedBonus = 0; this.tempDamageBonus = 0; this.recalculateStats(); }
        continue;
      }
      const hasTarget = this.enemies.some(e => !e.isDying() && e.active && distanceBetween(this.x, this.y, e.x, e.y) <= this.currentRange);
      if (!hasTarget) continue;

      const eff = state.skill.effect;
      const scaling = this.getScalingValue(eff.scaling);
      const val = eff.baseValue + eff.perLevel * (state.level - 1);

      switch (eff.type) {
        case 'aoe': case 'splash': {
          const aoeRange = this.currentSplash > 0 ? this.currentSplash + 20 : 80;
          const aoeDmg = Math.floor(val + scaling * 0.5) + this.currentDamage;
          this.onProjectileHit?.(this.x, this.y, aoeDmg, aoeRange, this.config.baseAttackType, undefined);
          break;
        }
        case 'damage_boost': {
          this.tempDamageBonus = Math.floor(val + scaling * 0.3);
          this.tempAtkSpeedBonus = Math.floor(200 + state.level * 50);
          state.buffTimer = 5000;
          this.recalculateStats();
          break;
        }
        case 'chain': {
          const chainDmg = Math.floor(val + scaling * 0.4);
          let count = 3 + state.level;
          for (const e of this.enemies) {
            if (e.isDying() || !e.active || count <= 0) continue;
            if (distanceBetween(this.x, this.y, e.x, e.y) <= this.currentRange) { e.takeDamage(chainDmg); count--; }
          }
          break;
        }
      }
      state.cdTimer = state.skill.cooldown || 10000;
    }
  }

  private applyPassiveEffects(): void {
    for (const ls of this.learnedSkills) {
      if (ls.skill.isActive || ls.skill.effect.type !== 'passive_aura') continue;
      const val = ls.skill.effect.baseValue + ls.skill.effect.perLevel * (ls.level - 1);
      for (const e of this.enemies) {
        if (e.isDying() || !e.active) continue;
        if (distanceBetween(this.x, this.y, e.x, e.y) <= this.currentRange) e.applySlow(val, 500);
      }
    }
  }

  destroy(): void { this.active = false; this.projectiles = []; }
}
