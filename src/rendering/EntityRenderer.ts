import * as THREE from 'three';
import { ThreeRenderer } from '../rendering/ThreeRenderer';
import { TerrainBuilder } from '../rendering/TerrainBuilder';
import { TowerModelFactory } from '../rendering/TowerModelFactory';
import { EnemyModelFactory } from '../rendering/EnemyModelFactory';
import { HeroModelFactory } from '../rendering/HeroModelFactory';
import { SummonModelFactory } from '../rendering/SummonModelFactory';
import { EffectsSystem } from '../rendering/EffectsSystem';
import { TowerLogic } from '../entities/TowerLogic';
import { EnemyLogic } from '../entities/EnemyLogic';
import { HeroTowerLogic } from '../entities/HeroTowerLogic';
import { SummonLogic } from '../entities/SummonLogic';
import { PathManager } from '../systems/PathManager';
import { TILE_SIZE } from '../utils/constants';

interface TowerSync { tower: TowerLogic; model: THREE.Group; lastLevel: number; attackAnim: number; }
interface EnemySync { enemy: EnemyLogic; model: THREE.Group; walkPhase: number; lastX: number; lastZ: number; }
interface SummonSync { summon: SummonLogic; model: THREE.Group; attackAnim: number; }

/**
 * 3D 实体渲染器 — 直接从纯逻辑实体读取状态驱动 3D 渲染
 * 替代了之前的 GameBridge
 */
export class EntityRenderer {
  private renderer: ThreeRenderer;
  effects: EffectsSystem;

  private towerSyncs: Map<TowerLogic, TowerSync> = new Map();
  private enemySyncs: Map<EnemyLogic, EnemySync> = new Map();
  private summonSyncs: Map<SummonLogic, SummonSync> = new Map();
  private heroSync: { hero: HeroTowerLogic; model: THREE.Group; attackAnim: number } | null = null;

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
  private terrainGroup: THREE.Group | null = null;
  private spawnPillar: THREE.Mesh | null = null;
  private spawnExtras: THREE.Object3D[] = [];

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
    this.terrainGroup = terrain;

    // 出生点标记 — 更大更醒目
    const spawn = pathManager.getSpawnPoint();
    const pos = ThreeRenderer.toWorld(spawn.x, spawn.y, 0);

