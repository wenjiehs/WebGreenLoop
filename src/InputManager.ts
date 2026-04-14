import { TOWER_CONFIGS, TowerConfig } from './config/towers';
import { ThreeRenderer } from './rendering/ThreeRenderer';
import { EntityRenderer } from './rendering/EntityRenderer';

export interface InputCallbacks {
  getPhase: () => string;
  isGameOver: () => boolean;
  getSelectedTowerConfig: () => TowerConfig | null;
  isHeroMoving: () => boolean;
  getHeroActive: () => boolean;
  getHeroGrid: () => { col: number; row: number } | null;

  onCanvasClick: (col: number, row: number) => void;
  onCanvasMouseMove: (col: number, row: number) => void;
  onCanvasMouseLeave: () => void;
  onForceNextWave: () => void;
  onCancelSelection: () => void;
  onToggleSpeed: () => void;
  onTogglePause: () => void;
  onUpgradeKey: () => void;
  onSellKey: () => void;
  onHeroMoveKey: () => void;
  onToggleHelp: () => void;
  onToggleStats: () => void;
  onNumberKey: (num: number) => void;
}

/**
 * 输入管理器 — 键盘/鼠标事件处理
 */
export class InputManager {
  private canvas: HTMLCanvasElement;
  private renderer: ThreeRenderer;
  private entityRenderer: EntityRenderer;
  private callbacks!: InputCallbacks;

  private isDragging: boolean = false;
  private lastMouse = { x: 0, y: 0 };
  private shiftDown: boolean = false;

  constructor(canvas: HTMLCanvasElement, renderer: ThreeRenderer, entityRenderer: EntityRenderer) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.entityRenderer = entityRenderer;
  }

  setCallbacks(callbacks: InputCallbacks): void {
    this.callbacks = callbacks;
  }

  isShiftDown(): boolean { return this.shiftDown; }

  setup(): void {
    // 鼠标点击 — 3D Raycaster 拾取
    this.canvas.addEventListener('click', (e) => {
      if (this.callbacks.getPhase() !== 'playing' || this.callbacks.isGameOver()) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (my > rect.height * (1 - 140 / 720)) return;

      const grid = this.entityRenderer.getGridFromClick(mx, my, rect.width, rect.height);
      if (!grid) return;
      this.callbacks.onCanvasClick(grid.col, grid.row);
    });

    // 鼠标移动 — 建造预览
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.callbacks.getPhase() !== 'playing' || !this.callbacks.getSelectedTowerConfig()) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      if (my > rect.height * (1 - 140 / 720)) { this.callbacks.onCanvasMouseLeave(); return; }

      const grid = this.entityRenderer.getGridFromClick(mx, my, rect.width, rect.height);
      if (grid) this.callbacks.onCanvasMouseMove(grid.col, grid.row);
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
      if (this.callbacks.getPhase() !== 'playing') return;
      switch (e.key) {
        case 'n': case 'N': this.callbacks.onForceNextWave(); break;
        case 'Escape': this.callbacks.onCancelSelection(); break;
        case ' ': this.callbacks.onToggleSpeed(); e.preventDefault(); break;
        case 'p': case 'P': this.callbacks.onTogglePause(); break;
        case 'u': case 'U': this.callbacks.onUpgradeKey(); break;
        case 's': case 'S': this.callbacks.onSellKey(); break;
        case 'm': case 'M': this.callbacks.onHeroMoveKey(); break;
        case 'h': case 'H': this.callbacks.onToggleHelp(); break;
        case 'Tab': e.preventDefault(); this.callbacks.onToggleStats(); break;
        default:
          const num = parseInt(e.key);
          if (num >= 1 && num <= 9) this.callbacks.onNumberKey(num);
          if (e.key === '0') this.callbacks.onNumberKey(10);
      }
    });
  }
}
