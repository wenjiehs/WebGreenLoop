import * as THREE from 'three';
import { ThreeRenderer } from '../rendering/ThreeRenderer';
import { TerrainBuilder } from '../rendering/TerrainBuilder';
import { TowerModelFactory } from '../rendering/TowerModelFactory';
import { EnemyModelFactory } from '../rendering/EnemyModelFactory';
import { EffectsSystem } from '../rendering/EffectsSystem';
import { TowerLogic } from '../entities/TowerLogic';
import { EnemyLogic } from '../entities/EnemyLogic';
import { HeroTowerLogic } from '../entities/HeroTowerLogic';
import { PathManager } from '../systems/PathManager';
import { TILE_SIZE } from '../utils/constants';

interface TowerSync { tower: TowerLogic; model: THREE.Group; lastLevel: number; }
interface EnemySync { enemy: EnemyLogic; model: THREE.Group; walkPhase: number; lastX: number; lastZ: number; }

/**
 * 3D 实体渲染器 — 直接从纯逻辑实体读取状态驱动 3D 渲染
 * 替代了之前的 GameBridge
 */
export class EntityRenderer {
  private renderer: ThreeRenderer;
  effects: EffectsSystem;

  private towerSyncs: Map<TowerLogic, TowerSync> = new Map();
  private enemySyncs: Map<EnemyLogic, EnemySync> = new Map();
  private heroSync: { hero: HeroTowerLogic; model: THREE.Group } | null = null;

  private towerGroup = new THREE.Group();
  private enemyGroup = new THREE.Group();
  private effectGroup = new THREE.Group();

  // 选中
  private selectRing: THREE.Mesh | null = null;
  private rangeCircle: THREE.Mesh | null = null;
  // 建造预览
  private buildPreview: THREE.Group | null = null;
  // 地形
  private terrainBuilt = false;

  constructor(renderer: ThreeRenderer) {
    this.renderer = renderer;
    this.effects = new EffectsSystem(renderer);
    renderer.scene.add(this.towerGroup);
    renderer.scene.add(this.enemyGroup);
    renderer.scene.add(this.effectGroup);
  }

