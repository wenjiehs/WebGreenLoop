import Phaser from 'phaser';
import { TILE_SIZE, GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

/**
 * 路径管理器 - 管理怪物的闭合循环路径
 * 绿色循环圈的核心：方形闭合跑道
 */
export class PathManager {
  private waypoints: Phaser.Math.Vector2[] = [];
  private pathTiles: Set<string> = new Set();
  private buildableTiles: Set<string> = new Set();

  constructor() {
    this.generatePath();
    this.calculateBuildableTiles();
  }

  /**
   * 生成方形闭合跑道路径点
   * 跑道是一个方形环，怪物沿着它无限循环
   */
  private generatePath(): void {
    const margin = 3; // 距边缘的格数
    const pathWidth = 2; // 路径宽度(格数)

    // 外圈矩形边界 (格坐标)
    const left = margin;
    const right = Math.floor(GAME_WIDTH / TILE_SIZE) - margin - 1;
    const top = margin;
    const bottom = Math.floor(GAME_HEIGHT / TILE_SIZE) - margin - 1;

    // 中心线坐标生成路径点 (顺时针)
    // 上边: 从左到右
    for (let col = left; col <= right; col++) {
      this.waypoints.push(new Phaser.Math.Vector2(
        col * TILE_SIZE + TILE_SIZE / 2,
        top * TILE_SIZE + TILE_SIZE / 2,
      ));
    }
    // 右边: 从上到下
    for (let row = top + 1; row <= bottom; row++) {
      this.waypoints.push(new Phaser.Math.Vector2(
        right * TILE_SIZE + TILE_SIZE / 2,
        row * TILE_SIZE + TILE_SIZE / 2,
      ));
    }
    // 下边: 从右到左
    for (let col = right - 1; col >= left; col--) {
      this.waypoints.push(new Phaser.Math.Vector2(
        col * TILE_SIZE + TILE_SIZE / 2,
        bottom * TILE_SIZE + TILE_SIZE / 2,
      ));
    }
    // 左边: 从下到上
    for (let row = bottom - 1; row > top; row--) {
      this.waypoints.push(new Phaser.Math.Vector2(
        left * TILE_SIZE + TILE_SIZE / 2,
        row * TILE_SIZE + TILE_SIZE / 2,
      ));
    }

    // 标记路径占用的格子 (含路径宽度)
    const left2 = left;
    const right2 = right;
    const top2 = top;
    const bottom2 = bottom;

    for (let pw = 0; pw < pathWidth; pw++) {
      // 上边
      for (let col = left2 - 1; col <= right2 + 1; col++) {
        this.pathTiles.add(`${col},${top2 - 1 + pw}`);
        this.pathTiles.add(`${col},${top2 + pw}`);
      }
      // 下边
      for (let col = left2 - 1; col <= right2 + 1; col++) {
        this.pathTiles.add(`${col},${bottom2 + 1 - pw}`);
        this.pathTiles.add(`${col},${bottom2 - pw}`);
      }
      // 左边
      for (let row = top2 - 1; row <= bottom2 + 1; row++) {
        this.pathTiles.add(`${left2 - 1 + pw},${row}`);
        this.pathTiles.add(`${left2 + pw},${row}`);
      }
      // 右边
      for (let row = top2 - 1; row <= bottom2 + 1; row++) {
        this.pathTiles.add(`${right2 + 1 - pw},${row}`);
        this.pathTiles.add(`${right2 - pw},${row}`);
      }
    }
  }

  /**
   * 计算可建造区域：路径内外两侧各几格
   */
  private calculateBuildableTiles(): void {
    const cols = Math.floor(GAME_WIDTH / TILE_SIZE);
    const rows = Math.floor(GAME_HEIGHT / TILE_SIZE);

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        if (!this.pathTiles.has(`${col},${row}`)) {
          // 检查是否在路径附近（可建造区域）
          // UI 区域排除（底部留给 UI）
          if (row < rows - 3) {
            this.buildableTiles.add(`${col},${row}`);
          }
        }
      }
    }
  }

  getWaypoints(): Phaser.Math.Vector2[] {
    return this.waypoints;
  }

  getSpawnPoint(): Phaser.Math.Vector2 {
    return this.waypoints[0].clone();
  }

  isPathTile(col: number, row: number): boolean {
    return this.pathTiles.has(`${col},${row}`);
  }

  isBuildable(col: number, row: number): boolean {
    return this.buildableTiles.has(`${col},${row}`);
  }

  getPathTiles(): Set<string> {
    return this.pathTiles;
  }

  /**
   * 获取路径上指定索引的下一个路径点（循环）
   */
  getNextWaypoint(currentIndex: number): { point: Phaser.Math.Vector2; index: number } {
    const nextIndex = (currentIndex + 1) % this.waypoints.length;
    return {
      point: this.waypoints[nextIndex],
      index: nextIndex,
    };
  }
}
