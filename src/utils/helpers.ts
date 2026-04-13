import { AttackType, ArmorType, DAMAGE_MATRIX } from './constants';

/**
 * 计算最终伤害
 */
export function calculateDamage(
  baseDamage: number,
  attackType: AttackType,
  armorType: ArmorType,
  armorValue: number = 0
): number {
  const multiplier = DAMAGE_MATRIX[attackType]?.[armorType] ?? 1.0;
  // 护甲减伤公式: 每点护甲减少约 6% 伤害
  const armorReduction = 1 - (0.06 * armorValue) / (1 + 0.06 * armorValue);
  return Math.max(1, Math.round(baseDamage * multiplier * armorReduction));
}

/**
 * 两点之间的距离
 */
export function distanceBetween(
  x1: number, y1: number,
  x2: number, y2: number
): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * 角度（弧度）从点1到点2
 */
export function angleBetween(
  x1: number, y1: number,
  x2: number, y2: number
): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * 网格坐标转像素坐标（中心点）
 */
export function gridToPixel(col: number, row: number, tileSize: number): { x: number; y: number } {
  return {
    x: col * tileSize + tileSize / 2,
    y: row * tileSize + tileSize / 2,
  };
}

/**
 * 像素坐标转网格坐标
 */
export function pixelToGrid(x: number, y: number, tileSize: number): { col: number; row: number } {
  return {
    col: Math.floor(x / tileSize),
    row: Math.floor(y / tileSize),
  };
}

/**
 * 格式化金钱显示
 */
export function formatGold(amount: number): string {
  if (amount >= 10000) {
    return (amount / 10000).toFixed(1) + '万';
  }
  return amount.toString();
}
