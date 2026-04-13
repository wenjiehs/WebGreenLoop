import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // 未来加载资源用
  }

  create(): void {
    this.scene.start('MainMenuScene');
  }
}
