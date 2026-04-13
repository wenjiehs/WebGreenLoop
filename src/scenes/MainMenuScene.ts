import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'hell';

const DIFFICULTY_INFO: Record<Difficulty, { label: string; color: string; desc: string }> = {
  easy:   { label: '简单', color: '#44FF44', desc: '怪物HP -30%, 初始金 200' },
  normal: { label: '普通', color: '#FFCC44', desc: '标准参数' },
  hard:   { label: '困难', color: '#FF8844', desc: '怪物HP +50%, 初始金 80' },
  hell:   { label: '地狱', color: '#FF4444', desc: '怪物HP +200%, 初始金 60' },
};

export class MainMenuScene extends Phaser.Scene {
  private selectedDifficulty: Difficulty = 'normal';

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d0d1a');

    // 装饰背景
    const gfx = this.add.graphics();
    gfx.lineStyle(0.5, 0x224422, 0.15);
    for (let x = 0; x < GAME_WIDTH; x += 32) { gfx.moveTo(x, 0); gfx.lineTo(x, GAME_HEIGHT); }
    for (let y = 0; y < GAME_HEIGHT; y += 32) { gfx.moveTo(0, y); gfx.lineTo(GAME_WIDTH, y); }
    gfx.strokePath();

    const ring = this.add.graphics();
    ring.lineStyle(3, 0x44ff44, 0.1);
    ring.strokeRect(200, 80, GAME_WIDTH - 400, GAME_HEIGHT - 160);

    // 标题
    const title = this.add.text(GAME_WIDTH / 2, 110, '绿色循环圈', {
      fontSize: '68px', fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#44ff44', stroke: '#003300', strokeThickness: 8,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 182, 'Green Circle TD · Web Edition', {
      fontSize: '16px', fontFamily: 'Arial', color: '#66aa66',
    }).setOrigin(0.5);

    this.add.rectangle(GAME_WIDTH / 2, 210, 300, 1, 0x44ff44, 0.3);

    // 难度选择
    this.add.text(GAME_WIDTH / 2, 235, '选择难度', {
      fontSize: '14px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#888888',
    }).setOrigin(0.5);

    const difficulties: Difficulty[] = ['easy', 'normal', 'hard', 'hell'];
    const diffBtns: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; diff: Difficulty }[] = [];
    const diffY = 268;
    const diffW = 100;
    const diffGap = 16;
    const diffStartX = GAME_WIDTH / 2 - ((diffW + diffGap) * difficulties.length - diffGap) / 2;

    const descText = this.add.text(GAME_WIDTH / 2, diffY + 38, DIFFICULTY_INFO[this.selectedDifficulty].desc, {
      fontSize: '12px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#AAAAAA',
    }).setOrigin(0.5);

    difficulties.forEach((diff, i) => {
      const info = DIFFICULTY_INFO[diff];
      const x = diffStartX + i * (diffW + diffGap) + diffW / 2;
      const bg = this.add.rectangle(x, diffY, diffW, 28, 0x222233, 0.9);
      bg.setStrokeStyle(diff === this.selectedDifficulty ? 2 : 1,
        diff === this.selectedDifficulty ? 0x44FF44 : 0x444466);
      bg.setInteractive({ useHandCursor: true });
      const label = this.add.text(x, diffY, info.label, {
        fontSize: '13px', fontFamily: 'Microsoft YaHei, sans-serif',
        color: diff === this.selectedDifficulty ? info.color : '#888888',
      }).setOrigin(0.5);

      bg.on('pointerdown', () => {
        this.selectedDifficulty = diff;
        diffBtns.forEach(b => {
          const sel = b.diff === diff;
          b.bg.setStrokeStyle(sel ? 2 : 1, sel ? 0x44FF44 : 0x444466);
          b.label.setColor(sel ? DIFFICULTY_INFO[b.diff].color : '#888888');
        });
        descText.setText(DIFFICULTY_INFO[diff].desc);
      });
      bg.on('pointerover', () => bg.setFillStyle(0x333344));
      bg.on('pointerout', () => bg.setFillStyle(0x222233, 0.9));

      diffBtns.push({ bg, label, diff });
    });

    // 开始按钮
    this.createButton(GAME_WIDTH / 2, 345, '▶  开始游戏', 0x336633, () => {
      this.scene.start('GameScene', { difficulty: this.selectedDifficulty });
    });

    // 操作说明
    const controls = [
      '🖱 点击商店选塔 → 点击地图放置（Shift 连续建造）',
      '🖱 点击塔查看信息 → [U] 升级  [S] 出售',
      '⌨️ [1-0] 快捷选塔  [N] 下一波  [P] 暂停  [Space] 加速  [H] 克制表',
    ];
    this.add.text(GAME_WIDTH / 2, 416, controls.join('\n'), {
      fontSize: '12px', fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#778877', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);

    // 游戏规则
    const rules = [
      '🎯 目标：消灭全部 50 波怪物',
      '⚠️ 场上怪物 > 100 → 失败  |  BOSS 波限时击杀',
      '⭐ 每波清空 +1 PF  |  不同攻击对不同护甲有伤害加减',
    ];
    this.add.text(GAME_WIDTH / 2, 500, rules.join('\n'), {
      fontSize: '12px', fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#667766', align: 'center', lineSpacing: 5,
    }).setOrigin(0.5);

    // 攻击克制速查
    const matrix = [
      '      无甲  轻甲  中甲  重甲  神圣  英雄',
      '穿刺  100%  200%   75%  100%   35%   50%',
      '魔法  100%  125%   75%  200%   35%   50%',
      '攻城  100%  100%   50%  100%  150%   50%',
      '混乱  100%  100%  100%  100%  100%  100%',
      '神圣  100%  100%  100%  100%  150%  100%',
    ];
    this.add.text(GAME_WIDTH / 2, 575, '📊 攻击/护甲克制速查（游戏内按 H 查看完整表）', {
      fontSize: '10px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#556655',
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 594, matrix.join('\n'), {
      fontSize: '9px', fontFamily: 'Consolas, monospace', color: '#445544',
      lineSpacing: 2,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 10, 'v0.4.0', {
      fontSize: '10px', fontFamily: 'Arial', color: '#333344',
    }).setOrigin(1, 1);

    // 动画
    this.tweens.add({
      targets: title, y: title.y + 4,
      duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  private createButton(x: number, y: number, text: string, bgColor: number, callback: () => void): void {
    const bg = this.add.rectangle(x, y, 260, 50, bgColor, 0.9);
    bg.setStrokeStyle(2, 0x44ff44, 0.8);
    bg.setInteractive({ useHandCursor: true });
    const label = this.add.text(x, y, text, {
      fontSize: '22px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#ffffff',
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      bg.setFillStyle(bgColor + 0x111111, 1);
      label.setColor('#44ff44');
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(bgColor, 0.9);
      label.setColor('#ffffff');
    });
    bg.on('pointerdown', callback);
  }
}
