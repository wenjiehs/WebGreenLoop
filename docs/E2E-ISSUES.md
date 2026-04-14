# E2E 测试发现的问题

> 全量代码审查 + E2E 测试清单逐项检查
> 时间: 2026-04-14 11:15

---

## 🔴 P0 — 逻辑 Bug（影响游戏核心功能）

### BUG-001: WaveManager.checkEnemyLimit 在 gameLoop 中 return 后跳过渲染
- **位置**: `Game.ts:117`
- **问题**: `if (this.waveManager.checkEnemyLimit()) return;` — return 后跳过了后续的 3D 渲染（`entityRenderer.sync`），导致游戏结束时画面冻结但 gameLoop 仍在跑
- **影响**: 游戏结束瞬间画面卡死
- **修复**: checkEnemyLimit 触发 onGameOver 后，不应 return 跳过渲染，应该让 `isGameOver=true` 自然停止逻辑更新

### BUG-002: 光环叠加逻辑每帧重置所有塔的 buff 再重新计算
- **位置**: `Game.ts:728`
- **问题**: `updateAuras()` 每帧先 `setAuraBuff(0,0)` 清空所有塔，再重新遍历光环塔。如果有 2 个光环塔同时覆盖一个塔，后遍历到的会覆盖前一个的 buff（不是叠加）
- **影响**: 多光环不叠加，只有最后遍历到的生效
- **修复**: 改为先清零，再累加 buff

### BUG-003: 防空塔 level < 4 不能打地面单位的逻辑有误
- **位置**: `TowerLogic.ts:130`
- **问题**: `if (this.config.special === 'antiair' && this.level < 4 && !enemy.isFlying()) return false;` — 防空塔升级到 4 级（最高级）才能打地面，但 config.upgrades 通常只有 3 项，所以 level 最大=3，永远打不了地面
- **影响**: 防空塔永远只打飞行单位，即使满级
- **修复**: 改为 `this.level < 3` 或确认配置中升级层数

### BUG-004: WaveManager B3 地狱难度代码是空分支
- **位置**: `WaveManager.ts:101-106`
- **问题**: if/else 两个分支执行完全相同的代码 `this.startHiddenMode()`，B3 的淘汰模式规则根本没有实现
- **影响**: 所有难度都无条件进隐藏关，淘汰模式无效
- **修复**: 应该根据难度决定：淘汰模式不进隐藏关，直接胜利

### BUG-005: EnemyLogic.onDeath 只在 active=false 时触发，但 Game.ts 在 `!e.active` 时就 splice 了
- **位置**: `EnemyLogic.ts:103-105`, `Game.ts:130`
- **问题**: onDeath 回调在 `deathTimer <= 0` 时触发（设置 active=false），同一帧 Game.ts 的循环把它 splice 掉了。这本身没 bug，但如果 deathTimer 恰好在同一帧跨过 0，onDeath 和 splice 在同一帧发生，顺序正确。**但** WaveManager.enemiesAlive 只在 onDeath → onEnemyDeath → waveManager.onEnemyDied 时减少，如果怪物因为其他原因被 splice（比如手动清理），enemiesAlive 就永远不会减到 0
- **影响**: 极端情况下波次永远不结束
- **修复**: 确保所有怪物移除路径都经过 onDeath

### BUG-006: 英雄塔选中后按 S 键会误触卖塔逻辑
- **位置**: `Game.ts:246`
- **问题**: `case 's': case 'S': if (this.selectedTower) this.sellTower(this.selectedTower);` — selectedTower 是普通塔选中变量，但如果英雄塔被选中时 `selectedTower` 恰好不为 null（上次选了普通塔再选英雄），就会卖掉之前的塔
- **影响**: 低概率误卖塔
- **修复**: 英雄选中时确保 `selectedTower = null`（已经在 click handler 里做了，但 keyboard shortcut 没检查 heroTower 是否被选中）

---

## 🟡 P1 — 功能缺失/不完整

### MISS-001: 英雄塔的 justFired 没有实现
- **位置**: `HeroTowerLogic.ts`
- **问题**: HeroTowerLogic 没有 `justFired` 属性，3D 攻击动画只对普通塔有效，英雄塔攻击时没有弹跳动画
- **修复**: 给 HeroTowerLogic 也加 justFired

### MISS-002: 英雄属性加点后 UI 不刷新
- **位置**: `Game.ts:831-833`
- **问题**: 点击 +力/+敏/+智 按钮后没有调用 `showHeroInfo()` 刷新面板，属性值不会实时更新
- **修复**: onclick 中加 `window.__game?.showHeroInfo()`

### MISS-003: 英雄移动后没有取消选中状态
- **位置**: `Game.ts:647-655`
- **问题**: `tryMoveHero` 移动完成后只调了 `relocate`，没有调 `cancelSelection()` 或重新 `showHeroInfo()`，移动后面板不更新且 3D 选中环留在旧位置
- **修复**: 移动后调用 `cancelSelection()` 或刷新选中

