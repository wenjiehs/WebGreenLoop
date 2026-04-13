import { STARTING_GOLD, STARTING_WOOD, TOWER_SELL_RATIO, TOWER_SELL_RATIO_WAVE1 } from '../utils/constants';

/**
 * 经济系统管理
 */
export class EconomyManager {
  private gold: number;
  private wood: number;
  private population: number;
  private maxPopulation: number;
  private currentWave: number = 0;
  private score: number = 0;
  private totalKills: number = 0;

  // 事件回调
  onGoldChange?: (gold: number) => void;
  onWoodChange?: (wood: number) => void;
  onPopulationChange?: (pop: number, max: number) => void;
  onScoreChange?: (score: number) => void;

  constructor(startingGold: number = STARTING_GOLD) {
    this.gold = startingGold;
    this.wood = STARTING_WOOD;
    this.population = 0;
    this.maxPopulation = 20;
  }

  getGold(): number { return this.gold; }
  getWood(): number { return this.wood; }
  getPopulation(): number { return this.population; }
  getMaxPopulation(): number { return this.maxPopulation; }
  getScore(): number { return this.score; }
  getTotalKills(): number { return this.totalKills; }

  setCurrentWave(wave: number): void {
    this.currentWave = wave;
  }

  canAfford(cost: number): boolean {
    return this.gold >= cost;
  }

  canBuild(): boolean {
    return this.population < this.maxPopulation;
  }

  spendGold(amount: number): boolean {
    if (this.gold >= amount) {
      this.gold -= amount;
      this.onGoldChange?.(this.gold);
      return true;
    }
    return false;
  }

  addGold(amount: number): void {
    this.gold += amount;
    this.onGoldChange?.(this.gold);
  }

  spendWood(amount: number): boolean {
    if (this.wood >= amount) {
      this.wood -= amount;
      this.onWoodChange?.(this.wood);
      return true;
    }
    return false;
  }

  addWood(amount: number): void {
    this.wood += amount;
    this.onWoodChange?.(this.wood);
  }

  addPopulation(amount: number = 1): void {
    this.population += amount;
    this.onPopulationChange?.(this.population, this.maxPopulation);
  }

  removePopulation(amount: number = 1): void {
    this.population = Math.max(0, this.population - amount);
    this.onPopulationChange?.(this.population, this.maxPopulation);
  }

  /**
   * 购买人口上限: 12 木 = 1 人口
   */
  buyPopulation(): boolean {
    if (this.wood >= 12) {
      this.wood -= 12;
      this.maxPopulation += 1;
      this.onWoodChange?.(this.wood);
      this.onPopulationChange?.(this.population, this.maxPopulation);
      return true;
    }
    return false;
  }

  /**
   * 木材交换: 5000 金 = 10 木
   */
  buyWood(): boolean {
    if (this.gold >= 5000) {
      this.gold -= 5000;
      this.wood += 10;
      this.onGoldChange?.(this.gold);
      this.onWoodChange?.(this.wood);
      return true;
    }
    return false;
  }

  /**
   * 击杀怪物奖励
   */
  onEnemyKilled(goldReward: number): void {
    this.gold += goldReward;
    this.totalKills += 1;
    this.score += goldReward * (this.currentWave + 1);
    this.onGoldChange?.(this.gold);
    this.onScoreChange?.(this.score);
  }

  /**
   * 出售塔的回收金额
   */
  getSellValue(totalInvested: number): number {
    const ratio = this.currentWave <= 1 ? TOWER_SELL_RATIO_WAVE1 : TOWER_SELL_RATIO;
    return Math.floor(totalInvested * ratio);
  }
}
