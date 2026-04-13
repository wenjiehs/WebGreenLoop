import * as THREE from 'three';
import { ThreeRenderer } from './ThreeRenderer';
import { TerrainBuilder } from './TerrainBuilder';
import { TowerModelFactory } from './TowerModelFactory';
import { EnemyModelFactory } from './EnemyModelFactory';
import { Tower } from '../entities/Tower';
import { Enemy } from '../entities/Enemy';
import { HeroTower } from '../entities/HeroTower';
import { PathManager } from '../systems/PathManager';
import { TILE_SIZE } from '../utils/constants';

interface TowerSync {
  tower: Tower;
  model: THREE.Group;
  lastLevel: number;
}

interface EnemySync {
  enemy: Enemy;
  model: THREE.Group;
  walkPhase: number;
}

interface ProjectileSync {
  model: THREE.Mesh;
  startTime: number;
}

/**
 * GameBridge - Phaser 游戏逻辑 ↔ Three.js 3D 渲染的同步桥
 * 每帧从 Phaser 实体读取状态，同步到 Three.js 对象
 */
export class GameBridge {
  private renderer: ThreeRenderer;
  private towerSyncs: Map<Tower, TowerSync> = new Map();
  private enemySyncs: Map<Enemy, EnemySync> = new Map();
  private projectiles: ProjectileSync[] = [];
  private heroSync: { hero: HeroTower; model: THREE.Group } | null = null;
  private terrainBuilt = false;

  // 缓存
  private towerGroup: THREE.Group;
  private enemyGroup: THREE.Group;
  private projectileGroup: THREE.Group;
  private effectGroup: THREE.Group;

  constructor(renderer: ThreeRenderer) {
    this.renderer = renderer;
    this.towerGroup = new THREE.Group();
    this.enemyGroup = new THREE.Group();
    this.projectileGroup = new THREE.Group();
    this.effectGroup = new THREE.Group();

    renderer.scene.add(this.towerGroup);
    renderer.scene.add(this.enemyGroup);
    renderer.scene.add(this.projectileGroup);
    renderer.scene.add(this.effectGroup);
  }

