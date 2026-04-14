import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, MAX_ENEMIES_ON_MAP } from './utils/constants';
import { TOWER_CONFIGS, TowerConfig } from './config/towers';
import { HeroTowerConfig, getRandomHeroChoices } from './config/heroTowers';
import { TowerLogic } from './entities/TowerLogic';
import { HeroTowerLogic } from './entities/HeroTowerLogic';
import { EconomyManager } from './systems/EconomyManager';
import { WaveManager } from './systems/WaveManager';
import { soundManager } from './systems/SoundManager';

type Difficulty = 'easy' | 'normal' | 'hard' | 'hell';

export interface UICallbacks {
  onDifficultySelect: (diff: Difficulty) => void;
  onStartGame: () => void;
  onHeroSelected: (hero: HeroTowerConfig) => void;
  onTowerSelect: (config: TowerConfig, index: number) => void;
  onUpgradeTower: () => void;
  onSellTower: () => void;
  onStartHeroMove: () => void;
  onBuyWood: () => void;
  onBuyPopulation: () => void;
  onRestart: () => void;
  onBackToMenu: () => void;
  getHeroTower: () => HeroTowerLogic | null;
  getSelectedTower: () => TowerLogic | null;
}

/**
 * UI 管理器 — 所有 HTML UI 创建/更新/信息面板/结算/帮助/统计/小地图
 */
export class UIManager {
  private uiRoot: HTMLElement;
  private messageEl!: HTMLElement;
  private minimapCanvas: HTMLCanvasElement | null = null;
  private topBarRefs: Record<string, HTMLElement | null> = {};
  private messageTimer: number = 0;
  private helpVisible: boolean = false;
  private statsVisible: boolean = false;
  private selectedTowerConfig: TowerConfig | null = null;
  private callbacks!: UICallbacks;

  constructor(container: HTMLElement) {
    this.uiRoot = document.createElement('div');
    this.uiRoot.id = 'ui-root';
    this.uiRoot.style.cssText = 'position:absolute;top:0;left:0;width:1280px;height:720px;pointer-events:none;font-family:Microsoft YaHei,sans-serif;overflow:hidden;';
    container.appendChild(this.uiRoot);
  }

  setCallbacks(callbacks: UICallbacks): void {
    this.callbacks = callbacks;
  }

  getUIRoot(): HTMLElement { return this.uiRoot; }

  // ======================= 消息 =======================

  showMessage(msg: string): void {
    if (this.messageEl) {
      this.messageEl.textContent = msg;
      this.messageEl.style.opacity = '1';
      this.messageTimer = 3000;
    }
  }

  updateMessageTimer(rawDelta: number): void {
    if (this.messageTimer > 0) {
      this.messageTimer -= rawDelta;
      if (this.messageTimer <= 0 && this.messageEl) this.messageEl.style.opacity = '0';
    }
  }

  // ======================= 菜单 =======================

