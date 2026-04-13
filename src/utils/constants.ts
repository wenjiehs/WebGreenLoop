// 游戏常量配置
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const TILE_SIZE = 32;

// 地图网格尺寸
export const GRID_COLS = Math.floor(GAME_WIDTH / TILE_SIZE); // 40
export const GRID_ROWS = Math.floor(GAME_HEIGHT / TILE_SIZE); // 22

// 颜色
export const COLORS = {
  GRASS: 0x2d5a1e,
  PATH: 0x8b7355,
  PATH_BORDER: 0x6b5335,
  GRID_LINE: 0x3a7a2a,
  BUILDABLE: 0x4a8a3a,
  BUILDABLE_HOVER: 0x5aaa4a,
  UNBUILDABLE: 0xff4444,
  GOLD: 0xffd700,
  WOOD: 0x8b4513,
  HP_BAR_BG: 0x333333,
  HP_BAR_FILL: 0x00ff00,
  HP_BAR_LOW: 0xff0000,
  ENEMY_NORMAL: 0xcc3333,
  ENEMY_FAST: 0x33cccc,
  ENEMY_HEAVY: 0x666699,
  ENEMY_BOSS: 0xff6600,
};

// 游戏平衡常量
export const STARTING_GOLD = 100;
export const STARTING_WOOD = 0;
export const STARTING_LIVES = 0; // 无生命值，靠怪物上限
export const MAX_ENEMIES_ON_MAP = 100;
export const WAVE_INTERVAL = 25000; // 波次间隔 ms
export const FIRST_WAVE_DELAY = 5000;
export const TOWER_SELL_RATIO = 0.75;
export const TOWER_SELL_RATIO_WAVE1 = 1.0;

// PF系统
export const PF_UNLOCK_ENDLESS = 40;

// 攻击类型
export enum AttackType {
  NORMAL = 'normal',
  PIERCE = 'pierce',
  MAGIC = 'magic',
  SIEGE = 'siege',
  CHAOS = 'chaos',
  HERO = 'hero',
  HOLY = 'holy',
}

// 护甲类型 (魔兽争霸3完整)
export enum ArmorType {
  UNARMORED = 'unarmored',  // 无甲
  LIGHT = 'light',          // 轻甲
  MEDIUM = 'medium',        // 中甲
  HEAVY = 'heavy',          // 重甲
  FORTIFIED = 'fortified',  // 加强甲
  HERO = 'hero',            // 英雄甲
  DIVINE = 'divine',        // 神圣甲
  NORMAL_ARMOR = 'normal_armor', // 普通甲
}

// 攻击/护甲克制矩阵 (基于魔兽争霸3原版数据)
export const DAMAGE_MATRIX: Record<AttackType, Record<ArmorType, number>> = {
  [AttackType.NORMAL]: {
    [ArmorType.UNARMORED]: 1.0,
    [ArmorType.LIGHT]: 1.0,
    [ArmorType.MEDIUM]: 1.5,
    [ArmorType.HEAVY]: 1.0,
    [ArmorType.FORTIFIED]: 0.7,
    [ArmorType.HERO]: 1.0,
    [ArmorType.DIVINE]: 0.05,
    [ArmorType.NORMAL_ARMOR]: 0.5,
  },
  [AttackType.PIERCE]: {
    [ArmorType.UNARMORED]: 1.25,
    [ArmorType.LIGHT]: 1.5,
    [ArmorType.MEDIUM]: 0.75,
    [ArmorType.HEAVY]: 1.0,
    [ArmorType.FORTIFIED]: 0.75,
    [ArmorType.HERO]: 0.75,
    [ArmorType.DIVINE]: 0.05,
    [ArmorType.NORMAL_ARMOR]: 0.5,
  },
  [AttackType.MAGIC]: {
    [ArmorType.UNARMORED]: 1.0,
    [ArmorType.LIGHT]: 1.25,
    [ArmorType.MEDIUM]: 0.75,
    [ArmorType.HEAVY]: 1.5,
    [ArmorType.FORTIFIED]: 0.75,
    [ArmorType.HERO]: 0.75,
    [ArmorType.DIVINE]: 0.05,
    [ArmorType.NORMAL_ARMOR]: 0.5,
  },
  [AttackType.SIEGE]: {
    [ArmorType.UNARMORED]: 1.25,
    [ArmorType.LIGHT]: 1.0,
    [ArmorType.MEDIUM]: 0.5,
    [ArmorType.HEAVY]: 1.0,
    [ArmorType.FORTIFIED]: 1.5,
    [ArmorType.HERO]: 1.5,
    [ArmorType.DIVINE]: 0.05,
    [ArmorType.NORMAL_ARMOR]: 0.5,
  },
  [AttackType.CHAOS]: {
    [ArmorType.UNARMORED]: 1.0,
    [ArmorType.LIGHT]: 1.0,
    [ArmorType.MEDIUM]: 1.0,
    [ArmorType.HEAVY]: 1.0,
    [ArmorType.FORTIFIED]: 1.0,
    [ArmorType.HERO]: 2.0,
    [ArmorType.DIVINE]: 2.0,
    [ArmorType.NORMAL_ARMOR]: 1.0,
  },
  [AttackType.HERO]: {
    [ArmorType.UNARMORED]: 1.0,
    [ArmorType.LIGHT]: 1.0,
    [ArmorType.MEDIUM]: 1.0,
    [ArmorType.HEAVY]: 1.0,
    [ArmorType.FORTIFIED]: 1.5,
    [ArmorType.HERO]: 1.0,
    [ArmorType.DIVINE]: 2.0,
    [ArmorType.NORMAL_ARMOR]: 0.5,
  },
  [AttackType.HOLY]: {
    [ArmorType.UNARMORED]: 1.0,
    [ArmorType.LIGHT]: 1.0,
    [ArmorType.MEDIUM]: 1.0,
    [ArmorType.HEAVY]: 1.0,
    [ArmorType.FORTIFIED]: 1.0,
    [ArmorType.HERO]: 1.0,
    [ArmorType.DIVINE]: 1.5,
    [ArmorType.NORMAL_ARMOR]: 1.0,
  },
};
