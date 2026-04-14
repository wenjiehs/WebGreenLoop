import { TILE_SIZE, GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

export interface Vec2 { x: number; y: number; }

/**
 * 路径管理器 — 支持内外双环跑道
 * 外圈：margin=3 的方形环
 * 内圈：margin=7 的方形环（更小）
 * 怪物交替在两条跑道上生成
 */
export class PathManager {
  private outerWaypoints: Vec2[] = [];
  private innerWaypoints: Vec2[] = [];
  private pathTiles: Set<string> = new Set();
  private buildableTiles: Set<string> = new Set();
  private useInner: boolean = false; // 交替生成标记

  constructor() {
    this.generateDualPath();
    this.calculateBuildableTiles();
  }

  private generateDualPath(): void {
    const pathWidth = 2;

    // 外圈
    const oLeft = 3, oRight = Math.floor(GAME_WIDTH / TILE_SIZE) - 4;
    const oTop = 3, oBottom = Math.floor(GAME_HEIGHT / TILE_SIZE) - 4;
    this.outerWaypoints = this.generateRingWaypoints(oLeft, oRight, oTop, oBottom);
    this.markPathTiles(oLeft, oRight, oTop, oBottom, pathWidth);

    // 内圈（更小的方形环）
    const iLeft = 8, iRight = Math.floor(GAME_WIDTH / TILE_SIZE) - 9;
    const iTop = 7, iBottom = Math.floor(GAME_HEIGHT / TILE_SIZE) - 8;
    // 只有内圈足够大时才生成
    if (iRight > iLeft + 4 && iBottom > iTop + 2) {
      this.innerWaypoints = this.generateRingWaypoints(iLeft, iRight, iTop, iBottom);
      this.markPathTiles(iLeft, iRight, iTop, iBottom, pathWidth);
    }
  }

  private generateRingWaypoints(left: number, right: number, top: number, bottom: number): Vec2[] {
    const wp: Vec2[] = [];
    // 上边: 左→右
    for (let col = left; col <= right; col++)
      wp.push({ x: col * TILE_SIZE + TILE_SIZE / 2, y: top * TILE_SIZE + TILE_SIZE / 2 });
    // 右边: 上→下
    for (let row = top + 1; row <= bottom; row++)
      wp.push({ x: right * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 });
    // 下边: 右→左
    for (let col = right - 1; col >= left; col--)
      wp.push({ x: col * TILE_SIZE + TILE_SIZE / 2, y: bottom * TILE_SIZE + TILE_SIZE / 2 });
    // 左边: 下→上
    for (let row = bottom - 1; row > top; row--)
      wp.push({ x: left * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 });
    return wp;
  }

  private markPathTiles(left: number, right: number, top: number, bottom: number, pathWidth: number): void {
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

  /** 获取当前应使用的路径点（外圈或内圈交替） */
  getWaypoints(): Vec2[] { return this.outerWaypoints; }
  getInnerWaypoints(): Vec2[] { return this.innerWaypoints; }
  hasInnerRing(): boolean { return this.innerWaypoints.length > 0; }

  /** 交替获取生成路径（外圈/内圈） */
  getSpawnWaypoints(): Vec2[] {
    if (!this.hasInnerRing()) return this.outerWaypoints;
    this.useInner = !this.useInner;
    return this.useInner ? this.innerWaypoints : this.outerWaypoints;
  }

  getSpawnPoint(): Vec2 { return { ...this.outerWaypoints[0] }; }
  getInnerSpawnPoint(): Vec2 { return this.innerWaypoints.length > 0 ? { ...this.innerWaypoints[0] } : this.getSpawnPoint(); }
  isPathTile(col: number, row: number): boolean { return this.pathTiles.has(`${col},${row}`); }
  isBuildable(col: number, row: number): boolean { return this.buildableTiles.has(`${col},${row}`); }
  getPathTiles(): Set<string> { return this.pathTiles; }

  getNextWaypoint(currentIndex: number): { point: Vec2; index: number } {
    const nextIndex = (currentIndex + 1) % this.outerWaypoints.length;
    return { point: this.outerWaypoints[nextIndex], index: nextIndex };
  }
}
