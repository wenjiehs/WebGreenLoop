import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

interface GameOverData {
  victory: boolean;
  wave: number;
  score: number;
  kills: number;
  pf: number;
  reason?: string;
  difficulty?: string;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create(data: GameOverData): void {
    this.cameras.main.setBackgroundColor('#0d0d1a');

    const isVictory = data.victory;

    // 背景特效
    if (isVictory) {
      // 胜利粒子
      for (let i = 0; i < 30; i++) {
        const p = this.add.circle(
          Phaser.Math.Between(100, GAME_WIDTH - 100),
          Phaser.Math.Between(50, GAME_HEIGHT - 50),
          Phaser.Math.Between(1, 3),
          Phaser.Math.Between(0, 1) ? 0x44FF44 : 0xFFD700,
          0.5,
        );
        this.tweens.add({
          targets: p,
          y: p.y - Phaser.Math.Between(50, 150),
          alpha: 0,
          duration: 2000 + Phaser.Math.Between(0, 2000),
          repeat: -1,
          delay: Phaser.Math.Between(0, 2000),
        });
      }
    }

    // 标题
    const titleText = isVictory ? '🎉 胜 利 🎉' : '💀 失 败';
    this.add.text(GAME_WIDTH / 2, 100, titleText, {
      fontSize: '56px',
      fontFamily: 'Microsoft YaHei, sans-serif',
      color: isVictory ? '#44FF44' : '#FF4444',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    if (!isVictory && data.reason) {
      this.add.text(GAME_WIDTH / 2, 165, data.reason, {
        fontSize: '16px',
        fontFamily: 'Microsoft YaHei, sans-serif',
        color: '#FF8888',
      }).setOrigin(0.5);
    }

    // 分隔线
    this.add.rectangle(GAME_WIDTH / 2, 200, 400, 1, 0x44FF44, 0.3);

    // 统计数据
    const stats = [
      ['波 次', `${data.wave} / 50`],
      ['总击杀', `${data.kills}`],
      ['得 分', `${data.score}`],
      ['PF 点数', `${data.pf}`],
    ];

    const statsY = 230;
    stats.forEach(([label, value], i) => {
      const y = statsY + i * 40;
      this.add.text(GAME_WIDTH / 2 - 100, y, label, {
        fontSize: '18px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#888888',
      });
      this.add.text(GAME_WIDTH / 2 + 100, y, value, {
        fontSize: '20px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FFFFFF',
      }).setOrigin(1, 0);
    });

    // 评级
    const rating = this.getRating(data);
    this.add.text(GAME_WIDTH / 2, statsY + stats.length * 40 + 20, rating, {
      fontSize: '28px', fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#FFD700',
    }).setOrigin(0.5);

    // 按钮
    const btnY = 500;
    this.createButton(GAME_WIDTH / 2 - 140, btnY, '🔄 重新开始', 0x336633, () => {
      this.scene.start('GameScene', { difficulty: data.difficulty || 'normal' });
    });
    this.createButton(GAME_WIDTH / 2 + 140, btnY, '🏠 返回菜单', 0x2a2a3e, () => {
      this.scene.start('MainMenuScene');
    });

    // 提示
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, '按 Enter 重新开始', {
      fontSize: '12px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#555555',
    }).setOrigin(0.5);

    this.input.keyboard?.on('keydown-ENTER', () => {
      this.scene.start('GameScene', { difficulty: data.difficulty || 'normal' });
    });
  }

  private getRating(data: GameOverData): string {
    if (data.victory && data.pf >= 40) return '评级: S+ 完美通关！';
    if (data.victory && data.pf >= 30) return '评级: S 出色！';
    if (data.victory) return '评级: A 胜利！';
    if (data.wave >= 40) return '评级: B 接近胜利';
    if (data.wave >= 20) return '评级: C 中等';
    if (data.wave >= 10) return '评级: D 还需努力';
    return '评级: F 再接再厉';
  }

  private createButton(x: number, y: number, text: string, bgColor: number, callback: () => void): void {
    const bg = this.add.rectangle(x, y, 220, 48, bgColor, 0.9);
    bg.setStrokeStyle(1.5, 0x44FF44, 0.6);
    bg.setInteractive({ useHandCursor: true });

    const label = this.add.text(x, y, text, {
      fontSize: '18px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#FFFFFF',
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      bg.setStrokeStyle(2, 0x66FF66);
      label.setColor('#44FF44');
    });
    bg.on('pointerout', () => {
      bg.setStrokeStyle(1.5, 0x44FF44, 0.6);
      label.setColor('#FFFFFF');
    });
    bg.on('pointerdown', callback);
  }
}
