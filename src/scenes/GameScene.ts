import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, COLORS,
  MAX_ENEMIES_ON_MAP, AttackType,
  WAVE_INTERVAL,
} from '../utils/constants';
import { calculateDamage, distanceBetween } from '../utils/helpers';
import { PathManager } from '../systems/PathManager';
import { GridManager } from '../systems/GridManager';
import { EconomyManager } from '../systems/EconomyManager';
import { WaveManager, WaveManagerEvents } from '../systems/WaveManager';
import { TOWER_CONFIGS, TowerConfig } from '../config/towers';
import { ENEMY_CONFIGS } from '../config/enemies';
import { WaveConfig, WAVE_CONFIGS } from '../config/waves';
import { soundManager } from '../systems/SoundManager';
import { Tower } from '../entities/Tower';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { HeroTower } from '../entities/HeroTower';
import { HeroTowerConfig, getRandomHeroChoices } from '../config/heroTowers';
import { Difficulty } from './MainMenuScene';

const UI_HEIGHT = 140;
const SHOP_COLS = 8;
const SHOP_ROWS = 2;

const DIFFICULTY_PARAMS: Record<Difficulty, { hpMul: number; gold: number; label: string }> = {
  easy:   { hpMul: 0.7, gold: 200, label: '简单' },
  normal: { hpMul: 1.0, gold: 100, label: '普通' },
  hard:   { hpMul: 1.5, gold: 80, label: '困难' },
  hell:   { hpMul: 3.0, gold: 60, label: '地狱' },
};

export class GameScene extends Phaser.Scene {
  // 系统
  private pathManager!: PathManager;
  private gridManager!: GridManager;
  private economyManager!: EconomyManager;
  private waveManager!: WaveManager;

  // 实体列表
  private towers: Tower[] = [];
  private enemies: Enemy[] = [];
  private heroTower: HeroTower | null = null;
  private heroChoicePanel: Phaser.GameObjects.Container | null = null;

  // 状态
  private selectedTowerConfig: TowerConfig | null = null;
  private selectedTower: Tower | null = null;
  private placementGhost: Phaser.GameObjects.Rectangle | null = null;
  private rangePreview: Phaser.GameObjects.Arc | null = null;
  private isGameOver: boolean = false;
  private isPaused: boolean = false;
  private gameSpeed: number = 1;
  private difficulty: Difficulty = 'normal';
  private diffHpMul: number = 1;

  // UI 元素
  private goldText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private enemyCountText!: Phaser.GameObjects.Text;
  private pfText!: Phaser.GameObjects.Text;
  private bossTimerText!: Phaser.GameObjects.Text;
  private nextWaveText!: Phaser.GameObjects.Text;
  private infoPanel!: Phaser.GameObjects.Container;
  private infoPanelTexts: Phaser.GameObjects.Text[] = [];
  private shopButtons: Phaser.GameObjects.Container[] = [];
  private shopHighlight: Phaser.GameObjects.Rectangle | null = null;
  private messageText!: Phaser.GameObjects.Text;
  private messageTimer: number = 0;
  private speedText!: Phaser.GameObjects.Text;
  private pauseText!: Phaser.GameObjects.Text;
  private popText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private woodText!: Phaser.GameObjects.Text;

  // 粒子和视觉效果
  private damageTexts: { text: Phaser.GameObjects.Text; timer: number }[] = [];
  private helpPanel: Phaser.GameObjects.Container | null = null;
  private wavePreviewText!: Phaser.GameObjects.Text;
  private heroHUD!: Phaser.GameObjects.Container;
  private heroHUDTexts: Phaser.GameObjects.Text[] = [];
  private heroExpBar!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(data?: { difficulty?: Difficulty }): void {
    // 难度
    this.difficulty = data?.difficulty || 'normal';
    const diffParams = DIFFICULTY_PARAMS[this.difficulty];
    this.diffHpMul = diffParams.hpMul;

    // 重置状态
    this.towers = [];
    this.enemies = [];
    this.selectedTowerConfig = null;
    this.selectedTower = null;
    this.isGameOver = false;
    this.isPaused = false;
    this.gameSpeed = 1;
    this.damageTexts = [];
    this.shopButtons = [];
    this.infoPanelTexts = [];
    this.placementGhost = null;
    this.rangePreview = null;
    this.shopHighlight = null;
    this.helpPanel = null;

    // 初始化系统
    this.pathManager = new PathManager();
    this.gridManager = new GridManager(this.pathManager);
    this.economyManager = new EconomyManager(diffParams.gold);

    const waveEvents: WaveManagerEvents = {
      onWaveStart: (waveNum, config) => this.onWaveStart(waveNum, config),
      onWaveComplete: (waveNum) => this.onWaveComplete(waveNum),
      onSpawnEnemy: (enemyId) => this.spawnEnemy(enemyId),
      onAllWavesComplete: () => this.onVictory(),
      onGameOver: (reason) => this.onGameOver(reason),
      onPFGained: (totalPF) => this.onPFGained(totalPF),
      onHiddenWaveStart: () => {
        this.showMessage('🌟 恭喜通过50波！进入隐藏关卡！');
        this.cameras.main.flash(1000, 255, 215, 0);
        soundManager.playVictory();
      },
      onEndlessModeStart: () => {
        this.showMessage('♾️ 无尽模式开启！怪物将无限增强！');
        this.cameras.main.flash(1000, 255, 0, 0);
        soundManager.playBossAlert();
      },
    };
    this.waveManager = new WaveManager(waveEvents);

    this.drawMap();
    this.createUI();
    this.setupInput();

    // 3D 渲染层接入
    const bridge = (window as any).__gameBridge;
    if (bridge) {
      bridge.reset();
      bridge.buildTerrain(this.pathManager);
    }

    this.economyManager.onGoldChange = () => {
      this.updateResourceUI();
      this.updateShopAffordability();
    };
    this.economyManager.onPopulationChange = () => {
      this.updateResourceUI();
    };
    this.economyManager.onScoreChange = () => {
      this.updateResourceUI();
    };
    this.economyManager.onWoodChange = () => {
      this.updateResourceUI();
    };

    this.goldText.setText(`💰 ${this.economyManager.getGold()}`);
    this.showMessage(`绿色循环圈 [${diffParams.label}] - 选择你的英雄塔！`);

    // 弹出英雄选择
    this.showHeroChoice();
  }

  /**
   * 英雄选择面板 - 开局从3个随机英雄中选1个
   */
  private showHeroChoice(): void {
    this.isPaused = true;
    const choices = getRandomHeroChoices(3);

    this.heroChoicePanel = this.add.container(0, 0).setDepth(100);

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75);
    this.heroChoicePanel.add(overlay);

