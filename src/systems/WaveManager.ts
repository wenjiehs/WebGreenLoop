import { WAVE_CONFIGS, WaveConfig } from '../config/waves';
import { ENEMY_CONFIGS } from '../config/enemies';
import { WAVE_INTERVAL, FIRST_WAVE_DELAY, MAX_ENEMIES_ON_MAP, PF_UNLOCK_ENDLESS } from '../utils/constants';

export interface WaveManagerEvents {
  onWaveStart: (waveNumber: number, waveConfig: WaveConfig) => void;
  onWaveComplete: (waveNumber: number) => void;
  onSpawnEnemy: (enemyId: string) => void;
  onAllWavesComplete: () => void;
  onGameOver: (reason: string) => void;
  onPFGained: (totalPF: number) => void;
  onHiddenWaveStart?: () => void;
  onEndlessModeStart?: () => void;
}

export type GameMode = 'normal' | 'hidden' | 'endless';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class WaveManager {
  private currentWaveIndex: number = -1;
  private isSpawning: boolean = false;
  private spawnQueue: string[] = [];
  private spawnTimer: number = 0;
  private waveTimer: number = 0;
  private waveStarted: boolean = false;
  private allWavesComplete: boolean = false;
  private pfPoints: number = 0;
  private enemiesAlive: number = 0;
  private bossTimer: number = 0;
  private bossTimeLimit: number = 0;
  private isBossWave: boolean = false;
  private currentSpawnInterval: number = 800;
  private waitingForNextWave: boolean = false;

  private gameMode: GameMode = 'normal';
  private hiddenWaveCount: number = 0;
  private endlessWaveCount: number = 0;
  private endlessScaling: number = 1.0;

  events: WaveManagerEvents;
  private difficulty: string;

  constructor(events: WaveManagerEvents, difficulty: string = 'normal') {
    this.events = events;
    this.difficulty = difficulty;
    this.waveTimer = FIRST_WAVE_DELAY;
    this.waitingForNextWave = true;
  }

  getCurrentWave(): number {
    if (this.gameMode === 'hidden') return 50 + this.hiddenWaveCount;
    if (this.gameMode === 'endless') return 60 + this.endlessWaveCount;
    return this.currentWaveIndex + 1;
  }

  getTotalWaves(): number {
    if (this.gameMode === 'endless') return Infinity;
    if (this.gameMode === 'hidden') return 60;
    return WAVE_CONFIGS.length;
  }

  getPFPoints(): number { return this.pfPoints; }
  getEnemiesAlive(): number { return this.enemiesAlive; }
  getGameMode(): GameMode { return this.gameMode; }
  getEndlessScaling(): number { return this.endlessScaling; }

  getBossTimeRemaining(): number {
    if (!this.isBossWave) return 0;
    return Math.max(0, this.bossTimeLimit - this.bossTimer);
  }

  isWaveActive(): boolean { return this.isSpawning || this.enemiesAlive > 0; }
  isWaitingForNextWave(): boolean { return this.waitingForNextWave; }

  getNextWaveCountdown(): number {
    if (!this.waitingForNextWave) return 0;
    const target = this.currentWaveIndex === -1 ? FIRST_WAVE_DELAY : WAVE_INTERVAL;
    return Math.max(0, target - this.waveTimer);
  }

  onEnemyDied(): void {
    this.enemiesAlive = Math.max(0, this.enemiesAlive - 1);
    if (this.enemiesAlive === 0 && !this.isSpawning && this.waveStarted) {
      this.pfPoints += 1;
      this.events.onPFGained(this.pfPoints);
      this.events.onWaveComplete(this.getCurrentWave());

      if (this.gameMode === 'normal') {
        if (this.currentWaveIndex + 1 < WAVE_CONFIGS.length) {
          this.waitingForNextWave = true;
          this.waveTimer = 0;
        } else {
          // 50波通关后：淘汰模式直接胜利，其他难度进隐藏关
          if (this.difficulty === 'easy') {
            // 淘汰/简单模式：不进隐藏关，直接胜利
            this.allWavesComplete = true;
            this.events.onAllWavesComplete();
          } else {
            this.startHiddenMode();
          }
        }
      } else if (this.gameMode === 'hidden') {
        if (this.hiddenWaveCount < 10) {
          this.waitingForNextWave = true;
          this.waveTimer = 0;
        } else {
          if (this.pfPoints >= PF_UNLOCK_ENDLESS) this.startEndlessMode();
          else { this.allWavesComplete = true; this.events.onAllWavesComplete(); }
        }
      } else if (this.gameMode === 'endless') {
        this.waitingForNextWave = true;
        this.waveTimer = 0;
        this.endlessScaling += 0.15;
      }
    }
  }

  checkEnemyLimit(): boolean {
    if (this.enemiesAlive >= MAX_ENEMIES_ON_MAP) {
      this.events.onGameOver(`场上怪物数量超过 ${MAX_ENEMIES_ON_MAP}！`);
      return true;
    }
    return false;
  }

  update(delta: number): void {
    if (this.allWavesComplete) return;

    if (this.waitingForNextWave) {
      this.waveTimer += delta;
      if (this.waveTimer >= WAVE_INTERVAL || (this.currentWaveIndex === -1 && this.waveTimer >= FIRST_WAVE_DELAY)) {
        this.startNextWave();
      }
      return;
    }

    if (this.isSpawning && this.spawnQueue.length > 0) {
      this.spawnTimer += delta;
      if (this.spawnTimer >= this.currentSpawnInterval) {
        this.spawnTimer = 0;
        const enemyId = this.spawnQueue.shift()!;
        this.enemiesAlive += 1;
        this.events.onSpawnEnemy(enemyId);
        if (this.spawnQueue.length === 0) this.isSpawning = false;
      }
    }

    if (this.isBossWave && this.waveStarted) {
      this.bossTimer += delta;
      if (this.bossTimer >= this.bossTimeLimit) {
        this.events.onGameOver('BOSS 限时未击杀！');
      }
    }
  }

  private startNextWave(): void {
    if (this.gameMode === 'normal') this.startNormalWave();
    else if (this.gameMode === 'hidden') this.startHiddenWave();
    else if (this.gameMode === 'endless') this.startEndlessWave();
  }

  private startNormalWave(): void {
    this.currentWaveIndex += 1;
    this.waitingForNextWave = false;
    this.waveStarted = true;
    this.waveTimer = 0;
    if (this.currentWaveIndex >= WAVE_CONFIGS.length) { this.startHiddenMode(); return; }
    const wave = WAVE_CONFIGS[this.currentWaveIndex];
    this.setupWave(wave);
    this.events.onWaveStart(this.currentWaveIndex + 1, wave);
  }

  private setupWave(wave: WaveConfig): void {
    this.isBossWave = wave.isBossWave;
    this.bossTimer = 0;
    this.currentSpawnInterval = wave.spawnInterval;
    if (wave.isBossWave) {
      let maxTimeLimit = 0;
      for (const group of wave.enemies) {
        const config = ENEMY_CONFIGS[group.enemyId];
        if (config?.bossTimeLimit && config.bossTimeLimit > maxTimeLimit) maxTimeLimit = config.bossTimeLimit;
      }
      this.bossTimeLimit = maxTimeLimit || 60000;
    }
    this.spawnQueue = [];
    for (const group of wave.enemies) {
      for (let i = 0; i < group.count; i++) this.spawnQueue.push(group.enemyId);
    }
    this.isSpawning = true;
    this.spawnTimer = 0;
  }

  private startHiddenMode(): void {
    this.gameMode = 'hidden';
    this.hiddenWaveCount = 0;
    this.waitingForNextWave = true;
    this.waveTimer = 0;
    this.events.onHiddenWaveStart?.();
  }

  private startHiddenWave(): void {
    this.hiddenWaveCount += 1;
    this.waitingForNextWave = false;
    this.waveStarted = true;
    this.waveTimer = 0;
    const hiddenWave = this.generateHiddenWave(this.hiddenWaveCount);
    this.setupWave(hiddenWave);
    this.events.onWaveStart(50 + this.hiddenWaveCount, hiddenWave);
  }

  private generateHiddenWave(waveNum: number): WaveConfig {
    const enemyIds = Object.keys(ENEMY_CONFIGS);
    const strongEnemies = enemyIds.filter(id => ENEMY_CONFIGS[id].hp >= 800 && !ENEMY_CONFIGS[id].isBoss);
    const bossEnemies = enemyIds.filter(id => ENEMY_CONFIGS[id].isBoss);
    const isBoss = waveNum === 5 || waveNum === 10;
    const enemies: { enemyId: string; count: number }[] = [];
    if (isBoss && bossEnemies.length > 0) {
      enemies.push({ enemyId: bossEnemies[waveNum % bossEnemies.length], count: 3 + waveNum });
    } else {
      const picks = shuffleArray(strongEnemies).slice(0, 2 + Math.floor(waveNum / 3));
      for (const id of picks) enemies.push({ enemyId: id, count: 20 + waveNum * 8 });
    }
    return { waveNumber: 50 + waveNum, enemies, isBossWave: isBoss, spawnInterval: Math.max(200, 600 - waveNum * 30) };
  }

  private startEndlessMode(): void {
    this.gameMode = 'endless';
    this.endlessWaveCount = 0;
    this.endlessScaling = 2.0;
    this.waitingForNextWave = true;
    this.waveTimer = 0;
    this.events.onEndlessModeStart?.();
  }

  private startEndlessWave(): void {
    this.endlessWaveCount += 1;
    this.waitingForNextWave = false;
    this.waveStarted = true;
    this.waveTimer = 0;
    const endlessWave = this.generateEndlessWave(this.endlessWaveCount);
    this.setupWave(endlessWave);
    this.events.onWaveStart(60 + this.endlessWaveCount, endlessWave);
  }

  private generateEndlessWave(waveNum: number): WaveConfig {
    const enemyIds = Object.keys(ENEMY_CONFIGS);
    const allNonBoss = enemyIds.filter(id => !ENEMY_CONFIGS[id].isBoss);
    const bossIds = enemyIds.filter(id => ENEMY_CONFIGS[id].isBoss);
    const isBoss = waveNum % 5 === 0;
    const enemies: { enemyId: string; count: number }[] = [];
    if (isBoss && bossIds.length > 0) enemies.push({ enemyId: bossIds[waveNum % bossIds.length], count: 5 + waveNum });
    const picks = shuffleArray(allNonBoss).slice(0, 3 + Math.floor(waveNum / 5));
    for (const id of picks) enemies.push({ enemyId: id, count: 30 + waveNum * 5 });
    return { waveNumber: 60 + waveNum, enemies, isBossWave: isBoss, spawnInterval: Math.max(100, 500 - waveNum * 10) };
  }

  forceNextWave(): void {
    if (this.waitingForNextWave) this.startNextWave();
  }
}
