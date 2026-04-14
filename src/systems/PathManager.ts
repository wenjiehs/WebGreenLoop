import { TILE_SIZE, GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

export interface Vec2 { x: number; y: number; }

/**
 * 绿色循环圈 路径管理器 — 操场跑道形状
 *
 * 形状：两段平行直线 + 两个半圆弧（椭圆跑道）
 *
 *        ╭──────────────────────╮
 *       ╱                        ╲
 *      │    内圈建造区              │
 *      │                          │  ← 跑道（2格宽）
 *       ╲                        ╱
 *        ╰──────────────────────╯
 *
 * 怪物从左侧中点（出怪口）出生，顺时针跑
 * 跑道外侧和内侧都可以建塔
 */
export class PathManager {
  private waypoints: Vec2[] = [];
  private pathTiles: Set<string> = new Set();
  private buildableTiles: Set<string> = new Set();
  private spawnPoint: Vec2 = { x: 0, y: 0 };

  // 跑道参数（像素坐标）
  private centerX: number;
  private centerY: number;
  private straightLen: number;  // 直线段半长（像素）
  private radiusY: number;      // 半圆半径（像素）
  private trackWidth = 2;       // 格数

  constructor() {
    const cols = Math.floor(GAME_WIDTH / TILE_SIZE);          // 40
    const mapRows = Math.floor(GAME_HEIGHT / TILE_SIZE) - 4;  // 18

    this.centerX = (cols * TILE_SIZE) / 2;
    this.centerY = (mapRows * TILE_SIZE) / 2;

    // 直线段在水平方向，半圆在左右两端
    // 半圆半径 = 地图高度的 ~35%
    this.radiusY = mapRows * TILE_SIZE * 0.32;
    // 直线段半长 = 地图宽度的 ~30%（两端留空给半圆）
    this.straightLen = cols * TILE_SIZE * 0.28;

    this.generateTrack();
    this.calculateBuildableTiles();
  }

  private generateTrack(): void {
    const hw = this.trackWidth; // 跑道宽度（格数）
    const hwPx = hw * TILE_SIZE / 2; // 跑道半宽（像素）
    const arcSegments = 24; // 半圆弧分段数

    // === 标记路径瓦片 ===
    // 沿跑道中心线采样，将周围 hwPx 范围内的格子标记为路径
    const samplePoints: Vec2[] = [];

    // 上直线：从左弧端 → 右弧端（y = centerY - radiusY 位置是错的，应该是直线段）
    // 修正：操场跑道是水平直线+左右半圆
    // 上直线 y = centerY - radiusY... 不对
    // 
    // 操场跑道正确结构：
    // - 上直线: 从 (cx - straightLen, cy - radiusY) 到 (cx + straightLen, cy - radiusY)  ← 不对
    //
    // 其实操场跑道结构是：
    // - 上直线: y = cy - 某个值, x 从左到右
    // - 下直线: y = cy + 某个值, x 从右到左
    // - 右半圆: 圆心在 (cx + straightLen, cy), 半径 radiusY
    // - 左半圆: 圆心在 (cx - straightLen, cy), 半径 radiusY
    //
    // 所以：
    // 上边直线: y 恒定 = cy - radiusY, x 从 cx-straightLen 到 cx+straightLen
    // 这不对...操场跑道应该是：
    //
    // 左半圆中心: (cx - straightLen, cy)
    // 右半圆中心: (cx + straightLen, cy)
    // 上直线: 从左半圆顶点到右半圆顶点 → y = cy - radiusY
    // 下直线: 从右半圆底点到左半圆底点 → y = cy + radiusY

    const leftArcCx = this.centerX - this.straightLen;
    const rightArcCx = this.centerX + this.straightLen;

    // 顺时针方向采样跑道中心线：
    // 1. 上直线（左→右）
    const numStraightPts = 40;
    for (let i = 0; i <= numStraightPts; i++) {
      const t = i / numStraightPts;
      samplePoints.push({
        x: leftArcCx + t * (this.straightLen * 2),
        y: this.centerY - this.radiusY,
      });
    }

    // 2. 右半圆（上→下，顺时针 = -PI/2 → +PI/2）
    for (let i = 1; i <= arcSegments; i++) {
      const angle = -Math.PI / 2 + (i / arcSegments) * Math.PI;
      samplePoints.push({
        x: rightArcCx + Math.cos(angle) * this.radiusY * 0.5,  // 椭圆x方向压缩
        y: this.centerY + Math.sin(angle) * this.radiusY,
      });
    }

    // 3. 下直线（右→左）
    for (let i = 1; i <= numStraightPts; i++) {
      const t = i / numStraightPts;
      samplePoints.push({
        x: rightArcCx - t * (this.straightLen * 2),
        y: this.centerY + this.radiusY,
      });
    }

    // 4. 左半圆（下→上，顺时针 = +PI/2 → +3PI/2 即 PI/2 → -PI/2）
    for (let i = 1; i < arcSegments; i++) {
      const angle = Math.PI / 2 + (i / arcSegments) * Math.PI;
      samplePoints.push({
        x: leftArcCx + Math.cos(angle) * this.radiusY * 0.5,
        y: this.centerY + Math.sin(angle) * this.radiusY,
      });
    }

    // waypoints = 采样点
    this.waypoints = samplePoints;

    // 出怪口 = 左侧中点
    this.spawnPoint = { x: leftArcCx - this.radiusY * 0.5, y: this.centerY };

    // 标记路径瓦片：对每个采样点，将其周围 hwPx 范围内的格子标记
    for (const pt of samplePoints) {
      const centerCol = Math.floor(pt.x / TILE_SIZE);
      const centerRow = Math.floor(pt.y / TILE_SIZE);
      for (let dc = -hw; dc <= hw; dc++) {
        for (let dr = -hw; dr <= hw; dr++) {
          const c = centerCol + dc;
          const r = centerRow + dr;
          // 检查格子中心是否在跑道宽度范围内
          const gx = c * TILE_SIZE + TILE_SIZE / 2;
          const gy = r * TILE_SIZE + TILE_SIZE / 2;
          const dist = Math.sqrt((gx - pt.x) ** 2 + (gy - pt.y) ** 2);
          if (dist <= hwPx + TILE_SIZE * 0.3) {
            this.pathTiles.add(`${c},${r}`);
          }
        }
      }
    }
  }

  private calculateBuildableTiles(): void {
    const cols = Math.floor(GAME_WIDTH / TILE_SIZE);
    const mapRows = Math.floor(GAME_HEIGHT / TILE_SIZE) - 4;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < mapRows; row++) {
        if (!this.pathTiles.has(`${col},${row}`)) {
          if (col >= 1 && col < cols - 1 && row >= 1 && row < mapRows) {
            this.buildableTiles.add(`${col},${row}`);
          }
        }
      }
    }
  }

  // ======= 公开接口 =======

  getWaypoints(): Vec2[] { return this.waypoints; }
  getSpawnPoint(): Vec2 { return { ...this.spawnPoint }; }
  getSpawnWaypoints(): Vec2[] { return this.waypoints; }
  getInnerWaypoints(): Vec2[] { return this.waypoints; }
  hasInnerRing(): boolean { return false; }
  getInnerSpawnPoint(): Vec2 { return this.getSpawnPoint(); }
  isPathTile(col: number, row: number): boolean { return this.pathTiles.has(`${col},${row}`); }
  isBuildable(col: number, row: number): boolean { return this.buildableTiles.has(`${col},${row}`); }
  getPathTiles(): Set<string> { return this.pathTiles; }

  getNextWaypoint(currentIndex: number): { point: Vec2; index: number } {
    const nextIndex = (currentIndex + 1) % this.waypoints.length;
    return { point: this.waypoints[nextIndex], index: nextIndex };
  }
}
