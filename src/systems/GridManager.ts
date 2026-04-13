import Phaser from 'phaser';
import { TILE_SIZE } from '../utils/constants';
import { PathManager } from './PathManager';

/**
 * 网格建造管理
 */
export class GridManager {
  private occupiedTiles: Set<string> = new Set();
  private pathManager: PathManager;

  constructor(pathManager: PathManager) {
    this.pathManager = pathManager;
  }

  /**
   * 检查网格是否可以建造
   */
  canBuildAt(col: number, row: number): boolean {
    if (this.occupiedTiles.has(`${col},${row}`)) return false;
    if (this.pathManager.isPathTile(col, row)) return false;
    return this.pathManager.isBuildable(col, row);
  }

  /**
   * 占用格子
   */
  occupy(col: number, row: number): void {
    this.occupiedTiles.add(`${col},${row}`);
  }

  /**
   * 释放格子
   */
  release(col: number, row: number): void {
    this.occupiedTiles.delete(`${col},${row}`);
  }

  /**
   * 像素坐标转网格
   */
  pixelToGrid(x: number, y: number): { col: number; row: number } {
    return {
      col: Math.floor(x / TILE_SIZE),
      row: Math.floor(y / TILE_SIZE),
    };
  }

  /**
   * 网格坐标转像素(中心)
   */
  gridToPixel(col: number, row: number): { x: number; y: number } {
    return {
      x: col * TILE_SIZE + TILE_SIZE / 2,
      y: row * TILE_SIZE + TILE_SIZE / 2,
    };
  }
}
