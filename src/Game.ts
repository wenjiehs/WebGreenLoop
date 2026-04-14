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
import { HeroTowerConfig, getRandomHeroChoices } from './config/heroTowers';
import { soundManager } from './systems/SoundManager';
import { TowerLogic } from './entities/TowerLogic';
import { EnemyLogic } from './entities/EnemyLogic';
import { HeroTowerLogic } from './entities/HeroTowerLogic';

type GamePhase = 'menu' | 'hero_select' | 'playing' | 'game_over';
type Difficulty = 'easy' | 'normal' | 'hard' | 'hell';

const DIFFICULTY_PARAMS: Record<Difficulty, { hpMul: number; gold: number; label: string }> = {
  easy:   { hpMul: 0.7, gold: 200, label: '简单' },
  normal: { hpMul: 1.0, gold: 100, label: '普通' },
  hard:   { hpMul: 1.5, gold: 80, label: '困难' },
  hell:   { hpMul: 3.0, gold: 60, label: '地狱' },
};

/**
 * 纯 Three.js 塔防游戏 — 无 Phaser 依赖
 * 一个类整合所有功能：游戏逻辑 + 3D渲染 + HTML UI + 输入处理
 */
export class Game {
  // 3D
  private renderer: ThreeRenderer;
  private entityRenderer: EntityRenderer;
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;

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

  // UI 状态
  private selectedTowerConfig: TowerConfig | null = null;
  private selectedTower: TowerLogic | null = null;
  private selectedShopIndex: number = -1;

  // 拖拽
  private isDragging: boolean = false;
  private lastMouse = { x: 0, y: 0 };
  private shiftDown: boolean = false;
  private helpVisible: boolean = false;

  // B4: RP 事件
  private rpEventTimer: number = 0;
  private rpEventInterval: number = 45000; // 45秒一次

  // UI DOM
  private uiRoot!: HTMLElement;
  private messageEl!: HTMLElement;
  private minimapCanvas: HTMLCanvasElement | null = null;
  private messageTimer: number = 0;

  // 计时
  private lastTime: number = 0;

  constructor(container: HTMLElement) {
    this.container = container;

    // 创建 Three.js
    const threeContainer = document.createElement('div');
    threeContainer.style.cssText = 'position:absolute;top:0;left:0;width:1280px;height:720px;';
    container.appendChild(threeContainer);
    this.renderer = new ThreeRenderer(threeContainer);
    this.entityRenderer = new EntityRenderer(this.renderer);
    this.canvas = threeContainer.querySelector('canvas')!;

    // UI overlay
    this.uiRoot = document.createElement('div');
    this.uiRoot.id = 'ui-root';
    this.uiRoot.style.cssText = 'position:absolute;top:0;left:0;width:1280px;height:720px;pointer-events:none;font-family:Microsoft YaHei,sans-serif;overflow:hidden;';
    container.appendChild(this.uiRoot);

    this.setupInput();
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

      // 波次
      this.waveManager.update(delta);
      this.waveManager.checkEnemyLimit(); // 触发 onGameOver → isGameOver=true

      // 光环
      this.updateAuras();

      // 塔
      for (const tower of this.towers) tower.update(delta);
      if (this.heroTower?.active) this.heroTower.update(delta);

      // 怪物
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        e.update(delta);
        if (!e.active) this.enemies.splice(i, 1);
      }

      // B4: RP 事件
      this.rpEventTimer += delta;
      if (this.rpEventTimer >= this.rpEventInterval) {
        this.rpEventTimer = 0;
        this.triggerRPEvent();
      }

      // 消息
      if (this.messageTimer > 0) { this.messageTimer -= rawDelta; if (this.messageTimer <= 0 && this.messageEl) this.messageEl.style.opacity = '0'; }

