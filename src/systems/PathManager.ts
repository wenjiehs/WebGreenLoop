import { TILE_SIZE, GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

export interface Vec2 { x: number; y: number; }

/**
 * 绿色循环圈 路径管理器
 *
 * 原版地图结构：
 * - 一条闭合的方形环跑道（2格宽），怪物在上面无限循环跑圈
 * - 跑道中心线大约在距地图边缘 6-7 格的位置
 * - 出怪口在跑道左上角附近
 * - 玩家在跑道**外侧**（外圈）和**内侧**（内圈）两侧建造防御塔
 * - 怪物从出怪口出生后，沿跑道顺时针跑圈，永远不会自行消失
 *
 * 地图示意（40×18格，去掉底部UI区）：
 *
 *   ┌─────────────────────────────────────┐
 *   │  外圈建造区                           │
 *   │    ┌───────────────────────────┐     │
 *   │    │  ★出怪口                   │     │
 *   │    │  ═══════════════════════►  │     │
 *   │    │  ║                      ║  │     │
 *   │    │  ║    内圈建造区          ║  │     │
 *   │    │  ║                      ║  │     │
 *   │    │  ◄═══════════════════════  │     │
 *   │    └───────────────────────────┘     │
 *   │  外圈建造区                           │
 *   └─────────────────────────────────────┘
 *
 * 跑道宽度 = 2格，中心线走的是这 2 格的中间
 */
export class PathManager {
  private waypoints: Vec2[] = [];
  private pathTiles: Set<string> = new Set();
  private buildableTiles: Set<string> = new Set();
  private spawnPoint: Vec2 = { x: 0, y: 0 };

  // 跑道参数
  private readonly trackMargin = 5;  // 跑道中心线距地图边缘的格数
  private readonly trackWidth = 2;   // 跑道宽度（格数）

  constructor() {
    this.generateTrack();
    this.calculateBuildableTiles();
  }

  /**
   * 生成一条方形环跑道
   * 跑道中心线形成一个矩形环路
   * 怪物沿着中心线上的 waypoint 顺时针跑
   */
  private generateTrack(): void {
    const cols = Math.floor(GAME_WIDTH / TILE_SIZE);        // 40
    const mapRows = Math.floor(GAME_HEIGHT / TILE_SIZE) - 4; // 18 (去掉底部UI约4行)

    const margin = this.trackMargin;
    const hw = Math.floor(this.trackWidth / 2);

    // 跑道中心线的四个角坐标（格子坐标）
    const left = margin;
    const right = cols - margin - 1;
    const top = margin;
    const bottom = mapRows - margin - 1;

    // 标记跑道瓦片（2格宽的方形环）
    // 上边横条 (不含角落，角落由竖条处理)
    for (let col = left; col <= right; col++) {
      for (let w = -hw; w < hw; w++) {
        this.pathTiles.add(`${col},${top + w}`);
      }
    }
    // 下边横条
    for (let col = left; col <= right; col++) {
      for (let w = -hw; w < hw; w++) {
        this.pathTiles.add(`${col},${bottom + w}`);
      }
    }
    // 左边竖条 (包含角落)
    for (let row = top - hw; row <= bottom + hw - 1; row++) {
      for (let w = -hw; w < hw; w++) {
        this.pathTiles.add(`${left + w},${row}`);
      }
    }
    // 右边竖条 (包含角落)
    for (let row = top - hw; row <= bottom + hw - 1; row++) {
      for (let w = -hw; w < hw; w++) {
        this.pathTiles.add(`${right + w},${row}`);
      }
    }

    // 生成中心线 waypoints（怪物沿此路径跑）
    // 顺时针: 从出怪口（左上角）开始 → 右 → 下 → 左 → 上 → 回到起点
    // 出怪口在左上角
    const spawnCol = left;
    const spawnRow = top;
    this.spawnPoint = {
      x: spawnCol * TILE_SIZE + TILE_SIZE / 2,
      y: spawnRow * TILE_SIZE + TILE_SIZE / 2,
    };

    // 上边: 左→右
    for (let col = left; col <= right; col++) {
      this.waypoints.push({
        x: col * TILE_SIZE + TILE_SIZE / 2,
        y: top * TILE_SIZE + TILE_SIZE / 2,
      });
    }
    // 右边: 上→下
    for (let row = top + 1; row <= bottom; row++) {
      this.waypoints.push({
        x: right * TILE_SIZE + TILE_SIZE / 2,
        y: row * TILE_SIZE + TILE_SIZE / 2,
      });
    }
    // 下边: 右→左
    for (let col = right - 1; col >= left; col--) {
      this.waypoints.push({
        x: col * TILE_SIZE + TILE_SIZE / 2,
        y: bottom * TILE_SIZE + TILE_SIZE / 2,
      });
    }
    // 左边: 下→上（不包含起始点，因为循环回起始点）
    for (let row = bottom - 1; row > top; row--) {
      this.waypoints.push({
        x: left * TILE_SIZE + TILE_SIZE / 2,
        y: row * TILE_SIZE + TILE_SIZE / 2,
      });
    }
  }

  /**
   * 计算可建造区域
   * 跑道外侧 = 外圈建造区
   * 跑道内侧 = 内圈建造区
   * 跑道本身不可建造
   */
  private calculateBuildableTiles(): void {
    const cols = Math.floor(GAME_WIDTH / TILE_SIZE);
    const mapRows = Math.floor(GAME_HEIGHT / TILE_SIZE) - 4;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < mapRows; row++) {
        if (!this.pathTiles.has(`${col},${row}`)) {
          // 不在跑道上 + 在地图边界内
          if (col >= 1 && col < cols - 1 && row >= 1 && row < mapRows) {
            this.buildableTiles.add(`${col},${row}`);
          }
        }
      }
    }
  }

  // ======= 公开接口 =======

  /** 获取环形跑道的中心线 waypoints（怪物沿此循环跑） */
  getWaypoints(): Vec2[] { return this.waypoints; }

  /** 获取出怪口位置 */
  getSpawnPoint(): Vec2 { return { ...this.spawnPoint }; }

  /** 怪物生成时的路径（单跑道，所有怪物走同一条路） */
  getSpawnWaypoints(): Vec2[] { return this.waypoints; }

  /** 内圈（兼容旧接口，单跑道版本无内圈，返回同一路径） */
  getInnerWaypoints(): Vec2[] { return this.waypoints; }
  hasInnerRing(): boolean { return false; }
  getInnerSpawnPoint(): Vec2 { return this.getSpawnPoint(); }

  /** 路径瓦片检测 */
  isPathTile(col: number, row: number): boolean { return this.pathTiles.has(`${col},${row}`); }
  isBuildable(col: number, row: number): boolean { return this.buildableTiles.has(`${col},${row}`); }
  getPathTiles(): Set<string> { return this.pathTiles; }

  /** 获取下一个 waypoint（用于预瞄等逻辑） */
  getNextWaypoint(currentIndex: number): { point: Vec2; index: number } {
    const nextIndex = (currentIndex + 1) % this.waypoints.length;
    return { point: this.waypoints[nextIndex], index: nextIndex };
  }
}
