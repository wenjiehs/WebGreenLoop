import Phaser from 'phaser';
import { EnemyConfig } from '../config/enemies';
import { COLORS, ArmorType, AttackType } from '../utils/constants';
import { PathManager } from '../systems/PathManager';

const ARMOR_SYMBOLS: Record<string, string> = {
  [ArmorType.UNARMORED]: '',
  [ArmorType.LIGHT]: '○',
  [ArmorType.MEDIUM]: '◐',
  [ArmorType.HEAVY]: '●',
  [ArmorType.FORTIFIED]: '◆',
  [ArmorType.HERO]: '♛',
  [ArmorType.DIVINE]: '✦',
  [ArmorType.NORMAL_ARMOR]: '□',
};

/**
 * 敌人实体 - 支持飞行/隐形/魔免/毒免/降甲debuff
 */
export class Enemy extends Phaser.GameObjects.Container {
  private config: EnemyConfig;
  private hp: number;
  private maxHp: number;
  private speed: number;
  private baseSpeed: number;
  private pathManager: PathManager;
  private currentWaypointIndex: number = 0;
  private bodySprite: Phaser.GameObjects.Arc;
  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBarFill: Phaser.GameObjects.Rectangle;
  private dead: boolean = false;
  private slowTimer: number = 0;
  private slowAmount: number = 0;
  private poisonTimer: number = 0;
  private poisonDamage: number = 0;
  private poisonTickTimer: number = 0;
  private laps: number = 0;
  private slowTint: Phaser.GameObjects.Arc | null = null;

  // P0 新增
  private revealed: boolean = false;    // 被侦查塔揭示
  private revealTimer: number = 0;
  private armorReduction: number = 0;   // 腐蚀降甲值
  private armorReduceTimer: number = 0;
  private shadow: Phaser.GameObjects.Arc | null = null; // 飞行阴影

  onDeath?: (enemy: Enemy) => void;

