import * as THREE from 'three';
import { ThreeRenderer } from './ThreeRenderer';
import { TerrainBuilder } from './TerrainBuilder';
import { TowerModelFactory } from './TowerModelFactory';
import { EnemyModelFactory } from './EnemyModelFactory';
import { EffectsSystem } from './EffectsSystem';
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
  lastX: number;
  lastZ: number;
}

/**
 * GameBridge - Phaser↔Three.js 实体同步
 * 全面增强：朝向追踪/3D血条/选中高亮/范围预览/攻击动画/建造预览/波次动画
 */
export class GameBridge {
  private renderer: ThreeRenderer;
  private towerSyncs: Map<Tower, TowerSync> = new Map();
  private enemySyncs: Map<Enemy, EnemySync> = new Map();
  private heroSync: { hero: HeroTower; model: THREE.Group } | null = null;
  private terrainBuilt = false;
  effects: EffectsSystem;

  // 3D 组
  private towerGroup: THREE.Group;
  private enemyGroup: THREE.Group;
  private effectGroup: THREE.Group;

  // 选中高亮
  private selectRing: THREE.Mesh | null = null;
  private rangeCircle: THREE.Mesh | null = null;

  // 建造预览
  private buildPreview: THREE.Group | null = null;

  constructor(renderer: ThreeRenderer) {
    this.renderer = renderer;
    this.effects = new EffectsSystem(renderer);
    this.towerGroup = new THREE.Group();
    this.enemyGroup = new THREE.Group();
    this.effectGroup = new THREE.Group();

    renderer.scene.add(this.towerGroup);
    renderer.scene.add(this.enemyGroup);
    renderer.scene.add(this.effectGroup);
  }