  showMenu(difficulty: Difficulty): void {
    this.uiRoot.innerHTML = `
      <div style="pointer-events:auto;position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(10,10,26,0.92);">
        <h1 style="font-size:60px;color:#44ff44;text-shadow:0 0 20px #003300;margin-bottom:8px;">绿色循环圈</h1>
        <p style="color:#66aa66;margin-bottom:20px;">Green Circle TD · Web 3D Edition</p>
        <div style="display:flex;gap:12px;margin-bottom:20px;" id="diff-btns">
          ${(['easy','normal','hard','hell'] as Difficulty[]).map(d => {
            const labels: Record<Difficulty, string> = { easy:'简单',normal:'普通',hard:'困难',hell:'地狱' };
            const colors: Record<Difficulty, string> = { easy:'#44FF44',normal:'#FFCC44',hard:'#FF8844',hell:'#FF4444' };
            return `<button data-diff="${d}" style="pointer-events:auto;padding:8px 24px;border:2px solid ${difficulty===d?'#44FF44':'#444'};background:${difficulty===d?'#1a331a':'#1a1a2e'};color:${difficulty===d?colors[d]:'#888'};font-size:14px;cursor:pointer;border-radius:4px;font-family:inherit;">${labels[d]}</button>`;
          }).join('')}
        </div>
        <button id="start-btn" style="pointer-events:auto;padding:14px 60px;background:#336633;color:#fff;border:2px solid #44ff44;font-size:20px;cursor:pointer;border-radius:6px;font-family:inherit;">▶ 开始游戏</button>
        <div style="color:#667766;font-size:12px;margin-top:30px;text-align:center;line-height:2;">
          🖱 左键点击建塔/选塔 | 右键拖拽摄像机 | 滚轮缩放<br>
          ⌨️ [1-0]选塔 [N]下一波 [P]暂停 [Space]加速 [U]升级 [S]出售 [M]移英雄
        </div>
      </div>`;

    this.uiRoot.querySelectorAll('[data-diff]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.callbacks.onDifficultySelect((btn as HTMLElement).dataset.diff as Difficulty);
      });
    });
    this.uiRoot.querySelector('#start-btn')?.addEventListener('click', () => this.callbacks.onStartGame());
  }

  // ======================= 英雄选择 =======================

  showHeroChoice(): void {
    const choices = getRandomHeroChoices(3);
    let html = `<div style="pointer-events:auto;position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);">
      <h2 style="color:#FFD700;font-size:28px;margin-bottom:10px;">🎲 选择你的英雄塔</h2>
      <p style="color:#AAA;font-size:12px;margin-bottom:20px;">英雄塔可通过击杀获得经验升级，拥有独特技能和属性成长</p>
      <div style="display:flex;gap:20px;">`;

    for (const hero of choices) {
      const c = `#${hero.color.toString(16).padStart(6, '0')}`;
      const diffLabels: Record<string, string> = { easy: '★ 新手推荐', medium: '★★ 中等', hard: '★★★ 困难' };
      html += `<div class="hero-card" data-hero="${hero.id}" style="pointer-events:auto;cursor:pointer;width:280px;padding:16px;background:#1a1a2e;border:2px solid ${c};border-radius:8px;">
        <h3 style="color:${c};font-size:20px;margin:0;">${hero.name} ${hero.difficulty === 'easy' ? '<span style="color:#44FF44;font-size:11px;">✅推荐</span>' : ''}</h3>
        <p style="color:#888;font-size:12px;">${hero.title}</p>
        <p style="color:#CCC;font-size:11px;margin:8px 0;">${hero.description}</p>
        <p style="color:#88AACC;font-size:10px;">力+${hero.strGrowth} 敏+${hero.agiGrowth} 智+${hero.intGrowth}</p>
        <p style="color:#AAA;font-size:10px;">攻击: ${hero.baseAttackType} | 👥 占${hero.populationCost}人口</p>
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
        this.callbacks.onHeroSelected(hero);
      });
      card.addEventListener('mouseenter', () => (card as HTMLElement).style.borderColor = '#44FF44');
      card.addEventListener('mouseleave', () => {
        const hero = choices.find(h => h.id === (card as HTMLElement).dataset.hero)!;
        (card as HTMLElement).style.borderColor = `#${hero.color.toString(16).padStart(6, '0')}`;
      });
    });
  }

  // ======================= 游戏 UI =======================

  createPlayingUI(economyManager: EconomyManager): void {
    this.uiRoot.innerHTML = `
      <div id="topbar" style="position:absolute;top:0;left:0;right:0;height:44px;background:linear-gradient(180deg,rgba(15,12,25,0.95),rgba(8,6,16,0.85));border-bottom:2px solid #886622;display:flex;align-items:center;padding:0 12px;gap:12px;font-size:13px;color:#FFF;z-index:10;flex-wrap:wrap;box-shadow:0 4px 12px rgba(0,0,0,0.4);">
        <span id="gold-text">💰 ${economyManager.getGold()}</span>
        <span id="wood-text" style="color:#CC9966;">🪵 ${economyManager.getWood()}</span>
        <span id="wave-text">波次: 0/50</span>
        <span id="pop-text">👥 ${economyManager.getPopulation()}/${economyManager.getMaxPopulation()}</span>
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
      <div id="shop-panel" style="pointer-events:auto;position:absolute;bottom:0;left:0;right:0;height:130px;background:linear-gradient(180deg,rgba(15,12,25,0.92),rgba(8,6,16,0.96));border-top:2px solid #886622;display:flex;flex-wrap:wrap;gap:3px;padding:4px;overflow-y:auto;z-index:10;box-shadow:0 -4px 16px rgba(0,0,0,0.5);"></div>
      <div id="info-panel" style="pointer-events:auto;display:none;position:absolute;right:8px;top:50px;width:200px;background:rgba(20,20,40,0.95);border:1px solid #44FF44;border-radius:6px;padding:10px;color:#FFF;font-size:11px;z-index:20;"></div>`;

    this.messageEl = this.uiRoot.querySelector('#message-bar')!;
    this.minimapCanvas = null;
    this.topBarRefs = {
      gold: this.uiRoot.querySelector('#gold-text'),
      wood: this.uiRoot.querySelector('#wood-text'),
      wave: this.uiRoot.querySelector('#wave-text'),
      pop: this.uiRoot.querySelector('#pop-text'),
      score: this.uiRoot.querySelector('#score-text'),
      enemy: this.uiRoot.querySelector('#enemy-count'),
      speed: this.uiRoot.querySelector('#speed-text'),
      nextWave: this.uiRoot.querySelector('#next-wave-text'),
      bossTimer: this.uiRoot.querySelector('#boss-timer'),
    };
    this.createShop();
  }

  // ======================= 商店 =======================

  private createShop(): void {
    const panel = this.uiRoot.querySelector('#shop-panel')!;
    const configs = Object.values(TOWER_CONFIGS);
    configs.forEach((config, i) => {
      const btn = document.createElement('div');
      btn.className = 'shop-btn';
      btn.dataset.index = String(i);
      btn.dataset.cost = String(config.cost);
      btn.dataset.towerId = config.id;
      btn.style.cssText = `width:148px;height:54px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #334;border-radius:6px;cursor:pointer;padding:4px 6px;position:relative;display:flex;align-items:center;gap:6px;transition:all 0.15s;box-shadow:0 2px 4px rgba(0,0,0,0.3);`;
      btn.innerHTML = `
        <div style="width:24px;height:24px;background:#${config.color.toString(16).padStart(6,'0')};border:2px solid #666;border-radius:4px;flex-shrink:0;box-shadow:0 0 6px #${config.color.toString(16).padStart(6,'0')}44;"></div>
        <div>
          <div style="font-size:11px;color:#EEE;font-weight:bold;">${config.name}</div>
          <div style="font-size:10px;color:#FFD700;">💰${config.cost}</div>
          <div style="font-size:9px;color:#889;">${config.splash > 0 ? 'AOE' : config.attackType}${config.special ? ' [' + config.special + ']' : ''}</div>
        </div>
        <div style="position:absolute;top:2px;right:5px;font-size:9px;color:#FFD700;background:rgba(0,0,0,0.4);padding:0 3px;border-radius:2px;">${i < 9 ? i + 1 : '0'}</div>`;

      btn.addEventListener('click', () => this.callbacks.onTowerSelect(config, i));
      btn.addEventListener('mouseenter', () => {
        btn.style.borderColor = '#886622';
        btn.style.boxShadow = '0 2px 8px rgba(136,102,34,0.4)';
        btn.style.transform = 'translateY(-1px)';
        const splashInfo = config.splash > 0 ? ` | AOE ${config.splash}px` : '';
        this.showMessage(`${config.name} - ${config.description} | ${config.attackType}${splashInfo} | 伤害${config.damage} | 射程${config.range} | 攻速${(config.attackSpeed / 1000).toFixed(1)}s`);
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.borderColor = this.selectedTowerConfig?.id === config.id ? '#886622' : '#334';
        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        btn.style.transform = 'translateY(0)';
      });
      panel.appendChild(btn);
    });
    this.updateShopAffordability(0, true);
  }

  setSelectedTowerConfig(config: TowerConfig | null): void {
    this.selectedTowerConfig = config;
  }

  updateShopAffordability(gold: number, canBuild: boolean): void {
    this.uiRoot.querySelectorAll('.shop-btn').forEach(btn => {
      const cost = parseInt((btn as HTMLElement).dataset.cost || '0');
      const affordable = gold >= cost && canBuild;
      (btn as HTMLElement).style.opacity = affordable ? '1' : '0.4';
    });
  }

  highlightShopButton(index: number): void {
    this.uiRoot.querySelectorAll('.shop-btn').forEach((btn, i) => {
      (btn as HTMLElement).style.borderColor = i === index ? '#44FF44' : '#444466';
    });
  }

  // ======================= TopBar =======================

  updateTopBar(economyManager: EconomyManager, waveManager: WaveManager, enemies: { length: number }, gameSpeed: number): void {
    const r = this.topBarRefs;
    if (r.gold) r.gold.textContent = `💰 ${economyManager.getGold()}`;
    if (r.wood) r.wood.textContent = `🪵 ${economyManager.getWood()}`;
    if (r.pop) r.pop.textContent = `👥 ${economyManager.getPopulation()}/${economyManager.getMaxPopulation()}`;
    if (r.score) r.score.textContent = `⭐ ${economyManager.getScore()}`;
    if (r.enemy) { const alive = enemies.length; r.enemy.textContent = `怪物: ${alive}/${MAX_ENEMIES_ON_MAP}`; r.enemy.style.color = alive > 80 ? '#FF4444' : alive > 50 ? '#FFAA00' : '#88FF88'; }
    if (r.speed) r.speed.textContent = `⏩ x${gameSpeed}`;

    if (r.wave) {
      const mode = waveManager.getGameMode();
      const wn = waveManager.getCurrentWave();
      if (mode === 'hidden') r.wave.textContent = `🌟 隐藏关: ${wn - 50}/10`;
      else if (mode === 'endless') r.wave.textContent = `♾️ 无尽 #${wn - 60} (x${Math.round(waveManager.getEndlessScaling() * 100)}%)`;
      else r.wave.textContent = `波次: ${wn}/50`;
    }

    if (r.bossTimer) {
      const bossRemaining = waveManager.getBossTimeRemaining();
      if (bossRemaining > 0) { r.bossTimer.style.display = 'inline'; r.bossTimer.textContent = `⏱ BOSS: ${Math.ceil(bossRemaining / 1000)}s`; }
      else r.bossTimer.style.display = 'none';
    }

    if (r.nextWave && waveManager.isWaitingForNextWave()) {
      const remaining = waveManager.getNextWaveCountdown();
      r.nextWave.textContent = remaining > 0 ? `下一波: ${Math.ceil(remaining / 1000)}s | 按N提前` : '';
    } else if (r.nextWave) r.nextWave.textContent = '';
  }

  // ======================= 信息面板 =======================

  showTowerInfo(tower: TowerLogic, economyManager: EconomyManager): void {
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
        ${upgCost ? `<button onclick="window.__game?.upgradeTowerAction()" style="pointer-events:auto;padding:4px 12px;background:#336633;border:1px solid #44FF44;color:#44FF44;cursor:pointer;border-radius:3px;font-size:10px;">升级[U] 💰${upgCost}</button>` : '<span style="color:#666;">已满级</span>'}
        <button onclick="window.__game?.sellTowerAction()" style="pointer-events:auto;padding:4px 12px;background:#663333;border:1px solid #FF4444;color:#FF4444;cursor:pointer;border-radius:3px;font-size:10px;">出售[S] 💰${economyManager.getSellValue(tower.getTotalInvested())}</button>
      </div>`;
  }

  showHeroInfo(heroTower: HeroTowerLogic): void {
    const panel = this.uiRoot.querySelector('#info-panel') as HTMLElement;
    if (!panel) return;
    panel.style.display = 'block';
    const h = heroTower;
    panel.innerHTML = `
      <h3 style="color:#FFD700;margin:0 0 6px;">${h.config.name} Lv.${h.heroLevel}</h3>
      <p>💪${h.str} 🏃${h.agi} 🧠${h.int} | 自由点:${h.freePoints}</p>
      <p>⚔️${h.getDamage()} ⏱${(h.getAttackSpeed()/1000).toFixed(2)}s 🎯${h.getRange()}</p>
      <p>💀${h.killCount} | EXP:${h.experience}/${h.expToNextLevel}</p>
      ${h.freePoints > 0 ? `<div style="display:flex;gap:4px;margin:4px 0;">
        <button onclick="window.__game?.heroAddStr()" style="pointer-events:auto;padding:2px 8px;background:#333;border:1px solid #F44;color:#F44;cursor:pointer;border-radius:2px;font-size:9px;">+力</button>
        <button onclick="window.__game?.heroAddAgi()" style="pointer-events:auto;padding:2px 8px;background:#333;border:1px solid #4F4;color:#4F4;cursor:pointer;border-radius:2px;font-size:9px;">+敏</button>
        <button onclick="window.__game?.heroAddInt()" style="pointer-events:auto;padding:2px 8px;background:#333;border:1px solid #44F;color:#44F;cursor:pointer;border-radius:2px;font-size:9px;">+智</button>
      </div>` : ''}
      <div style="border-top:1px solid #333;margin-top:6px;padding-top:4px;">
        ${h.config.skills.map((s, i) => {
          const lv = h.getSkillLevel(i);
          const canLearn = h.canLearnSkill(i);
          const [gc, wc] = h.getSkillCost(i);
          const costStr = gc > 0 ? ` 💰${gc}${wc > 0 ? `+🪵${wc}` : ''}` : '';
          return `<div style="display:flex;justify-content:space-between;align-items:center;margin:2px 0;">
            <span style="color:${lv > 0 ? '#DDDDAA' : '#666'};font-size:10px;">${s.name} Lv.${lv}/${s.maxLevel}</span>
            ${canLearn ? `<button onclick="window.__game?.heroLearnSkill(${i})" style="pointer-events:auto;padding:1px 6px;background:#333;border:1px solid #FFCC44;color:#FFCC44;cursor:pointer;border-radius:2px;font-size:9px;">学习${costStr}</button>` : ''}
          </div>`;
        }).join('')}
      </div>
      <button onclick="window.__game?.startHeroMove()" style="pointer-events:auto;margin-top:6px;padding:3px 10px;background:#333366;border:1px solid #8888FF;color:#8888FF;cursor:pointer;border-radius:3px;font-size:10px;">移动[M]</button>`;
  }

  hideInfoPanel(): void {
    const panel = this.uiRoot.querySelector('#info-panel') as HTMLElement;
    if (panel) panel.style.display = 'none';
  }

  // ======================= 结算 =======================

  showGameOver(victory: boolean, stats: { wave: number; score: number; kills: number; pf: number }, heroTower: HeroTowerLogic | null, towers: TowerLogic[], highScore: number, isNewRecord: boolean, reason?: string): void {
    const heroStats = heroTower ? `
      <p>🦸 英雄: ${heroTower.config.name} Lv.${heroTower.getHeroLevel()}</p>
      <p style="font-size:14px;color:#AAA;">💪${heroTower.getStr()} 🏃${heroTower.getAgi()} 🧠${heroTower.getInt()} | 💀${heroTower.getKillCount()}击杀</p>
    ` : '';

    let topTower = '';
    if (towers.length > 0) {
      const best = [...towers].sort((a, b) => b.getKillCount() - a.getKillCount())[0];
      topTower = `<p style="font-size:14px;color:#AAA;">🏅 最佳塔: ${best.config.name} Lv.${best.level + 1} (${best.getKillCount()}击杀)</p>`;
    }

    const summonCount = heroTower?.summons.length || 0;

    this.uiRoot.innerHTML = `
      <div style="pointer-events:auto;position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(180deg,rgba(10,10,26,0.95),rgba(5,5,15,0.98));">
        <h1 style="font-size:56px;color:${victory ? '#44FF44' : '#FF4444'};text-shadow:0 0 20px ${victory ? '#44FF4444' : '#FF444444'};">${victory ? '🎉 胜 利 🎉' : '💀 失 败'}</h1>
        ${reason ? `<p style="color:#FF8888;margin-bottom:12px;">${reason}</p>` : ''}
        <div style="color:#FFF;font-size:18px;line-height:1.8;margin:16px 0;text-align:center;background:rgba(255,255,255,0.05);padding:16px 32px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
          <p>🌊 波次: ${stats.wave}/50 | 💀 击杀: ${stats.kills} | 🏗️ 塔: ${towers.length}座</p>
          <p>⭐ 得分: ${stats.score} | 🎯 PF: ${stats.pf}${summonCount > 0 ? ` | 🐾 召唤物: ${summonCount}` : ''}</p>
          ${heroStats}
          ${topTower}
          <p style="color:#FFD700;font-size:20px;margin-top:8px;">🏆 最高分: ${highScore}${isNewRecord ? ' 🆕 新纪录！' : ''}</p>
        </div>
        <div style="display:flex;gap:16px;margin-top:8px;">
          <button onclick="window.__game?.restart()" style="pointer-events:auto;padding:12px 36px;background:linear-gradient(135deg,#2a5a2a,#336633);border:2px solid #44FF44;color:#FFF;font-size:18px;cursor:pointer;border-radius:6px;font-family:inherit;box-shadow:0 4px 12px rgba(68,255,68,0.2);">🔄 重新开始</button>
          <button onclick="window.__game?.backToMenu()" style="pointer-events:auto;padding:12px 36px;background:linear-gradient(135deg,#1a1a3e,#2a2a4e);border:2px solid #8888CC;color:#FFF;font-size:18px;cursor:pointer;border-radius:6px;font-family:inherit;box-shadow:0 4px 12px rgba(136,136,204,0.2);">🏠 返回菜单</button>
        </div>
      </div>`;
  }

  // ======================= 帮助面板 =======================

  toggleHelp(): void {
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
          <p style="color:#888;margin-top:10px;font-size:10px;">绿色=克制(>100%) 红色=被克(<100%) | 按 H 关闭</p>
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

  // ======================= 统计面板 =======================

  toggleStatsPanel(towers: TowerLogic[], heroTower: HeroTowerLogic | null, economyManager: EconomyManager, waveManager: WaveManager): void {
    this.statsVisible = !this.statsVisible;
    let panel = this.uiRoot.querySelector('#stats-panel') as HTMLElement;
    if (!this.statsVisible) { if (panel) panel.remove(); return; }

    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'stats-panel';
      panel.style.cssText = 'pointer-events:auto;position:absolute;left:8px;top:50px;width:220px;background:rgba(10,10,30,0.92);border:1px solid #886622;border-radius:6px;padding:10px;color:#FFF;font-size:11px;z-index:25;';
      this.uiRoot.appendChild(panel);
    }

    const allUnits = [
      ...towers.map(t => ({ name: `${t.config.name} Lv.${t.level + 1}`, kills: t.getKillCount(), color: '#88FF88' })),
      ...(heroTower ? [{ name: `🦸 ${heroTower.config.name} Lv.${heroTower.getHeroLevel()}`, kills: heroTower.getKillCount(), color: '#FFD700' }] : []),
    ].sort((a, b) => b.kills - a.kills).slice(0, 8);

    const totalKills = economyManager.getTotalKills();

    panel.innerHTML = `
      <h3 style="color:#886622;margin:0 0 6px;">📊 战斗统计 <span style="font-size:9px;color:#666;">Tab关闭</span></h3>
      <p style="color:#AAA;">🌊 波次: ${waveManager.getCurrentWave()} | 💀 总击杀: ${totalKills}</p>
      <p style="color:#AAA;">🏗️ 塔: ${towers.length}座 | 👥 人口: ${economyManager.getPopulation()}/${economyManager.getMaxPopulation()}</p>
      <div style="border-top:1px solid #333;margin:6px 0;padding-top:4px;">
        <p style="color:#886622;font-size:10px;">🏅 击杀排行</p>
        ${allUnits.map((u, i) => {
          const pct = totalKills > 0 ? Math.round(u.kills / totalKills * 100) : 0;
          return `<div style="display:flex;justify-content:space-between;margin:1px 0;">
            <span style="color:${u.color};font-size:10px;">${i + 1}. ${u.name}</span>
            <span style="color:#AAA;font-size:10px;">${u.kills} (${pct}%)</span>
          </div>`;
        }).join('')}
      </div>`;
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

  // ======================= 小地图 =======================

  updateMinimap(pathManager: { getPathTiles: () => Set<string> }, towers: TowerLogic[], enemies: { x: number; y: number; active: boolean; isDying: () => boolean }[], heroTower: HeroTowerLogic | null): void {
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

    ctx.fillStyle = 'rgba(139,115,85,0.4)';
    pathManager.getPathTiles().forEach(key => {
      const [col, row] = key.split(',').map(Number);
      ctx.fillRect(col * TILE_SIZE * scaleX, row * TILE_SIZE * scaleY, TILE_SIZE * scaleX, TILE_SIZE * scaleY);
    });

    ctx.fillStyle = '#44FF44';
    for (const tower of towers) {
      ctx.fillRect(tower.x * scaleX - 1.5, tower.y * scaleY - 1.5, 3, 3);
    }

    if (heroTower?.active) {
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(heroTower.x * scaleX - 2, heroTower.y * scaleY - 2, 4, 4);
    }

    ctx.fillStyle = 'rgba(255,68,68,0.6)';
    for (const e of enemies) {
      if (!e.active || e.isDying()) continue;
      ctx.fillRect(e.x * scaleX - 0.5, e.y * scaleY - 0.5, 1.5, 1.5);
    }
  }
}
