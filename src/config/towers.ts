import { AttackType } from '../utils/constants';

export interface TowerConfig {
  id: string;
  name: string;
  description: string;
  cost: number;
  attackType: AttackType;
  damage: number;
  range: number;
  attackSpeed: number;
  splash: number;
  color: number;
  projectileSpeed: number;
  projectileColor: number;
  special?: string;
  upgrades: TowerUpgrade[];
  category: 'basic' | 'aoe' | 'slow' | 'support' | 'special' | 'hero';
}

export interface TowerUpgrade {
  cost: number;
  damage: number;
  range: number;
  attackSpeed: number;
  splash: number;
  name?: string;
}

// 基于原版 Green Circle TD v9.73 的塔类型
export const TOWER_CONFIGS: Record<string, TowerConfig> = {

  // ===== 基础攻击塔 =====
  scatter: {
    id: 'scatter', name: '多重塔', category: 'aoe',
    description: '散射多支箭矢，前期群攻核心',
    cost: 80, attackType: AttackType.PIERCE, damage: 8,
    range: 180, attackSpeed: 600, splash: 40,
    color: 0x88AA44, projectileSpeed: 600, projectileColor: 0xAACC66,
    upgrades: [
      { cost: 100, damage: 14, range: 195, attackSpeed: 560, splash: 45, name: '多重塔 2级' },
      { cost: 250, damage: 22, range: 210, attackSpeed: 520, splash: 50, name: '多重塔 3级' },
      { cost: 500, damage: 35, range: 230, attackSpeed: 480, splash: 56, name: '多重塔 4级' },
      { cost: 1200, damage: 55, range: 250, attackSpeed: 440, splash: 64, name: '多重塔 5级' },
    ],
  },
  bounce: {
    id: 'bounce', name: '弹射塔', category: 'basic',
    description: '弹射攻击可命中多个目标',
    cost: 50, attackType: AttackType.NORMAL, damage: 10,
    range: 170, attackSpeed: 900, splash: 0,
    color: 0x5588CC, projectileSpeed: 550, projectileColor: 0x77AAEE,
    special: 'chain',
    upgrades: [
      { cost: 130, damage: 18, range: 185, attackSpeed: 850, splash: 0 },
      { cost: 300, damage: 30, range: 200, attackSpeed: 800, splash: 0 },
      { cost: 700, damage: 50, range: 220, attackSpeed: 750, splash: 0 },
    ],
  },
  critical: {
    id: 'critical', name: '重击塔', category: 'basic',
    description: '暴击攻击，对高血量目标有效',
    cost: 60, attackType: AttackType.NORMAL, damage: 18,
    range: 160, attackSpeed: 1200, splash: 0,
    color: 0xCC5533, projectileSpeed: 500, projectileColor: 0xFF7744,
    special: 'critical',
    upgrades: [
      { cost: 175, damage: 30, range: 175, attackSpeed: 1100, splash: 0 },
      { cost: 425, damage: 50, range: 190, attackSpeed: 1050, splash: 0 },
      { cost: 950, damage: 80, range: 200, attackSpeed: 1000, splash: 0 },
      { cost: 2000, damage: 130, range: 220, attackSpeed: 950, splash: 0 },
    ],
  },

  // ===== 减速/控制塔 =====
  poison: {
    id: 'poison', name: '毒塔', category: 'slow',
    description: '持续毒伤害并减速敌人',
    cost: 45, attackType: AttackType.NORMAL, damage: 5,
    range: 150, attackSpeed: 1000, splash: 0,
    color: 0x44AA44, projectileSpeed: 450, projectileColor: 0x66FF66,
    special: 'poison',
    upgrades: [
      { cost: 100, damage: 8, range: 160, attackSpeed: 950, splash: 0 },
      { cost: 250, damage: 12, range: 170, attackSpeed: 900, splash: 0 },
      { cost: 600, damage: 18, range: 180, attackSpeed: 850, splash: 0 },
    ],
  },
  slow: {
    id: 'slow', name: '减速塔', category: 'slow',
    description: '减速光环，大幅降低敌人移动速度',
    cost: 100, attackType: AttackType.MAGIC, damage: 6,
    range: 140, attackSpeed: 1200, splash: 80,
    color: 0x66CCFF, projectileSpeed: 0, projectileColor: 0x99EEFF,
    special: 'freeze_aura',
    upgrades: [
      { cost: 300, damage: 10, range: 155, attackSpeed: 1100, splash: 90 },
      { cost: 800, damage: 16, range: 170, attackSpeed: 1000, splash: 100 },
      { cost: 2000, damage: 25, range: 185, attackSpeed: 900, splash: 110, name: '减速塔 4级' },
      { cost: 6000, damage: 60, range: 220, attackSpeed: 700, splash: 140, name: '雪人' },
    ],
  },

  // ===== 中期核心输出塔 =====
  gunner: {
    id: 'gunner', name: '枪兵塔', category: 'basic',
    description: '高伤害攻城攻击，对加强甲有效',
    cost: 500, attackType: AttackType.SIEGE, damage: 40,
    range: 180, attackSpeed: 1300, splash: 0,
    color: 0x777755, projectileSpeed: 700, projectileColor: 0xAAAA88,
    upgrades: [
      { cost: 1700, damage: 70, range: 195, attackSpeed: 1200, splash: 0 },
      { cost: 4200, damage: 120, range: 210, attackSpeed: 1100, splash: 0 },
      { cost: 10000, damage: 200, range: 230, attackSpeed: 1000, splash: 0, name: '枪兵塔 4级' },
      { cost: 8000, damage: 350, range: 250, attackSpeed: 900, splash: 0, name: '枪兵塔 顶级' },
    ],
  },
  corruption: {
    id: 'corruption', name: '腐蚀塔', category: 'support',
    description: '降低敌人护甲值，使其更脆弱',
    cost: 200, attackType: AttackType.NORMAL, damage: 12,
    range: 160, attackSpeed: 1000, splash: 0,
    color: 0x886644, projectileSpeed: 500, projectileColor: 0xAA8866,
    special: 'armor_reduce',
    upgrades: [
      { cost: 400, damage: 20, range: 175, attackSpeed: 950, splash: 0 },
      { cost: 1000, damage: 30, range: 190, attackSpeed: 900, splash: 0 },
      { cost: 2500, damage: 50, range: 200, attackSpeed: 850, splash: 0 },
    ],
  },

  // ===== 光环塔 =====
  attack_aura: {
    id: 'attack_aura', name: '加攻光环', category: 'support',
    description: '提升周围友方塔20%攻击力',
    cost: 150, attackType: AttackType.NORMAL, damage: 0,
    range: 200, attackSpeed: 9999, splash: 0,
    color: 0xFF8844, projectileSpeed: 0, projectileColor: 0xFF8844,
    special: 'aura_attack',
    upgrades: [
      { cost: 500, damage: 0, range: 220, attackSpeed: 9999, splash: 0, name: '加攻光环 2级' },
      { cost: 2000, damage: 0, range: 250, attackSpeed: 9999, splash: 0, name: '加攻光环 顶级' },
    ],
  },
  speed_aura: {
    id: 'speed_aura', name: '加速光环', category: 'support',
    description: '提升周围友方塔20%攻击速度',
    cost: 150, attackType: AttackType.NORMAL, damage: 0,
    range: 200, attackSpeed: 9999, splash: 0,
    color: 0x44CCFF, projectileSpeed: 0, projectileColor: 0x44CCFF,
    special: 'aura_speed',
    upgrades: [
      { cost: 500, damage: 0, range: 220, attackSpeed: 9999, splash: 0, name: '加速光环 2级' },
      { cost: 2000, damage: 0, range: 250, attackSpeed: 9999, splash: 0, name: '加速光环 顶级' },
    ],
  },

  // ===== 对空塔 =====
  antiair: {
    id: 'antiair', name: '防空塔', category: 'special',
    description: '对空攻击，10级后对地对空，射程极远',
    cost: 300, attackType: AttackType.PIERCE, damage: 25,
    range: 200, attackSpeed: 800, splash: 0,
    color: 0xAAAACC, projectileSpeed: 800, projectileColor: 0xCCCCEE,
    special: 'antiair',
    upgrades: [
      { cost: 400, damage: 40, range: 220, attackSpeed: 750, splash: 0 },
      { cost: 700, damage: 60, range: 240, attackSpeed: 700, splash: 0 },
      { cost: 1200, damage: 90, range: 260, attackSpeed: 650, splash: 0 },
      { cost: 2000, damage: 130, range: 280, attackSpeed: 600, splash: 0 },
    ],
  },

  // ===== 多功能/混乱塔 =====
  chaos: {
    id: 'chaos', name: '混乱塔', category: 'special',
    description: '混乱攻击，对英雄甲和神圣甲200%伤害',
    cost: 400, attackType: AttackType.CHAOS, damage: 30,
    range: 170, attackSpeed: 1100, splash: 0,
    color: 0xCC44CC, projectileSpeed: 550, projectileColor: 0xFF66FF,
    upgrades: [
      { cost: 800, damage: 50, range: 185, attackSpeed: 1050, splash: 0 },
      { cost: 2000, damage: 85, range: 200, attackSpeed: 1000, splash: 0 },
      { cost: 5000, damage: 140, range: 220, attackSpeed: 950, splash: 0, name: '混乱塔 4级' },
    ],
  },
  destruction: {
    id: 'destruction', name: '破坏塔', category: 'hero',
    description: '英雄攻击，对神圣甲200%，可升级为超级破坏塔',
    cost: 800, attackType: AttackType.HERO, damage: 50,
    range: 180, attackSpeed: 1000, splash: 0,
    color: 0xFFDD44, projectileSpeed: 600, projectileColor: 0xFFEE88,
    special: 'hero_grow',
    upgrades: [
      { cost: 2000, damage: 90, range: 195, attackSpeed: 950, splash: 0, name: '破坏塔 2级' },
      { cost: 5000, damage: 150, range: 210, attackSpeed: 900, splash: 0, name: '破坏塔 3级' },
      { cost: 5000, damage: 280, range: 230, attackSpeed: 850, splash: 32, name: '国王塔' },
      { cost: 15000, damage: 600, range: 260, attackSpeed: 750, splash: 56, name: '超级破坏塔' },
    ],
  },

  // ===== 特殊塔 =====
  fire_sea: {
    id: 'fire_sea', name: '火海塔', category: 'aoe',
    description: '大范围火焰 AOE，魔法攻击对重甲有效',
    cost: 600, attackType: AttackType.MAGIC, damage: 35,
    range: 160, attackSpeed: 1400, splash: 64,
    color: 0xFF4400, projectileSpeed: 400, projectileColor: 0xFF6633,
    upgrades: [
      { cost: 1500, damage: 60, range: 175, attackSpeed: 1300, splash: 72 },
      { cost: 4000, damage: 100, range: 190, attackSpeed: 1200, splash: 80 },
      { cost: 10000, damage: 180, range: 210, attackSpeed: 1100, splash: 96, name: '火海塔 顶级' },
    ],
  },
  magic_illusion: {
    id: 'magic_illusion', name: '魔幻塔', category: 'hero',
    description: '成长塔，可切换攻击类型（穿刺/混乱/魔法）',
    cost: 700, attackType: AttackType.MAGIC, damage: 40,
    range: 175, attackSpeed: 1100, splash: 0,
    color: 0x8844CC, projectileSpeed: 550, projectileColor: 0xAA66FF,
    special: 'hero_grow',
    upgrades: [
      { cost: 1800, damage: 70, range: 190, attackSpeed: 1050, splash: 0, name: '魔幻塔 2级' },
      { cost: 4500, damage: 120, range: 210, attackSpeed: 1000, splash: 40, name: '魔幻塔 3级' },
      { cost: 12000, damage: 220, range: 230, attackSpeed: 900, splash: 56, name: '魔幻塔 4级' },
    ],
  },
  executioner: {
    id: 'executioner', name: '秒杀塔', category: 'special',
    description: '极低攻速但可秒杀单个非BOSS怪物',
    cost: 5000, attackType: AttackType.CHAOS, damage: 99999,
    range: 200, attackSpeed: 5000, splash: 0,
    color: 0xDD2222, projectileSpeed: 1000, projectileColor: 0xFF4444,
    special: 'execute',
    upgrades: [],
  },
  detect: {
    id: 'detect', name: '侦查塔', category: 'support',
    description: '侦测隐形单位，并提供视野',
    cost: 80, attackType: AttackType.NORMAL, damage: 3,
    range: 250, attackSpeed: 1500, splash: 0,
    color: 0xEEEECC, projectileSpeed: 500, projectileColor: 0xFFFFDD,
    special: 'detect',
    upgrades: [
      { cost: 200, damage: 6, range: 280, attackSpeed: 1400, splash: 0 },
      { cost: 500, damage: 12, range: 320, attackSpeed: 1300, splash: 0, name: '高级侦查塔' },
    ],
  },
};
