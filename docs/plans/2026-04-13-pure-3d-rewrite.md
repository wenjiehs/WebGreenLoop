# 纯 3D 重写实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完全删除 Phaser 依赖，用纯 Three.js + HTML/CSS UI 重写整个绿色循环圈塔防游戏。

**Architecture:** 
- Three.js 负责所有 3D 渲染（地图、塔、怪物、弹道、特效）
- HTML/CSS overlay 负责所有 UI（商店、信息面板、顶栏、英雄选择）
- 纯 TypeScript 类负责游戏逻辑实体（Tower/Enemy/Projectile 不再继承 Phaser.Container）
- requestAnimationFrame 驱动游戏主循环（替代 Phaser 的 scene.update）
- Three.js Raycaster 实现 3D 点击拾取（替代 Phaser 的像素坐标碰撞检测）

**Tech Stack:** Three.js, TypeScript, Vite, HTML/CSS (no Phaser)

**保留不变的文件：**
- `src/config/*` — 塔/怪物/波次/英雄配置（纯数据，无 Phaser 依赖）
- `src/utils/constants.ts` — 游戏常量
- `src/utils/helpers.ts` — 工具函数
- `src/systems/EconomyManager.ts` — 经济系统（纯逻辑）
- `src/systems/SoundManager.ts` — 音效系统（Web Audio）
- `src/rendering/*` — 已有的3D渲染模块（ThreeRenderer/TerrainBuilder/TowerModelFactory/EnemyModelFactory/EffectsSystem）

**需要重写的文件（去掉 Phaser 依赖）：**
- `src/systems/PathManager.ts` — Phaser.Math.Vector2 → 自定义 Vec2
- `src/systems/WaveManager.ts` — Phaser.Utils.Array.Shuffle → 原生 JS

**需要完全新建的文件：**
- `src/core/GameLoop.ts` — requestAnimationFrame 游戏主循环
- `src/core/InputManager.ts` — Three.js Raycaster 点击拾取 + 键盘
- `src/core/GameState.ts` — 游戏状态机（菜单/英雄选择/游戏中/暂停/结算）
- `src/entities/TowerLogic.ts` — 纯逻辑塔（不继承 Phaser.Container）
- `src/entities/EnemyLogic.ts` — 纯逻辑怪物
- `src/entities/ProjectileLogic.ts` — 纯逻辑弹道
- `src/entities/HeroTowerLogic.ts` — 纯逻辑英雄塔
- `src/ui/UIManager.ts` — HTML/CSS UI 管理（创建/更新/销毁 DOM 元素）
- `src/ui/ShopPanel.ts` — 商店面板
- `src/ui/InfoPanel.ts` — 塔信息面板
- `src/ui/HeroChoicePanel.ts` — 英雄选择面板
- `src/ui/TopBar.ts` — 顶部信息栏
- `src/ui/HeroHUD.ts` — 英雄状态HUD
- `src/rendering/SceneManager.ts` — 3D场景管理（替代 Phaser Scene 系统）
- `src/main.ts` — 入口（完全重写）
- `index.html` — 纯 Three.js 容器 + UI overlay

**需要删除的文件：**
- `src/scenes/BootScene.ts`
- `src/scenes/MainMenuScene.ts`
- `src/scenes/GameScene.ts`
- `src/scenes/GameOverScene.ts`
- `src/entities/Enemy.ts`（替换为 EnemyLogic.ts）
- `src/entities/Tower.ts`（替换为 TowerLogic.ts）
- `src/entities/HeroTower.ts`（替换为 HeroTowerLogic.ts）
- `src/entities/Projectile.ts`（替换为 ProjectileLogic.ts）
- `src/rendering/GameBridge.ts`（不再需要桥接层）

---

## 执行顺序（8个大任务）

### Task 1: 基础设施 — 去 Phaser 化 + 游戏主循环

**Files:**
- Delete: `src/scenes/*.ts` (4 files)
- Delete: `src/entities/*.ts` (4 files)  
- Delete: `src/rendering/GameBridge.ts`
- Rewrite: `src/systems/PathManager.ts` — 去掉 Phaser.Math.Vector2
- Rewrite: `src/systems/WaveManager.ts` — 去掉 Phaser 依赖
- Create: `src/core/GameLoop.ts`
- Create: `src/core/GameState.ts`
- Rewrite: `src/main.ts`
- Rewrite: `index.html`
- Modify: `package.json` — 卸载 phaser

### Task 2: 纯逻辑实体层

**Files:**
- Create: `src/entities/EnemyLogic.ts`
- Create: `src/entities/TowerLogic.ts`
- Create: `src/entities/ProjectileLogic.ts`
- Create: `src/entities/HeroTowerLogic.ts`

### Task 3: 3D 渲染整合 — 直接渲染实体

**Files:**
- Rewrite: `src/rendering/ThreeRenderer.ts` — 整合为完整的渲染管理器
- Keep: `src/rendering/TerrainBuilder.ts`
- Keep: `src/rendering/TowerModelFactory.ts`  
- Keep: `src/rendering/EnemyModelFactory.ts`
- Keep: `src/rendering/EffectsSystem.ts`
- Create: `src/rendering/EntityRenderer.ts` — 直接渲染实体（替代 GameBridge）

### Task 4: 3D 输入系统 — Raycaster 点击拾取

**Files:**
- Create: `src/core/InputManager.ts`

### Task 5: HTML/CSS UI 系统

**Files:**
- Create: `src/ui/UIManager.ts`
- Create: `src/ui/TopBar.ts`
- Create: `src/ui/ShopPanel.ts`
- Create: `src/ui/InfoPanel.ts`
- Create: `src/ui/HeroChoicePanel.ts`
- Create: `src/ui/HeroHUD.ts`
- Create: `src/ui/MenuScreen.ts`
- Create: `src/ui/GameOverScreen.ts`

### Task 6: 游戏核心循环集成

**Files:**
- Finalize: `src/core/GameLoop.ts` — 完整游戏逻辑（波次/建造/战斗/升级/出售）

### Task 7: 编译 + 修复 + 测试

### Task 8: 提交部署