  /**
   * 构建地形（只调用一次）
   */
  buildTerrain(pathManager: PathManager): void {
    if (this.terrainBuilt) return;
    this.terrainBuilt = true;

    const builder = new TerrainBuilder(this.renderer);
    const terrain = builder.build(pathManager.getPathTiles());
    this.renderer.scene.add(terrain);

    // 出生点标记 - 红色光柱
    const spawn = pathManager.getSpawnPoint();
    const pos = ThreeRenderer.toWorld(spawn.x, spawn.y, 0);
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8),
      new THREE.MeshBasicMaterial({ color: 0xFF4444, transparent: true, opacity: 0.3 }),
    );
    pillar.position.set(pos.x, 0.75, pos.z);
    this.renderer.scene.add(pillar);
  }

  /**
   * 每帧同步 - 从 Phaser 读取实体状态，更新 Three.js
   */
  sync(towers: Tower[], enemies: Enemy[], heroTower: HeroTower | null, time: number): void {
    this.syncTowers(towers);
    this.syncEnemies(enemies, time);
    this.syncHero(heroTower);
    this.cleanupProjectiles();
    this.renderer.render();
  }

  // ====== 塔同步 ======

  private syncTowers(towers: Tower[]): void {
    // 新增的塔
    for (const tower of towers) {
      if (!this.towerSyncs.has(tower)) {
        const model = TowerModelFactory.create(tower.getConfig(), tower.getLevel());
        const pos = ThreeRenderer.toWorld(tower.x, tower.y, 0);
        model.position.set(pos.x, 0, pos.z);

        // 建造动画 - 从地下升起
        model.position.y = -0.5;
        this.animateRise(model, 0);

        this.towerGroup.add(model);
        this.towerSyncs.set(tower, { tower, model, lastLevel: tower.getLevel() });
      }
    }

    // 更新/移除
    for (const [tower, sync] of this.towerSyncs) {
      if (!tower.active || !towers.includes(tower)) {
        // 塔被移除 - 播放销毁动画
        this.animateDestroy(sync.model);
        this.towerSyncs.delete(tower);
        continue;
      }

      // 等级变化 → 更新模型
      if (tower.getLevel() !== sync.lastLevel) {
        this.towerGroup.remove(sync.model);
        const newModel = TowerModelFactory.create(tower.getConfig(), tower.getLevel());
        const pos = ThreeRenderer.toWorld(tower.x, tower.y, 0);
        newModel.position.set(pos.x, 0, pos.z);
        this.towerGroup.add(newModel);
        sync.model = newModel;
        sync.lastLevel = tower.getLevel();
        // 升级闪光
        this.spawnFlash(newModel.position, 0x44FF44);
      }
    }
  }

  // ====== 怪物同步 ======

  private syncEnemies(enemies: Enemy[], time: number): void {
    // 新增
    for (const enemy of enemies) {
      if (!this.enemySyncs.has(enemy)) {
        const model = EnemyModelFactory.create(enemy.getConfig());
        this.enemyGroup.add(model);
        this.enemySyncs.set(enemy, { enemy, model, walkPhase: Math.random() * Math.PI * 2 });
      }
    }

    // 更新位置
    for (const [enemy, sync] of this.enemySyncs) {
      if (!enemy.active || enemy.isDying() || !enemies.includes(enemy)) {
        // 死亡特效
        this.spawnDeathEffect(sync.model.position.clone(), enemy.getConfig().color);
        this.enemyGroup.remove(sync.model);
        this.disposeModel(sync.model);
        this.enemySyncs.delete(enemy);
        continue;
      }

      const pos = ThreeRenderer.toWorld(enemy.x, enemy.y, 0);
      sync.model.position.x = pos.x;
      sync.model.position.z = pos.z;

      // 飞行单位保持高度
      if (enemy.isFlying()) {
        sync.model.position.y = 0.6 + Math.sin(time * 0.003) * 0.05;
      } else {
        // 行走弹跳
        sync.walkPhase += 0.15;
        sync.model.position.y = Math.abs(Math.sin(sync.walkPhase)) * 0.03;
      }

      // 朝向（面向移动方向）
      // 简单方案：让模型轻微旋转
      sync.model.rotation.y += 0.01;

      // 隐形透明度变化
      if (enemy.isInvisible()) {
        const opacity = enemy.isRevealed() ? 0.7 : 0.25;
        sync.model.traverse((child) => {
          if (child instanceof THREE.Mesh && (child.material as any).opacity !== undefined) {
            (child.material as any).opacity = opacity;
          }
        });
      }

      // 血条 - 用 Sprite 模拟
      // 暂不实现，血条保持在 2D Phaser 层
    }
  }

  // ====== 英雄同步 ======

  private syncHero(heroTower: HeroTower | null): void {
    if (!heroTower?.active) {
      if (this.heroSync) {
        this.towerGroup.remove(this.heroSync.model);
        this.heroSync = null;
      }
      return;
    }

    if (!this.heroSync) {
      // 英雄用特殊模型 - 金色光柱+旗帜
      const model = new THREE.Group();

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.5, 0.3, 8),
        new THREE.MeshPhongMaterial({
          color: heroTower.getConfig().color,
          emissive: heroTower.getConfig().color,
          emissiveIntensity: 0.2,
        }),
      );
      base.position.y = 0.15;
      base.castShadow = true;
      model.add(base);

      // 英雄体
      const hero = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.25, 1),
        new THREE.MeshPhongMaterial({
          color: heroTower.getConfig().color,
          emissive: 0xFFD700,
          emissiveIntensity: 0.15,
          shininess: 50,
        }),
      );
      hero.position.y = 0.55;
      hero.castShadow = true;
      model.add(hero);

      // 光环
      const aura = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.02, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.3 }),
      );
      aura.rotation.x = Math.PI / 2;
      aura.position.y = 0.1;
      model.add(aura);

      const pos = ThreeRenderer.toWorld(heroTower.x, heroTower.y, 0);
      model.position.set(pos.x, 0, pos.z);
      this.towerGroup.add(model);
      this.heroSync = { hero: heroTower, model };
    } else {
      // 更新位置（英雄塔可能被移动）
      const pos = ThreeRenderer.toWorld(heroTower.x, heroTower.y, 0);
      this.heroSync.model.position.set(pos.x, 0, pos.z);
      // 英雄体轻微旋转
      this.heroSync.model.children[1].rotation.y += 0.02;
    }
  }

  // ====== 弹道同步（简化版，大部分弹道速度很快不需要精确同步） ======

  /**
   * 由 GameScene 调用，当发射弹道时创建 3D 弹道
   */
  spawnProjectile(fromX: number, fromY: number, toX: number, toY: number, color: number): void {
    const from = ThreeRenderer.toWorld(fromX, fromY, 0.3);
    const to = ThreeRenderer.toWorld(toX, toY, 0.15);

    const geo = new THREE.SphereGeometry(0.05, 4, 3);
    const mat = new THREE.MeshBasicMaterial({ color });
    const proj = new THREE.Mesh(geo, mat);
    proj.position.copy(from);
    this.projectileGroup.add(proj);

    // 快速飞过去然后消失
    const duration = 200;
    const start = performance.now();
    const projSync: ProjectileSync = { model: proj, startTime: start };
    this.projectiles.push(projSync);

    const animate = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / duration);
      proj.position.lerpVectors(from, to, t);
      // 抛物线高度
      proj.position.y += Math.sin(t * Math.PI) * 0.3;

      if (t >= 1) {
        this.projectileGroup.remove(proj);
        geo.dispose();
        mat.dispose();
      } else {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }

  private cleanupProjectiles(): void {
    const now = performance.now();
    this.projectiles = this.projectiles.filter(p => {
      if (now - p.startTime > 300) {
        this.projectileGroup.remove(p.model);
        return false;
      }
      return true;
    });
  }

  // ====== 特效 ======

  private spawnFlash(pos: THREE.Vector3, color: number): void {
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 }),
    );
    flash.position.copy(pos);
    flash.position.y += 0.3;
    this.effectGroup.add(flash);

    let frame = 0;
    const animate = () => {
      frame++;
      flash.scale.multiplyScalar(1.05);
      (flash.material as THREE.MeshBasicMaterial).opacity -= 0.04;
      if (frame > 15) {
        this.effectGroup.remove(flash);
        flash.geometry.dispose();
        (flash.material as THREE.MeshBasicMaterial).dispose();
      } else {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }

  private spawnDeathEffect(pos: THREE.Vector3, color: number): void {
    for (let i = 0; i < 6; i++) {
      const particle = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.04),
        new THREE.MeshBasicMaterial({ color }),
      );
      particle.position.copy(pos);
      particle.position.y += 0.2;
      this.effectGroup.add(particle);

      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 0.05,
        Math.random() * 0.04 + 0.02,
        (Math.random() - 0.5) * 0.05,
      );

      let frame = 0;
      const animate = () => {
        frame++;
        particle.position.add(dir);
        dir.y -= 0.002; // 重力
        particle.rotation.x += 0.1;
        particle.rotation.z += 0.1;
        (particle.material as THREE.MeshBasicMaterial).opacity -= 0.05;
        if (frame > 20) {
          this.effectGroup.remove(particle);
          particle.geometry.dispose();
          (particle.material as THREE.MeshBasicMaterial).dispose();
        } else {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  }

  private animateRise(model: THREE.Group, targetY: number): void {
    let frame = 0;
    const startY = model.position.y;
    const animate = () => {
      frame++;
      const t = Math.min(1, frame / 20);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      model.position.y = startY + (targetY - startY) * ease;
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  private animateDestroy(model: THREE.Group): void {
    let frame = 0;
    const animate = () => {
      frame++;
      model.position.y -= 0.03;
      model.scale.multiplyScalar(0.92);
      if (frame > 15) {
        this.towerGroup.remove(model);
        this.disposeModel(model);
      } else {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }

  private disposeModel(model: THREE.Group): void {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  /**
   * 重置（场景切换时）
   */
  reset(): void {
    this.towerSyncs.clear();
    this.enemySyncs.clear();
    this.projectiles = [];
    this.heroSync = null;

    // 清空所有动态组
    while (this.towerGroup.children.length) this.towerGroup.remove(this.towerGroup.children[0]);
    while (this.enemyGroup.children.length) this.enemyGroup.remove(this.enemyGroup.children[0]);
    while (this.projectileGroup.children.length) this.projectileGroup.remove(this.projectileGroup.children[0]);
    while (this.effectGroup.children.length) this.effectGroup.remove(this.effectGroup.children[0]);
    this.terrainBuilt = false;
  }
}
