# 绿色循环圈 Web 版 (Green Circle TD)

基于魔兽争霸3经典塔防地图「绿色循环圈」原版 v10.1 的 Web 复刻版。

## 🎮 在线游玩

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`

## 🎯 游戏规则

- 怪物在**闭合环形跑道**上无限循环奔跑
- 在跑道两侧建造防御塔消灭怪物
- **失败条件**: 场上怪物 > 100 或 BOSS 限时未击杀
- **胜利条件**: 消灭全部 50 波怪物
- 每波在下一波前清空怪物可获得 **PF 点数**

## ⌨️ 操作

| 操作 | 说明 |
|---|---|
| 鼠标点击商店 | 选择塔 |
| 鼠标点击地图 | 放置塔 / 选中已有塔 |
| Shift + 点击 | 连续建造同种塔 |
| 1-9, 0 | 快捷选择 10 种塔 |
| U | 升级选中的塔 |
| S | 出售选中的塔 |
| N | 立即开始下一波 |
| P | 暂停/继续 |
| Space | 切换速度 x1/x2/x3 |
| H | 攻击/护甲克制表 |
| ESC | 取消选择 |

## ⚔️ 攻击/护甲克制

不同攻击类型对不同护甲有伤害倍率加减，合理搭配塔阵是取胜关键。按游戏内 H 键查看完整克制表。

## 🏗️ 10 种防御塔

| 塔 | 攻击类型 | 特性 |
|---|---|---|
| 箭塔 | 穿刺 | 基础单体，对轻甲 200% |
| 炮塔 | 攻城 | 溅射 AOE，对神圣 150% |
| 魔法塔 | 魔法 | 减速，对重甲 200% |
| 毒塔 | 普通 | 持续毒伤害 DOT |
| 冰塔 | 魔法 | 范围冰冻减速 50% |
| 电塔 | 魔法 | 链式闪电 3 跳 |
| 火塔 | 混乱 | 高伤 AOE，全甲 100% |
| 骷髅塔 | 神圣 | 对神圣甲 150% |
| 国王塔 | 英雄 | 击杀成长，单体高伤 |
| 王后塔 | 英雄 | 击杀成长，溅射 AOE |

## 🎚️ 难度模式

- **简单**: 怪物 HP -30%，初始金 200
- **普通**: 标准参数
- **困难**: 怪物 HP +50%，初始金 80
- **地狱**: 怪物 HP +200%，初始金 60

## 🛠️ 技术栈

- **Phaser 3** - 2D 游戏引擎
- **TypeScript** - 类型安全
- **Vite** - 快速构建
- **Web Audio API** - 合成音效（零外部资源依赖）

## 📁 项目结构

```
src/
├── main.ts              # 入口
├── config/              # 数据配置
│   ├── towers.ts        # 10种塔
│   ├── enemies.ts       # 怪物类型
│   └── waves.ts         # 50波配置
├── entities/            # 游戏实体
│   ├── Tower.ts         # 防御塔
│   ├── Enemy.ts         # 怪物
│   └── Projectile.ts    # 弹道
├── systems/             # 游戏系统
│   ├── PathManager.ts   # 路径管理
│   ├── GridManager.ts   # 网格建造
│   ├── EconomyManager.ts# 经济系统
│   ├── WaveManager.ts   # 波次管理
│   └── SoundManager.ts  # 音效系统
├── scenes/              # 游戏场景
│   ├── BootScene.ts
│   ├── MainMenuScene.ts
│   ├── GameScene.ts
│   └── GameOverScene.ts
└── utils/
    ├── constants.ts     # 常量+克制矩阵
    └── helpers.ts       # 工具函数
```

## 📜 License

Fan-made project for educational purposes.