  buildTerrain(pathManager: PathManager): void {
    if (this.terrainBuilt) return;
    this.terrainBuilt = true;
    const terrain = new TerrainBuilder(this.renderer).build(pathManager.getPathTiles());
    this.renderer.scene.add(terrain);

    // 出生点标记
    const spawn = pathManager.getSpawnPoint();
    const pos = ThreeRenderer.toWorld(spawn.x, spawn.y, 0);
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8),
      new THREE.MeshBasicMaterial({ color: 0xFF4444, transparent: true, opacity: 0.25 }),
    );
    pillar.position.set(pos.x, 0.6, pos.z);
    this.renderer.scene.add(pillar);
  }

  sync(towers: TowerLogic[], enemies: EnemyLogic[], heroTower: HeroTowerLogic | null, time: number): void {
    this.syncTowers(towers);
    this.syncEnemies(enemies, time);
    this.syncHero(heroTower);
    this.effects.update();
    this.renderer.render();
  }

  // ===== 塔 =====
  private syncTowers(towers: TowerLogic[]): void {
    for (const tower of towers) {
      if (!this.towerSyncs.has(tower)) {
        const model = TowerModelFactory.create(tower.config, tower.level);
        const pos = ThreeRenderer.toWorld(tower.x, tower.y, 0);
        model.position.set(pos.x, -0.5, pos.z);
        this.towerGroup.add(model);
        this.towerSyncs.set(tower, { tower, model, lastLevel: tower.level });
        this.animateRise(model, 0, 20);
      }
    }
    for (const [tower, sync] of this.towerSyncs) {
      if (!tower.active || !towers.includes(tower)) {
        this.animateDestroy(sync.model, this.towerGroup);
        this.towerSyncs.delete(tower);
        continue;
      }
      if (tower.level !== sync.lastLevel) {
        this.towerGroup.remove(sync.model);
        const newModel = TowerModelFactory.create(tower.config, tower.level);
        const pos = ThreeRenderer.toWorld(tower.x, tower.y, 0);
        newModel.position.set(pos.x, 0, pos.z);
        this.towerGroup.add(newModel);
        sync.model = newModel;
        sync.lastLevel = tower.level;
      }
    }
  }

  // ===== 怪物 =====
  private syncEnemies(enemies: EnemyLogic[], time: number): void {
    for (const enemy of enemies) {
      if (!this.enemySyncs.has(enemy)) {
        const model = EnemyModelFactory.create(enemy.config);
        this.enemyGroup.add(model);
        const pos = ThreeRenderer.toWorld(enemy.x, enemy.y, 0);
        this.enemySyncs.set(enemy, { enemy, model, walkPhase: Math.random() * Math.PI * 2, lastX: pos.x, lastZ: pos.z });
      }
    }
    for (const [enemy, sync] of this.enemySyncs) {
      if (!enemy.active || (enemy.isDying() && enemy.deathTimer <= 0)) {
        this.spawnDeathEffect(sync.model.position.clone(), enemy.config.color, enemy.config.isBoss);
        this.enemyGroup.remove(sync.model);
        this.disposeModel(sync.model);
        this.enemySyncs.delete(enemy);
        continue;
      }

      const pos = ThreeRenderer.toWorld(enemy.x, enemy.y, 0);
      sync.model.position.x += (pos.x - sync.model.position.x) * 0.3;
      sync.model.position.z += (pos.z - sync.model.position.z) * 0.3;

      // 朝向
      const dx = pos.x - sync.lastX, dz = pos.z - sync.lastZ;
      if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - sync.model.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        sync.model.rotation.y += diff * 0.15;
      }
      sync.lastX = pos.x; sync.lastZ = pos.z;

      // 高度
      if (enemy.isFlying()) {
        sync.model.position.y = 0.6 + Math.sin(time * 0.003 + sync.walkPhase) * 0.06;
      } else {
        sync.walkPhase += 0.12;
        sync.model.position.y = Math.abs(Math.sin(sync.walkPhase)) * 0.025;
      }

      // 血条
      const hpRatio = enemy.getHp() / enemy.getMaxHp();
      EnemyModelFactory.updateHealthBar(sync.model, hpRatio);

      // 死亡缩小
      if (enemy.isDying()) {
        const scale = Math.max(0.1, sync.model.scale.x - 0.05);
        sync.model.scale.set(scale, scale, scale);
      }

      // 隐形
      if (enemy.isInvisible()) {
        const opacity = enemy.isRevealed() ? 0.65 : 0.2;
        sync.model.traverse(child => {
          if (child instanceof THREE.Mesh && (child.material as any).opacity !== undefined) {
            if (child.name !== 'hpBar' && child.name !== 'hpBarBg') (child.material as any).opacity = opacity;
          }
        });
      }
    }
  }

  // ===== 英雄 =====
  private syncHero(heroTower: HeroTowerLogic | null): void {
    if (!heroTower?.active) {
      if (this.heroSync) { this.towerGroup.remove(this.heroSync.model); this.heroSync = null; }
      return;
    }
    if (!this.heroSync) {
      const model = new THREE.Group();
      const hc = heroTower.config;
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.45, 0.25, 8),
        new THREE.MeshPhongMaterial({ color: hc.color, emissive: hc.color, emissiveIntensity: 0.15 }),
      );
      base.position.y = 0.125; base.castShadow = true; model.add(base);
      const hero = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.22, 1),
        new THREE.MeshPhongMaterial({ color: hc.color, emissive: 0xFFD700, emissiveIntensity: 0.2 }),
      );
      hero.position.y = 0.5; hero.castShadow = true; hero.name = 'heroCore'; model.add(hero);
      const aura = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.015, 6, 20),
        new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.25 }),
      );
      aura.rotation.x = Math.PI / 2; aura.position.y = 0.1; aura.name = 'heroAura'; model.add(aura);
      const pos = ThreeRenderer.toWorld(heroTower.x, heroTower.y, 0);
      model.position.set(pos.x, 0, pos.z);
      this.towerGroup.add(model);
      this.heroSync = { hero: heroTower, model };
    } else {
      const pos = ThreeRenderer.toWorld(heroTower.x, heroTower.y, 0);
      this.heroSync.model.position.x += (pos.x - this.heroSync.model.position.x) * 0.2;
      this.heroSync.model.position.z += (pos.z - this.heroSync.model.position.z) * 0.2;
      const core = this.heroSync.model.getObjectByName('heroCore');
      if (core) core.rotation.y += 0.015;
    }
  }

  // ===== 3D 弹道 =====
  spawnProjectile(fromX: number, fromY: number, toX: number, toY: number, color: number, isAOE: boolean): void {
    const from = ThreeRenderer.toWorld(fromX, fromY, 0.3);
    const to = ThreeRenderer.toWorld(toX, toY, 0.12);
    const size = isAOE ? 0.06 : 0.04;
    const proj = new THREE.Mesh(
      isAOE ? new THREE.SphereGeometry(size, 5, 4) : new THREE.ConeGeometry(size * 0.5, size * 2, 4),
      new THREE.MeshBasicMaterial({ color }),
    );
    proj.position.copy(from);
    this.renderer.scene.add(proj);
    if (!isAOE) { proj.lookAt(to); proj.rotateX(Math.PI / 2); }

    const duration = 180;
    const start = performance.now();
    const trail: THREE.Mesh[] = [];
    const animate = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      proj.position.lerpVectors(from, to, t);
      proj.position.y += Math.sin(t * Math.PI) * (isAOE ? 0.4 : 0.2);
      if (t < 0.95 && trail.length < 6) {
        const tp = new THREE.Mesh(new THREE.SphereGeometry(0.012, 3, 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 }));
        tp.position.copy(proj.position);
        this.renderer.scene.add(tp);
        trail.push(tp);
      }
      trail.forEach(tp => {
        (tp.material as THREE.MeshBasicMaterial).opacity -= 0.08;
        if ((tp.material as THREE.MeshBasicMaterial).opacity <= 0) { this.renderer.scene.remove(tp); tp.geometry.dispose(); (tp.material as THREE.Material).dispose(); }
      });
      if (t >= 1) {
        this.renderer.scene.remove(proj); proj.geometry.dispose(); (proj.material as THREE.Material).dispose();
        trail.forEach(tp => { this.renderer.scene.remove(tp); tp.geometry.dispose(); (tp.material as THREE.Material).dispose(); });
      } else requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  // ===== 选中/预览 =====
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

  showBuildPreview(px: number, py: number, config: any, canBuild: boolean = true): void {
    this.clearBuildPreview();
    const model = TowerModelFactory.create(config, 0);
    model.traverse(child => {
      if (child instanceof THREE.Mesh) {
        (child.material as any).transparent = true;
        (child.material as any).opacity = 0.4;
        // 红/绿色调
        if (!canBuild) {
          (child.material as any).color = new THREE.Color(0xFF2222);
          (child.material as any).emissive = new THREE.Color(0xFF0000);
          (child.material as any).emissiveIntensity = 0.3;
        }
      }
    });
    const pos = ThreeRenderer.toWorld(px, py, 0);
    model.position.set(pos.x, 0, pos.z);
    this.renderer.scene.add(model);
    this.buildPreview = model;
  }

  clearBuildPreview(): void {
    if (this.buildPreview) { this.renderer.scene.remove(this.buildPreview); this.disposeModel(this.buildPreview); this.buildPreview = null; }
  }

  // ===== Raycaster 格子拾取 =====
  getGridFromClick(mouseX: number, mouseY: number, canvasW: number, canvasH: number): { col: number; row: number } | null {
    const ndcX = (mouseX / canvasW) * 2 - 1;
    const ndcY = -(mouseY / canvasH) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.renderer.camera);
    // 与地面(y=0)求交
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    const ray = raycaster.ray;
    if (!ray.intersectPlane(plane, intersection)) return null;

    // 3D 世界坐标 → Phaser 像素坐标
    const px = intersection.x / ThreeRenderer.SCALE + 1280 / 2;
    const py = intersection.z / ThreeRenderer.SCALE + (720 - 140) / 2;
    const col = Math.floor(px / TILE_SIZE);
    const row = Math.floor(py / TILE_SIZE);
    if (col < 0 || row < 0 || col >= 40 || row >= 22) return null;
    return { col, row };
  }

  // ===== 特效辅助 =====
  private spawnDeathEffect(pos: THREE.Vector3, color: number, isBoss: boolean): void {
    const count = isBoss ? 15 : 6;
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
      p.position.copy(pos); p.position.y += 0.2;
      this.effectGroup.add(p);
      const dir = new THREE.Vector3((Math.random() - 0.5) * 0.06, Math.random() * 0.04 + 0.02, (Math.random() - 0.5) * 0.06);
      let f = 0;
      const anim = () => {
        f++; p.position.add(dir); dir.y -= 0.002; p.rotation.x += 0.12;
        (p.material as THREE.MeshBasicMaterial).opacity -= 0.04;
        if (f > 22) { this.effectGroup.remove(p); p.geometry.dispose(); (p.material as THREE.MeshBasicMaterial).dispose(); }
        else requestAnimationFrame(anim);
      };
      requestAnimationFrame(anim);
    }
  }

  private animateRise(model: THREE.Group, targetY: number, frames: number): void {
    let f = 0; const startY = model.position.y;
    const anim = () => {
      f++; const t = Math.min(1, f / frames);
      model.position.y = startY + (targetY - startY) * (1 - Math.pow(1 - t, 3));
      if (t < 1) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }

  private animateDestroy(model: THREE.Group, parent: THREE.Group): void {
    let f = 0;
    const anim = () => {
      f++; model.position.y -= 0.025; model.scale.multiplyScalar(0.93);
      if (f > 15) { parent.remove(model); this.disposeModel(model); }
      else requestAnimationFrame(anim);
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
    this.towerSyncs.clear(); this.enemySyncs.clear(); this.heroSync = null;
    this.clearSelection(); this.clearBuildPreview();
    [this.towerGroup, this.enemyGroup, this.effectGroup].forEach(g => { while (g.children.length) g.remove(g.children[0]); });
    this.terrainBuilt = false;
  }
}