      // 更新 UI
      this.updateTopBar();
      this.updateMinimap();
    }

    // 3D 渲染
    if (this.phase === 'playing') {
      this.entityRenderer.sync(this.towers, this.enemies, this.heroTower, now);
    } else {
      this.renderer.render();
    }
  };

  // ======================= 输入 =======================

  private setupInput(): void {
    // 鼠标点击 — 3D Raycaster 拾取
    this.canvas.addEventListener('click', (e) => {
      if (this.phase !== 'playing' || this.isGameOver) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // UI 底栏区域忽略（由 HTML 处理）
      if (my > rect.height * (1 - 140 / 720)) return;

      const grid = this.entityRenderer.getGridFromClick(mx, my, rect.width, rect.height);
      if (!grid) return;

      const { col, row } = grid;

      // 建造模式
      if (this.selectedTowerConfig) {
        this.tryPlaceTower(col, row);
        return;
      }

      // 英雄移动
      if (this.heroTower?.getIsMoving()) {
        this.tryMoveHero(col, row);
        return;
      }

      // 选中检查
      if (this.heroTower?.active && this.heroTower.getGridCol() === col && this.heroTower.getGridRow() === row) {
        this.cancelSelection();
        this.heroTower.select();
        this.showHeroInfo();
        this.entityRenderer.showSelection(this.heroTower.x, this.heroTower.y, this.heroTower.getRange());
        return;
      }

      const clicked = this.towers.find(t => t.getGridCol() === col && t.getGridRow() === row);
      if (clicked) {
        this.selectExistingTower(clicked);
      } else {
        this.cancelSelection();
      }
    });

    // 鼠标移动 — 建造预览
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.phase !== 'playing' || !this.selectedTowerConfig) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      if (my > rect.height * (1 - 140 / 720)) { this.entityRenderer.clearBuildPreview(); return; }

      const grid = this.entityRenderer.getGridFromClick(mx, my, rect.width, rect.height);
      if (grid) {
        const { x, y } = this.gridManager.gridToPixel(grid.col, grid.row);
        const canBuild = this.gridManager.canBuildAt(grid.col, grid.row) && this.economyManager.canBuild();
        this.entityRenderer.showBuildPreview(x, y, this.selectedTowerConfig, canBuild);
      }
    });

    // 右键拖拽 3D 摄像机
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) { this.isDragging = true; this.lastMouse = { x: e.clientX, y: e.clientY }; }
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.renderer.handleDrag(e.clientX - this.lastMouse.x, e.clientY - this.lastMouse.y);
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => { this.isDragging = false; });

    // 滚轮缩放
    this.canvas.addEventListener('wheel', (e) => { this.renderer.handleZoom(e.deltaY); }, { passive: true });

    // Shift 追踪
    window.addEventListener('keydown', (e) => { if (e.key === 'Shift') this.shiftDown = true; });
    window.addEventListener('keyup', (e) => { if (e.key === 'Shift') this.shiftDown = false; });

    // 键盘
    window.addEventListener('keydown', (e) => {
      if (this.phase !== 'playing') return;
      switch (e.key) {
        case 'n': case 'N': if (!this.isPaused) this.waveManager.forceNextWave(); break;
        case 'Escape': this.cancelSelection(); break;
        case ' ': this.toggleSpeed(); e.preventDefault(); break;
        case 'p': case 'P': this.isPaused = !this.isPaused; this.showMessage(this.isPaused ? '⏸ 暂停' : '▶ 继续'); break;
        case 'u': case 'U': if (this.selectedTower && !this.heroTower?.isSelected) this.upgradeTower(this.selectedTower); break;
        case 's': case 'S': if (this.selectedTower && !this.heroTower?.isSelected) this.sellTower(this.selectedTower); break;
        case 'm': case 'M': this.startHeroMove(); break;
        case 'h': case 'H': this.toggleHelp(); break;
        default:
          const num = parseInt(e.key);
          if (num >= 1 && num <= 9) {
            const configs = Object.values(TOWER_CONFIGS);
            if (num - 1 < configs.length) this.selectTowerToBuild(configs[num - 1], num - 1);
          }
          if (e.key === '0') {
            const configs = Object.values(TOWER_CONFIGS);
            if (9 < configs.length) this.selectTowerToBuild(configs[9], 9);
          }
      }
    });
  }

  // ======================= 菜单 =======================

  private showMenu(): void {
    this.phase = 'menu';
    soundManager.startMenuBGM();
    this.uiRoot.innerHTML = `
      <div style="pointer-events:auto;position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(10,10,26,0.92);">
        <h1 style="font-size:60px;color:#44ff44;text-shadow:0 0 20px #003300;margin-bottom:8px;">绿色循环圈</h1>
        <p style="color:#66aa66;margin-bottom:20px;">Green Circle TD · Web 3D Edition</p>
        <div style="display:flex;gap:12px;margin-bottom:20px;" id="diff-btns">
          ${(['easy','normal','hard','hell'] as Difficulty[]).map(d => {
            const labels: Record<Difficulty, string> = { easy:'简单',normal:'普通',hard:'困难',hell:'地狱' };
            const colors: Record<Difficulty, string> = { easy:'#44FF44',normal:'#FFCC44',hard:'#FF8844',hell:'#FF4444' };
            return `<button data-diff="${d}" style="pointer-events:auto;padding:8px 24px;border:2px solid ${this.difficulty===d?'#44FF44':'#444'};background:${this.difficulty===d?'#1a331a':'#1a1a2e'};color:${this.difficulty===d?colors[d]:'#888'};font-size:14px;cursor:pointer;border-radius:4px;font-family:inherit;">${labels[d]}</button>`;
          }).join('')}
        </div>
        <button id="start-btn" style="pointer-events:auto;padding:14px 60px;background:#336633;color:#fff;border:2px solid #44ff44;font-size:20px;cursor:pointer;border-radius:6px;font-family:inherit;">▶ 开始游戏</button>
        <div style="color:#667766;font-size:12px;margin-top:30px;text-align:center;line-height:2;">
          🖱 左键点击建塔/选塔 | 右键拖拽摄像机 | 滚轮缩放<br>
          ⌨️ [1-0]选塔 [N]下一波 [P]暂停 [Space]加速 [U]升级 [S]出售 [M]移英雄
        </div>
      </div>`;

    // 绑定事件
    this.uiRoot.querySelectorAll('[data-diff]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.difficulty = (btn as HTMLElement).dataset.diff as Difficulty;
        this.showMenu(); // 刷新
      });
    });
    this.uiRoot.querySelector('#start-btn')?.addEventListener('click', () => this.startGame());
  }

  // ======================= 开始游戏 =======================

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
      onWaveComplete: (wn) => this.showMessage(`✅ 第 ${wn} 波完成！+1 PF`),
      onSpawnEnemy: (eid) => this.spawnEnemy(eid),
      onAllWavesComplete: () => this.onVictory(),
      onGameOver: (reason) => this.onGameOver(reason),
      onPFGained: () => {},
      onHiddenWaveStart: () => { this.showMessage('🌟 恭喜通过50波！进入隐藏关卡！'); soundManager.playVictory(); },
      onEndlessModeStart: () => { this.showMessage('♾️ 无尽模式开启！'); soundManager.playBossAlert(); },
    };
    this.waveManager = new WaveManager(waveEvents, this.difficulty);

    this.entityRenderer.reset();
    this.entityRenderer.buildTerrain(this.pathManager);

    this.showHeroChoice();
  }

  // ======================= 英雄选择 =======================

  private showHeroChoice(): void {
    this.phase = 'hero_select';
    const choices = getRandomHeroChoices(3);
    soundManager.startGameBGM();

    let html = `<div style="pointer-events:auto;position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);">
      <h2 style="color:#FFD700;font-size:28px;margin-bottom:10px;">🎲 选择你的英雄塔</h2>
      <p style="color:#AAA;font-size:12px;margin-bottom:20px;">英雄塔可通过击杀获得经验升级，拥有独特技能和属性成长</p>
      <div style="display:flex;gap:20px;">`;

    for (const hero of choices) {
      const c = `#${hero.color.toString(16).padStart(6, '0')}`;
      const diffLabels: Record<string, string> = { easy: '★ 新手推荐', medium: '★★ 中等', hard: '★★★ 困难' };
      html += `<div class="hero-card" data-hero="${hero.id}" style="pointer-events:auto;cursor:pointer;width:280px;padding:16px;background:#1a1a2e;border:2px solid ${c};border-radius:8px;">
        <h3 style="color:${c};font-size:20px;margin:0;">${hero.name}</h3>
        <p style="color:#888;font-size:12px;">${hero.title}</p>
        <p style="color:#CCC;font-size:11px;margin:8px 0;">${hero.description}</p>
        <p style="color:#88AACC;font-size:10px;">力+${hero.strGrowth} 敏+${hero.agiGrowth} 智+${hero.intGrowth}</p>
        <p style="color:#AAA;font-size:10px;">攻击: ${hero.baseAttackType}</p>
        <div style="margin:8px 0;border-top:1px solid #333;padding-top:6px;">
          ${hero.skills.map(s => `<p style="color:#DDDDAA;font-size:10px;">• ${s.name} - ${s.description.substring(0, 20)}</p>`).join('')}
        </div>
        <p style="color:#668866;font-size:9px;">推荐: ${hero.recommendedSkillOrder}</p>
        <p style="color:${hero.difficulty === 'easy' ? '#44FF44' : hero.difficulty === 'medium' ? '#FFCC44' : '#FF4444'};font-size:10px;">${diffLabels[hero.difficulty]}</p>
      </div>`;
    }
    html += `</div></div>`;
    this.uiRoot.innerHTML = html;

    this.uiRoot.querySelectorAll('.hero-card').forEach(card => {
      card.addEventListener('click', () => {
        const heroId = (card as HTMLElement).dataset.hero!;
        const hero = choices.find(h => h.id === heroId)!;
        this.selectHero(hero);
      });
      card.addEventListener('mouseenter', () => (card as HTMLElement).style.borderColor = '#44FF44');
      card.addEventListener('mouseleave', () => {
        const hero = choices.find(h => h.id === (card as HTMLElement).dataset.hero)!;
        (card as HTMLElement).style.borderColor = `#${hero.color.toString(16).padStart(6, '0')}`;
      });
    });
  }

  private selectHero(heroConfig: HeroTowerConfig): void {
    // 从地图中央向外螺旋搜索第一个可建造位置
    const centerCol = Math.floor(GRID_COLS / 2);
    const centerRow = Math.floor((GAME_HEIGHT - 140) / TILE_SIZE / 2);
    let bestCol = centerCol, bestRow = centerRow;
    let found = false;
    for (let radius = 0; radius < 20 && !found; radius++) {
      for (let dc = -radius; dc <= radius && !found; dc++) {
        for (let dr = -radius; dr <= radius && !found; dr++) {
          if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue; // 只检查当前圈
          const c = centerCol + dc, r = centerRow + dr;
          if (this.gridManager.canBuildAt(c, r)) { bestCol = c; bestRow = r; found = true; }
        }
      }
    }

    this.gridManager.occupy(bestCol, bestRow);
    this.economyManager.addPopulation();
    this.heroTower = new HeroTowerLogic(heroConfig, bestCol, bestRow);
    this.heroTower.setEnemies(this.enemies);
    this.heroTower.onProjectileHit = (x, y, dmg, sp, at, special) => this.handleProjectileHit(x, y, dmg, sp, at as AttackType, special, null, true);
    this.heroTower.onFireProjectile = (fx, fy, tx, ty, color, aoe) => this.entityRenderer.spawnProjectile(fx, fy, tx, ty, color, aoe);
    this.heroTower.onLevelUp = () => { this.showMessage(`⭐ ${heroConfig.name} 升级！`); soundManager.playUpgrade(); };

    this.phase = 'playing';
    soundManager.playBuild();
    this.showMessage(`${heroConfig.name} 已就位！点击英雄塔查看属性和技能`);
    this.createPlayingUI();
  }

  // ======================= 游戏 UI =======================

  private createPlayingUI(): void {
    this.uiRoot.innerHTML = `
      <div id="topbar" style="position:absolute;top:0;left:0;right:0;height:44px;background:rgba(0,0,0,0.5);display:flex;align-items:center;padding:0 12px;gap:12px;font-size:13px;color:#FFF;z-index:10;flex-wrap:wrap;">
        <span id="gold-text">💰 ${this.economyManager.getGold()}</span>
        <span id="wood-text" style="color:#CC9966;">🪵 ${this.economyManager.getWood()}</span>
        <span id="wave-text">波次: 0/50</span>
        <span id="pop-text">👥 ${this.economyManager.getPopulation()}/${this.economyManager.getMaxPopulation()}</span>
        <span id="score-text">⭐ 0</span>
        <span id="enemy-count" style="color:#88FF88;">怪物: 0/${MAX_ENEMIES_ON_MAP}</span>
        <span id="speed-text" style="cursor:pointer;pointer-events:auto;" onclick="window.__game?.toggleSpeed()">⏩ x1</span>
        <span id="boss-timer" style="color:#FF4444;display:none;"></span>
        <span id="next-wave-text" style="color:#AAAAAA;"></span>
        <span style="flex:1;"></span>
        <button id="buy-wood-btn" style="pointer-events:auto;padding:2px 8px;background:#222;border:1px solid #998866;color:#CC9966;font-size:9px;cursor:pointer;border-radius:3px;font-family:inherit;" onclick="window.__game?.buyWood()">5000金→10木</button>
        <button id="buy-pop-btn" style="pointer-events:auto;padding:2px 8px;background:#222;border:1px solid #8888CC;color:#8888CC;font-size:9px;cursor:pointer;border-radius:3px;font-family:inherit;" onclick="window.__game?.buyPopulation()">12木→+1人口</button>
      </div>
      <div id="message-bar" style="position:absolute;top:48px;left:50%;transform:translateX(-50%);color:#FFF;font-size:13px;background:rgba(0,0,0,0.6);padding:4px 16px;border-radius:4px;opacity:0;transition:opacity 0.3s;white-space:nowrap;z-index:15;"></div>
      <div id="help-overlay" style="pointer-events:auto;display:none;position:absolute;inset:0;background:rgba(0,0,0,0.8);z-index:50;display:none;justify-content:center;align-items:center;"></div>
      <div id="shop-panel" style="pointer-events:auto;position:absolute;bottom:0;left:0;right:0;height:130px;background:#111122;border-top:2px solid #44ff44;display:flex;flex-wrap:wrap;gap:3px;padding:4px;overflow-y:auto;z-index:10;"></div>
      <div id="info-panel" style="pointer-events:auto;display:none;position:absolute;right:8px;top:50px;width:200px;background:rgba(20,20,40,0.95);border:1px solid #44FF44;border-radius:6px;padding:10px;color:#FFF;font-size:11px;z-index:20;"></div>`;

    this.messageEl = this.uiRoot.querySelector('#message-bar')!;
    this.minimapCanvas = null; // 重建 UI 后清除缓存
    this.createShop();

    // 经济回调
    this.economyManager.onGoldChange = () => { this.updateTopBar(); this.updateShopAffordability(); };
    this.economyManager.onPopulationChange = () => this.updateTopBar();
    this.economyManager.onScoreChange = () => this.updateTopBar();
    this.economyManager.onWoodChange = () => this.updateTopBar();

    // 全局暴露
    (window as any).__game = this;
  }

  /** A1: 购买木材 */
  buyWood(): void {
    if (this.economyManager.buyWood()) {
      soundManager.playGold();
      this.showMessage('🪵 购买10木材');
    } else {
      soundManager.playError();
      this.showMessage('💰 金钱不足5000');
    }
  }

  /** A1: 购买人口 */
  buyPopulation(): void {
    if (this.economyManager.buyPopulation()) {
      soundManager.playGold();
      this.showMessage('👥 人口上限+1');
    } else {
      soundManager.playError();
      this.showMessage('🪵 木材不足12');
    }
  }

  private createShop(): void {
    const panel = this.uiRoot.querySelector('#shop-panel')!;
    const configs = Object.values(TOWER_CONFIGS);
    configs.forEach((config, i) => {
      const btn = document.createElement('div');
      btn.className = 'shop-btn';
      btn.dataset.index = String(i);
      btn.dataset.cost = String(config.cost);
      btn.dataset.towerId = config.id;
      btn.style.cssText = `width:148px;height:54px;background:#222233;border:1px solid #444466;border-radius:4px;cursor:pointer;padding:4px 6px;position:relative;display:flex;align-items:center;gap:6px;transition:opacity 0.2s;`;
      btn.innerHTML = `
        <div style="width:22px;height:22px;background:#${config.color.toString(16).padStart(6,'0')};border:1px solid #888;border-radius:3px;flex-shrink:0;"></div>
        <div>
          <div style="font-size:11px;color:#FFF;">${config.name}</div>
          <div style="font-size:10px;color:#FFD700;">💰${config.cost}</div>
          <div style="font-size:9px;color:#889;">${config.splash > 0 ? 'AOE' : config.attackType}${config.special ? ' [' + config.special + ']' : ''}</div>
        </div>
        <div style="position:absolute;top:2px;right:4px;font-size:9px;color:#556;">${i < 9 ? i + 1 : '0'}</div>`;

      btn.addEventListener('click', () => this.selectTowerToBuild(config, i));
      btn.addEventListener('mouseenter', () => {
        btn.style.borderColor = '#44FF44';
        const atkLabel = config.attackType;
        const splashInfo = config.splash > 0 ? ` | AOE ${config.splash}px` : '';
        this.showMessage(`${config.name} - ${config.description} | ${atkLabel}${splashInfo} | 伤害${config.damage} | 射程${config.range} | 攻速${(config.attackSpeed / 1000).toFixed(1)}s`);
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.borderColor = this.selectedTowerConfig?.id === config.id ? '#44FF44' : '#444466';
      });
      panel.appendChild(btn);
    });
    this.updateShopAffordability();
  }

  /** A5: 商店灰显 — 买不起的塔半透明 */
  private updateShopAffordability(): void {
    const gold = this.economyManager.getGold();
    const canBuild = this.economyManager.canBuild();
    this.uiRoot.querySelectorAll('.shop-btn').forEach(btn => {
      const cost = parseInt((btn as HTMLElement).dataset.cost || '0');
      const affordable = gold >= cost && canBuild;
      (btn as HTMLElement).style.opacity = affordable ? '1' : '0.4';
    });
  }

  private updateTopBar(): void {
    const g = this.uiRoot.querySelector('#gold-text');
    const wd = this.uiRoot.querySelector('#wood-text');
    const w = this.uiRoot.querySelector('#wave-text');
    const p = this.uiRoot.querySelector('#pop-text');
    const s = this.uiRoot.querySelector('#score-text');
    const e = this.uiRoot.querySelector('#enemy-count');
    const sp = this.uiRoot.querySelector('#speed-text');
    const nw = this.uiRoot.querySelector('#next-wave-text');
    const bt = this.uiRoot.querySelector('#boss-timer');

    if (g) g.textContent = `💰 ${this.economyManager.getGold()}`;
    if (wd) wd.textContent = `🪵 ${this.economyManager.getWood()}`;
    if (p) p.textContent = `👥 ${this.economyManager.getPopulation()}/${this.economyManager.getMaxPopulation()}`;
    if (s) s.textContent = `⭐ ${this.economyManager.getScore()}`;
    if (e) { const alive = this.enemies.length; e.textContent = `怪物: ${alive}/${MAX_ENEMIES_ON_MAP}`; (e as HTMLElement).style.color = alive > 80 ? '#FF4444' : alive > 50 ? '#FFAA00' : '#88FF88'; }
    if (sp) sp.textContent = `⏩ x${this.gameSpeed}`;

    // A4: 波次模式标记
    if (w) {
      const mode = this.waveManager.getGameMode();
      const wn = this.waveManager.getCurrentWave();
      if (mode === 'hidden') w.textContent = `🌟 隐藏关: ${wn - 50}/10`;
      else if (mode === 'endless') w.textContent = `♾️ 无尽 #${wn - 60} (x${Math.round(this.waveManager.getEndlessScaling() * 100)}%)`;
      else w.textContent = `波次: ${wn}/50`;
    }

    // A4: Boss 倒计时
    if (bt) {
      const bossRemaining = this.waveManager.getBossTimeRemaining();
      if (bossRemaining > 0) {
        (bt as HTMLElement).style.display = 'inline';
        bt.textContent = `⏱ BOSS: ${Math.ceil(bossRemaining / 1000)}s`;
      } else {
        (bt as HTMLElement).style.display = 'none';
      }
    }

    // 下一波倒计时
    if (nw && this.waveManager.isWaitingForNextWave()) {
      const remaining = this.waveManager.getNextWaveCountdown();
      nw.textContent = remaining > 0 ? `下一波: ${Math.ceil(remaining / 1000)}s | 按N提前` : '';
    } else if (nw) nw.textContent = '';
  }

  // ======================= 选择/建造 =======================

  private selectTowerToBuild(config: TowerConfig, shopIndex: number): void {
    if (this.selectedTower) { this.selectedTower.deselect(); this.selectedTower = null; }
    this.hideInfoPanel();

    if (this.selectedTowerConfig?.id === config.id) { this.cancelSelection(); return; }
    this.selectedTowerConfig = config;
    this.selectedShopIndex = shopIndex;
    this.highlightShopButton(shopIndex);

    if (!this.economyManager.canAfford(config.cost)) { this.showMessage(`💰不足！${config.name} 需要 ${config.cost} 金`); return; }
    if (!this.economyManager.canBuild()) { this.showMessage('👥 人口已满！'); return; }
    this.showMessage(`${config.name} (💰${config.cost}) - 左键点击放置 | ESC取消`);
  }

  private selectExistingTower(tower: TowerLogic): void {
    this.cancelSelection();
    this.selectedTower = tower;
    tower.select();
    this.showTowerInfo(tower);
    this.entityRenderer.showSelection(tower.x, tower.y, tower.getRange());
  }

  private cancelSelection(): void {
    this.selectedTowerConfig = null;
    if (this.selectedTower) { this.selectedTower.deselect(); this.selectedTower = null; }
    if (this.heroTower) { this.heroTower.deselect(); this.heroTower.cancelMoving(); }
    this.entityRenderer.clearSelection();
    this.entityRenderer.clearBuildPreview();
    this.highlightShopButton(-1);
    this.hideInfoPanel();
  }

  private highlightShopButton(index: number): void {
    this.uiRoot.querySelectorAll('.shop-btn').forEach((btn, i) => {
      (btn as HTMLElement).style.borderColor = i === index ? '#44FF44' : '#444466';
    });
  }

  private tryPlaceTower(col: number, row: number): void {
    if (!this.selectedTowerConfig) return;
    if (!this.gridManager.canBuildAt(col, row)) { this.showMessage('⛔ 无法在此处建造'); soundManager.playError(); return; }
    if (!this.economyManager.canAfford(this.selectedTowerConfig.cost)) { this.showMessage('💰 金钱不足'); soundManager.playError(); return; }
    if (!this.economyManager.canBuild()) { this.showMessage('👥 人口已满'); soundManager.playError(); return; }

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
    this.showMessage(`✅ ${this.selectedTowerConfig.name} 已建造`);

    // A7: Shift 连续建造
    if (!this.shiftDown) {
      this.cancelSelection();
    } else {
      this.entityRenderer.clearBuildPreview();
    }
  }

  private upgradeTower(tower: TowerLogic): void {
    const cost = tower.getUpgradeCost();
    if (!cost) { this.showMessage('已满级！'); return; }
    if (!this.economyManager.canAfford(cost)) { this.showMessage('💰 不足'); return; }
    this.economyManager.spendGold(cost);
    tower.upgrade();
    soundManager.playUpgrade();
    this.showMessage(`⬆️ ${tower.config.name} → Lv.${tower.level + 1}`);
    this.showTowerInfo(tower);
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
    this.showMessage(`💰 出售回收 ${sellValue} 金`);
  }

  private startHeroMove(): void {
    if (!this.heroTower?.active) { this.showMessage('⛔ 没有英雄塔'); return; }
    this.cancelSelection();
    this.heroTower.startMoving();
    this.heroTower.select();
    this.showMessage('🔄 点击新位置移动英雄塔 | ESC取消');
  }

  private tryMoveHero(col: number, row: number): void {
    if (!this.heroTower) return;
    if (!this.gridManager.canBuildAt(col, row)) { this.showMessage('⛔ 无法移动到此位置'); soundManager.playError(); return; }
    this.gridManager.release(this.heroTower.getGridCol(), this.heroTower.getGridRow());
    this.gridManager.occupy(col, row);
    this.heroTower.relocate(col, row);
    soundManager.playBuild();
    this.showMessage(`✅ ${this.heroTower.config.name} 已移动`);
    // MISS-003: 刷新选中位置和面板
    this.entityRenderer.clearSelection();
    this.entityRenderer.showSelection(this.heroTower.x, this.heroTower.y, this.heroTower.getRange());
    this.showHeroInfo();
  }

  toggleSpeed(): void {
    this.gameSpeed = this.gameSpeed === 1 ? 2 : this.gameSpeed === 2 ? 4 : 1;
    this.showMessage(`⏩ 速度 x${this.gameSpeed}`);
  }

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
    // 先清零所有塔的 buff
    for (const tower of this.towers) tower.setAuraBuff(0, 0);
    // 再累加每个光环塔的 buff（多个光环叠加）
    for (const aura of this.towers) {
      if (aura.config.special !== 'aura_attack' && aura.config.special !== 'aura_speed') continue;
      for (const tower of this.towers) {
        if (tower === aura) continue;
        if (distanceBetween(aura.x, aura.y, tower.x, tower.y) <= aura.getRange()) {
          if (aura.config.special === 'aura_attack') {
            tower.addAuraBuff(Math.floor(tower.config.damage * 0.2 * (1 + aura.level * 0.1)), 0);
          } else {
            tower.addAuraBuff(0, Math.floor(tower.config.attackSpeed * 0.2 * (1 + aura.level * 0.1)));
          }
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
    // B1: 交替使用内外圈路径
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
    if (this.heroTower?.active) this.heroTower.addExperience(1 + Math.floor(enemy.config.goldReward * 0.5));
    this.waveManager.onEnemyDied();
  }

  private onWaveStart(waveNum: number, config: WaveConfig): void {
    this.economyManager.setCurrentWave(waveNum);
    const mode = this.waveManager.getGameMode();
    if (config.isBossWave) {
      this.showMessage(`⚠️ 第 ${waveNum} 波 - BOSS 来袭！`);
      soundManager.playBossAlert(); soundManager.startBossBGM();
      this.entityRenderer.showWaveBanner(`⚠️ WAVE ${waveNum} — BOSS`, '#FF4444');
    } else if (mode === 'hidden') {
      this.showMessage(`🌟 隐藏关 第 ${waveNum - 50} 波`);
      soundManager.playWaveStart(); soundManager.startGameBGM();
      this.entityRenderer.showWaveBanner(`🌟 HIDDEN ${waveNum - 50}`, '#FFD700');
    } else if (mode === 'endless') {
      this.showMessage(`♾️ 无尽 #${waveNum - 60}`);
      soundManager.playWaveStart(); soundManager.startGameBGM();
      this.entityRenderer.showWaveBanner(`♾️ ENDLESS #${waveNum - 60}`, '#AA88FF');
    } else {
      this.showMessage(`第 ${waveNum} 波开始`);
      soundManager.playWaveStart(); soundManager.startGameBGM();
      this.entityRenderer.showWaveBanner(`WAVE ${waveNum}`, '#44FF44');
    }
  }

  private onVictory(): void {
    this.isGameOver = true;
    soundManager.stopBGM();
    soundManager.playVictory();
    this.showGameOver(true);
  }

  private onGameOver(reason: string): void {
    this.isGameOver = true;
    soundManager.stopBGM();
    soundManager.playGameOver();
    this.showGameOver(false, reason);
  }

  // ======================= 信息面板 =======================

  private showTowerInfo(tower: TowerLogic): void {
    const panel = this.uiRoot.querySelector('#info-panel') as HTMLElement;
    if (!panel) return;
    panel.style.display = 'block';
    const upgCost = tower.getUpgradeCost();
    panel.innerHTML = `
      <h3 style="color:#44FF44;margin:0 0 6px;">${tower.config.name} Lv.${tower.level + 1}</h3>
      <p>⚔️ 伤害: ${tower.getDamage()} | 🎯 射程: ${tower.getRange()}</p>
      <p>⏱ 攻速: ${(tower.getAttackSpeed() / 1000).toFixed(2)}s | 💀 击杀: ${tower.getKillCount()}</p>
      ${tower.config.special ? `<p style="color:#FFCC44;">特殊: ${tower.config.special}</p>` : ''}
      <div style="display:flex;gap:6px;margin-top:8px;">
        ${upgCost ? `<button onclick="window.__game?.upgradeTower(window.__game?.selectedTower)" style="pointer-events:auto;padding:4px 12px;background:#336633;border:1px solid #44FF44;color:#44FF44;cursor:pointer;border-radius:3px;font-size:10px;">升级[U] 💰${upgCost}</button>` : '<span style="color:#666;">已满级</span>'}
        <button onclick="window.__game?.sellTower(window.__game?.selectedTower)" style="pointer-events:auto;padding:4px 12px;background:#663333;border:1px solid #FF4444;color:#FF4444;cursor:pointer;border-radius:3px;font-size:10px;">出售[S] 💰${this.economyManager.getSellValue(tower.getTotalInvested())}</button>
      </div>`;
  }

  private showHeroInfo(): void {
    if (!this.heroTower) return;
    const panel = this.uiRoot.querySelector('#info-panel') as HTMLElement;
    if (!panel) return;
    panel.style.display = 'block';
    const h = this.heroTower;
    panel.innerHTML = `
      <h3 style="color:#FFD700;margin:0 0 6px;">${h.config.name} Lv.${h.heroLevel}</h3>
      <p>💪${h.str} 🏃${h.agi} 🧠${h.int} | 自由点:${h.freePoints}</p>
      <p>⚔️${h.getDamage()} ⏱${(h.getAttackSpeed()/1000).toFixed(2)}s 🎯${h.getRange()}</p>
      <p>💀${h.killCount} | EXP:${h.experience}/${h.expToNextLevel}</p>
      ${h.freePoints > 0 ? `<div style="display:flex;gap:4px;margin:4px 0;">
        <button onclick="window.__game?.heroTower?.addStr();window.__game?.showHeroInfo()" style="pointer-events:auto;padding:2px 8px;background:#333;border:1px solid #F44;color:#F44;cursor:pointer;border-radius:2px;font-size:9px;">+力</button>
        <button onclick="window.__game?.heroTower?.addAgi();window.__game?.showHeroInfo()" style="pointer-events:auto;padding:2px 8px;background:#333;border:1px solid #4F4;color:#4F4;cursor:pointer;border-radius:2px;font-size:9px;">+敏</button>
        <button onclick="window.__game?.heroTower?.addInt();window.__game?.showHeroInfo()" style="pointer-events:auto;padding:2px 8px;background:#333;border:1px solid #44F;color:#44F;cursor:pointer;border-radius:2px;font-size:9px;">+智</button>
      </div>` : ''}
      <div style="border-top:1px solid #333;margin-top:6px;padding-top:4px;">
        ${h.config.skills.map((s, i) => {
          const lv = h.getSkillLevel(i);
          const canLearn = h.canLearnSkill(i);
          return `<div style="display:flex;justify-content:space-between;align-items:center;margin:2px 0;">
            <span style="color:${lv > 0 ? '#DDDDAA' : '#666'};font-size:10px;">${s.name} Lv.${lv}/${s.maxLevel}</span>
            ${canLearn ? `<button onclick="window.__game?.heroTower?.learnSkill(${i});window.__game?.showHeroInfo()" style="pointer-events:auto;padding:1px 6px;background:#333;border:1px solid #FFCC44;color:#FFCC44;cursor:pointer;border-radius:2px;font-size:9px;">学习</button>` : ''}
          </div>`;
        }).join('')}
      </div>
      <button onclick="window.__game?.startHeroMove()" style="pointer-events:auto;margin-top:6px;padding:3px 10px;background:#333366;border:1px solid #8888FF;color:#8888FF;cursor:pointer;border-radius:3px;font-size:10px;">移动[M]</button>`;
  }

  private hideInfoPanel(): void {
    const panel = this.uiRoot.querySelector('#info-panel') as HTMLElement;
    if (panel) panel.style.display = 'none';
  }

  // ======================= 结算 =======================

  private showGameOver(victory: boolean, reason?: string): void {
    this.phase = 'game_over';
    const stats = {
      wave: this.waveManager.getCurrentWave(),
      score: this.economyManager.getScore(),
      kills: this.economyManager.getTotalKills(),
      pf: this.waveManager.getPFPoints(),
    };
    // B5: 保存最高分
    this.saveHighScore(stats.score);
    const highScore = this.getHighScore();
    const isNewRecord = stats.score >= highScore && stats.score > 0;

    this.uiRoot.innerHTML = `
      <div style="pointer-events:auto;position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(10,10,26,0.9);">
        <h1 style="font-size:56px;color:${victory ? '#44FF44' : '#FF4444'};">${victory ? '🎉 胜 利 🎉' : '💀 失 败'}</h1>
        ${reason ? `<p style="color:#FF8888;margin-bottom:12px;">${reason}</p>` : ''}
        <div style="color:#FFF;font-size:18px;line-height:2;margin:16px 0;">
          <p>波次: ${stats.wave}/50 | 击杀: ${stats.kills}</p>
          <p>得分: ${stats.score} | PF: ${stats.pf}</p>
          <p style="color:#FFD700;">🏆 最高分: ${highScore}${isNewRecord ? ' 🆕 新纪录！' : ''}</p>
        </div>
        <div style="display:flex;gap:16px;">
          <button onclick="window.__game?.restart()" style="pointer-events:auto;padding:12px 36px;background:#336633;border:2px solid #44FF44;color:#FFF;font-size:18px;cursor:pointer;border-radius:6px;font-family:inherit;">🔄 重新开始</button>
          <button onclick="window.__game?.backToMenu()" style="pointer-events:auto;padding:12px 36px;background:#2a2a3e;border:2px solid #8888CC;color:#FFF;font-size:18px;cursor:pointer;border-radius:6px;font-family:inherit;">🏠 返回菜单</button>
        </div>
      </div>`;
  }

  restart(): void { this.startGame(); }
  backToMenu(): void { this.entityRenderer.reset(); this.showMenu(); }

  // ======================= 消息 =======================

  showMessage(msg: string): void {
    if (this.messageEl) {
      this.messageEl.textContent = msg;
      this.messageEl.style.opacity = '1';
      this.messageTimer = 3000;
    }
  }

  /** A3: 克制表 */
  private toggleHelp(): void {
    this.helpVisible = !this.helpVisible;
    const overlay = this.uiRoot.querySelector('#help-overlay') as HTMLElement;
    if (!overlay) return;
    if (this.helpVisible) {
      overlay.style.display = 'flex';
      overlay.innerHTML = `
        <div style="background:#1a1a2e;border:2px solid #44FF44;border-radius:8px;padding:20px;max-width:700px;color:#FFF;font-size:12px;pointer-events:auto;">
          <h2 style="color:#44FF44;margin:0 0 10px;">📊 攻击/护甲克制矩阵</h2>
          <table style="border-collapse:collapse;width:100%;font-size:11px;">
            <tr style="background:#222;">
              <th style="padding:4px 8px;border:1px solid #333;"></th>
              <th style="padding:4px 8px;border:1px solid #333;">无甲</th>
              <th style="padding:4px 8px;border:1px solid #333;">轻甲</th>
              <th style="padding:4px 8px;border:1px solid #333;">中甲</th>
              <th style="padding:4px 8px;border:1px solid #333;">重甲</th>
              <th style="padding:4px 8px;border:1px solid #333;">加强甲</th>
              <th style="padding:4px 8px;border:1px solid #333;">英雄甲</th>
              <th style="padding:4px 8px;border:1px solid #333;">神圣甲</th>
            </tr>
            ${this.renderDamageRow('普通', [1.0,1.0,1.5,1.0,0.7,1.0,0.05])}
            ${this.renderDamageRow('穿刺', [1.25,1.5,0.75,1.0,0.75,0.75,0.05])}
            ${this.renderDamageRow('魔法', [1.0,1.25,0.75,1.5,0.75,0.75,0.05])}
            ${this.renderDamageRow('攻城', [1.25,1.0,0.5,1.0,1.5,1.5,0.05])}
            ${this.renderDamageRow('混乱', [1.0,1.0,1.0,1.0,1.0,2.0,2.0])}
            ${this.renderDamageRow('英雄', [1.0,1.0,1.0,1.0,1.5,1.0,2.0])}
            ${this.renderDamageRow('神圣', [1.0,1.0,1.0,1.0,1.0,1.0,1.5])}
          </table>
          <p style="color:#888;margin-top:10px;font-size:10px;">绿色=克制(>100%) 红色=被克(&#60;100%) | 按 H 关闭</p>
          <div style="margin-top:10px;font-size:10px;color:#AAA;">
            <p>🛡 魔免怪物：受魔法攻击伤害-70%</p>
            <p>☠ 毒免怪物：完全免疫毒效果</p>
            <p>✈ 飞行怪物：只有防空塔能攻击</p>
            <p>👁 隐形怪物：需要侦查塔揭示才能攻击</p>
          </div>
        </div>`;
      overlay.addEventListener('click', () => this.toggleHelp());
    } else {
      overlay.style.display = 'none';
    }
  }

  private renderDamageRow(name: string, values: number[]): string {
    return `<tr>
      <td style="padding:4px 8px;border:1px solid #333;color:#FFCC44;font-weight:bold;">${name}</td>
      ${values.map(v => {
        const pct = Math.round(v * 100);
        const color = v > 1 ? '#44FF44' : v < 1 ? '#FF4444' : '#FFFFFF';
        return `<td style="padding:4px 8px;border:1px solid #333;color:${color};text-align:center;">${pct}%</td>`;
      }).join('')}
    </tr>`;
  }

  // ======================= B4: RP 事件 =======================

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
    this.showMessage(event.msg);
    soundManager.playGold();
  }

  // ======================= B5: 最高分 =======================

  private saveHighScore(score: number): void {
    const key = `gcTD_highscore_${this.difficulty}`;
    const prev = parseInt(localStorage.getItem(key) || '0');
    if (score > prev) {
      localStorage.setItem(key, String(score));
    }
  }

  private getHighScore(): number {
    return parseInt(localStorage.getItem(`gcTD_highscore_${this.difficulty}`) || '0');
  }

  // ======================= B6: 小地图 =======================

  private updateMinimap(): void {
    if (!this.minimapCanvas) {
      this.minimapCanvas = document.createElement('canvas');
      this.minimapCanvas.id = 'minimap';
      this.minimapCanvas.width = 160;
      this.minimapCanvas.height = 90;
      this.minimapCanvas.style.cssText = 'position:absolute;bottom:135px;right:5px;border:1px solid #44FF44;border-radius:4px;background:rgba(0,0,0,0.6);z-index:15;';
      this.uiRoot.appendChild(this.minimapCanvas);
    }
    const ctx = this.minimapCanvas.getContext('2d');
    if (!ctx) return;

    const scaleX = 160 / GAME_WIDTH;
    const scaleY = 90 / (GAME_HEIGHT - 140);

    ctx.clearRect(0, 0, 160, 90);

    // 路径
    ctx.fillStyle = 'rgba(139,115,85,0.4)';
    this.pathManager.getPathTiles().forEach(key => {
      const [col, row] = key.split(',').map(Number);
      ctx.fillRect(col * TILE_SIZE * scaleX, row * TILE_SIZE * scaleY, TILE_SIZE * scaleX, TILE_SIZE * scaleY);
    });

    // 塔
    ctx.fillStyle = '#44FF44';
    for (const tower of this.towers) {
      ctx.fillRect(tower.x * scaleX - 1.5, tower.y * scaleY - 1.5, 3, 3);
    }

    // 英雄
    if (this.heroTower?.active) {
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(this.heroTower.x * scaleX - 2, this.heroTower.y * scaleY - 2, 4, 4);
    }

    // 怪物（红色密度点）
    ctx.fillStyle = 'rgba(255,68,68,0.6)';
    for (const e of this.enemies) {
      if (!e.active || e.isDying()) continue;
      ctx.fillRect(e.x * scaleX - 0.5, e.y * scaleY - 0.5, 1.5, 1.5);
    }
  }
}
