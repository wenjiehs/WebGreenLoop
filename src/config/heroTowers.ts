import { AttackType } from '../utils/constants';

/**
 * 英雄成长塔配置
 * 绿色循环圈的核心机制：每位玩家开局随机获得一个英雄塔
 * 英雄塔通过击杀怪物获得经验升级，有力量/敏捷/智力三维属性
 * 每个英雄有4个独特技能，部分为主动技能（有CD）
 */

export interface HeroSkill {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  isActive: boolean;      // true=主动技能（有CD），false=被动/附加效果
  cooldown?: number;       // 主动技能 CD（ms），仅 isActive=true 时有效
  effect: HeroSkillEffect;
}

export interface HeroSkillEffect {
  type: 'damage_boost' | 'aoe' | 'chain' | 'slow' | 'armor_reduce' | 'critical' |
        'summon' | 'lifesteal' | 'dot' | 'splash' | 'multishot' | 'execute' |
        'teleport' | 'passive_aura' | 'transform';
  baseValue: number;
  perLevel: number;
  scaling?: 'str' | 'agi' | 'int';
}

export interface HeroTowerConfig {
  id: string;
  name: string;
  title: string;
  description: string;
  color: number;
  projectileColor: number;
  baseAttackType: AttackType;
  baseDamage: number;
  baseRange: number;
  baseAttackSpeed: number;
  strGrowth: number;
  agiGrowth: number;
  intGrowth: number;
  strEffect: string;
  agiEffect: string;
  intEffect: string;
  skills: HeroSkill[];
  recommendedSkillOrder: string;
  recommendedStats: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const HERO_TOWER_CONFIGS: HeroTowerConfig[] = [
  {
    id: 'fire_soul', name: '火魂', title: '烈焰之灵',
    description: '远程魔法输出，智力越高火焰伤害越强',
    color: 0xFF4400, projectileColor: 0xFF6633,
    baseAttackType: AttackType.MAGIC, baseDamage: 15, baseRange: 180, baseAttackSpeed: 1000,
    strGrowth: 1.5, agiGrowth: 1.0, intGrowth: 2.5,
    strEffect: '增加HP上限', agiEffect: '增加攻速', intEffect: '增加技能伤害',
    skills: [
      { id: 'fire_bolt', name: '火球术', description: '强化普攻，附加智力系火焰伤害', maxLevel: 5, isActive: false,
        effect: { type: 'damage_boost', baseValue: 20, perLevel: 15, scaling: 'int' } },
      { id: 'flame_wave', name: '烈焰波', description: '每8s释放火焰波，伤害范围内所有敌人', maxLevel: 5, isActive: true, cooldown: 8000,
        effect: { type: 'aoe', baseValue: 30, perLevel: 20, scaling: 'int' } },
      { id: 'ignite', name: '点燃', description: '普攻附带灼烧DOT，持续4秒', maxLevel: 5, isActive: false,
        effect: { type: 'dot', baseValue: 8, perLevel: 6, scaling: 'int' } },
      { id: 'inferno', name: '地狱火', description: '每15s召唤地狱火轰炸，超大范围', maxLevel: 3, isActive: true, cooldown: 15000,
        effect: { type: 'splash', baseValue: 80, perLevel: 40, scaling: 'int' } },
    ],
    recommendedSkillOrder: '1→3→2→4', recommendedStats: '力180 敏0 智400', difficulty: 'medium',
  },
  {
    id: 'shadow_hunter', name: '小黑', title: '暗影猎手',
    description: '敏捷型物理输出，攻速极快',
    color: 0x334466, projectileColor: 0x5566AA,
    baseAttackType: AttackType.PIERCE, baseDamage: 12, baseRange: 200, baseAttackSpeed: 800,
    strGrowth: 1.0, agiGrowth: 2.5, intGrowth: 1.5,
    strEffect: '增加基础伤害', agiEffect: '增加攻速和闪避', intEffect: '增加技能效果',
    skills: [
      { id: 'frost_arrow', name: '冰箭', description: '普攻附带减速30%，持续2秒', maxLevel: 5, isActive: false,
        effect: { type: 'slow', baseValue: 0.15, perLevel: 0.05, scaling: 'agi' } },
      { id: 'multishot', name: '多重箭', description: '每次攻击额外射出N支箭', maxLevel: 5, isActive: false,
        effect: { type: 'multishot', baseValue: 2, perLevel: 1, scaling: 'agi' } },
      { id: 'silence', name: '沉默之箭', description: '普攻降低目标护甲值', maxLevel: 5, isActive: false,
        effect: { type: 'armor_reduce', baseValue: 1, perLevel: 1, scaling: 'int' } },
      { id: 'starfall', name: '流星雨', description: '每12s召唤流星雨，范围AOE', maxLevel: 3, isActive: true, cooldown: 12000,
        effect: { type: 'splash', baseValue: 50, perLevel: 30, scaling: 'agi' } },
    ],
    recommendedSkillOrder: '1→2→3→4', recommendedStats: '力240 敏高 智320', difficulty: 'easy',
  },
  {
    id: 'blade_master', name: '剑神', title: '无双剑客',
    description: '力量型近战英雄，暴击伤害极高',
    color: 0xCC8844, projectileColor: 0xFFAA66,
    baseAttackType: AttackType.HERO, baseDamage: 20, baseRange: 160, baseAttackSpeed: 900,
    strGrowth: 2.5, agiGrowth: 2.0, intGrowth: 0.5,
    strEffect: '增加攻击力', agiEffect: '增加攻速和暴击', intEffect: '增加技能范围',
    skills: [
      { id: 'critical_strike', name: '致命一击', description: '暴击率+8%/级，暴击倍率1.5起', maxLevel: 5, isActive: false,
        effect: { type: 'critical', baseValue: 1.5, perLevel: 0.3, scaling: 'str' } },
      { id: 'blade_storm', name: '剑刃风暴', description: '每10s旋转攻击周围所有敌人', maxLevel: 5, isActive: true, cooldown: 10000,
        effect: { type: 'splash', baseValue: 40, perLevel: 25, scaling: 'str' } },
      { id: 'mirror_image', name: '镜像', description: '增加等效输出(分身)', maxLevel: 5, isActive: false,
        effect: { type: 'damage_boost', baseValue: 0.2, perLevel: 0.1, scaling: 'agi' } },
      { id: 'omnislash', name: '无双斩', description: '每20s对范围内多目标连斩', maxLevel: 3, isActive: true, cooldown: 20000,
        effect: { type: 'chain', baseValue: 100, perLevel: 60, scaling: 'str' } },
    ],
    recommendedSkillOrder: '1→3→2→4', recommendedStats: '力300 敏240', difficulty: 'medium',
  },
  {
    id: 'storm_spirit', name: '电法', title: '风暴之灵',
    description: '智力型法师，连锁闪电可扫清成群怪物',
    color: 0x4488FF, projectileColor: 0x66AAFF,
    baseAttackType: AttackType.MAGIC, baseDamage: 14, baseRange: 190, baseAttackSpeed: 1100,
    strGrowth: 1.0, agiGrowth: 1.5, intGrowth: 2.5,
    strEffect: '增加HP', agiEffect: '增加攻速', intEffect: '增加闪电伤害和跳数',
    skills: [
      { id: 'chain_lightning', name: '连锁闪电', description: '普攻附带闪电跳跃，跳3+目标', maxLevel: 5, isActive: false,
        effect: { type: 'chain', baseValue: 25, perLevel: 15, scaling: 'int' } },
      { id: 'static_field', name: '静电场', description: '每6s对范围敌人造成智力系伤害', maxLevel: 5, isActive: true, cooldown: 6000,
        effect: { type: 'aoe', baseValue: 15, perLevel: 10, scaling: 'int' } },
      { id: 'overload', name: '过载', description: '普攻附加额外闪电伤害', maxLevel: 5, isActive: false,
        effect: { type: 'damage_boost', baseValue: 10, perLevel: 8, scaling: 'int' } },
      { id: 'thunder_god', name: '雷神之怒', description: '每18s召唤雷暴大范围伤害', maxLevel: 3, isActive: true, cooldown: 18000,
        effect: { type: 'splash', baseValue: 70, perLevel: 45, scaling: 'int' } },
    ],
    recommendedSkillOrder: '1→3→2→4', recommendedStats: '力160 敏200 智高', difficulty: 'medium',
  },
  {
    id: 'water_mage', name: '水魔', title: '水元素法师',
    description: '敏捷型辅助，水墨环可大幅减速敌人',
    color: 0x2288CC, projectileColor: 0x44AAEE,
    baseAttackType: AttackType.MAGIC, baseDamage: 12, baseRange: 170, baseAttackSpeed: 1000,
    strGrowth: 1.0, agiGrowth: 2.0, intGrowth: 2.0,
    strEffect: '增加HP', agiEffect: '增加水墨环减速效果', intEffect: '增加暴风雨伤害',
    skills: [
      { id: 'water_bolt', name: '水弹', description: '普攻附带减速20%+5%/级', maxLevel: 5, isActive: false,
        effect: { type: 'slow', baseValue: 0.2, perLevel: 0.05, scaling: 'agi' } },
      { id: 'summon_water', name: '召唤水人', description: '召唤水元素，增加额外输出', maxLevel: 5, isActive: false,
        effect: { type: 'summon', baseValue: 1, perLevel: 1, scaling: 'int' } },
      { id: 'storm', name: '暴风雨', description: '每10s释放暴风雨AOE', maxLevel: 5, isActive: true, cooldown: 10000,
        effect: { type: 'aoe', baseValue: 25, perLevel: 18, scaling: 'int' } },
      { id: 'water_ring', name: '水墨环', description: '永久减速光环，敏捷影响效果', maxLevel: 3, isActive: false,
        effect: { type: 'passive_aura', baseValue: 0.3, perLevel: 0.1, scaling: 'agi' } },
    ],
    recommendedSkillOrder: '1→3→2→4', recommendedStats: '力160 敏250 智250', difficulty: 'hard',
  },
  {
    id: 'wind_god', name: '风神', title: '疾风之翼',
    description: '智力型远程，风系技能可控可打',
    color: 0x88CC88, projectileColor: 0xAAEEAA,
    baseAttackType: AttackType.PIERCE, baseDamage: 13, baseRange: 200, baseAttackSpeed: 900,
    strGrowth: 1.0, agiGrowth: 1.5, intGrowth: 2.5,
    strEffect: '增加HP', agiEffect: '增加攻速', intEffect: '增加风暴伤害',
    skills: [
      { id: 'gust', name: '风暴突袭', description: '每8s释放风暴AOE推开敌人', maxLevel: 5, isActive: true, cooldown: 8000,
        effect: { type: 'aoe', baseValue: 20, perLevel: 15, scaling: 'int' } },
      { id: 'tornado', name: '龙卷风', description: '普攻附带风系DOT，持续3秒', maxLevel: 5, isActive: false,
        effect: { type: 'dot', baseValue: 12, perLevel: 8, scaling: 'int' } },
      { id: 'wind_walk', name: '风行术', description: '被动提升攻速', maxLevel: 5, isActive: false,
        effect: { type: 'damage_boost', baseValue: 0.15, perLevel: 0.08, scaling: 'agi' } },
      { id: 'cyclone', name: '飓风', description: '每16s大范围风暴伤害', maxLevel: 3, isActive: true, cooldown: 16000,
        effect: { type: 'splash', baseValue: 60, perLevel: 40, scaling: 'int' } },
    ],
    recommendedSkillOrder: '2→3→1→4', recommendedStats: '力160 敏240 智320', difficulty: 'hard',
  },
  {
    id: 'war_god', name: '战神', title: '不灭战魂',
    description: '全属性战士，均衡发展，技能丰富',
    color: 0xDD6622, projectileColor: 0xFF8844,
    baseAttackType: AttackType.CHAOS, baseDamage: 18, baseRange: 165, baseAttackSpeed: 950,
    strGrowth: 2.0, agiGrowth: 1.5, intGrowth: 1.5,
    strEffect: '增加攻击力', agiEffect: '增加攻速', intEffect: '增加技能伤害',
    skills: [
      { id: 'war_cry', name: '战吼', description: '被动提升攻击力', maxLevel: 5, isActive: false,
        effect: { type: 'damage_boost', baseValue: 0.2, perLevel: 0.1, scaling: 'str' } },
      { id: 'cleave', name: '劈斩', description: '普攻附带溅射', maxLevel: 5, isActive: false,
        effect: { type: 'splash', baseValue: 30, perLevel: 15, scaling: 'str' } },
      { id: 'berserker', name: '狂暴', description: '每12s进入狂暴态，攻速翻倍5秒', maxLevel: 5, isActive: true, cooldown: 12000,
        effect: { type: 'damage_boost', baseValue: 0.3, perLevel: 0.15, scaling: 'agi' } },
      { id: 'god_strike', name: '神罚', description: '每20s对单体造成巨额神圣伤害', maxLevel: 3, isActive: true, cooldown: 20000,
        effect: { type: 'damage_boost', baseValue: 200, perLevel: 100, scaling: 'str' } },
    ],
    recommendedSkillOrder: '1→2→3→4', recommendedStats: '力240 敏250 智随意', difficulty: 'easy',
  },
  {
    id: 'beast_master', name: '兽王', title: '万兽之王',
    description: '召唤型英雄，召唤野兽协助战斗',
    color: 0x886622, projectileColor: 0xAA8844,
    baseAttackType: AttackType.NORMAL, baseDamage: 16, baseRange: 175, baseAttackSpeed: 1000,
    strGrowth: 2.0, agiGrowth: 1.5, intGrowth: 1.5,
    strEffect: '增加攻击力', agiEffect: '增加攻速', intEffect: '增加召唤物数量',
    skills: [
      { id: 'summon_hawk', name: '召唤战鹰', description: '召唤战鹰持续输出(被动加伤)', maxLevel: 5, isActive: false,
        effect: { type: 'summon', baseValue: 1, perLevel: 1, scaling: 'int' } },
      { id: 'summon_bear', name: '召唤巨熊', description: '召唤巨熊近战(被动加伤)', maxLevel: 5, isActive: false,
        effect: { type: 'summon', baseValue: 1, perLevel: 1, scaling: 'str' } },
      { id: 'roar', name: '咆哮', description: '被动攻击光环，增加周围塔输出', maxLevel: 5, isActive: false,
        effect: { type: 'passive_aura', baseValue: 0.15, perLevel: 0.1, scaling: 'str' } },
      { id: 'stampede', name: '万兽奔腾', description: '每20s全力爆发，伤害翻倍5秒', maxLevel: 3, isActive: true, cooldown: 20000,
        effect: { type: 'damage_boost', baseValue: 0.5, perLevel: 0.25, scaling: 'str' } },
    ],
    recommendedSkillOrder: '1→2→3→4', recommendedStats: '力高 智高', difficulty: 'hard',
  },
  {
    id: 'demon_child', name: '恶魔之子', title: '地狱恶童',
    description: '智力型暗系英雄，成长潜力极高',
    color: 0x660044, projectileColor: 0x990066,
    baseAttackType: AttackType.CHAOS, baseDamage: 14, baseRange: 175, baseAttackSpeed: 1050,
    strGrowth: 1.5, agiGrowth: 1.0, intGrowth: 2.5,
    strEffect: '增加HP', agiEffect: '增加攻速', intEffect: '增加暗影伤害',
    skills: [
      { id: 'shadow_bolt', name: '暗影箭', description: '强化普攻，附加智力系暗影伤害', maxLevel: 5, isActive: false,
        effect: { type: 'damage_boost', baseValue: 25, perLevel: 18, scaling: 'int' } },
      { id: 'summon_imp', name: '召唤小鬼', description: '被动增加额外输出', maxLevel: 5, isActive: false,
        effect: { type: 'summon', baseValue: 1, perLevel: 1, scaling: 'int' } },
      { id: 'dark_ritual', name: '暗黑仪式', description: '每15s献祭爆发，大幅增伤8秒', maxLevel: 5, isActive: true, cooldown: 15000,
        effect: { type: 'damage_boost', baseValue: 0.3, perLevel: 0.15, scaling: 'int' } },
      { id: 'doom', name: '末日', description: '普攻附带毁灭DOT，持续5秒', maxLevel: 3, isActive: false,
        effect: { type: 'dot', baseValue: 50, perLevel: 30, scaling: 'int' } },
    ],
    recommendedSkillOrder: '1→2→4→3', recommendedStats: '力240 智全加', difficulty: 'medium',
  },
  {
    id: 'ice_witch', name: '寒冰', title: '冰霜女巫',
    description: '控制型法师，冰冻能力极强',
    color: 0x88CCFF, projectileColor: 0xAAEEFF,
    baseAttackType: AttackType.MAGIC, baseDamage: 11, baseRange: 185, baseAttackSpeed: 1100,
    strGrowth: 0.5, agiGrowth: 1.5, intGrowth: 3.0,
    strEffect: '增加HP', agiEffect: '增加攻速', intEffect: '增加冰冻伤害和时间',
    skills: [
      { id: 'frost_nova', name: '霜冻新星', description: '每8s释放冰爆，范围伤害+减速', maxLevel: 5, isActive: true, cooldown: 8000,
        effect: { type: 'aoe', baseValue: 20, perLevel: 12, scaling: 'int' } },
      { id: 'blizzard', name: '暴风雪', description: '每14s召唤暴风雪持续伤害', maxLevel: 5, isActive: true, cooldown: 14000,
        effect: { type: 'splash', baseValue: 35, perLevel: 20, scaling: 'int' } },
      { id: 'ice_armor', name: '冰甲术', description: '普攻附带深度减速', maxLevel: 5, isActive: false,
        effect: { type: 'slow', baseValue: 0.25, perLevel: 0.05, scaling: 'int' } },
      { id: 'absolute_zero', name: '绝对零度', description: '永久减速光环，智力影响范围', maxLevel: 3, isActive: false,
        effect: { type: 'passive_aura', baseValue: 0.4, perLevel: 0.1, scaling: 'int' } },
    ],
    recommendedSkillOrder: '3→4→1→2', recommendedStats: '智力全加', difficulty: 'easy',
  },
  {
    id: 'phantom', name: '幻影', title: '幻影刺客',
    description: '敏捷型刺客，暴击连击爆发极强',
    color: 0x553366, projectileColor: 0x775588,
    baseAttackType: AttackType.HERO, baseDamage: 16, baseRange: 155, baseAttackSpeed: 750,
    strGrowth: 2.0, agiGrowth: 2.5, intGrowth: 0.5,
    strEffect: '增加攻击力(每50+400)', agiEffect: '增加攻速和暴击率', intEffect: '增加技能冷却',
    skills: [
      { id: 'phantom_strike', name: '幻影突袭', description: '被动连击，每次攻击多打一次', maxLevel: 5, isActive: false,
        effect: { type: 'damage_boost', baseValue: 0.3, perLevel: 0.15, scaling: 'agi' } },
      { id: 'blur', name: '模糊', description: '被动增加攻击和闪避', maxLevel: 5, isActive: false,
        effect: { type: 'damage_boost', baseValue: 0.15, perLevel: 0.1, scaling: 'agi' } },
      { id: 'coup_de_grace', name: '恩赐解脱', description: '暴击率+8%/级，倍率2.0起', maxLevel: 5, isActive: false,
        effect: { type: 'critical', baseValue: 2.0, perLevel: 0.5, scaling: 'str' } },
      { id: 'shadow_dance', name: '暗影之舞', description: '每15s进入暗影态，攻速极限5秒', maxLevel: 3, isActive: true, cooldown: 15000,
        effect: { type: 'damage_boost', baseValue: 0.5, perLevel: 0.25, scaling: 'agi' } },
    ],
    recommendedSkillOrder: '1→2→3→4', recommendedStats: '力160+ 敏全加', difficulty: 'hard',
  },
  {
    id: 'tauren_chief', name: '神牛', title: '牛头人酋长',
    description: '力量型坦克英雄，AOE震荡波威力巨大',
    color: 0x996633, projectileColor: 0xBB8855,
    baseAttackType: AttackType.NORMAL, baseDamage: 22, baseRange: 150, baseAttackSpeed: 1200,
    strGrowth: 3.0, agiGrowth: 1.0, intGrowth: 1.0,
    strEffect: '增加攻击力和震荡伤害', agiEffect: '增加攻速', intEffect: '增加技能范围',
    skills: [
      { id: 'war_stomp', name: '战争践踏', description: '每8s践踏范围内敌人并眩晕', maxLevel: 5, isActive: true, cooldown: 8000,
        effect: { type: 'aoe', baseValue: 40, perLevel: 25, scaling: 'str' } },
      { id: 'shockwave', name: '震荡波', description: '普攻附带直线冲击波', maxLevel: 5, isActive: false,
        effect: { type: 'aoe', baseValue: 35, perLevel: 20, scaling: 'str' } },
      { id: 'endurance', name: '耐久光环', description: '被动攻速光环，增强周围塔', maxLevel: 5, isActive: false,
        effect: { type: 'passive_aura', baseValue: 0.1, perLevel: 0.05, scaling: 'str' } },
      { id: 'reincarnation', name: '重生', description: '每25s释放震荡大爆炸', maxLevel: 3, isActive: true, cooldown: 25000,
        effect: { type: 'splash', baseValue: 100, perLevel: 60, scaling: 'str' } },
    ],
    recommendedSkillOrder: '2→1→3→4', recommendedStats: '力全加', difficulty: 'easy',
  },
];

export function getRandomHeroTower(): HeroTowerConfig {
  return HERO_TOWER_CONFIGS[Math.floor(Math.random() * HERO_TOWER_CONFIGS.length)];
}

export function getRandomHeroChoices(count: number = 3): HeroTowerConfig[] {
  const shuffled = [...HERO_TOWER_CONFIGS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