    this.heroChoicePanel.add(this.add.text(GAME_WIDTH / 2, 60, '🎲 选择你的英雄塔', {
      fontSize: '28px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FFD700',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5));

    this.heroChoicePanel.add(this.add.text(GAME_WIDTH / 2, 100, '英雄塔可通过击杀获得经验升级，拥有独特技能和属性成长', {
      fontSize: '12px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#AAAAAA',
    }).setOrigin(0.5));

    const cardW = 320;
    const cardH = 380;
    const gap = 30;
    const totalW = choices.length * cardW + (choices.length - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2;

    choices.forEach((hero, i) => {
      const cx = startX + i * (cardW + gap) + cardW / 2;
      const cy = GAME_HEIGHT / 2 + 20;

      // 卡片背景
      const card = this.add.rectangle(cx, cy, cardW, cardH, 0x1a1a2e, 0.95);
      card.setStrokeStyle(2, hero.color, 0.8);
      card.setInteractive({ useHandCursor: true });
      this.heroChoicePanel!.add(card);

      let yOff = cy - cardH / 2 + 15;

      // 英雄名称
      this.heroChoicePanel!.add(this.add.text(cx, yOff, hero.name, {
        fontSize: '24px', fontFamily: 'Microsoft YaHei, sans-serif',
        color: `#${hero.color.toString(16).padStart(6, '0')}`,
      }).setOrigin(0.5));
      yOff += 28;

      // 称号
      this.heroChoicePanel!.add(this.add.text(cx, yOff, hero.title, {
        fontSize: '13px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#888888',
      }).setOrigin(0.5));
      yOff += 22;

      // 颜色预览
      this.heroChoicePanel!.add(this.add.circle(cx, yOff + 5, 12, hero.color));
      yOff += 28;

      // 描述
      this.heroChoicePanel!.add(this.add.text(cx, yOff, hero.description, {
        fontSize: '11px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#CCCCCC',
        wordWrap: { width: cardW - 30 }, align: 'center',
      }).setOrigin(0.5, 0));
      yOff += 36;

      // 属性成长
      const growthText = `力量+${hero.strGrowth} 敏捷+${hero.agiGrowth} 智力+${hero.intGrowth}`;
      this.heroChoicePanel!.add(this.add.text(cx, yOff, growthText, {
        fontSize: '10px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#88AACC',
      }).setOrigin(0.5));
      yOff += 20;

      // 攻击类型
      this.heroChoicePanel!.add(this.add.text(cx, yOff, `攻击: ${hero.baseAttackType}`, {
        fontSize: '10px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#AAAAAA',
      }).setOrigin(0.5));
      yOff += 20;

      // 技能列表
      this.heroChoicePanel!.add(this.add.text(cx, yOff, '── 技能 ──', {
        fontSize: '10px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#666666',
      }).setOrigin(0.5));
      yOff += 16;

      hero.skills.forEach((skill) => {
        this.heroChoicePanel!.add(this.add.text(cx - cardW / 2 + 15, yOff, `• ${skill.name}`, {
          fontSize: '10px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#DDDDAA',
        }));
        this.heroChoicePanel!.add(this.add.text(cx + cardW / 2 - 15, yOff, skill.description.substring(0, 12), {
          fontSize: '9px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#888888',
        }).setOrigin(1, 0));
        yOff += 16;
      });

      yOff += 8;

      // 推荐
      this.heroChoicePanel!.add(this.add.text(cx, yOff, `推荐: ${hero.recommendedSkillOrder}`, {
        fontSize: '9px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#668866',
      }).setOrigin(0.5));
      yOff += 14;

      // 难度
      const diffColors = { easy: '#44FF44', medium: '#FFCC44', hard: '#FF4444' };
      const diffLabels = { easy: '★ 新手推荐', medium: '★★ 中等', hard: '★★★ 困难' };
      this.heroChoicePanel!.add(this.add.text(cx, yOff, diffLabels[hero.difficulty], {
        fontSize: '10px', fontFamily: 'Microsoft YaHei, sans-serif', color: diffColors[hero.difficulty],
      }).setOrigin(0.5));

      // 悬停效果
      card.on('pointerover', () => card.setStrokeStyle(3, 0x44FF44));
      card.on('pointerout', () => card.setStrokeStyle(2, hero.color, 0.8));
      card.on('pointerdown', () => this.selectHero(hero));
    });
  }

  /**
   * 选择英雄后放置到地图上
   */
  private selectHero(heroConfig: HeroTowerConfig): void {
    if (this.heroChoicePanel) {
      this.heroChoicePanel.destroy();
      this.heroChoicePanel = null;
    }

    // 放置在出生点附近的拐角处
    const waypoints = this.pathManager.getWaypoints();
    // 找一个路径拐角旁边的可建造格子
    let bestCol = 5, bestRow = 5;
    for (let r = 2; r < 8; r++) {
      for (let c = 2; c < 8; c++) {
        if (this.gridManager.canBuildAt(c, r)) {
          bestCol = c;
          bestRow = r;
          break;
        }
      }
      if (this.gridManager.canBuildAt(bestCol, bestRow)) break;
    }

    this.gridManager.occupy(bestCol, bestRow);
    this.economyManager.addPopulation();

    this.heroTower = new HeroTower(this, heroConfig, bestCol, bestRow);
    this.heroTower.setEnemies(this.enemies);
    this.heroTower.onProjectileHit = (x, y, damage, splash, atkType, special) => {
      this.handleProjectileHit(x, y, damage, splash, atkType as AttackType, special, null, true);
    };
    this.heroTower.onLevelUp = (hero) => {
      this.showMessage(`⭐ ${hero.getConfig().name} 升至 Lv.${hero.getHeroLevel()}！`);
      soundManager.playUpgrade();
      this.updateHeroHUD();
    };

    this.isPaused = false;
    soundManager.playBuild();
    soundManager.startGameBGM();
    this.showMessage(`${heroConfig.name} 已就位！点击英雄塔查看属性和技能`);
  }

  // ====== 地图绘制 ======

  private drawMap(): void {
    const mapHeight = GAME_HEIGHT - UI_HEIGHT;

    // 背景草地
    this.add.rectangle(GAME_WIDTH / 2, mapHeight / 2, GAME_WIDTH, mapHeight, COLORS.GRASS);

    // 草地纹理 - 多层点缀
    const grassGfx = this.add.graphics();
    // 大块深色草斑
    for (let i = 0; i < 60; i++) {
      const gx = Phaser.Math.Between(0, GAME_WIDTH);
      const gy = Phaser.Math.Between(0, mapHeight);
      grassGfx.fillStyle(0x1a4a1a, 0.2);
      grassGfx.fillCircle(gx, gy, Phaser.Math.Between(4, 10));
    }
    // 小草尖
    for (let i = 0; i < 300; i++) {
      const gx = Phaser.Math.Between(0, GAME_WIDTH);
      const gy = Phaser.Math.Between(0, mapHeight);
      const shade = Phaser.Math.Between(0x20, 0x50);
      grassGfx.fillStyle(Phaser.Display.Color.GetColor(shade, 70 + Phaser.Math.Between(0, 40), shade), 0.25);
      grassGfx.fillCircle(gx, gy, Phaser.Math.Between(1, 2));
    }

    // 绘制路径 - 石砖纹理
    const pathTiles = this.pathManager.getPathTiles();
    pathTiles.forEach((key) => {
      const [col, row] = key.split(',').map(Number);
      if (row * TILE_SIZE < mapHeight) {
        const px = col * TILE_SIZE + TILE_SIZE / 2;
        const py = row * TILE_SIZE + TILE_SIZE / 2;
        // 路面底色
        const rect = this.add.rectangle(px, py, TILE_SIZE, TILE_SIZE, COLORS.PATH);
        rect.setStrokeStyle(0.5, COLORS.PATH_BORDER, 0.3);
        // 石砖线
        const brickGfx = this.add.graphics();
        brickGfx.lineStyle(0.5, 0x000000, 0.08);
        brickGfx.moveTo(px - TILE_SIZE / 2, py);
        brickGfx.lineTo(px + TILE_SIZE / 2, py);
        brickGfx.moveTo(px, py - TILE_SIZE / 2);
        brickGfx.lineTo(px, py + TILE_SIZE / 2);
        brickGfx.strokePath();
      }
    });

    // 出生点标记
    const waypoints = this.pathManager.getWaypoints();
    if (waypoints.length > 0) {
      const spawn = waypoints[0];
      this.add.circle(spawn.x, spawn.y, 10, 0xFF4444, 0.5).setDepth(2);
      this.add.text(spawn.x, spawn.y - 18, '🚩 出生点', {
        fontSize: '10px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FF8888',
      }).setOrigin(0.5).setDepth(2);

      // 路径方向箭头 - 在每条边的中点标注
      const midPoints = [
        { x: GAME_WIDTH / 2, y: waypoints[0].y, text: '→' },
        { x: waypoints.find(w => w.x === waypoints[Math.floor(waypoints.length * 0.25)]?.x)?.x || GAME_WIDTH - 100, y: mapHeight / 2, text: '↓' },
        { x: GAME_WIDTH / 2, y: waypoints.find(w => w.y > mapHeight / 2)?.y || mapHeight - 100, text: '←' },
        { x: waypoints[0].x, y: mapHeight / 2, text: '↑' },
      ];
      midPoints.forEach(mp => {
        this.add.text(mp.x, mp.y, mp.text, {
          fontSize: '20px', color: '#FFFFFF', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(2).setAlpha(0.4);
      });
    }

    // 网格线
    const graphics = this.add.graphics();
    graphics.lineStyle(0.5, COLORS.GRID_LINE, 0.1);
    const cols = Math.floor(GAME_WIDTH / TILE_SIZE);
    const rows = Math.floor(mapHeight / TILE_SIZE);
    for (let col = 0; col <= cols; col++) {
      graphics.moveTo(col * TILE_SIZE, 0);
      graphics.lineTo(col * TILE_SIZE, rows * TILE_SIZE);
    }
    for (let row = 0; row <= rows; row++) {
      graphics.moveTo(0, row * TILE_SIZE);
      graphics.lineTo(cols * TILE_SIZE, row * TILE_SIZE);
    }
    graphics.strokePath();
    graphics.setDepth(1);

    // UI 底部区域
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - UI_HEIGHT / 2, GAME_WIDTH, UI_HEIGHT, 0x111122).setDepth(50);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - UI_HEIGHT, GAME_WIDTH, 2, 0x44ff44, 0.5).setDepth(50);
  }

  // ====== UI ======

  private createUI(): void {
    const uiY = GAME_HEIGHT - UI_HEIGHT;

    // ==== 顶部信息栏 ====
    // 半透明背景
    this.add.rectangle(GAME_WIDTH / 2, 22, GAME_WIDTH, 44, 0x000000, 0.4).setDepth(55);

    this.goldText = this.add.text(10, 8, '💰 100', {
      fontSize: '16px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FFD700',
    }).setDepth(60);

    this.popText = this.add.text(10, 28, '👥 0/20', {
      fontSize: '12px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#88AAFF',
    }).setDepth(60);

    this.scoreText = this.add.text(130, 8, '⭐ 0', {
      fontSize: '14px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FFCC44',
    }).setDepth(60);

    this.woodText = this.add.text(130, 28, '🪵 0', {
      fontSize: '12px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#CC9966',
    }).setDepth(60);

    // 资源交换按钮
    const exchBuyWood = this.add.text(210, 28, '[5000金→10木]', {
      fontSize: '9px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#998866',
      backgroundColor: '#222222', padding: { x: 3, y: 1 },
    }).setDepth(60).setInteractive({ useHandCursor: true });
    exchBuyWood.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      if (this.economyManager.buyWood()) {
        soundManager.playGold();
        this.showMessage('🪵 购买10木材');
        this.updateResourceUI();
      } else {
        soundManager.playError();
        this.showMessage('💰 金钱不足5000');
      }
    });