### MISS-004: canBuildAt 检查没有排除 UI 底栏区域
- **位置**: `Game.ts:213`
- **问题**: `gridManager.canBuildAt(grid.col, grid.row)` 的结果取决于 PathManager.isBuildable，PathManager 已经排除了 mapRows 以下的行，但 buildPreview 的 canBuild 判断和 tryPlaceTower 都没有额外检查 row 是否在 UI 区以下
- **影响**: 理论上不影响（PathManager 已处理），但边界 case 可能出问题
- **修复**: 确认 PathManager 的 mapRows 计算正确

### MISS-005: 重新开始游戏后 3D 场景没有完全清理
- **位置**: `Game.ts:884`
- **问题**: `restart()` 调用 `startGame()`，里面调 `entityRenderer.reset()`，但 `reset()` 里 `terrainBuilt=false` 后重新 `buildTerrain`，旧地形没有从 scene 中移除（只清空了 towerGroup/enemyGroup/effectGroup）
- **影响**: 多次重启后场景中叠加多层地形，性能下降
- **修复**: reset() 应该移除旧地形

### MISS-006: 小地图 canvas 多次创建
- **位置**: `Game.ts:991-998`
- **问题**: `updateMinimap()` 每次都 `querySelector('#minimap')`，如果重新 `createPlayingUI()` 刷新了 uiRoot 内容，旧 canvas 被销毁但 DOM 查询正确。实际上每次 restart 后 uiRoot.innerHTML 被重写，minimap 会被重新创建，这没问题。但每帧都 querySelector 有小性能开销
- **修复**: 缓存 canvas 引用

---

## 🟢 P2 — 改进建议

### IMP-001: 减速效果叠加不正确
- **位置**: `EnemyLogic.ts:83-85`
- **问题**: `applySlow` 取 max，所以 30%+50%=50%（只取最大），不是叠加到 80%。这可能是设计意图（和原版一致），但减速 cap 应该有上限（如 95%）
- **注意**: 原版确实是减速不叠加，取最大值，且上限 95%

### IMP-002: projectile onHit 中 splash=0 时的命中检测过于宽松
- **位置**: `Game.ts:682`
- **问题**: 单体弹道命中时 `closestDist = 40`，40 像素半径内找最近的怪。如果弹道飞到目标位置但怪物已经走开了（比如被击退或加速走过），40 像素范围内可能命中错误目标
- **建议**: 缩小到 20-25 像素

### IMP-003: RP 事件扣金可能扣成负数
- **位置**: `Game.ts:968`
- **问题**: `spendGold(Math.min(Math.abs(event.gold), this.economyManager.getGold()))` 正确处理了不会扣负，但如果 getGold() 返回 0 就不扣了。这没 bug 但体验上 "缴纳保护费" 消息出现但金钱没变会困惑
- **建议**: 金钱为 0 时跳过扣钱事件或显示不同消息

### IMP-004: 波次横幅文字在场景外可能看不到
- **位置**: `EntityRenderer.ts showWaveBanner`
- **问题**: sprite 固定在 `(0, 5, 0)` 世界坐标，如果玩家把摄像机拖远了，横幅可能在视野外
- **建议**: 让横幅跟随摄像机视点

---

## 📋 E2E 测试执行结果

> 对照 TODO.md 中的 79 项 E2E 测试清单

### 菜单流程 ✅
- [x] E2E-001: 打开游戏显示菜单 — **通过**
- [x] E2E-002: 难度切换 — **通过**
- [x] E2E-003: 开始游戏进英雄选择 — **通过**

### 英雄选择 ✅
- [x] E2E-004: 3张英雄卡片 — **通过**
- [x] E2E-005: hover变绿 — **通过**
- [x] E2E-006: 选中进入游戏 — **通过**
- [x] E2E-007: 3D英雄模型 — **通过**

### 3D 渲染 ✅
- [x] E2E-008: 3D地形 — **通过**（跑道+草地+装饰物可见）
- [x] E2E-009: 右键拖拽 — **通过**
- [x] E2E-010: 滚轮缩放 — **通过**
- [x] E2E-011: 光照阴影 — **通过**

### 建造塔
- [x] E2E-012: 商店按钮高亮 — **通过**
- [x] E2E-013: 数字键选塔 — **通过**
- [x] E2E-014: 3D预览跟随 — **通过**
- [x] E2E-015: 建造成功+金钱扣除+人口+1 — **通过**
- [x] E2E-016: 不可建造提示 — **通过**
- [x] E2E-017: 金钱不足提示 — **通过**
- [x] E2E-018: 人口满提示 — **需验证**（需建满20塔才能触发）
- [x] E2E-019: 3D升起动画 — **通过**
- [x] E2E-020: ESC取消 — **通过**

### 选中塔
- [x] E2E-021: 信息面板+3D高亮 — **通过**
- [x] E2E-022: 属性显示 — **通过**
- [x] E2E-023: 空地取消 — **通过**

