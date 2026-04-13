import * as THREE from 'three';
import { EnemyConfig } from '../config/enemies';
import { ThreeRenderer } from './ThreeRenderer';
import { ArmorType } from '../utils/constants';

// 护甲类型对应的材质颜色偏移
const ARMOR_TINTS: Partial<Record<string, number>> = {
  [ArmorType.LIGHT]: 0xCCCCCC,
  [ArmorType.MEDIUM]: 0x8888AA,
  [ArmorType.HEAVY]: 0x555577,
  [ArmorType.FORTIFIED]: 0x886644,
  [ArmorType.HERO]: 0xFFDD44,
  [ArmorType.DIVINE]: 0xFFFFCC,
};

/**
 * 怪物 3D 模型工厂 - 程序化低多边形模型
 * 人形/重甲骑士/兽形/飞行/Boss + 3D血条 + 护甲视觉
 */
export class EnemyModelFactory {
  static create(config: EnemyConfig): THREE.Group {
    const group = new THREE.Group();
    const color = new THREE.Color(config.color);
    const r = config.radius * ThreeRenderer.SCALE;
    const bs = Math.max(0.06, r * 0.6);

    if (config.isFlying) {
      this.buildFlyingModel(group, color, bs, config);
    } else if (config.isBoss) {
      this.buildBossModel(group, color, bs, config);
    } else if (config.radius >= 10) {
      this.buildHeavyBeastModel(group, color, bs, config);
    } else if (config.radius >= 8) {
      this.buildKnightModel(group, color, bs, config);
    } else {
      this.buildHumanoidModel(group, color, bs, config);
    }

    // 3D 血条 (Billboard - 始终面向摄像机方向，简化为水平条)
    this.addHealthBar(group, bs, config.isBoss);

    // 护甲类型视觉 - 不同描边/底部环
    const armorTint = ARMOR_TINTS[config.armorType];
    if (armorTint) {
      const armorRing = new THREE.Mesh(
        new THREE.TorusGeometry(bs * 1.2, 0.008, 4, 12),
        new THREE.MeshBasicMaterial({ color: armorTint, transparent: true, opacity: 0.3 }),
      );
      armorRing.rotation.x = Math.PI / 2;
      armorRing.position.y = 0.01;
      group.add(armorRing);
    }

    // 隐形
    if (config.isInvisible) {
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.Material;
          (mat as any).transparent = true;
          (mat as any).opacity = 0.3;
        }
      });
    }

    // 魔免护盾
    if (config.isMagicImmune) {
      const shield = new THREE.Mesh(
        new THREE.SphereGeometry(bs * 1.5, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x4488FF, transparent: true, opacity: 0.12, side: THREE.BackSide }),
      );
      shield.position.y = bs * 1.2;
      group.add(shield);
    }

    // 毒免绿环
    if (config.isPoisonImmune) {
      const toxicRing = new THREE.Mesh(
        new THREE.TorusGeometry(bs * 1.0, 0.01, 4, 10),
        new THREE.MeshBasicMaterial({ color: 0x44FF44, transparent: true, opacity: 0.2 }),
      );
      toxicRing.rotation.x = Math.PI / 2;
      toxicRing.position.y = bs * 0.5;
      group.add(toxicRing);
    }

    return group;
  }

  // ---- 人形 (小型) ----
  private static buildHumanoidModel(g: THREE.Group, color: THREE.Color, bs: number, config: EnemyConfig): void {
    // 身体
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(bs * 1.0, bs * 1.4, bs * 0.7),
      new THREE.MeshLambertMaterial({ color }),
    );
    body.position.y = bs * 1.1;
    body.castShadow = true;
    g.add(body);

    // 头（大头风格-魔兽）
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(bs * 0.55, 6, 5),
      new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, -0.1, 0.15) }),
    );
    head.position.y = bs * 2.1;
    head.castShadow = true;
    g.add(head);

    // 眼睛
    for (const side of [-0.15, 0.15]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(bs * 0.08, 4, 3),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF }),
      );
      eye.position.set(side * bs, bs * 2.2, bs * 0.4);
      g.add(eye);
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(bs * 0.04, 3, 2),
        new THREE.MeshBasicMaterial({ color: 0x111111 }),
      );
      pupil.position.set(side * bs, bs * 2.2, bs * 0.47);
      g.add(pupil);
    }

    // 腿
    for (const side of [-0.25, 0.25]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(bs * 0.12, bs * 0.1, bs * 0.6, 4),
        new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, 0, -0.1) }),
      );
      leg.position.set(side * bs, bs * 0.3, 0);
      g.add(leg);
    }

    // 手臂
    for (const side of [-0.55, 0.55]) {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(bs * 0.08, bs * 0.06, bs * 0.5, 4),
        new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, -0.05, 0.05) }),
      );
      arm.position.set(side * bs, bs * 1.0, 0);
      arm.rotation.z = side > 0 ? -0.3 : 0.3;
      g.add(arm);
    }
  }

  // ---- 骑士/中型 ----
  private static buildKnightModel(g: THREE.Group, color: THREE.Color, bs: number, config: EnemyConfig): void {
    this.buildHumanoidModel(g, color, bs, config);

    // 头盔
    const helmet = new THREE.Mesh(
      new THREE.ConeGeometry(bs * 0.35, bs * 0.25, 6),
      new THREE.MeshLambertMaterial({ color: 0x888899 }),
    );
    helmet.position.y = bs * 2.5;
    g.add(helmet);

    // 盾牌
    const shield = new THREE.Mesh(
      new THREE.CircleGeometry(bs * 0.35, 6),
      new THREE.MeshLambertMaterial({ color: 0xAA8844, side: THREE.DoubleSide }),
    );
    shield.position.set(-bs * 0.6, bs * 1.2, bs * 0.2);
    shield.rotation.y = 0.3;
    g.add(shield);
  }

  // ---- 重型兽形 ----
  private static buildHeavyBeastModel(g: THREE.Group, color: THREE.Color, bs: number, config: EnemyConfig): void {
    // 身体（宽方块）
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(bs * 1.8, bs * 1.0, bs * 1.3),
      new THREE.MeshLambertMaterial({ color }),
    );
    body.position.y = bs * 0.8;
    body.castShadow = true;
    g.add(body);

    // 头
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(bs * 0.5, 5, 4),
      new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, 0, 0.05) }),
    );
    head.position.set(0, bs * 1.1, bs * 0.8);
    g.add(head);

    // 四腿
    for (const [lx, lz] of [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(bs * 0.12, bs * 0.1, bs * 0.6, 4),
        new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, 0, -0.1) }),
      );
      leg.position.set(lx * bs, bs * 0.3, lz * bs);
      g.add(leg);
    }

    // 角（如果有）
    if (config.radius >= 11) {
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(
          new THREE.ConeGeometry(bs * 0.08, bs * 0.3, 4),
          new THREE.MeshLambertMaterial({ color: 0xCCBB88 }),
        );
        horn.position.set(side * bs * 0.3, bs * 1.5, bs * 0.6);
        horn.rotation.z = side * 0.25;
        g.add(horn);
      }
    }
  }

  // ---- 飞行 ----
  private static buildFlyingModel(g: THREE.Group, color: THREE.Color, bs: number, config: EnemyConfig): void {
    // 流线体
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(bs * 0.8, bs * 2, 5),
      new THREE.MeshLambertMaterial({ color }),
    );
    body.rotation.x = Math.PI / 5;
    body.castShadow = true;
    g.add(body);

    // 翅膀
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(
        new THREE.PlaneGeometry(bs * 2.5, bs * 0.6),
        new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, 0, 0.1), side: THREE.DoubleSide }),
      );
      wing.position.set(side * bs * 0.8, 0, 0);
      wing.rotation.x = -Math.PI / 10;
      wing.rotation.z = side * 0.2;
      g.add(wing);
    }

    // 尾巴
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(bs * 0.2, bs * 0.8, 4),
      new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, 0, -0.1) }),
    );
    tail.rotation.x = -Math.PI / 3;
    tail.position.set(0, bs * 0.3, -bs * 1.0);
    g.add(tail);

    // 地面阴影（扁平暗圆）
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(bs * 0.8, 6),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15, side: THREE.DoubleSide }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.58;
    g.add(shadow);

    g.position.y = 0.6;
  }

  // ---- Boss ----
  private static buildBossModel(g: THREE.Group, color: THREE.Color, bs: number, config: EnemyConfig): void {
    const scale = 1.5;
    const sbs = bs * scale;

    // 巨大身体
    const body = new THREE.Mesh(
      new THREE.DodecahedronGeometry(sbs * 1.2, 1),
      new THREE.MeshPhongMaterial({ color, emissive: 0x331100, emissiveIntensity: 0.25, shininess: 30 }),
    );
    body.position.y = sbs * 1.2;
    body.castShadow = true;
    g.add(body);

    // 头
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(sbs * 0.6, 7, 5),
      new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, 0, 0.08) }),
    );
    head.position.y = sbs * 2.3;
    head.castShadow = true;
    g.add(head);

    // 双角
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(sbs * 0.15, sbs * 0.6, 5),
        new THREE.MeshLambertMaterial({ color: 0xDDBB77 }),
      );
      horn.position.set(side * sbs * 0.45, sbs * 2.8, 0);
      horn.rotation.z = side * 0.25;
      g.add(horn);
    }

    // 皇冠
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(sbs * 0.3, sbs * 0.35, sbs * 0.15, 6),
      new THREE.MeshPhongMaterial({ color: 0xFFD700, emissive: 0xFFAA00, emissiveIntensity: 0.3 }),
    );
    crown.position.y = sbs * 2.9;
    g.add(crown);

    // 发光光环
    const aura = new THREE.Mesh(
      new THREE.TorusGeometry(sbs * 1.5, 0.02, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.3 }),
    );
    aura.rotation.x = Math.PI / 2;
    aura.position.y = sbs * 0.3;
    g.add(aura);

    // 发光粒子球
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(sbs * 1.5, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xFF4400, transparent: true, opacity: 0.05, side: THREE.BackSide }),
    );
    glow.position.y = sbs * 1.2;
    g.add(glow);
  }

  // ---- 3D 血条 ----
  private static addHealthBar(g: THREE.Group, bs: number, isBoss: boolean): void {
    const barW = isBoss ? bs * 3 : bs * 1.8;
    const barH = isBoss ? 0.04 : 0.025;
    const barY = isBoss ? bs * 4 : bs * 3;

    // 背景
    const bgBar = new THREE.Mesh(
      new THREE.BoxGeometry(barW, barH, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x333333 }),
    );
    bgBar.position.y = barY;
    bgBar.name = 'hpBarBg';
    g.add(bgBar);

    // 前景（绿色，后续动态缩放）
    const hpBar = new THREE.Mesh(
      new THREE.BoxGeometry(barW, barH * 0.8, 0.015),
      new THREE.MeshBasicMaterial({ color: 0x00FF00 }),
    );
    hpBar.position.y = barY;
    hpBar.name = 'hpBar';
    g.add(hpBar);
  }

  /** 更新血条（从 Bridge 调用） */
  static updateHealthBar(model: THREE.Group, hpRatio: number): void {
    const hpBar = model.getObjectByName('hpBar') as THREE.Mesh | undefined;
    const bgBar = model.getObjectByName('hpBarBg') as THREE.Mesh | undefined;
    if (!hpBar || !bgBar) return;

    const ratio = Math.max(0, Math.min(1, hpRatio));
    hpBar.scale.x = ratio;
    hpBar.position.x = (ratio - 1) * (bgBar.geometry as THREE.BoxGeometry).parameters.width * 0.5;

    // 颜色：绿→黄→红
    const mat = hpBar.material as THREE.MeshBasicMaterial;
    if (ratio > 0.6) mat.color.setHex(0x00FF00);
    else if (ratio > 0.3) mat.color.setHex(0xFFCC00);
    else mat.color.setHex(0xFF2200);
  }
}