    const exchBuyPop = this.add.text(315, 28, '[12木→+1人口]', {
      fontSize: '9px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#8888CC',
      backgroundColor: '#222222', padding: { x: 3, y: 1 },
    }).setDepth(60).setInteractive({ useHandCursor: true });
    exchBuyPop.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      if (this.economyManager.buyPopulation()) {
        soundManager.playGold();
        this.showMessage('👥 人口上限+1');
        this.updateResourceUI();
      } else {
        soundManager.playError();
        this.showMessage('🪵 木材不足12');
      }
    });

    this.waveText = this.add.text(GAME_WIDTH / 2, 6, '波次: 0/50', {
      fontSize: '16px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FFFFFF',
    }).setOrigin(0.5, 0).setDepth(60);

    this.nextWaveText = this.add.text(GAME_WIDTH / 2, 26, '按 N 开始第一波', {
      fontSize: '12px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#88FF88',
    }).setOrigin(0.5, 0).setDepth(60);

    this.enemyCountText = this.add.text(GAME_WIDTH - 10, 6, '怪物: 0/100', {
      fontSize: '16px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FF6666',
    }).setOrigin(1, 0).setDepth(60);

    this.pfText = this.add.text(GAME_WIDTH - 10, 26, 'PF: 0', {
      fontSize: '12px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#88CCFF',
    }).setOrigin(1, 0).setDepth(60);

    this.bossTimerText = this.add.text(GAME_WIDTH / 2, 48, '', {
      fontSize: '18px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FF4444',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(60);

    // 速度 & 暂停按钮
    this.speedText = this.add.text(260, 8, '▶ x1', {
      fontSize: '14px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#AAFFAA',
      backgroundColor: '#333344', padding: { x: 6, y: 2 },
    }).setDepth(60).setInteractive({ useHandCursor: true });
    this.speedText.on('pointerdown', () => this.toggleSpeed());

    this.pauseText = this.add.text(320, 8, '⏸', {
      fontSize: '14px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FFAAAA',
      backgroundColor: '#333344', padding: { x: 6, y: 2 },
    }).setDepth(60).setInteractive({ useHandCursor: true });
    this.pauseText.on('pointerdown', () => this.togglePause());

    // 音效开关
    const soundBtn = this.add.text(355, 8, '🔊', {
      fontSize: '14px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#AAFFAA',
      backgroundColor: '#333344', padding: { x: 6, y: 2 },
    }).setDepth(60).setInteractive({ useHandCursor: true });
    soundBtn.on('pointerdown', () => {
      soundManager.setEnabled(!soundManager.isEnabled());
      soundBtn.setText(soundManager.isEnabled() ? '🔊' : '🔇');
    });

    // 帮助按钮
    const helpBtn = this.add.text(395, 8, '❓', {
      fontSize: '14px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#88CCFF',
      backgroundColor: '#333344', padding: { x: 6, y: 2 },
    }).setDepth(60).setInteractive({ useHandCursor: true });
    helpBtn.on('pointerdown', () => this.toggleHelp());

    // 消息
    this.messageText = this.add.text(GAME_WIDTH / 2, 68, '', {
      fontSize: '18px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FFFF00',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(60).setAlpha(0);

    // ==== 底部商店区域 ====
    // 深色背景+上边缘高光
    const shopBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - UI_HEIGHT / 2, GAME_WIDTH, UI_HEIGHT, 0x0a0a18, 0.95).setDepth(50);
    const shopTopLine = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - UI_HEIGHT, GAME_WIDTH, 2, 0x44FF44, 0.3).setDepth(51);
    // 底部渐变暗角
    const bottomFade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 2, GAME_WIDTH, 4, 0x000000, 0.5).setDepth(50);
    this.createShop(uiY);

    // ==== 信息面板 ====
    this.createInfoPanel();

    // ==== 英雄 HUD (左侧) ====
    this.createHeroHUD();
  }

  private createHeroHUD(): void {
    this.heroHUD = this.add.container(8, GAME_HEIGHT - UI_HEIGHT - 75).setDepth(57);
    this.heroHUD.setVisible(false);

    const bg = this.add.rectangle(75, 28, 150, 56, 0x111122, 0.9);
    bg.setStrokeStyle(1, 0xFFD700, 0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      // 点击 HUD 定位到英雄塔
      if (this.heroTower?.active) {
        this.cancelSelection();
        this.heroTower.select();
        this.showHeroTowerInfo();
      }
    });
    this.heroHUD.add(bg);

    // 英雄名字+等级
    const nameT = this.add.text(6, 6, '', {
      fontSize: '11px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FFD700', fontStyle: 'bold',
    });
    this.heroHUD.add(nameT);
    this.heroHUDTexts.push(nameT);

    // 属性
    const statsT = this.add.text(6, 22, '', {
      fontSize: '9px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#AAAACC',
    });
    this.heroHUD.add(statsT);
    this.heroHUDTexts.push(statsT);

    // 伤害/攻速
    const dmgT = this.add.text(6, 34, '', {
      fontSize: '9px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#88FF88',
    });
    this.heroHUD.add(dmgT);
    this.heroHUDTexts.push(dmgT);

    // 经验条
    const expBg = this.add.rectangle(75, 50, 140, 4, 0x333333);
    this.heroHUD.add(expBg);
    this.heroExpBar = this.add.rectangle(5, 50, 0, 4, 0x44CCFF);
    this.heroExpBar.setOrigin(0, 0.5);
    this.heroHUD.add(this.heroExpBar);
  }

  private updateHeroHUD(): void {
    if (!this.heroTower?.active) {
      this.heroHUD.setVisible(false);
      return;
    }
    this.heroHUD.setVisible(true);
    const hero = this.heroTower;
    const config = hero.getConfig();
    const pointTag = hero.hasPointsToSpend() ? ' 🔴' : '';

    this.heroHUDTexts[0].setText(`${config.name} Lv.${hero.getHeroLevel()}${pointTag}`);
    this.heroHUDTexts[1].setText(`💪${hero.getStr()} 🏃${hero.getAgi()} 🧠${hero.getInt()}`);
    this.heroHUDTexts[2].setText(`⚔️${hero.getDamage()} ⏱${(hero.getAttackSpeed() / 1000).toFixed(2)}s 🏆${hero.getKillCount()}`);

    const ratio = hero.getExperience() / hero.getExpToNext();
    this.heroExpBar.width = 140 * ratio;
  }

  private createShop(uiY: number): void {
    const configs = Object.values(TOWER_CONFIGS);
    const btnW = 150;
    const btnH = 56;
    const gap = 4;
    const startX = 4;
    const startY = uiY + 8;

    configs.forEach((config, i) => {
      const col = i % SHOP_COLS;
      const row = Math.floor(i / SHOP_COLS);
      const x = startX + col * (btnW + gap);
      const y = startY + row * (btnH + gap);

      const container = this.add.container(x, y).setDepth(55);

      const bg = this.add.rectangle(btnW / 2, btnH / 2, btnW, btnH, 0x222233, 0.95);
      bg.setStrokeStyle(1, 0x444466);
      bg.setInteractive({ useHandCursor: true });
      container.add(bg);

      // 塔颜色块
      const preview = this.add.rectangle(16, btnH / 2, 22, 22, config.color);
      preview.setStrokeStyle(1, 0x888888, 0.5);
      container.add(preview);

      // 攻击类型小标记
      const atkColor = this.getAttackTypeColor(config.attackType);
      const atkDot = this.add.circle(16, btnH / 2 - 14, 3, atkColor);
      container.add(atkDot);

      // 塔名
      container.add(this.add.text(34, 6, config.name, {
        fontSize: '12px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FFFFFF',
      }));

      // 价格
      container.add(this.add.text(34, 22, `💰${config.cost}`, {
        fontSize: '10px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FFD700',
      }));

      // 简短描述
      const shortDesc = config.splash > 0 ? `${this.getAttackTypeLabel(config.attackType)} AOE` : this.getAttackTypeLabel(config.attackType);
      container.add(this.add.text(34, 38, shortDesc, {
        fontSize: '9px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#888899',
      }));

      // 快捷键
      if (i < 9) {
        container.add(this.add.text(btnW - 6, 4, `${i + 1}`, {
          fontSize: '9px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#555566',
        }).setOrigin(1, 0));
      } else {
        container.add(this.add.text(btnW - 6, 4, '0', {
          fontSize: '9px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#555566',
        }).setOrigin(1, 0));
      }

      bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        soundManager.playClick();
        this.selectTowerToBuild(config, i);
      });
      bg.on('pointerover', () => {
        bg.setStrokeStyle(2, 0x44FF44);
        soundManager.playHover();
        // Tooltip
        const special = config.special ? ` [${config.special}]` : '';
        const atkLabel = this.getAttackTypeLabel(config.attackType);
        const splashInfo = config.splash > 0 ? ` | AOE ${config.splash}px` : '';
        const tip = `${config.name} - ${config.description}\n${atkLabel}${special} | 伤害${config.damage} | 射程${config.range} | 攻速${(config.attackSpeed / 1000).toFixed(1)}s${splashInfo}`;
        this.showMessage(tip.split('\n')[0]);
      });
      bg.on('pointerout', () => {
        const isSelected = this.selectedTowerConfig?.id === config.id;
        bg.setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0x44FF44 : 0x444466);
      });

      // 存储引用
      (container as any)._bg = bg;
      (container as any)._config = config;
      this.shopButtons.push(container);
    });
  }

  private updateShopAffordability(): void {
    for (const btn of this.shopButtons) {
      const config = (btn as any)._config as TowerConfig;
      const bg = (btn as any)._bg as Phaser.GameObjects.Rectangle;
      const canAfford = this.economyManager.canAfford(config.cost);
      btn.setAlpha(canAfford ? 1 : 0.5);
    }
  }

  private getAttackTypeLabel(type: AttackType): string {
    const labels: Record<string, string> = {
      [AttackType.NORMAL]: '普通攻击',
      [AttackType.PIERCE]: '穿刺攻击',
      [AttackType.MAGIC]: '魔法攻击',
      [AttackType.SIEGE]: '攻城攻击',
      [AttackType.CHAOS]: '混乱攻击',
      [AttackType.HERO]: '英雄攻击',
      [AttackType.HOLY]: '神圣攻击',
    };
    return labels[type] || type;
  }

  private getAttackTypeColor(type: AttackType): number {
    const colors: Record<string, number> = {
      [AttackType.NORMAL]: 0xCCCCCC,
      [AttackType.PIERCE]: 0x44AAFF,
      [AttackType.MAGIC]: 0xAA44FF,
      [AttackType.SIEGE]: 0xFF8844,
      [AttackType.CHAOS]: 0xFF4444,
      [AttackType.HERO]: 0xFFD700,
      [AttackType.HOLY]: 0xFFFFAA,
    };
    return colors[type] || 0xCCCCCC;
  }

  private createInfoPanel(): void {
    this.infoPanel = this.add.container(GAME_WIDTH - 210, 48).setDepth(58);
    this.infoPanel.setVisible(false);

    const panelW = 200;
    const panelH = 310;
    const bg = this.add.rectangle(panelW / 2, panelH / 2, panelW, panelH, 0x111122, 0.95);
    bg.setStrokeStyle(1.5, 0x44FF44, 0.7);
    bg.setInteractive(); // 吞掉点击，防止穿透到地图
    bg.on('pointerdown', (p: Phaser.Input.Pointer) => p.event.stopPropagation());
    this.infoPanel.add(bg);

    // 文本行（11行）
    for (let i = 0; i < 11; i++) {
      const t = this.add.text(8, 6 + i * 16, '', {
        fontSize: '11px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FFFFFF',
      });
      this.infoPanel.add(t);
      this.infoPanelTexts.push(t);
    }

    // 属性加点按钮 (在面板底部)
    const btnY = panelH - 70;
    const btnLabels = ['力+5', '敏+5', '智+5'];
    const btnColors = [0x884422, 0x228844, 0x224488];
    btnLabels.forEach((label, i) => {
      const bx = 15 + i * 62;
      const btn = this.add.rectangle(bx + 24, btnY, 52, 20, btnColors[i], 0.9);
      btn.setStrokeStyle(1, 0x888888);
      btn.setInteractive({ useHandCursor: true });
      this.infoPanel.add(btn);
      const lbl = this.add.text(bx + 24, btnY, label, {
        fontSize: '10px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FFFFFF',
      }).setOrigin(0.5);
      this.infoPanel.add(lbl);
      btn.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        if (!this.heroTower) return;
        const shiftKey = this.input.keyboard?.addKey('SHIFT');
        const amount = shiftKey?.isDown ? 1 : 5;
        const pts = Math.min(amount, this.heroTower.getFreePoints());
        if (pts <= 0) { soundManager.playError(); return; }
        let ok = false;
        for (let a = 0; a < pts; a++) {
          if (i === 0) ok = this.heroTower.addStr(1) || ok;
          else if (i === 1) ok = this.heroTower.addAgi(1) || ok;
          else ok = this.heroTower.addInt(1) || ok;
        }
        if (ok) {
          soundManager.playGold();
          this.showHeroTowerInfo();
        } else {
          soundManager.playError();
        }
      });
    });

    // 技能按钮 (4个)
    const skillBtnY = panelH - 38;
    for (let si = 0; si < 4; si++) {
      const sx = 10 + si * 47;
      const skillBtn = this.add.rectangle(sx + 20, skillBtnY, 42, 22, 0x333355, 0.9);
      skillBtn.setStrokeStyle(1, 0x666688);
      skillBtn.setInteractive({ useHandCursor: true });
      this.infoPanel.add(skillBtn);
      const skillLbl = this.add.text(sx + 20, skillBtnY, `S${si + 1}`, {
        fontSize: '9px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#AAAACC',
      }).setOrigin(0.5);
      this.infoPanel.add(skillLbl);

      // 悬停 tooltip
      skillBtn.on('pointerover', () => {
        skillBtn.setStrokeStyle(1.5, 0x44FF44);
        if (this.heroTower) {
          const sk = this.heroTower.getConfig().skills[si];
          if (sk) this.showMessage(`${sk.name}: ${sk.description}`);
        }
      });
      skillBtn.on('pointerout', () => skillBtn.setStrokeStyle(1, 0x666688));

      skillBtn.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        if (!this.heroTower) return;
        if (this.heroTower.learnSkill(si)) {
          soundManager.playUpgrade();
          const sk = this.heroTower.getConfig().skills[si];
          const lv = this.heroTower.getSkillLevel(si);
          this.showMessage(`✨ ${sk.name} → Lv.${lv}！${sk.description}`);
          this.showHeroTowerInfo();
          this.updateHeroHUD();
        } else {
          if (this.heroTower.getSkillPoints() <= 0) {
            this.showMessage('⛔ 没有技能点');
          } else {
            this.showMessage('⛔ 该技能已满级');
          }
          soundManager.playError();
        }
      });
    }

    // 普通塔按钮区域
    const upgBtnY = panelH - 10;
    const upgradeBtn = this.add.rectangle(50, upgBtnY, 70, 20, 0x336633, 0.9);
    upgradeBtn.setStrokeStyle(1, 0x44FF44);
    upgradeBtn.setInteractive({ useHandCursor: true });
    this.infoPanel.add(upgradeBtn);
    this.infoPanel.add(this.add.text(50, upgBtnY, '升级[U]', {
      fontSize: '10px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#44FF44',
    }).setOrigin(0.5));
    upgradeBtn.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      if (this.selectedTower) this.upgradeTower(this.selectedTower);
    });

    const sellBtn = this.add.rectangle(140, upgBtnY, 70, 20, 0x663333, 0.9);
    sellBtn.setStrokeStyle(1, 0xFF4444);
    sellBtn.setInteractive({ useHandCursor: true });
    this.infoPanel.add(sellBtn);
    this.infoPanel.add(this.add.text(140, upgBtnY, '出售[S]', {
      fontSize: '10px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FF4444',
    }).setOrigin(0.5));
    sellBtn.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      if (this.selectedTower) this.sellTower(this.selectedTower);
    });
  }

  // ====== 输入 ======

  private setupInput(): void {
    // 地图点击
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y >= GAME_HEIGHT - UI_HEIGHT) return;
      if (this.isGameOver) return;

      // 信息面板可见时，点击面板区域不处理
      if (this.infoPanel.visible) {
        const panelX = GAME_WIDTH - 210;
        const panelY = 48;
        if (pointer.x >= panelX && pointer.x <= panelX + 200 &&
            pointer.y >= panelY && pointer.y <= panelY + 310) {
          return;
        }
      }

      // 英雄 HUD 区域不处理
      if (this.heroHUD.visible) {
        const hudX = 8, hudY = GAME_HEIGHT - UI_HEIGHT - 75;
        if (pointer.x >= hudX && pointer.x <= hudX + 150 &&
            pointer.y >= hudY && pointer.y <= hudY + 56) {
          return;
        }
      }

      if (this.selectedTowerConfig) {
        this.tryPlaceTower(pointer.x, pointer.y);
        return;
      }

      // 英雄移动模式
      if (this.heroTower?.getIsMoving()) {
        this.tryMoveHero(pointer.x, pointer.y);
        return;
      }

      // 检查是否点击了塔
      const { col, row } = this.gridManager.pixelToGrid(pointer.x, pointer.y);

      // 检查英雄塔
      if (this.heroTower?.active && this.heroTower.getGridCol() === col && this.heroTower.getGridRow() === row) {
        this.cancelSelection();
        this.heroTower.select();
        this.selectedTower = null;
        this.showHeroTowerInfo();
        return;
      }

      const clickedTower = this.towers.find(t => t.getGridCol() === col && t.getGridRow() === row);
      if (clickedTower) {
        this.selectExistingTower(clickedTower);
      } else {
        this.cancelSelection();
      }
    });

    // 鼠标移动
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.selectedTowerConfig && pointer.y < GAME_HEIGHT - UI_HEIGHT) {
        this.updatePlacementGhost(pointer.x, pointer.y);
      } else {
        this.clearPlacementGhost();
      }
    });

    // 键盘
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-N', () => {
        if (!this.isPaused) this.waveManager.forceNextWave();
      });
      this.input.keyboard.on('keydown-ESC', () => this.cancelSelection());
      this.input.keyboard.on('keydown-SPACE', () => this.toggleSpeed());
      this.input.keyboard.on('keydown-P', () => this.togglePause());
      this.input.keyboard.on('keydown-H', () => this.toggleHelp());
      this.input.keyboard.on('keydown-M', () => this.startHeroMove());
      this.input.keyboard.on('keydown-U', () => {
        if (this.selectedTower) this.upgradeTower(this.selectedTower);
      });
      this.input.keyboard.on('keydown-S', () => {
        if (this.selectedTower) this.sellTower(this.selectedTower);
      });

      // 数字键快捷选塔 1-9, 0
      const configs = Object.values(TOWER_CONFIGS);
      for (let i = 0; i < 10; i++) {
        const key = i === 9 ? 'ZERO' : `${i + 1}` as any;
        this.input.keyboard.on(`keydown-${i === 9 ? 'ZERO' : (i + 1).toString()}`, () => {
          if (i < configs.length) {
            this.selectTowerToBuild(configs[i], i);
          }
        });
      }
    }
  }

  // ====== 选择逻辑 ======

  private selectTowerToBuild(config: TowerConfig, shopIndex: number): void {
    if (this.selectedTower) {
      this.selectedTower.deselect();
      this.selectedTower = null;
    }
    this.infoPanel.setVisible(false);

    if (this.selectedTowerConfig?.id === config.id) {
      this.cancelSelection();
      return;
    }

    this.selectedTowerConfig = config;
    this.highlightShopButton(shopIndex);

    if (!this.economyManager.canAfford(config.cost)) {
      this.showMessage(`💰不足！${config.name} 需要 ${config.cost} 金`);
      return;
    }
    if (!this.economyManager.canBuild()) {
      this.showMessage('👥 人口已满！无法建造');
      return;
    }

    this.showMessage(`${config.name} (💰${config.cost}) - 点击地图放置 | ESC取消 | Shift连续建造`);
  }

  private selectExistingTower(tower: Tower): void {
    this.cancelSelection();
    this.selectedTower = tower;
    tower.select();
    this.showTowerInfo(tower);
  }

  private highlightShopButton(index: number): void {
    // 清除旧高亮
    for (const btn of this.shopButtons) {
      const bg = (btn as any)._bg as Phaser.GameObjects.Rectangle;
      bg.setStrokeStyle(1, 0x444466);
    }
    if (index >= 0 && index < this.shopButtons.length) {
      const bg = (this.shopButtons[index] as any)._bg as Phaser.GameObjects.Rectangle;
      bg.setStrokeStyle(2, 0x44FF44);
    }
  }

  private cancelSelection(): void {
    this.selectedTowerConfig = null;
    if (this.selectedTower) {
      this.selectedTower.deselect();
      this.selectedTower = null;
    }
    if (this.heroTower) {
      this.heroTower.deselect();
      this.heroTower.cancelMoving();
    }
    this.clearPlacementGhost();
    this.infoPanel.setVisible(false);
    this.highlightShopButton(-1);
  }

  private clearPlacementGhost(): void {
    if (this.placementGhost) {
      this.placementGhost.destroy();
      this.placementGhost = null;
    }
    if (this.rangePreview) {
      this.rangePreview.destroy();
      this.rangePreview = null;
    }
  }

  // ====== 放置 ======

  private updatePlacementGhost(px: number, py: number): void {
    const { col, row } = this.gridManager.pixelToGrid(px, py);
    const { x, y } = this.gridManager.gridToPixel(col, row);
    const canBuild = this.gridManager.canBuildAt(col, row) && this.economyManager.canBuild();

    if (!this.placementGhost) {
      this.placementGhost = this.add.rectangle(x, y, TILE_SIZE - 2, TILE_SIZE - 2);
      this.placementGhost.setDepth(20);
    }
    this.placementGhost.setPosition(x, y);
    this.placementGhost.setFillStyle(canBuild ? 0x44FF44 : 0xFF4444, 0.35);
    this.placementGhost.setStrokeStyle(1.5, canBuild ? 0x44FF44 : 0xFF4444);

    if (this.selectedTowerConfig) {
      if (!this.rangePreview) {
        this.rangePreview = this.add.circle(x, y, this.selectedTowerConfig.range);
        this.rangePreview.setStrokeStyle(1, 0xFFFFFF, 0.25);
        this.rangePreview.setFillStyle(0xFFFFFF, 0.04);
        this.rangePreview.setDepth(3);
      }
      this.rangePreview.setPosition(x, y);
    }
  }

  private tryPlaceTower(px: number, py: number): void {
    if (!this.selectedTowerConfig) return;

    const { col, row } = this.gridManager.pixelToGrid(px, py);

    if (!this.gridManager.canBuildAt(col, row)) {
      this.showMessage('⛔ 无法在此处建造');
      soundManager.playError();
      return;
    }
    if (!this.economyManager.canAfford(this.selectedTowerConfig.cost)) {
      this.showMessage('💰 金钱不足');
      soundManager.playError();
      return;
    }
    if (!this.economyManager.canBuild()) {
      this.showMessage('👥 人口已满');
      soundManager.playError();
      return;
    }

    this.economyManager.spendGold(this.selectedTowerConfig.cost);
    this.economyManager.addPopulation();
    this.gridManager.occupy(col, row);

    const tower = new Tower(this, this.selectedTowerConfig, col, row);
    tower.setEnemies(this.enemies);
    tower.onProjectileHit = (x, y, damage, splash, atkType, special) => {
      this.handleProjectileHit(x, y, damage, splash, atkType as AttackType, special, tower);
    };
    this.towers.push(tower);

    // 建造特效
    this.spawnBuildEffect(col, row);
    soundManager.playBuild();
    this.showMessage(`✅ ${this.selectedTowerConfig.name} 已建造`);

    // Shift 连续建造
    const shiftKey = this.input.keyboard?.addKey('SHIFT');
    if (!shiftKey || !shiftKey.isDown) {
      this.cancelSelection();
    }
  }

  private startHeroMove(): void {
    if (!this.heroTower?.active) {
      this.showMessage('⛔ 没有英雄塔');
      return;
    }
    this.cancelSelection();
    this.heroTower.startMoving();
    this.heroTower.select();
    this.showMessage('🔄 点击新位置移动英雄塔 | ESC取消');
  }

  private tryMoveHero(px: number, py: number): void {
    if (!this.heroTower) return;
    const { col, row } = this.gridManager.pixelToGrid(px, py);

    if (!this.gridManager.canBuildAt(col, row)) {
      this.showMessage('⛔ 无法移动到此位置');
      soundManager.playError();
      return;
    }

    // 释放旧位置
    this.gridManager.release(this.heroTower.getGridCol(), this.heroTower.getGridRow());
    // 占用新位置
    this.gridManager.occupy(col, row);
    // 移动
    this.heroTower.relocate(col, row);
    soundManager.playBuild();
    this.showMessage(`✅ ${this.heroTower.getConfig().name} 已移动`);
    this.showHeroTowerInfo();
  }

  private spawnBuildEffect(col: number, row: number): void {
    const { x, y } = this.gridManager.gridToPixel(col, row);
    for (let i = 0; i < 6; i++) {
      const particle = this.add.circle(
        x + Phaser.Math.Between(-8, 8),
        y + Phaser.Math.Between(-8, 8),
        Phaser.Math.Between(2, 4),
        0x44FF44, 0.8,
      ).setDepth(25);
      this.tweens.add({
        targets: particle,
        y: particle.y - Phaser.Math.Between(15, 30),
        alpha: 0,
        scale: 0,
        duration: 400 + Phaser.Math.Between(0, 200),
        onComplete: () => particle.destroy(),
      });
    }
  }

  // ====== 伤害 ======

  private handleProjectileHit(
    x: number, y: number,
    baseDamage: number, splash: number,
    attackType: AttackType, special: string | undefined,
    tower: Tower | null, isHeroAttack: boolean = false,
  ): void {
    const calcDmg = (enemy: Enemy): number => {
      let dmg = calculateDamage(baseDamage, attackType, enemy.getConfig().armorType, enemy.getEffectiveArmor());
      // 魔免：魔法攻击类型伤害降低 70%
      if (enemy.isMagicImmune() && attackType === AttackType.MAGIC) {
        dmg = Math.floor(dmg * 0.3);
      }
      return dmg;
    };

    if (splash > 0) {
      const ring = this.add.circle(x, y, splash, 0xFFAA00, 0.15).setDepth(12);
      ring.setStrokeStyle(1, 0xFFAA00, 0.4);
      this.tweens.add({ targets: ring, alpha: 0, scale: 1.3, duration: 300, onComplete: () => ring.destroy() });

      for (const enemy of this.enemies) {
        if (enemy.isDying() || !enemy.active) continue;
        const dist = distanceBetween(x, y, enemy.x, enemy.y);
        if (dist <= splash) {
          enemy.takeDamage(calcDmg(enemy));
          this.applySpecialEffect(enemy, special, baseDamage);
          if (enemy.isDying()) {
            if (isHeroAttack) this.heroTower?.addKill();
            else tower?.addKill();
          }
        }
      }
    } else {
      let closest: Enemy | null = null;
      let closestDist = 40;
      for (const enemy of this.enemies) {
        if (enemy.isDying() || !enemy.active) continue;
        const dist = distanceBetween(x, y, enemy.x, enemy.y);
        if (dist < closestDist) { closestDist = dist; closest = enemy; }
      }
      if (closest) {
        const dmg = calcDmg(closest);
        closest.takeDamage(dmg);
        this.showDamageNumber(closest.x, closest.y, dmg);
        this.applySpecialEffect(closest, special, baseDamage);
        if (closest.isDying()) {
          if (isHeroAttack) this.heroTower?.addKill();
          else tower?.addKill();
        }
      }
    }
  }

  private showDamageNumber(x: number, y: number, dmg: number): void {
    // 只对大伤害显示数字，避免过多
    if (dmg < 15) return;
    const color = dmg >= 50 ? '#FF4444' : dmg >= 30 ? '#FFAA44' : '#FFFFFF';
    const text = this.add.text(x, y - 10, `-${dmg}`, {
      fontSize: dmg >= 50 ? '14px' : '11px',
      fontFamily: 'Arial',
      color,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(30);

    this.damageTexts.push({ text, timer: 800 });
    this.tweens.add({
      targets: text,
      y: text.y - 25,
      alpha: 0,
      duration: 800,
      onComplete: () => text.destroy(),
    });
  }

  private applySpecialEffect(enemy: Enemy, special: string | undefined, baseDamage: number): void {
    if (!special) return;
    switch (special) {
      case 'slow':
        enemy.applySlow(0.3, 2000);
        break;
      case 'freeze_aura':
        enemy.applySlow(0.5, 1500);
        break;
      case 'poison':
        enemy.applyPoison(Math.floor(baseDamage * 0.5), 4000);
        break;
      case 'chain':
        this.chainLightning(enemy, baseDamage * 0.6, 3);
        break;
      case 'armor_reduce':
        // 腐蚀降甲：降低护甲值 3 点持续 5 秒，使其受到更多伤害
        enemy.applyArmorReduce(3, 5000);
        enemy.takeDamage(Math.floor(baseDamage * 0.15));
        break;
      case 'critical':
        // 暴击已在 HeroTower.fireAt 中处理
        break;
    }
  }

  private chainLightning(from: Enemy, damage: number, jumps: number): void {
    if (jumps <= 0) return;
    const hitSet = new Set<Enemy>([from]);
    let current = from;

    for (let i = 0; i < jumps; i++) {
      let nearest: Enemy | null = null;
      let nearestDist = 120;

      for (const enemy of this.enemies) {
        if (enemy.isDying() || !enemy.active || hitSet.has(enemy)) continue;
        const dist = distanceBetween(current.x, current.y, enemy.x, enemy.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = enemy;
        }
      }

      if (nearest) {
        nearest.takeDamage(Math.floor(damage));
        hitSet.add(nearest);

        // 闪电效果 - 双层（外层发光+内层亮白）
        const sx = current.x, sy = current.y;
        const ex = nearest.x, ey = nearest.y;
        const segments = 5;

        // 计算锯齿路径
        const points: { x: number; y: number }[] = [{ x: sx, y: sy }];
        for (let s = 1; s < segments; s++) {
          const t = s / segments;
          points.push({
            x: sx + (ex - sx) * t + Phaser.Math.Between(-10, 10),
            y: sy + (ey - sy) * t + Phaser.Math.Between(-10, 10),
          });
        }
        points.push({ x: ex, y: ey });

        // 外层发光（蓝色宽线）
        const glowGfx = this.add.graphics().setDepth(16);
        glowGfx.lineStyle(4, 0x4488FF, 0.4);
        glowGfx.moveTo(points[0].x, points[0].y);
        for (let p = 1; p < points.length; p++) glowGfx.lineTo(points[p].x, points[p].y);
        glowGfx.strokePath();

        // 内层高亮（白色细线）
        const coreGfx = this.add.graphics().setDepth(17);
        coreGfx.lineStyle(1.5, 0xFFFFFF, 0.9);
        coreGfx.moveTo(points[0].x, points[0].y);
        for (let p = 1; p < points.length; p++) coreGfx.lineTo(points[p].x, points[p].y);
        coreGfx.strokePath();

        // 击中火花
        const spark = this.add.circle(ex, ey, 6, 0xFFFF88, 0.7).setDepth(18);
        this.tweens.add({ targets: spark, scale: 0, alpha: 0, duration: 150, onComplete: () => spark.destroy() });

        this.time.delayedCall(150, () => { glowGfx.destroy(); coreGfx.destroy(); });

        current = nearest;
        damage *= 0.7;
      }
    }
  }

  // ====== 生成怪物 ======

  private spawnEnemy(enemyId: string): void {
    const config = ENEMY_CONFIGS[enemyId];
    if (!config) return;

    const waveNum = this.waveManager.getCurrentWave();
    let hpMultiplier = (1 + (waveNum - 1) * 0.15) * this.diffHpMul;

    // 无尽模式额外缩放
    if (this.waveManager.getGameMode() === 'endless') {
      hpMultiplier *= this.waveManager.getEndlessScaling();
    }

    const enemy = new Enemy(this, config, this.pathManager, hpMultiplier);
    enemy.onDeath = (e) => this.onEnemyDeath(e);
    this.enemies.push(enemy);

    for (const tower of this.towers) {
      tower.setEnemies(this.enemies);
    }
    if (this.heroTower?.active) {
      this.heroTower.setEnemies(this.enemies);
    }
    this.updateEnemyCountUI();
  }

  private onEnemyDeath(enemy: Enemy): void {
    this.economyManager.onEnemyKilled(enemy.getConfig().goldReward);

    const isBoss = enemy.getConfig().isBoss;
    if (isBoss) {
      soundManager.playBossDeath();
      this.spawnBossDeathEffect(enemy.x, enemy.y);
    } else {
      soundManager.playEnemyDeath();
    }

    // 英雄塔获得经验
    if (this.heroTower?.active) {
      this.heroTower.addExperience(1 + Math.floor(enemy.getConfig().goldReward * 0.5));
    }

    // 死亡粒子
    this.spawnDeathEffect(enemy.x, enemy.y, enemy.getConfig().color);

    const idx = this.enemies.indexOf(enemy);
    if (idx !== -1) this.enemies.splice(idx, 1);

    this.waveManager.onEnemyDied();
    this.updateEnemyCountUI();
  }

  private spawnBossDeathEffect(x: number, y: number): void {
    // 多波爆炸
    for (let wave = 0; wave < 3; wave++) {
      this.time.delayedCall(wave * 200, () => {
        const ring = this.add.circle(x, y, 10, 0xFFAA00, 0.5).setDepth(25);
        ring.setStrokeStyle(3, 0xFF4400);
        this.tweens.add({
          targets: ring, scale: 5, alpha: 0, duration: 500,
          onComplete: () => ring.destroy(),
        });
        // 碎片
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const p = this.add.circle(x, y, Phaser.Math.Between(2, 5),
            Phaser.Math.Between(0xFF4400, 0xFFFF00), 0.9).setDepth(26);
          this.tweens.add({
            targets: p,
            x: x + Math.cos(angle) * Phaser.Math.Between(30, 60),
            y: y + Math.sin(angle) * Phaser.Math.Between(30, 60),
            alpha: 0, scale: 0, duration: 600 + Phaser.Math.Between(0, 300),
            onComplete: () => p.destroy(),
          });
        }
      });
    }
    // 震屏
    this.cameras.main.shake(400, 0.008);
    // Boss击杀文字
    const txt = this.add.text(x, y - 20, '💀 BOSS KILLED!', {
      fontSize: '16px', color: '#FFD700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: txt, y: txt.y - 40, alpha: 0, duration: 1500, onComplete: () => txt.destroy() });
  }

  private spawnDeathEffect(x: number, y: number, color: number): void {
    for (let i = 0; i < 5; i++) {
      const p = this.add.circle(
        x + Phaser.Math.Between(-4, 4),
        y + Phaser.Math.Between(-4, 4),
        Phaser.Math.Between(1, 3), color, 0.7,
      ).setDepth(12);
      this.tweens.add({
        targets: p,
        x: p.x + Phaser.Math.Between(-20, 20),
        y: p.y + Phaser.Math.Between(-20, 20),
        alpha: 0, scale: 0,
        duration: 300 + Phaser.Math.Between(0, 200),
        onComplete: () => p.destroy(),
      });
    }
    // 金钱飘字
    const goldTxt = this.add.text(x, y - 5, '+💰', {
      fontSize: '10px', color: '#FFD700',
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({
      targets: goldTxt,
      y: goldTxt.y - 15, alpha: 0,
      duration: 600,
      onComplete: () => goldTxt.destroy(),
    });
  }

  // ====== 波次事件 ======

  private onWaveStart(waveNum: number, config: WaveConfig): void {
    this.economyManager.setCurrentWave(waveNum);

    const mode = this.waveManager.getGameMode();
    let waveLabel = '';
    if (mode === 'hidden') {
      waveLabel = `🌟 隐藏关: ${waveNum - 50}/10`;
    } else if (mode === 'endless') {
      const scaling = Math.round(this.waveManager.getEndlessScaling() * 100);
      waveLabel = `♾️ 无尽 #${waveNum - 60} (x${scaling}%)`;
    } else {
      waveLabel = `波次: ${waveNum}/50`;
    }
    this.waveText.setText(waveLabel);
    this.nextWaveText.setText('');

    if (config.isBossWave) {
      this.showMessage(`⚠️ 第 ${waveNum} 波 - BOSS 来袭！限时击杀！`);
      this.cameras.main.shake(300, 0.005);
      soundManager.playBossAlert();
      soundManager.startBossBGM();
    } else if (mode === 'hidden') {
      this.showMessage(`🌟 隐藏关 第 ${waveNum - 50} 波`);
      soundManager.playWaveStart();
    } else if (mode === 'endless') {
      this.showMessage(`♾️ 无尽模式 第 ${waveNum - 60} 波 (强度x${Math.round(this.waveManager.getEndlessScaling() * 100)}%)`);
      soundManager.playWaveStart();
    } else {
      this.showMessage(`第 ${waveNum} 波开始`);
      soundManager.playWaveStart();
    }

    // 波次横幅动画
    this.showWaveBanner(waveNum);
  }

  private onWaveComplete(waveNum: number): void {
    this.showMessage(`✅ 第 ${waveNum} 波完成！+1 PF`);
    soundManager.startGameBGM(); // 恢复正常 BGM
    // 预览下一波
    const nextWaveIdx = waveNum; // waveNum is 1-based, array is 0-based
    if (nextWaveIdx < WAVE_CONFIGS.length) {
      const nextWave = WAVE_CONFIGS[nextWaveIdx];
      const preview = nextWave.enemies.map((g) => {
        const ec = ENEMY_CONFIGS[g.enemyId];
        return ec ? `${ec.name}×${g.count}` : g.enemyId;
      }).join(' + ');
      const bossTag = nextWave.isBossWave ? ' ⚠️BOSS' : '';
      this.nextWaveText.setText(`下一波: ${preview}${bossTag} | 按 N 提前开始`);
    } else {
      this.nextWaveText.setText('最终波次已完成！');
    }
  }

  private onPFGained(totalPF: number): void {
    this.pfText.setText(`PF: ${totalPF}`);
  }

  private onVictory(): void {
    this.isGameOver = true;
    const mode = this.waveManager.getGameMode();
    if (mode === 'hidden') {
      this.showMessage('🌟 隐藏关全部通过！终极胜利！');
    } else {
      this.showMessage('🎉 恭喜通关！');
    }
    this.cameras.main.flash(1000, 68, 255, 68);
    soundManager.stopBGM();
    soundManager.playVictory();

    this.time.delayedCall(3000, () => {
      this.scene.start('GameOverScene', {
        victory: true,
        wave: this.waveManager.getCurrentWave(),
        score: this.economyManager.getScore(),
        kills: this.economyManager.getTotalKills(),
        pf: this.waveManager.getPFPoints(),
        difficulty: this.difficulty,
      });
    });
  }

  private onGameOver(reason: string): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.showMessage(`💀 游戏结束：${reason}`);
    this.cameras.main.shake(500, 0.01);
    soundManager.stopBGM();
    soundManager.playGameOver();

    this.time.delayedCall(3000, () => {
      this.scene.start('GameOverScene', {
        victory: false,
        wave: this.waveManager.getCurrentWave(),
        score: this.economyManager.getScore(),
        kills: this.economyManager.getTotalKills(),
        pf: this.waveManager.getPFPoints(),
        reason,
        difficulty: this.difficulty,
      });
    });
  }

  // ====== 塔信息面板 ======

  private showHeroTowerInfo(): void {
    if (!this.heroTower) return;
    this.infoPanel.setVisible(true);
    const hero = this.heroTower;
    const config = hero.getConfig();

    const skillLines = config.skills.map((s, i) => {
      const lv = hero.getSkillLevel(i);
      const canLearn = hero.canLearnSkill(i);
      const tag = canLearn ? ' ✅' : '';
      let cdInfo = '';
      if (s.isActive && lv > 0) {
        const cd = hero.getActiveSkillCD(s.id);
        if (cd && cd.remaining > 0) {
          cdInfo = ` ⏱${Math.ceil(cd.remaining / 1000)}s`;
        } else {
          cdInfo = ' 🟢';
        }
      }
      const prefix = lv > 0 ? (s.isActive ? '🔶' : '✨') : '○';
      return `${prefix} ${s.name} ${lv}/${s.maxLevel}${cdInfo}${tag}`;
    });

    const texts = [
      `⭐ ${config.name} Lv.${hero.getHeroLevel()}`,
      `⚔️ ${hero.getDamage()} 伤害 | ${(hero.getAttackSpeed() / 1000).toFixed(2)}s`,
      `💪${hero.getStr()} 🏃${hero.getAgi()} 🧠${hero.getInt()}  余:${hero.getFreePoints()}`,
      `📊 ${hero.getExperience()}/${hero.getExpToNext()} | 🏆${hero.getKillCount()}`,
      hero.getCritChance() > 0 ? `💥 暴击${Math.round(hero.getCritChance() * 100)}% x${hero.getCritMultiplier().toFixed(1)}` : `技能点: ${hero.getSkillPoints()}`,
      '── 技能(🔶主动 ✨被动) ──',
      ...skillLines,
      hero.getIsMoving() ? '🔄 点击新位置移动英雄' : '[M]移动英雄',
    ];

    for (let i = 0; i < this.infoPanelTexts.length; i++) {
      const t = texts[i] || '';
      this.infoPanelTexts[i].setText(t);
      if (i === 0) this.infoPanelTexts[i].setColor('#FFD700');
      else if (t.includes('✅')) this.infoPanelTexts[i].setColor('#88FF88');
      else if (t.includes('🔶')) this.infoPanelTexts[i].setColor('#FFAA44');
      else if (t.startsWith('✨')) this.infoPanelTexts[i].setColor('#FFDD88');
      else if (t.includes('🔄')) this.infoPanelTexts[i].setColor('#44CCFF');
      else this.infoPanelTexts[i].setColor('#CCCCCC');
    }
  }

  private showTowerInfo(tower: Tower): void {
    this.infoPanel.setVisible(true);
    const config = tower.getConfig();
    const upgradeCost = tower.getUpgradeCost();

    const texts = [
      `📍 ${config.name} Lv.${tower.getLevel() + 1}`,
      `⚔️ 伤害: ${tower.getDamage()}`,
      `🎯 类型: ${this.getAttackTypeLabel(config.attackType)}`,
      `📏 范围: ${(tower.getRange() / TILE_SIZE).toFixed(1)} 格`,
      `⏱ 攻速: ${(tower.getAttackSpeed() / 1000).toFixed(1)}s`,
      config.splash > 0 ? `💥 溅射: ${Math.round(config.splash / TILE_SIZE)} 格` : '',
      `🏆 击杀: ${tower.getKillCount()}`,
      upgradeCost ? `⬆️ 升级费用: 💰${upgradeCost}` : '🔒 已满级',
      `💰 出售: ${this.economyManager.getSellValue(tower.getTotalInvested())}`,
      config.special ? `✨ 特效: ${this.getSpecialLabel(config.special)}` : '',
    ];

    for (let i = 0; i < this.infoPanelTexts.length; i++) {
      this.infoPanelTexts[i].setText(texts[i] || '');
    }
  }

  private getSpecialLabel(special: string): string {
    const labels: Record<string, string> = {
      slow: '减速30%',
      freeze_aura: '范围冰冻50%',
      poison: '持续毒伤害',
      chain: '链式闪电',
      hero_grow: '击杀成长',
    };
    return labels[special] || special;
  }

  private upgradeTower(tower: Tower): void {
    const cost = tower.getUpgradeCost();
    if (!cost) { this.showMessage('已满级！'); return; }
    if (!this.economyManager.canAfford(cost)) { this.showMessage('💰 不足'); return; }

    this.economyManager.spendGold(cost);
    tower.upgrade();
    soundManager.playUpgrade();
    this.showMessage(`⬆️ ${tower.getConfig().name} → Lv.${tower.getLevel() + 1}`);
    this.showTowerInfo(tower);

    // 升级特效
    const { x, y } = this.gridManager.gridToPixel(tower.getGridCol(), tower.getGridRow());
    const flash = this.add.circle(x, y, 20, 0x44FF44, 0.5).setDepth(25);
    this.tweens.add({
      targets: flash,
      scale: 2, alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy(),
    });
  }

  private sellTower(tower: Tower): void {
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

  // ====== UI 辅助 ======

  private updateAuras(): void {
    // 重置所有塔的光环 buff
    for (const tower of this.towers) {
      tower.setAuraBuff(0, 0);
    }

    // 遍历光环塔，给范围内友方塔加 buff
    for (const aura of this.towers) {
      if (!aura.active) continue;
      const special = aura.getConfig().special;
      if (special !== 'aura_attack' && special !== 'aura_speed') continue;

      const range = aura.getRange();
      const level = aura.getLevel() + 1;

      for (const target of this.towers) {
        if (target === aura || !target.active) continue;
        if (target.getConfig().special === 'aura_attack' || target.getConfig().special === 'aura_speed') continue;

        const dist = distanceBetween(aura.x, aura.y, target.x, target.y);
        if (dist <= range) {
          if (special === 'aura_attack') {
            // 加攻: 20% + 10%/级 的基础伤害
            const bonus = Math.floor(target.getConfig().damage * (0.2 + level * 0.1));
            target.setAuraBuff(bonus, 0);
          } else if (special === 'aura_speed') {
            // 加速: 减少攻击间隔
            const bonus = Math.floor(50 + level * 30);
            target.setAuraBuff(0, bonus);
          }
        }
      }
    }
  }

  private updateEnemyCountUI(): void {
    const alive = this.enemies.length;
    const color = alive > 80 ? '#FF4444' : alive > 50 ? '#FFAA00' : '#88FF88';
    this.enemyCountText.setText(`怪物: ${alive}/${MAX_ENEMIES_ON_MAP}`);
    this.enemyCountText.setColor(color);
  }

  private updateResourceUI(): void {
    this.goldText.setText(`💰 ${this.economyManager.getGold()}`);
    this.woodText.setText(`🪵 ${this.economyManager.getWood()}`);
    this.popText.setText(`👥 ${this.economyManager.getPopulation()}/${this.economyManager.getMaxPopulation()}`);
    this.scoreText.setText(`⭐ ${this.economyManager.getScore()}`);
  }

  private showWaveBanner(waveNum: number): void {
    const mapHeight = GAME_HEIGHT - UI_HEIGHT;
    const mode = this.waveManager.getGameMode();

    let label = `WAVE ${waveNum}`;
    let color = '#FFFFFF';
    if (mode === 'hidden') { label = `🌟 HIDDEN ${waveNum - 50}`; color = '#FFD700'; }
    else if (mode === 'endless') { label = `♾️ ENDLESS ${waveNum - 60}`; color = '#FF4444'; }

    // 横幅背景
    const banner = this.add.rectangle(GAME_WIDTH / 2, mapHeight / 2, GAME_WIDTH + 20, 50, 0x000000, 0.6).setDepth(80);
    const text = this.add.text(GAME_WIDTH / 2, mapHeight / 2, label, {
      fontSize: '28px', fontFamily: 'Microsoft YaHei, sans-serif', color,
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(81);

    // 从左滑入
    banner.setX(-GAME_WIDTH);
    text.setX(-GAME_WIDTH);
    this.tweens.add({ targets: [banner, text], x: GAME_WIDTH / 2, duration: 300, ease: 'Cubic.easeOut' });

    // 1秒后淡出
    this.time.delayedCall(1200, () => {
      this.tweens.add({
        targets: [banner, text], alpha: 0, duration: 400,
        onComplete: () => { banner.destroy(); text.destroy(); },
      });
    });
  }

  private showMessage(msg: string): void {
    this.messageText.setText(msg);
    this.messageText.setAlpha(1);
    this.messageTimer = 3500;
  }

  private toggleSpeed(): void {
    if (this.gameSpeed === 1) {
      this.gameSpeed = 2;
      this.speedText.setText('▶▶ x2');
    } else if (this.gameSpeed === 2) {
      this.gameSpeed = 3;
      this.speedText.setText('▶▶▶ x3');
    } else {
      this.gameSpeed = 1;
      this.speedText.setText('▶ x1');
    }
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    this.pauseText.setText(this.isPaused ? '▶' : '⏸');
    this.pauseText.setColor(this.isPaused ? '#44FF44' : '#FFAAAA');

    if (this.isPaused) {
      this.showMessage('⏸ 已暂停 - 按 P 继续');
    }
  }

  private toggleHelp(): void {
    if (this.helpPanel) {
      this.helpPanel.destroy();
      this.helpPanel = null;
      return;
    }

    this.helpPanel = this.add.container(0, 0).setDepth(100);

    // 半透明遮罩
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this.toggleHelp());
    this.helpPanel.add(overlay);

    // 面板背景
    const panelW = 700;
    const panelH = 440;
    const px = (GAME_WIDTH - panelW) / 2;
    const py = (GAME_HEIGHT - panelH) / 2;
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, panelW, panelH, 0x111122, 0.97);
    bg.setStrokeStyle(2, 0x44FF44, 0.8);
    this.helpPanel.add(bg);

    // 标题
    this.helpPanel.add(this.add.text(GAME_WIDTH / 2, py + 15, '⚔️ 攻击 / 护甲克制表 (按 H 关闭)', {
      fontSize: '16px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#44FF44',
    }).setOrigin(0.5, 0));

    // 表头
    const tableX = px + 15;
    const tableY = py + 50;
    const cellW = 68;
    const cellH = 26;
    const headers = ['', '无甲', '轻甲', '中甲', '重甲', '加强', '英雄', '神圣', '普通'];
    const rows = [
      ['普通', '100%', '100%', '150%', '100%', '70%', '100%', '5%', '50%'],
      ['穿刺', '125%', '150%', '75%', '100%', '75%', '75%', '5%', '50%'],
      ['魔法', '100%', '125%', '75%', '150%', '75%', '75%', '5%', '50%'],
      ['攻城', '125%', '100%', '50%', '100%', '150%', '150%', '5%', '50%'],
      ['混乱', '100%', '100%', '100%', '100%', '100%', '200%', '200%', '100%'],
      ['英雄', '100%', '100%', '100%', '100%', '150%', '100%', '200%', '50%'],
      ['神圣', '100%', '100%', '100%', '100%', '100%', '100%', '150%', '100%'],
    ];

    // 表头
    headers.forEach((h, i) => {
      this.helpPanel!.add(this.add.text(tableX + i * cellW + cellW / 2, tableY, h, {
        fontSize: '11px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#88CCFF',
      }).setOrigin(0.5, 0));
    });

    // 表格行
    rows.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        const cy = tableY + (ri + 1) * cellH;
        let color = '#CCCCCC';
        if (ci > 0) {
          const val = parseInt(cell);
          if (val > 100) color = '#44FF44';
          else if (val < 100) color = '#FF6666';
          else color = '#888888';
        } else {
          color = '#FFCC44';
        }
        this.helpPanel!.add(this.add.text(tableX + ci * cellW + cellW / 2, cy, cell, {
          fontSize: '10px', fontFamily: 'Microsoft YaHei, sans-serif', color,
        }).setOrigin(0.5, 0));
      });
    });

    // 图例说明
    const legendY = tableY + 8 * cellH + 15;
    const legends = [
      '🟢 绿色 = 加成伤害  🔴 红色 = 减免伤害  ⚪ 灰色 = 标准',
      '',
      '护甲: ○轻  ◐中  ●重  ◆加强  ♛英雄  ✦神圣  □普通',
      '特性: 🛡魔免  ☠毒免  👁隐形  🦅飞行',
      '',
      '💡 神圣甲只怕混乱/英雄攻击！其余仅5%伤害',
      '💡 英雄甲弱混乱(200%)和攻城/英雄(150%)',
    ];
    legends.forEach((l, i) => {
      this.helpPanel!.add(this.add.text(GAME_WIDTH / 2, legendY + i * 16, l, {
        fontSize: '10px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#AAAAAA',
      }).setOrigin(0.5, 0));
    });
  }

  // ====== 主循环 ======

  update(time: number, delta: number): void {
    if (this.isGameOver || this.isPaused) return;

    const scaledDelta = delta * this.gameSpeed;

    // 波次
    this.waveManager.update(scaledDelta);

    // 怪物
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.active && !enemy.isDying()) {
        enemy.update(time, scaledDelta);
      }
    }

    // 光环系统：计算所有光环塔对附近塔的 buff
    this.updateAuras();

    // 塔
    for (const tower of this.towers) {
      if (tower.active) {
        tower.update(time, scaledDelta);
      }
    }

    // 英雄塔
    if (this.heroTower?.active) {
      this.heroTower.update(time, scaledDelta);
    }

    // 清理
    this.enemies = this.enemies.filter(e => e.active && !e.isDying());

    // 怪物上限检查
    this.waveManager.checkEnemyLimit();

    // BOSS 计时
    const bossTime = this.waveManager.getBossTimeRemaining();
    if (bossTime > 0) {
      const sec = Math.ceil(bossTime / 1000);
      this.bossTimerText.setText(`⏱ BOSS 剩余: ${sec}s`);
      this.bossTimerText.setColor(sec <= 10 ? '#FF0000' : '#FF4444');
      if (sec <= 10) {
        this.bossTimerText.setScale(1 + Math.sin(time * 0.01) * 0.05);
      }
    } else {
      this.bossTimerText.setText('');
      this.bossTimerText.setScale(1);
    }

    // 下一波倒计时
    if (this.waveManager.isWaitingForNextWave()) {
      const remaining = this.waveManager.getNextWaveCountdown();
      if (remaining > 0) {
        this.nextWaveText.setText(`下一波: ${Math.ceil(remaining / 1000)}s | 按 N 提前开始`);
      }
    }

    // 消息淡出
    if (this.messageTimer > 0) {
      this.messageTimer -= delta;
      if (this.messageTimer <= 0) {
        this.tweens.add({ targets: this.messageText, alpha: 0, duration: 400 });
      }
    }

    // 更新选中塔信息
    if (this.selectedTower && this.selectedTower.active) {
      this.showTowerInfo(this.selectedTower);
    }

    this.updateEnemyCountUI();
    this.updateHeroHUD();

    // 如果英雄塔被选中，实时更新面板
    if (this.heroTower?.active && this.infoPanel.visible && !this.selectedTower) {
      this.showHeroTowerInfo();
    }

    // 3D 渲染同步
    const bridge = (window as any).__gameBridge;
    if (bridge && (window as any).__3dEnabled) {
      bridge.sync(this.towers, this.enemies, this.heroTower, time);
    }
  }
}
