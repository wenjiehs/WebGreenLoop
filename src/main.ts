import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './utils/constants';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { ThreeRenderer } from './rendering/ThreeRenderer';
import { GameBridge } from './rendering/GameBridge';

// ====== Three.js 3D 渲染层 ======
const threeContainer = document.getElementById('three-container')!;
const threeRenderer = new ThreeRenderer(threeContainer);
const gameBridge = new GameBridge(threeRenderer);

(window as any).__gameBridge = gameBridge;
(window as any).__threeRenderer = threeRenderer;
(window as any).__3dEnabled = true;

// ====== 事件转发 ======
// Phaser canvas 接收所有鼠标事件，右键拖拽和滚轮缩放转发到 ThreeRenderer
const gameContainer = document.getElementById('game-container')!;

// 右键拖拽 3D 摄像机
let isDragging3D = false;
let lastMouse = { x: 0, y: 0 };

gameContainer.addEventListener('contextmenu', e => e.preventDefault());

gameContainer.addEventListener('mousedown', (e) => {
  if (e.button === 2 && (window as any).__3dEnabled) {
    isDragging3D = true;
    lastMouse = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging3D) return;
  threeRenderer.handleDrag(e.clientX - lastMouse.x, e.clientY - lastMouse.y);
  lastMouse = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mouseup', () => { isDragging3D = false; });

// 滚轮缩放 3D 摄像机
gameContainer.addEventListener('wheel', (e) => {
  if ((window as any).__3dEnabled) {
    threeRenderer.handleZoom(e.deltaY);
  }
}, { passive: true });

// ====== V键切换 ======
document.addEventListener('keydown', (e) => {
  if (e.key === 'v' || e.key === 'V') {
    const enabled = !(window as any).__3dEnabled;
    (window as any).__3dEnabled = enabled;
    threeContainer.style.display = enabled ? 'block' : 'none';
    document.getElementById('view-toggle')!.textContent = enabled ? 'V键切换2D/3D [3D]' : 'V键切换2D/3D [2D]';
  }
});

// ====== 3D层场景管理 ======
// 非游戏场景时隐藏3D（菜单/结算画面不需要3D地形）
(window as any).__show3DLayer = () => {
  if ((window as any).__3dEnabled) threeContainer.style.display = 'block';
};
(window as any).__hide3DLayer = () => {
  threeContainer.style.display = 'none';
};

// 初始隐藏（菜单场景先出来）
threeContainer.style.display = 'none';

// ====== Phaser ======
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  transparent: true,
  scene: [BootScene, MainMenuScene, GameScene, GameOverScene],
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
