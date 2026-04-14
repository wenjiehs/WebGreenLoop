import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, GRID_COLS, AttackType, MAX_ENEMIES_ON_MAP } from './utils/constants';
import { calculateDamage, distanceBetween } from './utils/helpers';
import { ThreeRenderer } from './rendering/ThreeRenderer';
import { EntityRenderer } from './rendering/EntityRenderer';
import { PathManager } from './systems/PathManager';
import { GridManager } from './systems/GridManager';
import { EconomyManager } from './systems/EconomyManager';
import { WaveManager, WaveManagerEvents } from './systems/WaveManager';
import { WaveConfig } from './config/waves';
import { TOWER_CONFIGS, TowerConfig } from './config/towers';
import { ENEMY_CONFIGS } from './config/enemies';
import { HeroTowerConfig } from './config/heroTowers';
import { soundManager } from './systems/SoundManager';
import { TowerLogic } from './entities/TowerLogic';
import { EnemyLogic } from './entities/EnemyLogic';
import { HeroTowerLogic } from './entities/HeroTowerLogic';
import { UIManager } from './UIManager';
import { InputManager } from './InputManager';

type GamePhase = 'menu' | 'hero_select' | 'playing' | 'game_over';
type Difficulty = 'easy' | 'normal' | 'hard' | 'hell';

const DIFFICULTY_PARAMS: Record<Difficulty, { hpMul: number; gold: number; label: string }> = {
  easy:   { hpMul: 0.7, gold: 1000, label: '简单' },
  normal: { hpMul: 1.0, gold: 800, label: '普通' },
  hard:   { hpMul: 1.5, gold: 600, label: '困难' },
  hell:   { hpMul: 3.0, gold: 400, label: '地狱' },
};

/**
 * 塔防游戏核心 — 游戏循环 + 系统协调 + 战斗逻辑
 * UI 由 UIManager 负责, 输入由 InputManager 负责
 */
export class Game {
  // 3D
  private renderer: ThreeRenderer;
  private entityRenderer: EntityRenderer;
  private canvas: HTMLCanvasElement;

  // 模块
  private ui: UIManager;
  private input: InputManager;

  // 游戏状态
  private phase: GamePhase = 'menu';
  private difficulty: Difficulty = 'normal';
  private diffHpMul: number = 1;
  private isPaused: boolean = false;
  private gameSpeed: number = 1;
  private isGameOver: boolean = false;

  // 系统
  private pathManager!: PathManager;
  private gridManager!: GridManager;
  private economyManager!: EconomyManager;
  private waveManager!: WaveManager;

  // 实体
  private towers: TowerLogic[] = [];
  private enemies: EnemyLogic[] = [];
  private heroTower: HeroTowerLogic | null = null;

  // 选择状态
  private selectedTowerConfig: TowerConfig | null = null;
  private selectedTower: TowerLogic | null = null;
  private selectedShopIndex: number = -1;

  // RP 事件
  private rpEventTimer: number = 0;
  private rpEventInterval: number = 45000;

  // 计时
  private lastTime: number = 0;