    // 红色光柱
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 2.0, 8),
      new THREE.MeshBasicMaterial({ color: 0xFF3333, transparent: true, opacity: 0.35 }),
    );
    pillar.position.set(pos.x, 1.0, pos.z);
    this.renderer.scene.add(pillar);
    this.spawnPillar = pillar;

    // 底部红色光环
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.04, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0xFF4444, transparent: true, opacity: 0.5 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(pos.x, 0.05, pos.z);
    this.renderer.scene.add(ring);

    // 顶部红色菱形标记
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.2, 0),
      new THREE.MeshBasicMaterial({ color: 0xFF2222, transparent: true, opacity: 0.6 }),
    );
    diamond.position.set(pos.x, 2.2, pos.z);
    diamond.name = 'spawnDiamond';
    this.renderer.scene.add(diamond);
    this.spawnExtras = [ring, diamond];

    // 浮动动画
    const animateSpawn = () => {
      const t = performance.now() * 0.002;
      diamond.position.y = 2.2 + Math.sin(t) * 0.15;
      diamond.rotation.y = t * 0.5;
      ring.scale.setScalar(1 + Math.sin(t * 1.5) * 0.1);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 2) * 0.15;
      requestAnimationFrame(animateSpawn);
    };
    requestAnimationFrame(animateSpawn);
  }

  sync(towers: TowerLogic[], enemies: EnemyLogic[], heroTower: HeroTowerLogic | null, time: number): void {
    this.syncTowers(towers);
    this.syncEnemies(enemies, time);
    this.syncHero(heroTower);
    this.syncSummons(heroTower);
    this.effects.update();
    this.effects.update();
    this.renderer.render();
  }

  // ===== 塔 =====
  private syncTowers(towers: TowerLogic[]): void {
    const MODEL_SCALE = 2.5; // 模型统一放大
    for (const tower of towers) {
      if (!this.towerSyncs.has(tower)) {
        const model = TowerModelFactory.create(tower.config, tower.level);
        model.scale.setScalar(MODEL_SCALE);
        const pos = ThreeRenderer.toWorld(tower.x, tower.y, 0);
        model.position.set(pos.x, -0.5, pos.z);
        this.towerGroup.add(model);
        this.towerSyncs.set(tower, { tower, model, lastLevel: tower.level, attackAnim: 0 });
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
        newModel.scale.setScalar(MODEL_SCALE);
        const pos = ThreeRenderer.toWorld(tower.x, tower.y, 0);
        newModel.position.set(pos.x, 0, pos.z);
        this.towerGroup.add(newModel);
        sync.model = newModel;
        sync.lastLevel = tower.level;
      }
      // C3: 塔攻击弹跳动画（持续更长，效果更明显）
      if (tower.justFired) {
        sync.attackAnim = 1.0;
        tower.justFired = false;
      }
      if (sync.attackAnim > 0) {
        sync.attackAnim -= 0.04;
        if (sync.attackAnim < 0) sync.attackAnim = 0;
        const bounce = Math.sin(sync.attackAnim * Math.PI) * 0.15;
        const squeeze = 1 + Math.sin(sync.attackAnim * Math.PI) * 0.08;
        sync.model.position.y = bounce;
        sync.model.scale.set(MODEL_SCALE * squeeze, MODEL_SCALE / squeeze, MODEL_SCALE * squeeze);
      } else {
        sync.model.position.y = 0;
        sync.model.scale.setScalar(MODEL_SCALE);
      }
    }
  }

  // ===== 怪物 =====
  private syncEnemies(enemies: EnemyLogic[], time: number): void {
    const ENEMY_SCALE = 2.5;
    for (const enemy of enemies) {
      if (!this.enemySyncs.has(enemy)) {
        const model = EnemyModelFactory.create(enemy.config);
        model.scale.setScalar(ENEMY_SCALE);
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
        // 翅膀扇动
        const wingL = sync.model.getObjectByName('wingL');
        const wingR = sync.model.getObjectByName('wingR');
        if (wingL && wingR) {
          const flap = Math.sin(time * 0.008 + sync.walkPhase) * 0.4;
          wingL.rotation.z = -0.3 - flap;
          wingR.rotation.z = 0.3 + flap;
        }
      } else {
        sync.walkPhase += 0.12;
        sync.model.position.y = Math.abs(Math.sin(sync.walkPhase)) * 0.025;
      }

      // Boss 发光脉冲
      if (enemy.config.isBoss) {
        const bossBody = sync.model.getObjectByName('bossBody');
        if (bossBody) {
          const mat = (bossBody as THREE.Mesh).material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = 0.2 + Math.sin(time * 0.004) * 0.15;
        }
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
      const model = HeroModelFactory.create(heroTower.config);
      model.scale.setScalar(2.8); // 英雄比普通塔稍大
      const pos = ThreeRenderer.toWorld(heroTower.x, heroTower.y, 0);
      model.position.set(pos.x, 0, pos.z);
      this.towerGroup.add(model);
      this.heroSync = { hero: heroTower, model, attackAnim: 0 };
    } else {
      const pos = ThreeRenderer.toWorld(heroTower.x, heroTower.y, 0);
      this.heroSync.model.position.x += (pos.x - this.heroSync.model.position.x) * 0.2;
      this.heroSync.model.position.z += (pos.z - this.heroSync.model.position.z) * 0.2;
      const core = this.heroSync.model.getObjectByName('heroCore');
      if (core) core.rotation.y += 0.015;

      // 英雄攻击弹跳动画（持续更长）
      if (heroTower.justFired) {
        this.heroSync.attackAnim = 1.0;
        heroTower.justFired = false;
      }
      if (this.heroSync.attackAnim > 0) {
        this.heroSync.attackAnim -= 0.04; // 衰减更慢
        if (this.heroSync.attackAnim < 0) this.heroSync.attackAnim = 0;
        const bounce = Math.sin(this.heroSync.attackAnim * Math.PI) * 0.15;
        this.heroSync.model.position.y = bounce;
      } else {
        this.heroSync.model.position.y = 0;
      }
    }
  }

  // ===== 召唤物 =====
  private syncSummons(heroTower: HeroTowerLogic | null): void {
    const summons = heroTower?.summons || [];

    // 新增
    for (const summon of summons) {
      if (!this.summonSyncs.has(summon)) {
        const model = SummonModelFactory.create(summon.config);
        model.scale.setScalar(2.2);
        const pos = ThreeRenderer.toWorld(summon.x, summon.y, 0);
        model.position.set(pos.x, 0, pos.z);
        this.towerGroup.add(model);
        this.summonSyncs.set(summon, { summon, model, attackAnim: 0 });
      }
    }

    // 同步/移除
    for (const [summon, sync] of this.summonSyncs) {
      if (!summon.active || !summons.includes(summon)) {
        // 消散效果
        this.spawnDeathEffect(sync.model.position.clone(), summon.config.color, false);
        this.towerGroup.remove(sync.model);
        this.summonSyncs.delete(summon);
        continue;
      }

      // 攻击弹跳
      if (summon.justFired) {
        sync.attackAnim = 1.0;
        summon.justFired = false;
      }
      if (sync.attackAnim > 0) {
        sync.attackAnim -= 0.05;
        if (sync.attackAnim < 0) sync.attackAnim = 0;
        const bounce = Math.sin(sync.attackAnim * Math.PI) * 0.1;
        sync.model.position.y = bounce;
      } else {
        sync.model.position.y = 0;
      }

      // 浮动动画
      const t = performance.now() * 0.002;
      const core = sync.model.getObjectByName('summonCore');
      if (core) { core.position.y += Math.sin(t) * 0.001; core.rotation.y = t * 0.3; }
      const aura = sync.model.getObjectByName('summonAura');
      if (aura) aura.scale.setScalar(1 + Math.sin(t * 1.5) * 0.08);
    }
  }

  // ===== 3D 弹道 =====
  spawnProjectile(fromX: number, fromY: number, toX: number, toY: number, color: number, isAOE: boolean): void {
    const from = ThreeRenderer.toWorld(fromX, fromY, 0.3);
    const to = ThreeRenderer.toWorld(toX, toY, 0.12);
    const size = isAOE ? 0.16 : 0.10; // 配合放大后的模型
    const proj = new THREE.Mesh(
      isAOE ? new THREE.SphereGeometry(size, 5, 4) : new THREE.ConeGeometry(size * 0.5, size * 2, 4),
      new THREE.MeshBasicMaterial({ color }),
    );
    proj.position.copy(from);
    this.renderer.scene.add(proj);
    if (!isAOE) { proj.lookAt(to); proj.rotateX(Math.PI / 2); }

    const duration = 350; // 弹道飞行时间(ms)
    const start = performance.now();
    const trail: THREE.Mesh[] = [];
    const animate = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      proj.position.lerpVectors(from, to, t);
      proj.position.y += Math.sin(t * Math.PI) * (isAOE ? 0.6 : 0.35); // 弧线更高
      // 更多拖尾粒子
      if (t < 0.95 && trail.length < 10) {
        const tp = new THREE.Mesh(new THREE.SphereGeometry(0.018, 4, 3), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
        tp.position.copy(proj.position);
        this.renderer.scene.add(tp);
        trail.push(tp);
      }
      trail.forEach(tp => {
        (tp.material as THREE.MeshBasicMaterial).opacity -= 0.05; // 拖尾消失更慢
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
    model.scale.setScalar(2.5); // 和实际塔一样大
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
    this.towerSyncs.clear(); this.enemySyncs.clear(); this.summonSyncs.clear(); this.heroSync = null;
    this.clearSelection(); this.clearBuildPreview();
    [this.towerGroup, this.enemyGroup, this.effectGroup].forEach(g => { while (g.children.length) g.remove(g.children[0]); });
    // MISS-005: 移除旧地形
    if (this.terrainGroup) { this.renderer.scene.remove(this.terrainGroup); this.terrainGroup = null; }
    if (this.spawnPillar) { this.renderer.scene.remove(this.spawnPillar); this.spawnPillar = null; }
    this.spawnExtras.forEach(o => this.renderer.scene.remove(o));
    this.spawnExtras = [];
    this.terrainBuilt = false;
  }

  // ===== C2: 3D 波次横幅 =====
  showWaveBanner(text: string, color: string = '#44FF44'): void {
    // 用 Canvas 纹理创建 Billboard 文字
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // 背景（半透明黑色圆角矩形）
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    this.roundRect(ctx, 10, 10, 492, 108, 16);
    ctx.fill();

    // 边框
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    this.roundRect(ctx, 10, 10, 492, 108, 16);
    ctx.stroke();

    // 文字
    ctx.fillStyle = color;
    ctx.font = 'bold 52px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);

    // 文字阴影效果
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = 'bold 52px Arial, sans-serif';
    ctx.fillText(text, 256, 62);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(8, 2, 1);
    sprite.position.set(0, 5, 0); // 场景中央上方
    this.renderer.scene.add(sprite);

    // 动画：淡入 → 停留 → 上浮淡出
    let frame = 0;
    const totalFrames = 120; // 约2秒
    const anim = () => {
      frame++;
      const t = frame / totalFrames;

      if (t < 0.15) {
        // 淡入 + 从下方弹上
        const easeIn = t / 0.15;
        material.opacity = easeIn;
        sprite.position.y = 3 + easeIn * 2;
        sprite.scale.set(8 * (0.8 + easeIn * 0.2), 2 * (0.8 + easeIn * 0.2), 1);
      } else if (t < 0.7) {
        // 停留 + 轻微浮动
        material.opacity = 1;
        sprite.position.y = 5 + Math.sin((t - 0.15) * 10) * 0.15;
      } else {
        // 上浮淡出
        const fadeOut = (t - 0.7) / 0.3;
        material.opacity = 1 - fadeOut;
        sprite.position.y = 5 + fadeOut * 2;
      }

      if (frame >= totalFrames) {
        this.renderer.scene.remove(sprite);
        material.dispose();
        texture.dispose();
      } else {
        requestAnimationFrame(anim);
      }
    };
    requestAnimationFrame(anim);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