  constructor(
    scene: Phaser.Scene, config: EnemyConfig,
    pathManager: PathManager, waveMultiplier: number = 1,
  ) {
    const spawn = pathManager.getSpawnPoint();
    super(scene, spawn.x, spawn.y);

    this.config = config;
    this.maxHp = Math.floor(config.hp * waveMultiplier);
    this.hp = this.maxHp;
    this.baseSpeed = config.speed;
    this.speed = config.speed;
    this.pathManager = pathManager;

    // 飞行单位阴影
    if (config.isFlying) {
      this.shadow = scene.add.circle(3, 3, config.radius - 1, 0x000000, 0.25);
      this.add(this.shadow);
    }

    // 怪物身体
    this.bodySprite = scene.add.circle(0, 0, config.radius, config.color);
    this.bodySprite.setStrokeStyle(1, Phaser.Display.Color.IntegerToColor(config.color).darken(30).color, 0.6);
    this.add(this.bodySprite);

    // 内部高光（立体感）
    const highlight = scene.add.circle(-config.radius * 0.25, -config.radius * 0.25, config.radius * 0.35,
      Phaser.Display.Color.IntegerToColor(config.color).lighten(40).color, 0.4);
    this.add(highlight);

    // 行走摇摆动画
    if (!config.isFlying) {
      scene.tweens.add({
        targets: this.bodySprite, scaleX: 1.08, scaleY: 0.92,
        duration: 200 + Math.floor(80 / Math.max(config.speed, 0.5)),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // 隐形单位半透明
    if (config.isInvisible) {
      this.bodySprite.setAlpha(0.35);
    }

    // 飞行标记
    if (config.isFlying) {
      const flyTag = scene.add.text(0, config.radius + 2, '🦅', { fontSize: '6px' }).setOrigin(0.5, 0);
      this.add(flyTag);
      // 飘浮效果
      scene.tweens.add({
        targets: this.bodySprite, y: -3,
        duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // Boss 装饰
    if (config.isBoss) {
      const glow = scene.add.circle(0, 0, config.radius + 4);
      glow.setStrokeStyle(2, 0xFFD700, 0.6);
      this.add(glow);
      // Boss 光环脉冲
      scene.tweens.add({
        targets: glow, scale: 1.3, alpha: 0.2,
        duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      const crown = scene.add.text(0, -config.radius - 8, '👑', { fontSize: '10px' }).setOrigin(0.5);
      this.add(crown);
      // Boss 入场缩放动画
      this.setScale(0.2);
      scene.tweens.add({
        targets: this, scaleX: 1, scaleY: 1,
        duration: 500, ease: 'Back.easeOut',
      });
    }

    // 特性标记
    const tags: string[] = [];
    if (config.isMagicImmune) tags.push('🛡');
    if (config.isPoisonImmune) tags.push('☠');
    if (config.isInvisible) tags.push('👁');
    if (tags.length > 0) {
      const tagText = scene.add.text(-config.radius - 2, -config.radius, tags.join(''), {
        fontSize: '6px', color: '#FFFFFF',
      }).setOrigin(1, 0);
      this.add(tagText);
    }

    // 护甲符号
    const armorSym = ARMOR_SYMBOLS[config.armorType] || '';
    if (armorSym) {
      this.add(scene.add.text(config.radius + 2, -config.radius, armorSym, {
        fontSize: '8px', color: '#FFFFFF',
      }).setOrigin(0, 0));
    }

    // 血条
    const barWidth = Math.max(config.radius * 2 + 6, 20);
    this.hpBarBg = scene.add.rectangle(0, -config.radius - 6, barWidth, 3, COLORS.HP_BAR_BG);
    this.add(this.hpBarBg);
    this.hpBarFill = scene.add.rectangle(-barWidth / 2, -config.radius - 6, barWidth, 3, COLORS.HP_BAR_FILL);
    this.hpBarFill.setOrigin(0, 0.5);
    this.add(this.hpBarFill);

    scene.add.existing(this);
    this.setDepth(config.isFlying ? 11 : 10); // 飞行单位在更高层
  }

  // ====== Getters ======
  getConfig(): EnemyConfig { return this.config; }
  getHp(): number { return this.hp; }
  getMaxHp(): number { return this.maxHp; }
  isDying(): boolean { return this.dead; }
  getLaps(): number { return this.laps; }
  isFlying(): boolean { return !!this.config.isFlying; }
  isInvisible(): boolean { return !!this.config.isInvisible; }
  isRevealed(): boolean { return this.revealed || !this.config.isInvisible; }
  isMagicImmune(): boolean { return !!this.config.isMagicImmune; }
  isPoisonImmune(): boolean { return !!this.config.isPoisonImmune; }
  getEffectiveArmor(): number { return Math.max(0, this.config.armorValue - this.armorReduction); }

  /**
   * 侦查塔揭示隐形
   */
  reveal(duration: number): void {
    this.revealed = true;
    this.revealTimer = Math.max(this.revealTimer, duration);
    if (this.config.isInvisible && this.bodySprite?.active) {
      this.bodySprite.setAlpha(0.8);
    }
  }

  /**
   * 腐蚀降甲
   */
  applyArmorReduce(amount: number, duration: number): void {
    this.armorReduction = Math.max(this.armorReduction, amount);
    this.armorReduceTimer = Math.max(this.armorReduceTimer, duration);
  }

  takeDamage(amount: number): void {
    if (this.dead) return;
    this.hp -= amount;

    const ratio = Math.max(0, this.hp / this.maxHp);
    const barWidth = Math.max(this.config.radius * 2 + 6, 20);
    this.hpBarFill.width = barWidth * ratio;
    this.hpBarFill.fillColor = ratio > 0.6 ? COLORS.HP_BAR_FILL : ratio > 0.3 ? 0xFFCC00 : COLORS.HP_BAR_LOW;

    if (this.bodySprite?.active) {
      this.bodySprite.fillColor = 0xFFFFFF;
      this.scene?.time.delayedCall(60, () => {
        if (!this.dead && this.bodySprite?.active) this.bodySprite.fillColor = this.config.color;
      });
    }

    if (this.hp <= 0) this.die();
  }

  applySlow(amount: number, duration: number): void {
    this.slowAmount = Math.max(this.slowAmount, amount);
    this.slowTimer = Math.max(this.slowTimer, duration);
    if (!this.slowTint && this.scene) {
      this.slowTint = this.scene.add.circle(0, 0, this.config.radius + 2, 0x66CCFF, 0.25);
      this.add(this.slowTint);
    }
  }

  applyPoison(damagePerTick: number, duration: number): void {
    // 毒免检查
    if (this.config.isPoisonImmune) return;
    this.poisonDamage = Math.max(this.poisonDamage, damagePerTick);
    this.poisonTimer = Math.max(this.poisonTimer, duration);
  }

  private die(): void {
    if (this.dead) return;
    this.dead = true;
    if (this.scene) {
      this.scene.tweens.add({
        targets: this, alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 180,
        onComplete: () => { this.onDeath?.(this); this.destroy(); },
      });
    } else {
      this.onDeath?.(this);
      this.destroy();
    }
  }

  update(_time: number, delta: number): void {
    if (this.dead) return;

    // 隐形揭示计时
    if (this.revealTimer > 0) {
      this.revealTimer -= delta;
      if (this.revealTimer <= 0) {
        this.revealed = false;
        if (this.config.isInvisible && this.bodySprite?.active) {
          this.bodySprite.setAlpha(0.35);
        }
      }
    }

    // 腐蚀降甲计时
    if (this.armorReduceTimer > 0) {
      this.armorReduceTimer -= delta;
      if (this.armorReduceTimer <= 0) {
        this.armorReduction = 0;
      }
    }

    // 减速
    if (this.slowTimer > 0) {
      this.slowTimer -= delta;
      this.speed = this.baseSpeed * (1 - this.slowAmount);
      if (this.slowTimer <= 0) {
        this.speed = this.baseSpeed;
        this.slowAmount = 0;
        if (this.slowTint) { this.slowTint.destroy(); this.slowTint = null; }
      }
    }

    // 毒
    if (this.poisonTimer > 0) {
      this.poisonTimer -= delta;
      this.poisonTickTimer += delta;
      if (this.poisonTickTimer >= 500) {
        this.poisonTickTimer = 0;
        this.takeDamage(this.poisonDamage);
      }
      if (this.bodySprite?.active && !this.dead) this.bodySprite.fillColor = 0x44FF44;
      if (this.poisonTimer <= 0) {
        this.poisonDamage = 0;
        if (this.bodySprite?.active && !this.dead) this.bodySprite.fillColor = this.config.color;
      }
    }

    // 移动
    const waypoints = this.pathManager.getWaypoints();
    const target = waypoints[this.currentWaypointIndex];
    const dx = target.x - this.x, dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const moveAmount = (this.speed * delta) / 1000;

    if (dist <= moveAmount) {
      this.x = target.x; this.y = target.y;
      this.currentWaypointIndex = (this.currentWaypointIndex + 1) % waypoints.length;
      if (this.currentWaypointIndex === 0) this.laps += 1;
    } else {
      this.x += (dx / dist) * moveAmount;
      this.y += (dy / dist) * moveAmount;
    }
  }
}