  constructor(container: HTMLElement) {
    // Three.js
    const threeContainer = document.createElement('div');
    threeContainer.style.cssText = 'position:absolute;top:0;left:0;width:1280px;height:720px;';
    container.appendChild(threeContainer);
    this.renderer = new ThreeRenderer(threeContainer);
    this.entityRenderer = new EntityRenderer(this.renderer);
    this.canvas = threeContainer.querySelector('canvas')!;

    // UI
    this.ui = new UIManager(container);
    this.ui.setCallbacks({
      onDifficultySelect: (d) => { this.difficulty = d; this.ui.showMenu(this.difficulty); },
      onStartGame: () => this.startGame(),
      onHeroSelected: (hero) => this.selectHero(hero),
      onTowerSelect: (config, i) => this.selectTowerToBuild(config, i),
      onUpgradeTower: () => { if (this.selectedTower && !this.heroTower?.isSelected) this.upgradeTower(this.selectedTower); },
      onSellTower: () => { if (this.selectedTower && !this.heroTower?.isSelected) this.sellTower(this.selectedTower); },
      onStartHeroMove: () => this.startHeroMove(),
      onBuyWood: () => this.buyWood(),
      onBuyPopulation: () => this.buyPopulation(),
      onRestart: () => this.startGame(),
      onBackToMenu: () => { this.entityRenderer.reset(); this.showMenu(); },
      getHeroTower: () => this.heroTower,
      getSelectedTower: () => this.selectedTower,
    });

    // Input
    this.input = new InputManager(this.canvas, this.renderer, this.entityRenderer);
    this.input.setCallbacks({
      getPhase: () => this.phase,
      isGameOver: () => this.isGameOver,
      getSelectedTowerConfig: () => this.selectedTowerConfig,
      isHeroMoving: () => this.heroTower?.getIsMoving() ?? false,
      getHeroActive: () => this.heroTower?.active ?? false,
      getHeroGrid: () => this.heroTower ? { col: this.heroTower.getGridCol(), row: this.heroTower.getGridRow() } : null,
      onCanvasClick: (col, row) => this.handleCanvasClick(col, row),
      onCanvasMouseMove: (col, row) => this.handleBuildPreview(col, row),
      onCanvasMouseLeave: () => this.entityRenderer.clearBuildPreview(),
      onForceNextWave: () => { if (!this.isPaused) this.waveManager.forceNextWave(); },
      onCancelSelection: () => this.cancelSelection(),
      onToggleSpeed: () => this.toggleSpeed(),
      onTogglePause: () => { this.isPaused = !this.isPaused; this.ui.showMessage(this.isPaused ? '⏸ 暂停' : '▶ 继续'); },
      onUpgradeKey: () => { if (this.selectedTower && !this.heroTower?.isSelected) this.upgradeTower(this.selectedTower); },
      onSellKey: () => { if (this.selectedTower && !this.heroTower?.isSelected) this.sellTower(this.selectedTower); },
      onHeroMoveKey: () => this.startHeroMove(),
      onToggleHelp: () => this.ui.toggleHelp(),
      onToggleStats: () => this.ui.toggleStatsPanel(this.towers, this.heroTower, this.economyManager, this.waveManager),
      onNumberKey: (num) => {
        const configs = Object.values(TOWER_CONFIGS);
        const idx = num <= 9 ? num - 1 : 9;
        if (idx < configs.length) this.selectTowerToBuild(configs[idx], idx);
      },
    });
    this.input.setup();

    // 全局暴露
    (window as any).__game = this;

    this.showMenu();
    this.lastTime = performance.now();
    this.gameLoop();
  }

  // ======================= 游戏循环 =======================

  private gameLoop = (): void => {
    requestAnimationFrame(this.gameLoop);
    const now = performance.now();
    const rawDelta = now - this.lastTime;
    this.lastTime = now;

    if (this.phase === 'playing' && !this.isPaused && !this.isGameOver) {
      const delta = rawDelta * this.gameSpeed;

      this.waveManager.update(delta);
      this.waveManager.checkEnemyLimit();
      this.updateAuras();

      for (const tower of this.towers) tower.update(delta);
      if (this.heroTower?.active) this.heroTower.update(delta);

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        e.update(delta);
        if (!e.active) this.enemies.splice(i, 1);
      }

      this.rpEventTimer += delta;
      if (this.rpEventTimer >= this.rpEventInterval) {
        this.rpEventTimer = 0;
        this.triggerRPEvent();
      }

      this.ui.updateMessageTimer(rawDelta);
      this.ui.updateTopBar(this.economyManager, this.waveManager, this.enemies, this.gameSpeed);
      this.ui.updateMinimap(this.pathManager, this.towers, this.enemies, this.heroTower);
    }