  buildTerrain(pathManager: PathManager): void {
    if (this.terrainBuilt) return;
    this.terrainBuilt = true;
    const terrain = new TerrainBuilder(this.renderer).build(pathManager.getPathTiles());
    this.renderer.scene.add(terrain);

    // 出生点标记 - 红色光柱+脉冲环
    const spawn = pathManager.getSpawnPoint();
    const pos = ThreeRenderer.toWorld(spawn.x, spawn.y, 0);
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8),
      new THREE.MeshBasicMaterial({ color: 0xFF4444, transparent: true, opacity: 0.25 }),
    );
    pillar.position.set(pos.x, 0.6, pos.z);
    this.renderer.scene.add(pillar);

    const spawnRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.02, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0xFF4444, transparent: true, opacity: 0.3 }),
    );
    spawnRing.rotation.x = Math.PI / 2;
    spawnRing.position.set(pos.x, 0.02, pos.z);
    this.renderer.scene.add(spawnRing);
  }

  sync(towers: Tower[], enemies: Enemy[], heroTower: HeroTower | null, time: number): void {
    this.syncTowers(towers, time);
    this.syncEnemies(enemies, time);
    this.syncHero(heroTower, time);
    this.effects.update();
    this.renderer.render();
  }

  // ====== 塔同步 ======

  private syncTowers(towers: Tower[], time: number): void {
    for (const tower of towers) {
      if (!this.towerSyncs.has(tower)) {
        const model = TowerModelFactory.create(tower.getConfig(), tower.getLevel());
        const pos = ThreeRenderer.toWorld(tower.x, tower.y, 0);
        model.position.set(pos.x, -0.5, pos.z);
        this.towerGroup.add(model);
        this.towerSyncs.set(tower, { tower, model, lastLevel: tower.getLevel() });
        this.animateRise(model, 0, 20);
      }
    }

    for (const [tower, sync] of this.towerSyncs) {
      if (!tower.active || !towers.includes(tower)) {
        this.animateDestroy(sync.model, this.towerGroup);
        this.towerSyncs.delete(tower);
        continue;
      }

      if (tower.getLevel() !== sync.lastLevel) {
        this.towerGroup.remove(sync.model);
        const newModel = TowerModelFactory.create(tower.getConfig(), tower.getLevel());
        const pos = ThreeRenderer.toWorld(tower.x, tower.y, 0);
        newModel.position.set(pos.x, 0, pos.z);
        this.towerGroup.add(newModel);
        sync.model = newModel;
        sync.lastLevel = tower.getLevel();
        this.spawnFlash(newModel.position, 0x44FF44, 0.4);
      }
    }
  }

  // ====== 怪物同步 ======

  private syncEnemies(enemies: Enemy[], time: number): void {
    for (const enemy of enemies) {
      if (!this.enemySyncs.has(enemy)) {
        const model = EnemyModelFactory.create(enemy.getConfig());
        this.enemyGroup.add(model);
        const pos = ThreeRenderer.toWorld(enemy.x, enemy.y, 0);
        this.enemySyncs.set(enemy, { enemy, model, walkPhase: Math.random() * Math.PI * 2, lastX: pos.x, lastZ: pos.z });
      }
    }

    for (const [enemy, sync] of this.enemySyncs) {
      if (!enemy.active || enemy.isDying() || !enemies.includes(enemy)) {
        this.spawnDeathEffect(sync.model.position.clone(), enemy.getConfig().color, enemy.getConfig().isBoss);
        this.enemyGroup.remove(sync.model);
        this.disposeModel(sync.model);
        this.enemySyncs.delete(enemy);
        continue;
      }

      const pos = ThreeRenderer.toWorld(enemy.x, enemy.y, 0);

      // 平滑移动
      sync.model.position.x += (pos.x - sync.model.position.x) * 0.3;
      sync.model.position.z += (pos.z - sync.model.position.z) * 0.3;

      // 朝向（面向移动方向）
      const dx = pos.x - sync.lastX;
      const dz = pos.z - sync.lastZ;
      if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
        const targetAngle = Math.atan2(dx, dz);
        let currentAngle = sync.model.rotation.y;
        let diff = targetAngle - currentAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        sync.model.rotation.y += diff * 0.15;
      }
      sync.lastX = pos.x;
      sync.lastZ = pos.z;

      // 飞行/行走高度
      if (enemy.isFlying()) {
        sync.model.position.y = 0.6 + Math.sin(time * 0.003 + sync.walkPhase) * 0.06;
      } else {
        sync.walkPhase += 0.12;
        sync.model.position.y = Math.abs(Math.sin(sync.walkPhase)) * 0.025;
      }

      // 3D 血条更新
      const hpRatio = enemy.getHp() / enemy.getMaxHp();
      EnemyModelFactory.updateHealthBar(sync.model, hpRatio);

      // 隐形透明度
      if (enemy.isInvisible()) {
        const opacity = enemy.isRevealed() ? 0.65 : 0.2;
        sync.model.traverse(child => {
          if (child instanceof THREE.Mesh && (child.material as any).opacity !== undefined) {
            if (child.name !== 'hpBar' && child.name !== 'hpBarBg') {
              (child.material as any).opacity = opacity;
            }
          }
        });
      }
    }
  }

  // ====== 英雄同步 ======

  private syncHero(heroTower: HeroTower | null, time: number): void {
    if (!heroTower?.active) {
      if (this.heroSync) { this.towerGroup.remove(this.heroSync.model); this.heroSync = null; }
      return;
    }

    if (!this.heroSync) {
      const model = new THREE.Group();
      const hc = heroTower.getConfig();

      // 底座
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.45, 0.25, 8),
        new THREE.MeshPhongMaterial({ color: hc.color, emissive: hc.color, emissiveIntensity: 0.15 }),
      );
      base.position.y = 0.125;
      base.castShadow = true;
      model.add(base);

      // 英雄核心体
      const hero = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.22, 1),
        new THREE.MeshPhongMaterial({ color: hc.color, emissive: 0xFFD700, emissiveIntensity: 0.2, shininess: 60 }),
      );
      hero.position.y = 0.5;
      hero.castShadow = true;
      hero.name = 'heroCore';
      model.add(hero);

      // 旋转光环
      const aura = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.015, 6, 20),
        new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.25 }),
      );
      aura.rotation.x = Math.PI / 2;
      aura.position.y = 0.1;
      aura.name = 'heroAura';
      model.add(aura);

      // 第二层光环（倾斜）
      const aura2 = new THREE.Mesh(
        new THREE.TorusGeometry(0.3, 0.01, 6, 16),
        new THREE.MeshBasicMaterial({ color: hc.color, transparent: true, opacity: 0.15 }),
      );
      aura2.rotation.x = Math.PI / 3;
      aura2.position.y = 0.5;
      aura2.name = 'heroAura2';
      model.add(aura2);

      // 旗帜
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4),
        new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
      );
      pole.position.set(0.2, 0.5, 0);
      model.add(pole);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xFFD700, side: THREE.DoubleSide }),
      );
      flag.position.set(0.275, 0.68, 0);
      model.add(flag);

      const pos = ThreeRenderer.toWorld(heroTower.x, heroTower.y, 0);
      model.position.set(pos.x, 0, pos.z);
      this.towerGroup.add(model);
      this.heroSync = { hero: heroTower, model };
    } else {
      const pos = ThreeRenderer.toWorld(heroTower.x, heroTower.y, 0);
      this.heroSync.model.position.x += (pos.x - this.heroSync.model.position.x) * 0.2;
      this.heroSync.model.position.z += (pos.z - this.heroSync.model.position.z) * 0.2;

      // 英雄体旋转
      const core = this.heroSync.model.getObjectByName('heroCore');
      if (core) core.rotation.y += 0.015;

      // 光环旋转
      const aura2 = this.heroSync.model.getObjectByName('heroAura2');
      if (aura2) aura2.rotation.z += 0.01;
    }
  }

  // ====== 选中和范围 ======

  showSelection(px: number, py: number, range: number): void {
    this.clearSelection();
    const pos = ThreeRenderer.toWorld(px, py, 0.02);

    this.selectRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.02, 6, 20),
      new THREE.MeshBasicMaterial({ color: 0x44FF44, transparent: true, opacity: 0.5 }),
    );
    this.selectRing.rotation.x = Math.PI / 2;
    this.selectRing.position.copy(pos);
    this.renderer.scene.add(this.selectRing);

    const r3d = range * ThreeRenderer.SCALE;
    this.rangeCircle = new THREE.Mesh(
      new THREE.CircleGeometry(r3d, 32),
      new THREE.MeshBasicMaterial({ color: 0x44FF44, transparent: true, opacity: 0.06, side: THREE.DoubleSide }),
    );
    this.rangeCircle.rotation.x = -Math.PI / 2;
    this.rangeCircle.position.set(pos.x, 0.01, pos.z);
    this.renderer.scene.add(this.rangeCircle);
  }

  clearSelection(): void {
    if (this.selectRing) { this.renderer.scene.remove(this.selectRing); this.selectRing = null; }
    if (this.rangeCircle) { this.renderer.scene.remove(this.rangeCircle); this.rangeCircle = null; }
  }

  // ====== 建造预览 ======

  showBuildPreview(px: number, py: number, config: any): void {
    this.clearBuildPreview();
    const model = TowerModelFactory.create(config, 0);
    model.traverse(child => {
      if (child instanceof THREE.Mesh) {
        (child.material as any).transparent = true;
        (child.material as any).opacity = 0.4;
      }
    });
    const pos = ThreeRenderer.toWorld(px, py, 0);
    model.position.set(pos.x, 0, pos.z);
    this.renderer.scene.add(model);
    this.buildPreview = model;
  }

  clearBuildPreview(): void {
    if (this.buildPreview) {
      this.renderer.scene.remove(this.buildPreview);
      this.disposeModel(this.buildPreview);
      this.buildPreview = null;
    }
  }

  // ====== 弹道 ======

  spawnProjectile(fromX: number, fromY: number, toX: number, toY: number, color: number, isAOE: boolean = false): void {
    const from = ThreeRenderer.toWorld(fromX, fromY, 0.3);
    const to = ThreeRenderer.toWorld(toX, toY, 0.12);
    const size = isAOE ? 0.06 : 0.04;

    const proj = new THREE.Mesh(
      isAOE ? new THREE.SphereGeometry(size, 5, 4) : new THREE.ConeGeometry(size * 0.5, size * 2, 4),
      new THREE.MeshBasicMaterial({ color }),
    );
    proj.position.copy(from);
    this.renderer.scene.add(proj);

    // 朝向目标
    if (!isAOE) {
      proj.lookAt(to);
      proj.rotateX(Math.PI / 2);
    }

    const duration = 180;
    const start = performance.now();
    const trail: THREE.Mesh[] = [];

    const animate = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      proj.position.lerpVectors(from, to, t);
      proj.position.y += Math.sin(t * Math.PI) * (isAOE ? 0.4 : 0.2);

      // 拖尾
      if (t < 0.95 && trail.length < 8) {
        const tp = new THREE.Mesh(
          new THREE.SphereGeometry(0.015, 3, 2),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }),
        );
        tp.position.copy(proj.position);
        this.renderer.scene.add(tp);
        trail.push(tp);
      }
      // 拖尾淡出
      trail.forEach((tp, i) => {
        (tp.material as THREE.MeshBasicMaterial).opacity -= 0.08;
        if ((tp.material as THREE.MeshBasicMaterial).opacity <= 0) {
          this.renderer.scene.remove(tp);
          tp.geometry.dispose();
          (tp.material as THREE.Material).dispose();
        }
      });

      if (t >= 1) {
        this.renderer.scene.remove(proj);
        proj.geometry.dispose();
        (proj.material as THREE.Material).dispose();
        trail.forEach(tp => {
          this.renderer.scene.remove(tp);
          tp.geometry.dispose(); (tp.material as THREE.Material).dispose();
        });
      } else {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }

  // ====== 波次事件 ======

  onWaveStart(waveNum: number, isBoss: boolean): void {
    if (isBoss) {
      // Boss 波 - 红色冲击波
      const wave = new THREE.Mesh(
        new THREE.TorusGeometry(0.3, 0.05, 6, 20),
        new THREE.MeshBasicMaterial({ color: 0xFF2200, transparent: true, opacity: 0.6 }),
      );
      wave.rotation.x = Math.PI / 2;
      wave.position.y = 0.5;
      this.renderer.scene.add(wave);

      let f = 0;
      const anim = () => {
        f++;
        wave.scale.set(1 + f * 0.8, 1 + f * 0.8, 1);
        (wave.material as THREE.MeshBasicMaterial).opacity -= 0.04;
        if (f > 15) {
          this.renderer.scene.remove(wave);
          wave.geometry.dispose(); (wave.material as THREE.Material).dispose();
        } else requestAnimationFrame(anim);
      };
      requestAnimationFrame(anim);
    }
  }

  // ====== 特效辅助 ======

  private spawnFlash(pos: THREE.Vector3, color: number, size: number): void {
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(size, 8, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }),
    );
    flash.position.copy(pos);
    flash.position.y += 0.3;
    this.effectGroup.add(flash);
    let f = 0;
    const anim = () => {
      f++;
      flash.scale.multiplyScalar(1.06);
      (flash.material as THREE.MeshBasicMaterial).opacity -= 0.035;
      if (f > 14) {
        this.effectGroup.remove(flash);
        flash.geometry.dispose(); (flash.material as THREE.MeshBasicMaterial).dispose();
      } else requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }

  private spawnDeathEffect(pos: THREE.Vector3, color: number, isBoss: boolean): void {
    const count = isBoss ? 15 : 6;
    const spread = isBoss ? 0.08 : 0.04;
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.03, 0.03),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
      );
      p.position.copy(pos);
      p.position.y += 0.2;
      this.effectGroup.add(p);
      const dir = new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * 0.04 + 0.02, (Math.random() - 0.5) * spread);
      let f = 0;
      const anim = () => {
        f++;
        p.position.add(dir);
        dir.y -= 0.002;
        p.rotation.x += 0.12; p.rotation.z += 0.1;
        (p.material as THREE.MeshBasicMaterial).opacity -= 0.04;
        if (f > 22) {
          this.effectGroup.remove(p);
          p.geometry.dispose(); (p.material as THREE.MeshBasicMaterial).dispose();
        } else requestAnimationFrame(anim);
      };
      requestAnimationFrame(anim);
    }
  }

  private animateRise(model: THREE.Group, targetY: number, frames: number): void {
    let f = 0;
    const startY = model.position.y;
    const anim = () => {
      f++;
      const t = Math.min(1, f / frames);
      model.position.y = startY + (targetY - startY) * (1 - Math.pow(1 - t, 3));
      if (t < 1) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }

  private animateDestroy(model: THREE.Group, parent: THREE.Group): void {
    let f = 0;
    const anim = () => {
      f++;
      model.position.y -= 0.025;
      model.scale.multiplyScalar(0.93);
      if (f > 15) {
        parent.remove(model);
        this.disposeModel(model);
      } else requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }

  private disposeModel(model: THREE.Group): void {
    model.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
  }

  reset(): void {
    this.towerSyncs.clear();
    this.enemySyncs.clear();
    this.heroSync = null;
    this.clearSelection();
    this.clearBuildPreview();
    [this.towerGroup, this.enemyGroup, this.effectGroup].forEach(g => {
      while (g.children.length) g.remove(g.children[0]);
    });
    this.terrainBuilt = false;
  }
}
