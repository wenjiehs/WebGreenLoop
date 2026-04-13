import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './utils/constants';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { ThreeRenderer } from './rendering/ThreeRenderer';
import { GameBridge } from './rendering/GameBridge';

// Three.js 3D 渲染层
const threeContainer = document.getElementById('three-container')!;
const threeRenderer = new ThreeRenderer(threeContainer);
const gameBridge = new GameBridge(threeRenderer);

// 挂到全局以便 GameScene 访问
(window as any).__gameBridge = gameBridge;
(window as any).__threeRenderer = threeRenderer;
(window as any).__3dEnabled = true;

// 视图切换
document.addEventListener('keydown', (e) => {
  if (e.key === 'v' || e.key === 'V') {
    const enabled = !(window as any).__3dEnabled;
    (window as any).__3dEnabled = enabled;
    threeContainer.style.display = enabled ? 'block' : 'none';
    document.getElementById('view-toggle')!.textContent = enabled ? 'V键切换2D/3D [3D]' : 'V键切换2D/3D [2D]';
  }
});

// Phaser 2D 游戏逻辑层
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS, // CANVAS 模式才能可靠透明
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  transparent: true,
  scene: [BootScene, MainMenuScene, GameScene, GameOverScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
