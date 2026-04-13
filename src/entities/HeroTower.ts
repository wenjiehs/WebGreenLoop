import Phaser from 'phaser';
import { TILE_SIZE } from '../utils/constants';
import { distanceBetween } from '../utils/helpers';
import { HeroTowerConfig, HeroSkill } from '../config/heroTowers';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';

interface ActiveSkillState {
  skill: HeroSkill;
  level: number;
  cdTimer: number;  // 剩余 CD（ms）
  buffTimer: number; // buff 剩余时间（如狂暴态）
}

/**
 * 英雄成长塔实体 - 含主动技能CD、可移动
 */
export class HeroTower extends Phaser.GameObjects.Container {
  private config: HeroTowerConfig;
  private gridCol: number;
  private gridRow: number;

  // 等级
  private heroLevel: number = 1;
  private experience: number = 0;
  private expToNextLevel: number = 20;

  // 属性
  private str: number = 10;
  private agi: number = 10;
  private int: number = 10;
  private freePoints: number = 5;

  // 技能
  private learnedSkills: { skill: HeroSkill; level: number }[] = [];
  private activeSkillStates: Map<string, ActiveSkillState> = new Map();
  private skillPoints: number = 1;

  // 战斗
  private currentDamage: number;
  private currentRange: number;
  private currentAttackSpeed: number;
  private currentSplash: number = 0;
  private attackTimer: number = 0;
  private killCount: number = 0;
  private critChance: number = 0;
  private critMultiplier: number = 1.5;
  // buff状态
  private tempAtkSpeedBonus: number = 0;
  private tempDamageBonus: number = 0;

  // 视觉
  private bodyRect: Phaser.GameObjects.Rectangle;
  private heroIcon: Phaser.GameObjects.Arc;
  private levelText: Phaser.GameObjects.Text;
  private nameText: Phaser.GameObjects.Text;
  private expBarBg: Phaser.GameObjects.Rectangle;
  private expBarFill: Phaser.GameObjects.Rectangle;
  private rangeCircle: Phaser.GameObjects.Arc | null = null;
  private isSelected: boolean = false;
  private notifyDot: Phaser.GameObjects.Arc | null = null;

  // 移动
  private isMoving: boolean = false;

  // 引用
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private lastTarget: Enemy | null = null;

  // 回调
  onProjectileHit?: (x: number, y: number, damage: number, splash: number, attackType: string, special?: string) => void;
  onLevelUp?: (hero: HeroTower) => void;
  onActiveSkillFired?: (hero: HeroTower, skill: HeroSkill, level: number) => void;