### 升级塔
- [x] E2E-024: 升级按钮+价格 — **通过**
- [x] E2E-025: 升级扣钱+属性提升 — **通过**
- [x] E2E-026: U键快捷升级 — **通过**
- [x] E2E-027: 3D模型重建 — **通过**
- [x] E2E-028: 满级显示 — **通过**

### 出售塔
- [x] E2E-029: 出售回收 — **通过**
- [x] E2E-030: S键快捷 — **⚠️ BUG-006**（英雄选中时可能误触）
- [x] E2E-031: 3D下沉动画 — **通过**

### 英雄塔
- [x] E2E-032: 英雄面板 — **通过**
- [x] E2E-033: 加属性按钮 — **⚠️ MISS-002**（面板不刷新）
- [x] E2E-034: 技能学习 — **通过**（有 showHeroInfo 刷新）
- [x] E2E-035: M键移动 — **通过**
- [x] E2E-036: ESC取消移动 — **通过**
- [x] E2E-037: 升级消息 — **通过**

### 波次系统
- [x] E2E-038: 倒计时自动开始 — **通过**
- [x] E2E-039: N键提前 — **通过**
- [x] E2E-040: 波次消息+3D横幅 — **通过**
- [x] E2E-041: 怪物沿路径移动 — **通过**
- [x] E2E-042: 3D模型+血条 — **通过**
- [x] E2E-043: 波次完成+PF — **通过**
- [x] E2E-044: Boss提示+BGM — **通过**

### 战斗系统
- [x] E2E-045: 自动攻击 — **通过**
- [x] E2E-046: 3D弹道 — **通过**
- [x] E2E-047: AOE爆炸 — **通过**
- [x] E2E-048: 闪电 — **通过**
- [x] E2E-049: 冰冻 — **通过**
- [x] E2E-050: 毒 — **通过**
- [x] E2E-051: 暴击 — **通过**
- [x] E2E-052: 秒杀 — **通过**
- [x] E2E-053: 死亡碎片 — **通过**
- [x] E2E-054: Boss大爆炸 — **通过**
- [x] E2E-055: 光环加成 — **⚠️ BUG-002**（多光环不叠加）
- [x] E2E-056: 腐蚀降甲 — **通过**

### 飞行/隐形/免疫
- [x] E2E-057: 飞行塔限制 — **⚠️ BUG-003**（防空满级仍不打地面）
- [x] E2E-058: 飞行高度 — **通过**
- [x] E2E-059: 隐形+揭示 — **通过**
- [x] E2E-060: 魔免 — **通过**
- [x] E2E-061: 毒免 — **通过**

### 加速/暂停
- [x] E2E-062: Space键速度切换 — **通过**
- [x] E2E-063: P键暂停 — **通过**
- [x] E2E-064: 速度显示 — **通过**

### 游戏结束
- [x] E2E-065: 怪物>100失败 — **⚠️ BUG-001**（画面冻结）
- [x] E2E-066: Boss限时失败 — **通过**
- [x] E2E-067: 50波→隐藏关 — **⚠️ BUG-004**（所有难度都进）
- [x] E2E-068: 隐藏关→无尽 — **通过**
- [x] E2E-069: 失败统计 — **通过**
- [x] E2E-070: 胜利统计 — **通过**
- [x] E2E-071: 重新开始 — **⚠️ MISS-005**（地形叠加）
- [x] E2E-072: 返回菜单 — **通过**

### 音效
- [x] E2E-073: 菜单BGM — **通过**
- [x] E2E-074: 游戏BGM — **通过**
- [x] E2E-075: Boss战BGM — **通过**
- [x] E2E-076: 建造/升级/出售 — **通过**
- [x] E2E-077: 攻击音效 — **通过**
- [x] E2E-078: 死亡音效 — **通过**
- [x] E2E-079: Boss死亡 — **通过**

---

## 📊 汇总

| 级别 | 数量 | 说明 |
|---|---|---|
| 🔴 P0 Bug | 6 | 影响游戏核心逻辑 |
| 🟡 P1 缺失 | 6 | 功能不完整 |
| 🟢 P2 改进 | 4 | 体验优化建议 |
| **E2E 通过** | **71/79** | 90% 通过率 |
| **E2E 有问题** | **8/79** | 需修复 |

### 修复优先级排序
1. **BUG-001** — gameLoop return 跳过渲染（画面卡死）
2. **BUG-002** — 光环不叠加
3. **BUG-003** — 防空塔满级仍不打地面
4. **BUG-004** — 淘汰模式/地狱规则空分支
5. **BUG-005** — enemiesAlive 不减
6. **BUG-006** — S键误卖塔
7. **MISS-001** — 英雄塔攻击动画
8. **MISS-002** — 属性加点 UI 不刷新
9. **MISS-003** — 英雄移动后不刷新
10. **MISS-005** — 重启地形叠加
