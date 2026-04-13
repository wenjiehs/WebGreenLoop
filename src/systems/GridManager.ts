import { TILE_SIZE } from '../utils/constants';
import { PathManager } from './PathManager';

export class GridManager {
  private occupiedTiles: Set<string> = new Set();
  private pathManager: PathManager;

  constructor(pathManager: PathManager) {
    this.pathManager = pathManager;
  }

  canBuildAt(col: number, row: number): boolean {
    if (this.occupiedTiles.has(`${col},${row}`)) return false;
    if (this.pathManager.isPathTile(col, row)) return false;
    return this.pathManager.isBuildable(col, row);
  }

  occupy(col: number, row: number): void { this.occupiedTiles.add(`${col},${row}`); }
  release(col: number, row: number): void { this.occupiedTiles.delete(`${col},${row}`); }

  pixelToGrid(x: number, y: number): { col: number; row: number } {
    return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
  }

  gridToPixel(col: number, row: number): { x: number; y: number } {
    return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
  }
}
