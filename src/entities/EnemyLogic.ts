import { EnemyConfig } from '../config/enemies';
import { ArmorType, COLORS } from '../utils/constants';
import { PathManager, Vec2 } from '../systems/PathManager';

/**
 * 纯逻辑敌人实体 — 无 Phaser 依赖
 * 只保存数据状态，3D 渲染由 EntityRenderer 读取状态驱动
 */
export class EnemyLogic {
  readonly config: EnemyConfig;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  baseSpeed: number;
  dead: boolean = false;
  active: boolean = true;

  private pathManager: PathManager;
  private currentWaypointIndex: number = 0;
  laps: number = 0;

  // Debuffs
  slowTimer: number = 0;
  slowAmount: number = 0;
  poisonTimer: number = 0;
  poisonDamage: number = 0;
  private poisonTickTimer: number = 0;
  revealed: boolean = false;
  revealTimer: number = 0;
  armorReduction: number = 0;
  armorReduceTimer: number = 0;

  // 死亡动画时间
  deathTimer: number = 0;

  onDeath?: (enemy: EnemyLogic) => void;

  constructor(config: EnemyConfig, pathManager: PathManager, waveMultiplier: number = 1) {
    this.config = config;
    const spawn = pathManager.getSpawnPoint();
    this.x = spawn.x;
    this.y = spawn.y;
    this.maxHp = Math.floor(config.hp * waveMultiplier);
    this.hp = this.maxHp;
    this.baseSpeed = config.speed;
    this.speed = config.speed;
    this.pathManager = pathManager;
  }

  // Getters
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

  reveal(duration: number): void {
    this.revealed = true;
    this.revealTimer = Math.max(this.revealTimer, duration);
  }

  applyArmorReduce(amount: number, duration: number): void {
    this.armorReduction = Math.max(this.armorReduction, amount);
    this.armorReduceTimer = Math.max(this.armorReduceTimer, duration);
  }

  takeDamage(amount: number): void {
    if (this.dead) return;
    this.hp -= amount;
    if (this.hp <= 0) this.die();
  }

  applySlow(amount: number, duration: number): void {
    this.slowAmount = Math.max(this.slowAmount, amount);
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  applyPoison(damagePerTick: number, duration: number): void {
    if (this.config.isPoisonImmune) return;
    this.poisonDamage = Math.max(this.poisonDamage, damagePerTick);
    this.poisonTimer = Math.max(this.poisonTimer, duration);
  }

  private die(): void {
    if (this.dead) return;
    this.dead = true;
    this.deathTimer = 300; // 300ms 死亡动画
  }

  update(delta: number): void {
    if (this.dead) {
      this.deathTimer -= delta;
      if (this.deathTimer <= 0) {
        this.active = false;
        this.onDeath?.(this);
      }
      return;
    }

    // 揭示计时
    if (this.revealTimer > 0) {
      this.revealTimer -= delta;
      if (this.revealTimer <= 0) this.revealed = false;
    }

    // 腐蚀降甲
    if (this.armorReduceTimer > 0) {
      this.armorReduceTimer -= delta;
      if (this.armorReduceTimer <= 0) this.armorReduction = 0;
    }

    // 减速
    if (this.slowTimer > 0) {
      this.slowTimer -= delta;
      this.speed = this.baseSpeed * (1 - this.slowAmount);
      if (this.slowTimer <= 0) { this.speed = this.baseSpeed; this.slowAmount = 0; }
    }

    // 毒
    if (this.poisonTimer > 0) {
      this.poisonTimer -= delta;
      this.poisonTickTimer += delta;
      if (this.poisonTickTimer >= 500) { this.poisonTickTimer = 0; this.takeDamage(this.poisonDamage); }
      if (this.poisonTimer <= 0) this.poisonDamage = 0;
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
