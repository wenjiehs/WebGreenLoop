import { AttackType, ArmorType } from '../utils/constants';

export interface EnemyConfig {
  id: string;
  name: string;
  hp: number;
  speed: number;
  armorType: ArmorType;
  armorValue: number;
  goldReward: number;
  color: number;
  radius: number;
  isBoss: boolean;
  bossTimeLimit?: number;
  isFlying?: boolean;
  isInvisible?: boolean;
  isMagicImmune?: boolean;
  isPoisonImmune?: boolean;
  count: number; // 每波默认数量
}

// 基于原版 v9.73 的 50波怪物数据
export const ENEMY_CONFIGS: Record<string, EnemyConfig> = {
  // ===== 前期怪物 (1-10波) =====
  troll: {
    id: 'troll', name: '巨魔', hp: 12, speed: 55,
    armorType: ArmorType.LIGHT, armorValue: 0, goldReward: 2,
    color: 0x88AA44, radius: 6, isBoss: false, isInvisible: true, count: 76,
  },
  dinosaur: {
    id: 'dinosaur', name: '恐龙', hp: 15, speed: 50,
    armorType: ArmorType.MEDIUM, armorValue: 1, goldReward: 2,
    color: 0x669933, radius: 7, isBoss: false, count: 141,
  },
  centaur: {
    id: 'centaur', name: '人马', hp: 20, speed: 60,
    armorType: ArmorType.UNARMORED, armorValue: 0, goldReward: 2,
    color: 0xBB8844, radius: 7, isBoss: false, count: 166,
  },
  bandit: {
    id: 'bandit', name: '强盗', hp: 25, speed: 55,
    armorType: ArmorType.LIGHT, armorValue: 1, goldReward: 3,
    color: 0x886644, radius: 6, isBoss: false, count: 75,
  },
  owlbeast: {
    id: 'owlbeast', name: '枭兽', hp: 30, speed: 50,
    armorType: ArmorType.LIGHT, armorValue: 1, goldReward: 3,
    color: 0x775533, radius: 7, isBoss: false, count: 121,
  },
  pirateship: {
    id: 'pirateship', name: '海盗船', hp: 50, speed: 40,
    armorType: ArmorType.FORTIFIED, armorValue: 3, goldReward: 4,
    color: 0x554433, radius: 9, isBoss: false, count: 54,
  },
  bear: {
    id: 'bear', name: '熊', hp: 45, speed: 45,
    armorType: ArmorType.DIVINE, armorValue: 2, goldReward: 4,
    color: 0x885522, radius: 8, isBoss: false, isMagicImmune: true, count: 90,
  },
  knight: {
    id: 'knight', name: '骑士', hp: 55, speed: 50,
    armorType: ArmorType.HEAVY, armorValue: 3, goldReward: 3,
    color: 0xCCCCCC, radius: 7, isBoss: false, count: 143,
  },
  airplane: {
    id: 'airplane', name: '飞机', hp: 40, speed: 65,
    armorType: ArmorType.LIGHT, armorValue: 1, goldReward: 3,
    color: 0x888899, radius: 6, isBoss: false, isFlying: true, count: 125,
  },
  mountain_giant: {
    id: 'mountain_giant', name: '小山岭', hp: 80, speed: 35,
    armorType: ArmorType.HEAVY, armorValue: 5, goldReward: 5,
    color: 0x666666, radius: 10, isBoss: false, isInvisible: true, count: 203,
  },

  // ===== 中前期 (11-20波) =====
  chaos_knight: {
    id: 'chaos_knight', name: '混沌骑士', hp: 300, speed: 40,
    armorType: ArmorType.HERO, armorValue: 5, goldReward: 15,
    color: 0xAA2222, radius: 10, isBoss: false, count: 15,
  },
  dark_treant: {
    id: 'dark_treant', name: '暗黑树人', hp: 90, speed: 50,
    armorType: ArmorType.LIGHT, armorValue: 2, goldReward: 4,
    color: 0x336633, radius: 8, isBoss: false, count: 123,
  },
  chimera: {
    id: 'chimera', name: '奇美拉', hp: 100, speed: 55,
    armorType: ArmorType.UNARMORED, armorValue: 0, goldReward: 5,
    color: 0xCC6644, radius: 8, isBoss: false, isFlying: true, count: 102,
  },
  axe_lord: {
    id: 'axe_lord', name: '斧王', hp: 150, speed: 40,
    armorType: ArmorType.DIVINE, armorValue: 4, goldReward: 8,
    color: 0xCC3333, radius: 9, isBoss: false, isMagicImmune: true, count: 60,
  },
  clay_golem: {
    id: 'clay_golem', name: '炭泥傀儡', hp: 120, speed: 45,
    armorType: ArmorType.MEDIUM, armorValue: 3, goldReward: 5,
    color: 0x997744, radius: 8, isBoss: false, count: 101,
  },
  kobold: {
    id: 'kobold', name: '狗头人', hp: 100, speed: 55,
    armorType: ArmorType.MEDIUM, armorValue: 2, goldReward: 4,
    color: 0xAA8855, radius: 6, isBoss: false, count: 118,
  },
  blood_shaman: {
    id: 'blood_shaman', name: '血萨满', hp: 140, speed: 45,
    armorType: ArmorType.HEAVY, armorValue: 4, goldReward: 5,
    color: 0xCC2244, radius: 8, isBoss: false, count: 144,
  },
  ghost_lord: {
    id: 'ghost_lord', name: '幽魂领主', hp: 130, speed: 50,
    armorType: ArmorType.MEDIUM, armorValue: 3, goldReward: 5,
    color: 0x6666AA, radius: 7, isBoss: false, isInvisible: true, count: 159,
  },
  elite_swordsman: {
    id: 'elite_swordsman', name: '精英剑士', hp: 160, speed: 45,
    armorType: ArmorType.DIVINE, armorValue: 5, goldReward: 5,
    color: 0xFFCC44, radius: 8, isBoss: false, isMagicImmune: true, count: 200,
  },
  dire_wolf: {
    id: 'dire_wolf', name: '恐怖之狼', hp: 200, speed: 70,
    armorType: ArmorType.UNARMORED, armorValue: 0, goldReward: 6,
    color: 0x555555, radius: 7, isBoss: false, count: 85,
  },

  // ===== 中期 (21-30波) =====
  tidal_fish: {
    id: 'tidal_fish', name: '潮汐战鱼', hp: 350, speed: 45,
    armorType: ArmorType.UNARMORED, armorValue: 2, goldReward: 8,
    color: 0x2288AA, radius: 8, isBoss: false, count: 60,
  },
  naga: {
    id: 'naga', name: '小娜迦', hp: 250, speed: 55,
    armorType: ArmorType.LIGHT, armorValue: 3, goldReward: 6,
    color: 0x44AA88, radius: 7, isBoss: false, count: 100,
  },
  dark_phoenix: {
    id: 'dark_phoenix', name: '黑凤凰', hp: 500, speed: 50,
    armorType: ArmorType.DIVINE, armorValue: 5, goldReward: 15,
    color: 0x442244, radius: 10, isBoss: false, isFlying: true, count: 30,
  },
  forgotten_one: {
    id: 'forgotten_one', name: '遗忘者', hp: 600, speed: 40,
    armorType: ArmorType.FORTIFIED, armorValue: 6, goldReward: 12,
    color: 0x664488, radius: 9, isBoss: false, isPoisonImmune: true, count: 45,
  },
  rock_golem: {
    id: 'rock_golem', name: '岩石傀儡', hp: 1000, speed: 35,
    armorType: ArmorType.FORTIFIED, armorValue: 8, goldReward: 20,
    color: 0x888888, radius: 11, isBoss: false, isPoisonImmune: true, count: 30,
  },
  super_kid: {
    id: 'super_kid', name: '超级小孩', hp: 1500, speed: 60,
    armorType: ArmorType.DIVINE, armorValue: 7, goldReward: 30,
    color: 0xFF8844, radius: 8, isBoss: false,
    isMagicImmune: true, isInvisible: true, isPoisonImmune: true, count: 15,
  },
  undead_banshee: {
    id: 'undead_banshee', name: '不死女妖', hp: 400, speed: 50,
    armorType: ArmorType.HEAVY, armorValue: 5, goldReward: 6,
    color: 0x88AACC, radius: 7, isBoss: false, isPoisonImmune: true, count: 150,
  },
  undead_wizard: {
    id: 'undead_wizard', name: '不死巫师', hp: 500, speed: 45,
    armorType: ArmorType.HEAVY, armorValue: 6, goldReward: 8,
    color: 0x5566AA, radius: 8, isBoss: false, isPoisonImmune: true, count: 120,
  },
  harpy: {
    id: 'harpy', name: '鹰身女妖', hp: 350, speed: 60,
    armorType: ArmorType.MEDIUM, armorValue: 3, goldReward: 6,
    color: 0xAA7788, radius: 7, isBoss: false,
    isFlying: true, isPoisonImmune: true, count: 150,
  },
  abomination: {
    id: 'abomination', name: '憎恶', hp: 800, speed: 35,
    armorType: ArmorType.MEDIUM, armorValue: 6, goldReward: 12,
    color: 0x558844, radius: 11, isBoss: false, isPoisonImmune: true, count: 80,
  },

  // ===== 后期 (31-40波) =====
  murloc_raider: {
    id: 'murloc_raider', name: '鱼人掠夺者', hp: 600, speed: 50,
    armorType: ArmorType.DIVINE, armorValue: 6, goldReward: 8,
    color: 0x44CC66, radius: 7, isBoss: false,
    isMagicImmune: true, isPoisonImmune: true, count: 100,
  },
  mammoth: {
    id: 'mammoth', name: '猛犸象', hp: 3000, speed: 30,
    armorType: ArmorType.HEAVY, armorValue: 10, goldReward: 30,
    color: 0x887766, radius: 13, isBoss: false, isPoisonImmune: true, count: 35,
  },
  black_dragon: {
    id: 'black_dragon', name: '黑骨龙', hp: 500, speed: 55,
    armorType: ArmorType.HEAVY, armorValue: 5, goldReward: 7,
    color: 0x222222, radius: 8, isBoss: false,
    isFlying: true, isInvisible: true, isPoisonImmune: true, count: 150,
  },
  speed_eagle: {
    id: 'speed_eagle', name: '急速鹰', hp: 400, speed: 80,
    armorType: ArmorType.LIGHT, armorValue: 2, goldReward: 6,
    color: 0xDDCC88, radius: 6, isBoss: false,
    isFlying: true, isMagicImmune: true, isPoisonImmune: true, count: 120,
  },
  ogre_chief: {
    id: 'ogre_chief', name: '食人魔首领', hp: 1200, speed: 40,
    armorType: ArmorType.UNARMORED, armorValue: 3, goldReward: 12,
    color: 0xBB8844, radius: 10, isBoss: false, count: 80,
  },
  mystery_tank: {
    id: 'mystery_tank', name: '神秘战车', hp: 2000, speed: 35,
    armorType: ArmorType.FORTIFIED, armorValue: 8, goldReward: 15,
    color: 0x556677, radius: 10, isBoss: false, count: 60,
  },
  crystal_scorpion: {
    id: 'crystal_scorpion', name: '水晶蝎', hp: 5000, speed: 30,
    armorType: ArmorType.LIGHT, armorValue: 3, goldReward: 30,
    color: 0x88CCDD, radius: 10, isBoss: false, count: 35,
  },
  mech_tank: {
    id: 'mech_tank', name: '机械战车', hp: 800, speed: 45,
    armorType: ArmorType.MEDIUM, armorValue: 5, goldReward: 8,
    color: 0x777788, radius: 8, isBoss: false, count: 120,
  },
  spider: {
    id: 'spider', name: '蜘蛛虫', hp: 600, speed: 55,
    armorType: ArmorType.MEDIUM, armorValue: 4, goldReward: 6,
    color: 0x553344, radius: 6, isBoss: false, count: 150,
  },
  dark_elf: {
    id: 'dark_elf', name: '暗黑精灵', hp: 1000, speed: 50,
    armorType: ArmorType.DIVINE, armorValue: 7, goldReward: 8,
    color: 0x443366, radius: 7, isBoss: false,
    isMagicImmune: true, isPoisonImmune: true, count: 200,
  },

  // ===== 终极 (41-50波) =====
  giant_shrimp: {
    id: 'giant_shrimp', name: '美味大虾', hp: 8000, speed: 25,
    armorType: ArmorType.MEDIUM, armorValue: 12, goldReward: 50,
    color: 0xEE6644, radius: 12, isBoss: false,
    isMagicImmune: true, isInvisible: true, isPoisonImmune: true, count: 45,
  },
  pandaren: {
    id: 'pandaren', name: '熊猫酒仙', hp: 2000, speed: 45,
    armorType: ArmorType.HERO, armorValue: 8, goldReward: 15,
    color: 0xFFFFFF, radius: 9, isBoss: false, count: 80,
  },
  giant_hero: {
    id: 'giant_hero', name: '巨型英雄', hp: 50000, speed: 20,
    armorType: ArmorType.DIVINE, armorValue: 15, goldReward: 200,
    color: 0xFF4400, radius: 18, isBoss: true, bossTimeLimit: 120000, count: 15,
  },
  death_knight: {
    id: 'death_knight', name: '死亡骑士', hp: 3000, speed: 50,
    armorType: ArmorType.HERO, armorValue: 10, goldReward: 12,
    color: 0x3344AA, radius: 8, isBoss: false, count: 200,
  },
  alchemist: {
    id: 'alchemist', name: '炼金术师', hp: 4000, speed: 45,
    armorType: ArmorType.HERO, armorValue: 8, goldReward: 18,
    color: 0xAACC44, radius: 9, isBoss: false, isMagicImmune: true, count: 99,
  },
  golden_dragon: {
    id: 'golden_dragon', name: '黄金龙', hp: 5000, speed: 45,
    armorType: ArmorType.DIVINE, armorValue: 10, goldReward: 20,
    color: 0xFFDD00, radius: 10, isBoss: false,
    isMagicImmune: true, isFlying: true, count: 106,
  },
  nether_dragon: {
    id: 'nether_dragon', name: '冥界龙王', hp: 80000, speed: 25,
    armorType: ArmorType.HERO, armorValue: 15, goldReward: 300,
    color: 0x220044, radius: 16, isBoss: true,
    bossTimeLimit: 120000, isFlying: true, count: 25,
  },
  cairne: {
    id: 'cairne', name: '卡琳血蹄', hp: 6000, speed: 45,
    armorType: ArmorType.DIVINE, armorValue: 10, goldReward: 20,
    color: 0x886644, radius: 10, isBoss: false, isMagicImmune: true, count: 120,
  },
  hell_lord: {
    id: 'hell_lord', name: '地狱领主', hp: 100000, speed: 30,
    armorType: ArmorType.DIVINE, armorValue: 20, goldReward: 500,
    color: 0xCC0000, radius: 16, isBoss: true,
    bossTimeLimit: 90000, isInvisible: true, count: 10,
  },
  despair_apostle: {
    id: 'despair_apostle', name: '绝望使徒', hp: 200000, speed: 25,
    armorType: ArmorType.DIVINE, armorValue: 25, goldReward: 1000,
    color: 0x440044, radius: 18, isBoss: true,
    bossTimeLimit: 120000, isMagicImmune: true, count: 8,
  },
};
