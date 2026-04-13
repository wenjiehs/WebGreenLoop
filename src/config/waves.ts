export interface WaveConfig {
  waveNumber: number;
  enemies: WaveEnemyGroup[];
  isBossWave: boolean;
  spawnInterval: number;
}

export interface WaveEnemyGroup {
  enemyId: string;
  count: number;
}

function w(n: number, enemies: WaveEnemyGroup[], interval: number = 600, boss = false): WaveConfig {
  return { waveNumber: n, enemies, isBossWave: boss, spawnInterval: interval };
}

// 基于原版 v9.73 的 50 波配置
export const WAVE_CONFIGS: WaveConfig[] = [
  w(1,  [{ enemyId: 'troll', count: 76 }], 300),             // 轻甲 隐形
  w(2,  [{ enemyId: 'dinosaur', count: 141 }], 250),         // 中甲
  w(3,  [{ enemyId: 'centaur', count: 166 }], 220),          // 无甲
  w(4,  [{ enemyId: 'bandit', count: 75 }], 400),            // 轻甲
  w(5,  [{ enemyId: 'owlbeast', count: 121 }], 300),         // 轻甲
  w(6,  [{ enemyId: 'pirateship', count: 54 }], 500),        // 加强甲
  w(7,  [{ enemyId: 'bear', count: 90 }], 400),              // 神圣甲 魔免
  w(8,  [{ enemyId: 'knight', count: 143 }], 250),           // 重甲
  w(9,  [{ enemyId: 'airplane', count: 125 }], 300),         // 轻甲 飞行
  w(10, [{ enemyId: 'mountain_giant', count: 203 }], 200),   // 重甲 隐形

  w(11, [{ enemyId: 'chaos_knight', count: 15 }], 1200),     // 英雄甲
  w(12, [{ enemyId: 'dark_treant', count: 123 }], 300),      // 轻甲
  w(13, [{ enemyId: 'chimera', count: 102 }], 350),          // 无甲 飞行
  w(14, [{ enemyId: 'axe_lord', count: 60 }], 500),          // 神圣甲 魔免
  w(15, [{ enemyId: 'clay_golem', count: 101 }], 350),       // 中甲
  w(16, [{ enemyId: 'kobold', count: 118 }], 300),           // 中甲
  w(17, [{ enemyId: 'blood_shaman', count: 144 }], 250),     // 重甲
  w(18, [{ enemyId: 'ghost_lord', count: 159 }], 230),       // 中甲 隐形
  w(19, [{ enemyId: 'elite_swordsman', count: 200 }], 200),  // 神圣甲 魔免
  w(20, [{ enemyId: 'dire_wolf', count: 85 }], 400),         // 无甲

  w(21, [{ enemyId: 'tidal_fish', count: 60 }], 550),        // 无甲
  w(22, [{ enemyId: 'naga', count: 100 }], 350),             // 轻甲
  w(23, [{ enemyId: 'dark_phoenix', count: 30 }], 800),      // 神圣甲 飞行
  w(24, [{ enemyId: 'forgotten_one', count: 45 }], 650),     // 加强甲 毒免
  w(25, [{ enemyId: 'rock_golem', count: 30 }], 900),        // 加强甲 毒免
  w(26, [{ enemyId: 'super_kid', count: 15 }], 1500),        // 神圣甲 魔免 隐形 毒免
  w(27, [{ enemyId: 'undead_banshee', count: 150 }], 220),   // 重甲 毒免
  w(28, [{ enemyId: 'undead_wizard', count: 120 }], 280),    // 重甲 毒免
  w(29, [{ enemyId: 'harpy', count: 150 }], 230),            // 中甲 飞行 毒免
  w(30, [{ enemyId: 'abomination', count: 80 }], 400),       // 中甲 毒免

  w(31, [{ enemyId: 'murloc_raider', count: 100 }], 350),    // 神圣甲 魔免 毒免
  w(32, [{ enemyId: 'mammoth', count: 35 }], 800),           // 重甲 毒免
  w(33, [{ enemyId: 'black_dragon', count: 150 }], 220),     // 重甲 飞行 隐形 毒免
  w(34, [{ enemyId: 'speed_eagle', count: 120 }], 280),      // 轻甲 飞行 魔免 毒免
  w(35, [{ enemyId: 'ogre_chief', count: 80 }], 400),        // 无甲
  w(36, [{ enemyId: 'mystery_tank', count: 60 }], 500),      // 加强甲
  w(37, [{ enemyId: 'crystal_scorpion', count: 35 }], 800),  // 轻甲
  w(38, [{ enemyId: 'mech_tank', count: 120 }], 280),        // 中甲
  w(39, [{ enemyId: 'spider', count: 150 }], 220),           // 中甲
  w(40, [{ enemyId: 'dark_elf', count: 200 }], 180),         // 神圣甲 魔免 毒免

  w(41, [{ enemyId: 'giant_shrimp', count: 45 }], 700),      // 中甲 魔免 隐形 毒免
  w(42, [{ enemyId: 'pandaren', count: 80 }], 400),          // 英雄甲
  w(43, [{ enemyId: 'giant_hero', count: 15 }], 1200, true), // 神圣甲 BOSS
  w(44, [{ enemyId: 'death_knight', count: 200 }], 170),     // 英雄甲
  w(45, [{ enemyId: 'alchemist', count: 99 }], 320),         // 英雄甲 魔免
  w(46, [{ enemyId: 'golden_dragon', count: 106 }], 300),    // 神圣甲 魔免 飞行
  w(47, [{ enemyId: 'nether_dragon', count: 25 }], 1000, true), // 英雄甲 BOSS 飞行
  w(48, [{ enemyId: 'cairne', count: 120 }], 280),           // 神圣甲 魔免
  w(49, [{ enemyId: 'hell_lord', count: 10 }], 2000, true),  // 神圣甲 BOSS 隐形
  w(50, [{ enemyId: 'despair_apostle', count: 8 }], 2500, true), // 神圣甲 BOSS 魔免
];