    if (this.phase === 'playing') {
      this.entityRenderer.sync(this.towers, this.enemies, this.heroTower, now);
    } else {
      this.renderer.render();
    }
  };

  // ======================= 菜单/开始 =======================

  private showMenu(): void {
    this.phase = 'menu';
    soundManager.startMenuBGM();
    this.ui.showMenu(this.difficulty);
  }

  private startGame(): void {
    const diffParams = DIFFICULTY_PARAMS[this.difficulty];
    this.diffHpMul = diffParams.hpMul;
    this.towers = [];
    this.enemies = [];
    this.heroTower = null;
    this.selectedTowerConfig = null;
    this.selectedTower = null;
    this.isGameOver = false;
    this.isPaused = false;
    this.gameSpeed = 1;

    this.pathManager = new PathManager();
    this.gridManager = new GridManager(this.pathManager);
    this.economyManager = new EconomyManager(diffParams.gold);

    const waveEvents: WaveManagerEvents = {
      onWaveStart: (wn, wc) => this.onWaveStart(wn, wc),
      onWaveComplete: (wn) => {
        const rewards = this.economyManager.onWaveComplete(wn);
        this.ui.showMessage(`✅ 第 ${wn} 波完成！+${rewards.goldReward}金 +${rewards.woodReward}木 利息+${rewards.interest}`);
      },
      onSpawnEnemy: (eid) => this.spawnEnemy(eid),
      onAllWavesComplete: () => this.onVictory(),
      onGameOver: (reason) => this.onGameOver(reason),
      onPFGained: () => {},
      onHiddenWaveStart: () => { this.ui.showMessage('🌟 恭喜通过50波！进入隐藏关卡！'); soundManager.playVictory(); },
      onEndlessModeStart: () => { this.ui.showMessage('♾️ 无尽模式开启！'); soundManager.playBossAlert(); },
    };
    this.waveManager = new WaveManager(waveEvents, this.difficulty);

    this.entityRenderer.reset();
    this.entityRenderer.buildTerrain(this.pathManager);

    this.phase = 'hero_select';
    soundManager.startGameBGM();
    this.ui.showHeroChoice();
  }

  private selectHero(heroConfig: HeroTowerConfig): void {
    const centerCol = Math.floor(GRID_COLS / 2);
    const centerRow = Math.floor((GAME_HEIGHT - 140) / TILE_SIZE / 2);
    let bestCol = centerCol, bestRow = centerRow, found = false;
    for (let radius = 0; radius < 20 && !found; radius++) {
      for (let dc = -radius; dc <= radius && !found; dc++) {
        for (let dr = -radius; dr <= radius && !found; dr++) {
          if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue;
          const c = centerCol + dc, r = centerRow + dr;
          if (this.gridManager.canBuildAt(c, r)) { bestCol = c; bestRow = r; found = true; }
        }
      }
    }

    this.gridManager.occupy(bestCol, bestRow);
    this.economyManager.addPopulation(heroConfig.populationCost);
    this.heroTower = new HeroTowerLogic(heroConfig, bestCol, bestRow);
    this.heroTower.setEnemies(this.enemies);
    this.heroTower.onProjectileHit = (x, y, dmg, sp, at, special) => this.handleProjectileHit(x, y, dmg, sp, at as AttackType, special, null, true);
    this.heroTower.onFireProjectile = (fx, fy, tx, ty, color, aoe) => this.entityRenderer.spawnProjectile(fx, fy, tx, ty, color, aoe);
    this.heroTower.onLevelUp = () => { this.ui.showMessage(`⭐ ${heroConfig.name} 升级！`); soundManager.playHeroLevelUp(); };
    this.heroTower.onSkillCost = (gold, wood) => {
      if (!this.economyManager.canAffordGoldAndWood(gold, wood)) {
        this.ui.showMessage(`💰 不够！需要 ${gold}金${wood > 0 ? ` + ${wood}木` : ''}`);
        soundManager.playError();
        return false;
      }
      return this.economyManager.spendGoldAndWood(gold, wood);
    };

    this.phase = 'playing';
    soundManager.playBuild();
    this.ui.showMessage(`${heroConfig.name} 已就位！点击英雄塔查看属性和技能`);
    this.ui.createPlayingUI(this.economyManager);

    this.economyManager.onGoldChange = () => { this.ui.updateTopBar(this.economyManager, this.waveManager, this.enemies, this.gameSpeed); this.ui.updateShopAffordability(this.economyManager.getGold(), this.economyManager.canBuild()); };
    this.economyManager.onPopulationChange = () => this.ui.updateTopBar(this.economyManager, this.waveManager, this.enemies, this.gameSpeed);
    this.economyManager.onScoreChange = () => this.ui.updateTopBar(this.economyManager, this.waveManager, this.enemies, this.gameSpeed);
    this.economyManager.onWoodChange = () => this.ui.updateTopBar(this.economyManager, this.waveManager, this.enemies, this.gameSpeed);
  }

  // ======================= 输入处理 =======================

  private handleCanvasClick(col: number, row: number): void {
    if (this.selectedTowerConfig) { this.tryPlaceTower(col, row); return; }
    if (this.heroTower?.getIsMoving()) { this.tryMoveHero(col, row); return; }
    if (this.heroTower?.active && this.heroTower.getGridCol() === col && this.heroTower.getGridRow() === row) {
      this.cancelSelection();
      this.heroTower.select();
      this.ui.showHeroInfo(this.heroTower);
      this.entityRenderer.showSelection(this.heroTower.x, this.heroTower.y, this.heroTower.getRange());
      return;
    }
    const clicked = this.towers.find(t => t.getGridCol() === col && t.getGridRow() === row);
    if (clicked) this.selectExistingTower(clicked);
    else this.cancelSelection();
  }

  private handleBuildPreview(col: number, row: number): void {
    if (!this.selectedTowerConfig) return;
    const { x, y } = this.gridManager.gridToPixel(col, row);
    const canBuild = this.gridManager.canBuildAt(col, row) && this.economyManager.canBuild();
    this.entityRenderer.showBuildPreview(x, y, this.selectedTowerConfig, canBuild);
  }

  // ======================= 选择/建造 =======================

  private selectTowerToBuild(config: TowerConfig, shopIndex: number): void {
    if (this.selectedTower) { this.selectedTower.deselect(); this.selectedTower = null; }
    this.ui.hideInfoPanel();

    if (this.selectedTowerConfig?.id === config.id) { this.cancelSelection(); return; }
    this.selectedTowerConfig = config;
    this.selectedShopIndex = shopIndex;
    this.ui.setSelectedTowerConfig(config);
    this.ui.highlightShopButton(shopIndex);

    if (!this.economyManager.canAfford(config.cost)) { this.ui.showMessage(`💰不足！${config.name} 需要 ${config.cost} 金`); return; }
    if (!this.economyManager.canBuild()) { this.ui.showMessage('👥 人口已满！'); return; }
    this.ui.showMessage(`${config.name} (💰${config.cost}) - 左键点击放置 | ESC取消`);
  }

  private selectExistingTower(tower: TowerLogic): void {
    this.cancelSelection();
    this.selectedTower = tower;
    tower.select();
    this.ui.showTowerInfo(tower, this.economyManager);
    this.entityRenderer.showSelection(tower.x, tower.y, tower.getRange());
  }

  private cancelSelection(): void {
    this.selectedTowerConfig = null;
    this.ui.setSelectedTowerConfig(null);
    if (this.selectedTower) { this.selectedTower.deselect(); this.selectedTower = null; }
    if (this.heroTower) { this.heroTower.deselect(); this.heroTower.cancelMoving(); }
    this.entityRenderer.clearSelection();
    this.entityRenderer.clearBuildPreview();
    this.ui.highlightShopButton(-1);
    this.ui.hideInfoPanel();
  }

  private tryPlaceTower(col: number, row: number): void {
    if (!this.selectedTowerConfig) return;
    if (!this.gridManager.canBuildAt(col, row)) { this.ui.showMessage('⛔ 无法在此处建造'); soundManager.playError(); return; }
    if (!this.economyManager.canAfford(this.selectedTowerConfig.cost)) { this.ui.showMessage('💰 金钱不足'); soundManager.playError(); return; }
    if (!this.economyManager.canBuild()) { this.ui.showMessage('👥 人口已满'); soundManager.playError(); return; }

    this.economyManager.spendGold(this.selectedTowerConfig.cost);
    this.economyManager.addPopulation();
    this.gridManager.occupy(col, row);

    const tower = new TowerLogic(this.selectedTowerConfig, col, row);
    tower.setEnemies(this.enemies);
    tower.onProjectileHit = (x, y, dmg, sp, at, special) => this.handleProjectileHit(x, y, dmg, sp, at as AttackType, special, tower);
    tower.onFireProjectile = (fx, fy, tx, ty, color, aoe) => this.entityRenderer.spawnProjectile(fx, fy, tx, ty, color, aoe);
    tower.onFireEffect = (type, x, y, radius) => {
      if (type === 'freeze') this.entityRenderer.effects.spawnFreezeEffect(x, y, radius || 40);
      else if (type === 'execute') this.entityRenderer.effects.spawnExplosion(x, y, 20);
    };
    this.towers.push(tower);
    soundManager.playBuild();
    this.ui.showMessage(`✅ ${this.selectedTowerConfig.name} 已建造`);

    if (!this.input.isShiftDown()) this.cancelSelection();
    else this.entityRenderer.clearBuildPreview();
  }

  private upgradeTower(tower: TowerLogic): void {
    const cost = tower.getUpgradeCost();
    if (!cost) { this.ui.showMessage('已满级！'); return; }
    if (!this.economyManager.canAfford(cost)) { this.ui.showMessage('💰 不足'); return; }
    this.economyManager.spendGold(cost);
    tower.upgrade();
    soundManager.playUpgrade();
    this.ui.showMessage(`⬆️ ${tower.config.name} → Lv.${tower.level + 1}`);
    this.ui.showTowerInfo(tower, this.economyManager);
    this.entityRenderer.showSelection(tower.x, tower.y, tower.getRange());
    this.entityRenderer.effects.spawnExplosion(tower.x, tower.y, 20);
  }

  private sellTower(tower: TowerLogic): void {
    const sellValue = this.economyManager.getSellValue(tower.getTotalInvested());
    this.economyManager.addGold(sellValue);
    this.economyManager.removePopulation();
    this.gridManager.release(tower.getGridCol(), tower.getGridRow());
    const idx = this.towers.indexOf(tower);
    if (idx !== -1) this.towers.splice(idx, 1);
    tower.destroy();
    this.cancelSelection();
    soundManager.playSell();
    this.ui.showMessage(`💰 出售回收 ${sellValue} 金`);
  }

  private startHeroMove(): void {
    if (!this.heroTower?.active) { this.ui.showMessage('⛔ 没有英雄塔'); return; }
    this.cancelSelection();
    this.heroTower.startMoving();
    this.heroTower.select();
    this.ui.showMessage('🔄 点击新位置移动英雄塔 | ESC取消');
  }

  private tryMoveHero(col: number, row: number): void {
    if (!this.heroTower) return;
    if (!this.gridManager.canBuildAt(col, row)) { this.ui.showMessage('⛔ 无法移动到此位置'); soundManager.playError(); return; }
    this.gridManager.release(this.heroTower.getGridCol(), this.heroTower.getGridRow());
    this.gridManager.occupy(col, row);
    this.heroTower.relocate(col, row);
    soundManager.playBuild();
    this.ui.showMessage(`✅ ${this.heroTower.config.name} 已移动`);
    this.entityRenderer.clearSelection();
    this.entityRenderer.showSelection(this.heroTower.x, this.heroTower.y, this.heroTower.getRange());
    this.ui.showHeroInfo(this.heroTower);
  }

  // ======================= 全局暴露的方法 =======================

  toggleSpeed(): void {
    this.gameSpeed = this.gameSpeed === 1 ? 2 : this.gameSpeed === 2 ? 4 : 1;
    this.ui.showMessage(`⏩ 速度 x${this.gameSpeed}`);
  }

  buyWood(): void {
    if (this.economyManager.buyWood()) { soundManager.playGold(); this.ui.showMessage('🪵 购买10木材'); }
    else { soundManager.playError(); this.ui.showMessage('💰 金钱不足5000'); }
  }

  buyPopulation(): void {
    if (this.economyManager.buyPopulation()) { soundManager.playGold(); this.ui.showMessage('👥 人口上限+1'); }
    else { soundManager.playError(); this.ui.showMessage('🪵 木材不足12'); }
  }

  restart(): void { this.startGame(); }
  backToMenu(): void { this.entityRenderer.reset(); this.showMenu(); }

  // 英雄操作（供 UI onclick 调用）
  upgradeTowerAction(): void { if (this.selectedTower && !this.heroTower?.isSelected) this.upgradeTower(this.selectedTower); }
  sellTowerAction(): void { if (this.selectedTower && !this.heroTower?.isSelected) this.sellTower(this.selectedTower); }
  heroAddStr(): void { this.heroTower?.addStr(); if (this.heroTower) this.ui.showHeroInfo(this.heroTower); }
  heroAddAgi(): void { this.heroTower?.addAgi(); if (this.heroTower) this.ui.showHeroInfo(this.heroTower); }
  heroAddInt(): void { this.heroTower?.addInt(); if (this.heroTower) this.ui.showHeroInfo(this.heroTower); }
  heroLearnSkill(index: number): void { this.heroTower?.learnSkill(index); if (this.heroTower) this.ui.showHeroInfo(this.heroTower); }

  // ======================= 战斗逻辑 =======================

  private handleProjectileHit(x: number, y: number, baseDamage: number, splash: number, attackType: AttackType, special: string | undefined, tower: TowerLogic | null, isHeroAttack: boolean = false): void {
    const calcDmg = (e: EnemyLogic): number => {
      let dmg = calculateDamage(baseDamage, attackType, e.config.armorType as any, e.getEffectiveArmor());
      if (e.isMagicImmune() && attackType === AttackType.MAGIC) dmg = Math.floor(dmg * 0.3);
      return dmg;
    };

    if (splash > 0) {
      this.entityRenderer.effects.spawnExplosion(x, y, splash);
      for (const e of this.enemies) {
        if (e.isDying() || !e.active) continue;
        if (distanceBetween(x, y, e.x, e.y) <= splash) {
          e.takeDamage(calcDmg(e));
          this.applySpecialEffect(e, special, baseDamage);
          if (e.isDying()) { if (isHeroAttack) this.heroTower?.addKill(); else tower?.addKill(); }
        }
      }
    } else {
      let closest: EnemyLogic | null = null, closestDist = 22;
      for (const e of this.enemies) {
        if (e.isDying() || !e.active) continue;
        const dist = distanceBetween(x, y, e.x, e.y);
        if (dist < closestDist) { closestDist = dist; closest = e; }
      }
      if (closest) {
        closest.takeDamage(calcDmg(closest));
        this.applySpecialEffect(closest, special, baseDamage);
        if (closest.isDying()) { if (isHeroAttack) this.heroTower?.addKill(); else tower?.addKill(); }
      }
    }
  }

  private applySpecialEffect(enemy: EnemyLogic, special: string | undefined, baseDmg: number): void {
    if (!special) return;
    switch (special) {
      case 'slow': enemy.applySlow(0.3, 2000); break;
      case 'freeze_aura': enemy.applySlow(0.5, 1500); this.entityRenderer.effects.spawnFreezeEffect(enemy.x, enemy.y, 40); break;
      case 'poison': enemy.applyPoison(Math.floor(baseDmg * 0.5), 4000); this.entityRenderer.effects.spawnPoisonCloud(enemy.x, enemy.y); break;
      case 'armor_reduce': enemy.applyArmorReduce(3, 5000); break;
      case 'chain': this.chainLightning(enemy, baseDmg); break;
    }
  }

  private chainLightning(origin: EnemyLogic, baseDmg: number): void {
    let current = origin, damage = baseDmg * 0.5;
    const hitSet = new Set<EnemyLogic>([origin]);
    for (let i = 0; i < 4; i++) {
      let nearest: EnemyLogic | null = null, nearestDist = 120;
      for (const e of this.enemies) {
        if (e.isDying() || !e.active || hitSet.has(e)) continue;
        const dist = distanceBetween(current.x, current.y, e.x, e.y);
        if (dist < nearestDist) { nearestDist = dist; nearest = e; }
      }
      if (nearest) {
        nearest.takeDamage(Math.floor(damage));
        hitSet.add(nearest);
        this.entityRenderer.effects.spawnLightning(current.x, current.y, nearest.x, nearest.y);
        current = nearest;
        damage *= 0.7;
      }
    }
  }

  private updateAuras(): void {
    for (const tower of this.towers) tower.setAuraBuff(0, 0);
    for (const aura of this.towers) {
      if (aura.config.special !== 'aura_attack' && aura.config.special !== 'aura_speed') continue;
      for (const tower of this.towers) {
        if (tower === aura) continue;
        if (distanceBetween(aura.x, aura.y, tower.x, tower.y) <= aura.getRange()) {
          if (aura.config.special === 'aura_attack') tower.addAuraBuff(Math.floor(tower.config.damage * 0.2 * (1 + aura.level * 0.1)), 0);
          else tower.addAuraBuff(0, Math.floor(tower.config.attackSpeed * 0.2 * (1 + aura.level * 0.1)));
        }
      }
    }
  }

  // ======================= 波次 =======================

  private spawnEnemy(enemyId: string): void {
    const config = ENEMY_CONFIGS[enemyId];
    if (!config) return;
    let hpMul = (1 + (this.waveManager.getCurrentWave() - 1) * 0.15) * this.diffHpMul;
    if (this.waveManager.getGameMode() === 'endless') hpMul *= this.waveManager.getEndlessScaling();
    const waypoints = this.pathManager.getSpawnWaypoints();
    const enemy = new EnemyLogic(config, this.pathManager, hpMul, waypoints);
    enemy.onDeath = (e) => this.onEnemyDeath(e);
    this.enemies.push(enemy);
    for (const tower of this.towers) tower.setEnemies(this.enemies);
    if (this.heroTower?.active) this.heroTower.setEnemies(this.enemies);
  }

  private onEnemyDeath(enemy: EnemyLogic): void {
    this.economyManager.onEnemyKilled(enemy.config.goldReward);
    if (enemy.config.isBoss) { soundManager.playBossDeath(); this.entityRenderer.effects.spawnBossExplosion(enemy.x, enemy.y); }
    else soundManager.playEnemyDeath();
    if (this.heroTower?.active) this.heroTower.addKill(enemy.config.goldReward);
    this.waveManager.onEnemyDied();
  }

  private onWaveStart(waveNum: number, config: WaveConfig): void {
    this.economyManager.setCurrentWave(waveNum);
    const mode = this.waveManager.getGameMode();
    if (config.isBossWave) {
      this.ui.showMessage(`⚠️ 第 ${waveNum} 波 - BOSS 来袭！`);
      soundManager.playBossAlert(); soundManager.startBossBGM();
      this.entityRenderer.showWaveBanner(`⚠️ WAVE ${waveNum} — BOSS`, '#FF4444');
    } else if (mode === 'hidden') {
      this.ui.showMessage(`🌟 隐藏关 第 ${waveNum - 50} 波`);
      soundManager.playWaveStart(); soundManager.startGameBGM();
      this.entityRenderer.showWaveBanner(`🌟 HIDDEN ${waveNum - 50}`, '#FFD700');
    } else if (mode === 'endless') {
      this.ui.showMessage(`♾️ 无尽 #${waveNum - 60}`);
      soundManager.playWaveStart(); soundManager.startGameBGM();
      this.entityRenderer.showWaveBanner(`♾️ ENDLESS #${waveNum - 60}`, '#AA88FF');
    } else {
      this.ui.showMessage(`第 ${waveNum} 波开始`);
      soundManager.playWaveStart(); soundManager.startGameBGM();
      this.entityRenderer.showWaveBanner(`WAVE ${waveNum}`, '#44FF44');
    }
    if (waveNum === 1) setTimeout(() => this.ui.showMessage('💡 提示: 点击下方商店选塔，再点击地图建造'), 2000);
    if (waveNum === 2) setTimeout(() => this.ui.showMessage('💡 提示: 按 N 键可提前开始下一波，按 H 键查看克制表'), 2000);
    if (waveNum === 3) setTimeout(() => this.ui.showMessage('💡 提示: 点击英雄塔可加属性点和学习技能'), 2000);
  }

  private onVictory(): void {
    this.isGameOver = true;
    soundManager.stopBGM(); soundManager.playVictory();
    this.showGameOverScreen(true);
  }

  private onGameOver(reason: string): void {
    this.isGameOver = true;
    soundManager.stopBGM(); soundManager.playGameOver();
    this.showGameOverScreen(false, reason);
  }

  private showGameOverScreen(victory: boolean, reason?: string): void {
    this.phase = 'game_over';
    const stats = {
      wave: this.waveManager.getCurrentWave(),
      score: this.economyManager.getScore(),
      kills: this.economyManager.getTotalKills(),
      pf: this.waveManager.getPFPoints(),
    };
    this.saveHighScore(stats.score);
    const highScore = this.getHighScore();
    const isNewRecord = stats.score >= highScore && stats.score > 0;
    this.ui.showGameOver(victory, stats, this.heroTower, this.towers, highScore, isNewRecord, reason);
  }

  // ======================= RP 事件 =======================

  private triggerRPEvent(): void {
    const events = [
      { msg: '🎉 天降横财！获得 500 金！', gold: 500, wood: 0 },
      { msg: '🪵 伐木工人进贡！获得 5 木材！', gold: 0, wood: 5 },
      { msg: '💰 商人路过，获得 300 金！', gold: 300, wood: 0 },
      { msg: '🎲 赌博赢了！获得 800 金！', gold: 800, wood: 0 },
      { msg: '💸 缴纳保护费，扣除 200 金...', gold: -200, wood: 0 },
      { msg: '🌲 发现宝箱！获得 3 木材！', gold: 100, wood: 3 },
      { msg: '🔥 仓库失火！损失 150 金...', gold: -150, wood: 0 },
      { msg: '⭐ 英雄塔获得灵感！+200金 +2木', gold: 200, wood: 2 },
      { msg: '🎰 幸运转盘！获得 1000 金！', gold: 1000, wood: 0 },
      { msg: '💀 盗贼来袭！损失 300 金...', gold: -300, wood: 0 },
    ];
    const event = events[Math.floor(Math.random() * events.length)];
    if (event.gold > 0) this.economyManager.addGold(event.gold);
    else if (event.gold < 0) this.economyManager.spendGold(Math.min(Math.abs(event.gold), this.economyManager.getGold()));
    if (event.wood > 0) this.economyManager.addWood(event.wood);
    this.ui.showMessage(event.msg);
    soundManager.playGold();
  }

  // ======================= 最高分 =======================

  private saveHighScore(score: number): void {
    const key = `gcTD_highscore_${this.difficulty}`;
    const prev = parseInt(localStorage.getItem(key) || '0');
    if (score > prev) localStorage.setItem(key, String(score));
  }

  private getHighScore(): number {
    return parseInt(localStorage.getItem(`gcTD_highscore_${this.difficulty}`) || '0');
  }
}
