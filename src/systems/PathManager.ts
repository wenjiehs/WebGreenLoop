import { TILE_SIZE, GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

export interface Vec2 { x: number; y: number; }

/**
 * 路径管理器 - 纯 TypeScript 实现，无 Phaser 依赖
 */
export class PathManager {
  private waypoints: Vec2[] = [];
  private pathTiles: Set<string> = new Set();
  private buildableTiles: Set<string> = new Set();

  constructor() {
    this.generatePath();
    this.calculateBuildableTiles();
  }

  private generatePath(): void {
    const margin = 3;
    const pathWidth = 2;
    const left = margin;
    const right = Math.floor(GAME_WIDTH / TILE_SIZE) - margin - 1;
    const top = margin;
    const bottom = Math.floor(GAME_HEIGHT / TILE_SIZE) - margin - 1;

    // 上边
    for (let col = left; col <= right; col++) {
      this.waypoints.push({ x: col * TILE_SIZE + TILE_SIZE / 2, y: top * TILE_SIZE + TILE_SIZE / 2 });
    }
    // 右边
    for (let row = top + 1; row <= bottom; row++) {
      this.waypoints.push({ x: right * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 });
    }
    // 下边
    for (let col = right - 1; col >= left; col--) {
      this.waypoints.push({ x: col * TILE_SIZE + TILE_SIZE / 2, y: bottom * TILE_SIZE + TILE_SIZE / 2 });
    }
    // 左边
    for (let row = bottom - 1; row > top; row--) {
      this.waypoints.push({ x: left * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 });
    }

    for (let pw = 0; pw < pathWidth; pw++) {
      for (let col = left - 1; col <= right + 1; col++) {
        this.pathTiles.add(`${col},${top - 1 + pw}`);
        this.pathTiles.add(`${col},${top + pw}`);
      }
      for (let col = left - 1; col <= right + 1; col++) {
        this.pathTiles.add(`${col},${bottom + 1 - pw}`);
        this.pathTiles.add(`${col},${bottom - pw}`);
      }
      for (let row = top - 1; row <= bottom + 1; row++) {
        this.pathTiles.add(`${left - 1 + pw},${row}`);
        this.pathTiles.add(`${left + pw},${row}`);
      }
      for (let row = top - 1; row <= bottom + 1; row++) {
        this.pathTiles.add(`${right + 1 - pw},${row}`);
        this.pathTiles.add(`${right - pw},${row}`);
      }
    }
  }

  private calculateBuildableTiles(): void {
    const cols = Math.floor(GAME_WIDTH / TILE_SIZE);
    const rows = Math.floor(GAME_HEIGHT / TILE_SIZE);
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        if (!this.pathTiles.has(`${col},${row}`) && row < rows - 3) {
          this.buildableTiles.add(`${col},${row}`);
        }
      }
    }
  }

  getWaypoints(): Vec2[] { return this.waypoints; }
  getSpawnPoint(): Vec2 { return { ...this.waypoints[0] }; }
  isPathTile(col: number, row: number): boolean { return this.pathTiles.has(`${col},${row}`); }
  isBuildable(col: number, row: number): boolean { return this.buildableTiles.has(`${col},${row}`); }
  getPathTiles(): Set<string> { return this.pathTiles; }

  getNextWaypoint(currentIndex: number): { point: Vec2; index: number } {
    const nextIndex = (currentIndex + 1) % this.waypoints.length;
    return { point: this.waypoints[nextIndex], index: nextIndex };
  }
}