  constructor(scene: Phaser.Scene, config: HeroTowerConfig, col: number, row: number) {
    const x = col * TILE_SIZE + TILE_SIZE / 2;
    const y = row * TILE_SIZE + TILE_SIZE / 2;
    super(scene, x, y);

    this.config = config;
    this.gridCol = col;
    this.gridRow = row;
    this.currentDamage = config.baseDamage;
    this.currentRange = config.baseRange;
    this.currentAttackSpeed = config.baseAttackSpeed;

    this.bodyRect = scene.add.rectangle(0, 0, TILE_SIZE - 2, TILE_SIZE - 2, config.color);
    this.bodyRect.setStrokeStyle(2, 0xFFD700, 0.8);
    this.add(this.bodyRect);

    this.heroIcon = scene.add.circle(0, -1, 7, config.projectileColor);
    this.add(this.heroIcon);

    const barW = TILE_SIZE - 6;
    this.expBarBg = scene.add.rectangle(0, -TILE_SIZE / 2 - 4, barW, 3, 0x333333);
    this.add(this.expBarBg);
    this.expBarFill = scene.add.rectangle(-barW / 2, -TILE_SIZE / 2 - 4, 0, 3, 0x44CCFF);
    this.expBarFill.setOrigin(0, 0.5);
    this.add(this.expBarFill);

    this.levelText = scene.add.text(TILE_SIZE / 2 - 1, -TILE_SIZE / 2 + 1, '1', {
      fontSize: '9px', color: '#FFD700', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(1, 0);
    this.add(this.levelText);

    this.nameText = scene.add.text(0, TILE_SIZE / 2 + 1, config.name, {
      fontSize: '7px', color: '#FFD700', fontFamily: 'Microsoft YaHei, sans-serif',
    }).setOrigin(0.5, 0);
    this.add(this.nameText);

    scene.add.existing(this);
    this.setDepth(6);
    this.recalculateStats();
    this.updateVisuals();
  }

  // ====== Getters ======
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
  getLearnedSkills(): { skill: HeroSkill; level: number }[] { return [...this.learnedSkills]; }
  getDamage(): number { return this.currentDamage; }
  getRange(): number { return this.currentRange; }
  getAttackSpeed(): number { return this.currentAttackSpeed; }
  getKillCount(): number { return this.killCount; }
  getCritChance(): number { return this.critChance; }
  getCritMultiplier(): number { return this.critMultiplier; }
  hasPointsToSpend(): boolean { return this.freePoints > 0 || this.skillPoints > 0; }
  getIsMoving(): boolean { return this.isMoving; }

  setEnemies(enemies: Enemy[]): void { this.enemies = enemies; }

  /**
   * 获取主动技能的 CD 状态
   */
  getActiveSkillCD(skillId: string): { remaining: number; total: number } | null {
    const state = this.activeSkillStates.get(skillId);
    if (!state) return null;
    return { remaining: Math.max(0, state.cdTimer), total: state.skill.cooldown || 0 };
  }

  // ====== 移动 ======

  startMoving(): void { this.isMoving = true; }
  cancelMoving(): void { this.isMoving = false; }

  /**
   * 移动到新位置
   */
  relocate(newCol: number, newRow: number): void {
    this.gridCol = newCol;
    this.gridRow = newRow;
    const nx = newCol * TILE_SIZE + TILE_SIZE / 2;
    const ny = newRow * TILE_SIZE + TILE_SIZE / 2;

    // 平滑移动动画
    if (this.scene) {
      this.scene.tweens.add({
        targets: this, x: nx, y: ny, duration: 300, ease: 'Quad.easeOut',
      });
    } else {
      this.x = nx;
      this.y = ny;
    }

    this.isMoving = false;
    if (this.rangeCircle) {
      this.rangeCircle.setPosition(nx, ny);
    }
  }

  // ====== 经验 ======

  addExperience(amount: number): void {
    this.experience += amount;
    while (this.experience >= this.expToNextLevel) {
      this.experience -= this.expToNextLevel;
      this.levelUp();
    }
    this.updateExpBar();
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
    this.updateVisuals();
    this.onLevelUp?.(this);

    if (this.scene) {
      const flash = this.scene.add.circle(this.x, this.y, 24, 0xFFD700, 0.5).setDepth(25);
      this.scene.tweens.add({ targets: flash, scale: 2.5, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
      const lvText = this.scene.add.text(this.x, this.y - 20, `Lv.${this.heroLevel}!`, {
        fontSize: '14px', color: '#FFD700', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(30);
      this.scene.tweens.add({ targets: lvText, y: lvText.y - 30, alpha: 0, duration: 1000, onComplete: () => lvText.destroy() });
    }
  }

  // ====== 属性 ======

  addStr(points: number = 1): boolean {
    if (this.freePoints < points) return false;
    this.str += points; this.freePoints -= points;
    this.recalculateStats(); this.updateVisuals(); return true;
  }
  addAgi(points: number = 1): boolean {
    if (this.freePoints < points) return false;
    this.agi += points; this.freePoints -= points;
    this.recalculateStats(); this.updateVisuals(); return true;
  }
  addInt(points: number = 1): boolean {
    if (this.freePoints < points) return false;
    this.int += points; this.freePoints -= points;
    this.recalculateStats(); this.updateVisuals(); return true;
  }

  // ====== 技能 ======

  learnSkill(skillIndex: number): boolean {
    if (this.skillPoints <= 0 || skillIndex < 0 || skillIndex >= this.config.skills.length) return false;
    const skill = this.config.skills[skillIndex];
    const existing = this.learnedSkills.find(s => s.skill.id === skill.id);

    if (existing) {
      if (existing.level >= skill.maxLevel) return false;
      existing.level += 1;
      // 更新主动技能状态
      if (skill.isActive) {
        const state = this.activeSkillStates.get(skill.id);
        if (state) state.level = existing.level;
      }
    } else {
      this.learnedSkills.push({ skill, level: 1 });
      if (skill.isActive) {
        this.activeSkillStates.set(skill.id, {
          skill, level: 1, cdTimer: 0, buffTimer: 0,
        });
      }
    }

    this.skillPoints -= 1;
    this.recalculateStats(); this.updateVisuals();
    return true;
  }

  getSkillLevel(skillIndex: number): number {
    if (skillIndex < 0 || skillIndex >= this.config.skills.length) return 0;
    const skill = this.config.skills[skillIndex];
    return this.learnedSkills.find(s => s.skill.id === skill.id)?.level || 0;
  }

  canLearnSkill(skillIndex: number): boolean {
    if (this.skillPoints <= 0 || skillIndex < 0 || skillIndex >= this.config.skills.length) return false;
    const skill = this.config.skills[skillIndex];
    const existing = this.learnedSkills.find(s => s.skill.id === skill.id);
    return !(existing && existing.level >= skill.maxLevel);
  }

  // ====== 属性计算 ======

  private recalculateStats(): void {
    this.currentDamage = this.config.baseDamage + Math.floor(this.str * 0.8);
    this.currentSplash = 0;
    this.critChance = 0;
    this.critMultiplier = 1.5;

    for (const ls of this.learnedSkills) {
      // 只有被动技能影响基础属性，主动技能在施放时生效
      if (ls.skill.isActive) continue;

      const eff = ls.skill.effect;
      const scaling = this.getScalingValue(eff.scaling);
      const val = eff.baseValue + eff.perLevel * (ls.level - 1);

      switch (eff.type) {
        case 'damage_boost':
          if (val < 1) this.currentDamage = Math.floor(this.currentDamage * (1 + val + scaling * 0.001));
          else this.currentDamage += Math.floor(val + scaling * 0.3);
          break;
        case 'splash':
          this.currentSplash = Math.max(this.currentSplash, 40 + ls.level * 12);
          this.currentDamage += Math.floor(val * 0.15 + scaling * 0.1);
          break;
        case 'aoe':
          this.currentSplash = Math.max(this.currentSplash, 36 + ls.level * 10);
          this.currentDamage += Math.floor(val * 0.1 + scaling * 0.08);
          break;
        case 'critical':
          this.critChance = Math.min(0.6, 0.1 + ls.level * 0.08 + this.agi * 0.001);
          this.critMultiplier = val;
          break;
        case 'chain':
          this.currentDamage += Math.floor(val * 0.5 + scaling * 0.2);
          break;
        case 'multishot':
          this.currentDamage += Math.floor(scaling * 0.1);
          break;
        case 'dot':
          this.currentDamage += Math.floor(val * 0.15);
          break;
        case 'slow': break;
        case 'armor_reduce':
          this.currentDamage += Math.floor(val * 1.5);
          break;
        case 'summon':
          this.currentDamage += Math.floor(val * 5 + scaling * 0.1);
          break;
        case 'passive_aura': break;
      }
    }

    this.currentAttackSpeed = Math.max(200, this.config.baseAttackSpeed - this.agi * 2.5 - this.tempAtkSpeedBonus);
    this.currentRange = this.config.baseRange + Math.floor(this.int * 0.25);
    this.currentDamage += this.tempDamageBonus;
  }

  private getScalingValue(scaling?: string): number {
    switch (scaling) { case 'str': return this.str; case 'agi': return this.agi; case 'int': return this.int; default: return 0; }
  }

  // ====== 视觉 ======

  private updateVisuals(): void {
    this.levelText.setText(`${this.heroLevel}`);
    if (!this.isSelected) this.bodyRect.setStrokeStyle(2, 0xFFD700, Math.min(1, 0.6 + this.heroLevel * 0.02));
    this.setScale(1 + Math.min(this.heroLevel * 0.008, 0.15));
    this.updateExpBar();

    if (this.hasPointsToSpend()) {
      if (!this.notifyDot && this.scene) {
        this.notifyDot = this.scene.add.circle(TILE_SIZE / 2 - 2, -TILE_SIZE / 2 + 2, 4, 0xFF4444);
        this.add(this.notifyDot);
        this.scene.tweens.add({ targets: this.notifyDot, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
      }
    } else if (this.notifyDot) {
      this.notifyDot.destroy(); this.notifyDot = null;
    }
  }

  private updateExpBar(): void {
    this.expBarFill.width = (TILE_SIZE - 6) * (this.experience / this.expToNextLevel);
  }

  select(): void {
    this.isSelected = true;
    if (this.rangeCircle) this.rangeCircle.destroy();
    this.rangeCircle = this.scene.add.circle(this.x, this.y, this.currentRange);
    this.rangeCircle.setStrokeStyle(2, 0xFFD700, 0.4);
    this.rangeCircle.setFillStyle(0xFFD700, 0.06);
    this.rangeCircle.setDepth(3);
    this.bodyRect.setStrokeStyle(3, 0x44FF44);
  }

  deselect(): void {
    this.isSelected = false;
    if (this.rangeCircle) { this.rangeCircle.destroy(); this.rangeCircle = null; }
    this.bodyRect.setStrokeStyle(2, 0xFFD700, 0.8);
  }

  addKill(): void {
    this.killCount += 1;
    this.addExperience(3 + Math.floor(this.heroLevel * 0.5));
  }

  // ====== 主动技能施放 ======

  private tryFireActiveSkills(delta: number): void {
    for (const [skillId, state] of this.activeSkillStates) {
      // CD 倒计时
      if (state.cdTimer > 0) {
        state.cdTimer -= delta;
        continue;
      }

      // buff 持续
      if (state.buffTimer > 0) {
        state.buffTimer -= delta;
        if (state.buffTimer <= 0) {
          this.tempAtkSpeedBonus = 0;
          this.tempDamageBonus = 0;
          this.recalculateStats();
        }
        continue;
      }

      // CD 好了，范围内有敌人时自动施放
      const hasTarget = this.enemies.some(e => !e.isDying() && e.active && distanceBetween(this.x, this.y, e.x, e.y) <= this.currentRange);
      if (!hasTarget) continue;

      const eff = state.skill.effect;
      const scaling = this.getScalingValue(eff.scaling);
      const val = eff.baseValue + eff.perLevel * (state.level - 1);

      switch (eff.type) {
        case 'aoe':
        case 'splash': {
          // 范围伤害
          const aoeRange = this.currentSplash > 0 ? this.currentSplash + 20 : 80;
          const aoeDmg = Math.floor(val + scaling * 0.5) + this.currentDamage;
          this.onProjectileHit?.(this.x, this.y, aoeDmg, aoeRange, this.config.baseAttackType, undefined);
          this.showActiveSkillEffect(state.skill, aoeRange);
          break;
        }
        case 'damage_boost': {
          // buff 型：增加伤害/攻速一段时间
          this.tempDamageBonus = Math.floor(val + scaling * 0.3);
          this.tempAtkSpeedBonus = Math.floor(200 + state.level * 50);
          state.buffTimer = 5000; // 5秒buff
          this.recalculateStats();
          this.showBuffEffect(state.skill.name);
          break;
        }
        case 'chain': {
          // 连斩
          const chainDmg = Math.floor(val + scaling * 0.4);
          let count = 3 + state.level;
          for (const enemy of this.enemies) {
            if (enemy.isDying() || !enemy.active || count <= 0) continue;
            if (distanceBetween(this.x, this.y, enemy.x, enemy.y) <= this.currentRange) {
              enemy.takeDamage(chainDmg);
              count--;
            }
          }
          this.showActiveSkillEffect(state.skill, this.currentRange);
          break;
        }
        default: break;
      }

      // 进入 CD
      state.cdTimer = state.skill.cooldown || 10000;
      this.onActiveSkillFired?.(this, state.skill, state.level);
    }
  }

  private showActiveSkillEffect(skill: HeroSkill, range: number): void {
    if (!this.scene) return;
    // 技能名飘字
    const txt = this.scene.add.text(this.x, this.y - 20, `✨${skill.name}`, {
      fontSize: '11px', color: '#FFDD44', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(30);
    this.scene.tweens.add({ targets: txt, y: txt.y - 25, alpha: 0, duration: 800, onComplete: () => txt.destroy() });

    // 范围波纹
    const wave = this.scene.add.circle(this.x, this.y, 10, this.config.color, 0.3).setDepth(12);
    this.scene.tweens.add({
      targets: wave, scaleX: range / 10, scaleY: range / 10, alpha: 0,
      duration: 400, onComplete: () => wave.destroy(),
    });
  }

  private showBuffEffect(skillName: string): void {
    if (!this.scene) return;
    const txt = this.scene.add.text(this.x, this.y - 20, `🔥${skillName}!`, {
      fontSize: '11px', color: '#FF8844', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(30);
    this.scene.tweens.add({ targets: txt, y: txt.y - 25, alpha: 0, duration: 800, onComplete: () => txt.destroy() });

    // 身体发光
    const glow = this.scene.add.circle(this.x, this.y, TILE_SIZE, 0xFF8844, 0.2).setDepth(4);
    this.scene.tweens.add({ targets: glow, alpha: 0, duration: 5000, onComplete: () => glow.destroy() });
  }

  // ====== 战斗 ======

  update(_time: number, delta: number): void {
    // 主动技能
    this.tryFireActiveSkills(delta);

    // 普攻
    this.attackTimer += delta;
    if (this.attackTimer >= this.currentAttackSpeed) {
      const target = this.findTarget();
      if (target) {
        this.attackTimer = 0;
        this.fireAt(target);
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (proj.active) proj.update(_time, delta);
      else this.projectiles.splice(i, 1);
    }

    this.applyPassiveEffects();
  }

  private findTarget(): Enemy | null {
    if (this.lastTarget?.active && !this.lastTarget.isDying()) {
      if (distanceBetween(this.x, this.y, this.lastTarget.x, this.lastTarget.y) <= this.currentRange) return this.lastTarget;
    }
    let best: Enemy | null = null, bestScore = -Infinity;
    for (const enemy of this.enemies) {
      if (enemy.isDying() || !enemy.active) continue;
      const dist = distanceBetween(this.x, this.y, enemy.x, enemy.y);
      if (dist <= this.currentRange) {
        const score = enemy.getLaps() * 10000 + (this.currentRange - dist);
        if (score > bestScore) { bestScore = score; best = enemy; }
      }
    }
    this.lastTarget = best;
    return best;
  }

  private fireAt(target: Enemy): void {
    if (!this.scene) return;
    this.scene.tweens.add({ targets: this.heroIcon, scaleX: 1.5, scaleY: 1.5, duration: 50, yoyo: true });

    const isCrit = this.critChance > 0 && Math.random() < this.critChance;
    let damage = this.currentDamage;
    if (isCrit) {
      damage = Math.floor(damage * this.critMultiplier);
      const ct = this.scene.add.text(this.x, this.y - 15, '💥暴击!', {
        fontSize: '12px', color: '#FF4444', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(30);
      this.scene.tweens.add({ targets: ct, y: ct.y - 25, alpha: 0, duration: 700, onComplete: () => ct.destroy() });
    }

    let special: string | undefined;
    let projColor = isCrit ? 0xFF4444 : this.config.projectileColor;
    for (const ls of this.learnedSkills) {
      if (ls.skill.isActive) continue; // 主动技能不附加在普攻上
      const t = ls.skill.effect.type;
      if (t === 'chain') { special = 'chain'; projColor = isCrit ? 0xFF4444 : 0x4488FF; break; }
      if (t === 'slow') { special = 'slow'; projColor = isCrit ? 0xFF4444 : 0x66CCFF; break; }
      if (t === 'dot') { special = 'poison'; projColor = isCrit ? 0xFF4444 : 0x44FF44; break; }
      if (t === 'armor_reduce') { special = 'armor_reduce'; projColor = isCrit ? 0xFF4444 : 0xAA8844; break; }
    }

    // 多重箭
    let multishotCount = 0;
    for (const ls of this.learnedSkills) {
      if (!ls.skill.isActive && ls.skill.effect.type === 'multishot') {
        multishotCount = Math.floor(ls.skill.effect.baseValue + ls.skill.effect.perLevel * (ls.level - 1));
      }
    }

    const proj = new Projectile(this.scene, this.x, this.y, target.x, target.y, 650 + this.agi * 0.5, damage, this.currentSplash, projColor);
    proj.onHit = (hx, hy, dmg, sp) => { this.onProjectileHit?.(hx, hy, dmg, sp, this.config.baseAttackType, special); };
    this.projectiles.push(proj);

    if (multishotCount > 0) {
      const extras: Enemy[] = [];
      for (const e of this.enemies) {
        if (e === target || e.isDying() || !e.active) continue;
        if (distanceBetween(this.x, this.y, e.x, e.y) <= this.currentRange) extras.push(e);
        if (extras.length >= multishotCount) break;
      }
      for (const et of extras) {
        const ep = new Projectile(this.scene, this.x, this.y, et.x, et.y, 600, Math.floor(damage * 0.6), 0, projColor);
        ep.onHit = (hx, hy, d, s) => { this.onProjectileHit?.(hx, hy, d, s, this.config.baseAttackType, undefined); };
        this.projectiles.push(ep);
      }
    }
  }

  private applyPassiveEffects(): void {
    for (const ls of this.learnedSkills) {
      if (ls.skill.isActive) continue;
      if (ls.skill.effect.type === 'passive_aura') {
        const val = ls.skill.effect.baseValue + ls.skill.effect.perLevel * (ls.level - 1);
        for (const enemy of this.enemies) {
          if (enemy.isDying() || !enemy.active) continue;
          if (distanceBetween(this.x, this.y, enemy.x, enemy.y) <= this.currentRange) {
            enemy.applySlow(val, 500);
          }
        }
      }
    }
  }

  destroy(fromScene?: boolean): void {
    if (this.rangeCircle) this.rangeCircle.destroy();
    if (this.notifyDot) this.notifyDot.destroy();
    for (const proj of this.projectiles) { if (proj.active) proj.destroy(); }
    this.projectiles = [];
    super.destroy(fromScene);
  }
}
