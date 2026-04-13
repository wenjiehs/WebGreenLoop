import * as THREE from 'three';
import { TowerConfig } from '../config/towers';

/**
 * 塔 3D 模型工厂 - 魔兽风格低多边形程序化模型
 * 7种基础外形 + 等级装饰 + 火把/旗帜/水晶
 */
export class TowerModelFactory {
  static create(config: TowerConfig, level: number = 0): THREE.Group {
    const group = new THREE.Group();
    const sp = config.special || '';
    const cat = config.category;
    const color = new THREE.Color(config.color);
    const projColor = new THREE.Color(config.projectileColor);
    const baseH = 0.25 + level * 0.05;
    const levelScale = 1 + level * 0.03;

    // ---- 根据类型生成不同模型 ----

    if (sp === 'antiair') {
      this.buildAntiAirTower(group, baseH, level);
    } else if (cat === 'aoe' || sp === 'aoe') {
      this.buildCannonTower(group, color, baseH, level);
    } else if (cat === 'support') {
      this.buildSupportTower(group, color, projColor, sp, baseH, level);
    } else if (cat === 'slow') {
      this.buildIceTower(group, baseH, level);
    } else if (cat === 'hero' || sp === 'hero_grow') {
      this.buildHeroTower(group, color, baseH, level);
    } else if (sp === 'execute' || sp === 'chaos') {
      this.buildDarkTower(group, projColor, baseH, level);
    } else if (sp === 'poison') {
      this.buildPoisonTower(group, baseH, level);
    } else if (sp === 'critical') {
      this.buildCriticalTower(group, color, baseH, level);
    } else if (sp === 'bounce') {
      this.buildBounceTower(group, color, baseH, level);
    } else {
      this.buildArrowTower(group, color, baseH, level);
    }

    // 等级装饰
    if (level >= 2) {
      // 高等级加火把
      for (const side of [-0.22, 0.22]) {
        const torchPole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008, 0.01, 0.15, 4),
          new THREE.MeshLambertMaterial({ color: 0x6B3A1F }),
        );
        torchPole.position.set(side, baseH + 0.08, side * 0.5);
        group.add(torchPole);
        const flame = new THREE.Mesh(
          new THREE.SphereGeometry(0.018, 4, 3),
          new THREE.MeshBasicMaterial({ color: 0xFF8822 }),
        );
        flame.position.set(side, baseH + 0.17, side * 0.5);
        group.add(flame);
      }
    }

    if (level >= 3) {
      // 最高级加底部装饰环
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.015, 6, 16),
        new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.3 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.02;
      group.add(ring);
    }

    group.scale.setScalar(levelScale);
    return group;
  }

  // 箭塔 - 方底+尖顶+窗口
  private static buildArrowTower(g: THREE.Group, color: THREE.Color, h: number, lv: number): void {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, h, 0.45),
      new THREE.MeshLambertMaterial({ color }),
    );
    base.position.y = h / 2;
    base.castShadow = true;
    g.add(base);

    // 城垛（顶部4个小方块）
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
      const merlon = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.06, 0.08),
        new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, 0, -0.05) }),
      );
      merlon.position.set(dx, h + 0.03, dz);
      merlon.castShadow = true;
      g.add(merlon);
    }

    // 锥形屋顶
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.15, 4),
      new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
    );
    roof.position.y = h + 0.12;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);

    // 窗口（黑色小方块）
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.08, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x111111 }),
    );
    win.position.set(0, h * 0.65, 0.23);
    g.add(win);
  }

  // 炮塔 - 粗圆柱+炮管+烟囱
  private static buildCannonTower(g: THREE.Group, color: THREE.Color, h: number, lv: number): void {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.35, h, 8),
      new THREE.MeshLambertMaterial({ color }),
    );
    base.position.y = h / 2;
    base.castShadow = true;
    g.add(base);

    // 平台
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(0.33, 0.33, 0.04, 8),
      new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, 0, -0.1) }),
    );
    platform.position.y = h;
    g.add(platform);

    // 炮管
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.06, 0.25 + lv * 0.03, 6),
      new THREE.MeshLambertMaterial({ color: 0x333333 }),
    );
    barrel.rotation.x = Math.PI / 3.5;
    barrel.position.set(0, h + 0.06, 0.14);
    barrel.castShadow = true;
    g.add(barrel);

    // 铆钉
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const rivet = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 4, 3),
        new THREE.MeshLambertMaterial({ color: 0x888888 }),
      );
      rivet.position.set(Math.cos(a) * 0.31, h * 0.6, Math.sin(a) * 0.31);
      g.add(rivet);
    }
  }

  // 冰塔/减速塔 - 冰晶
  private static buildIceTower(g: THREE.Group, h: number, lv: number): void {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, h * 0.6, 6),
      new THREE.MeshLambertMaterial({ color: 0x3366AA }),
    );
    base.position.y = h * 0.3;
    base.castShadow = true;
    g.add(base);

    // 主水晶
    const crystal = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.4 + lv * 0.05, 6),
      new THREE.MeshPhongMaterial({ color: 0x66CCFF, transparent: true, opacity: 0.75, shininess: 120, emissive: 0x224466, emissiveIntensity: 0.2 }),
    );
    crystal.position.y = h + 0.15;
    crystal.castShadow = true;
    g.add(crystal);

    // 小水晶碎片
    for (let i = 0; i < 3 + lv; i++) {
      const a = (i / (3 + lv)) * Math.PI * 2;
      const shard = new THREE.Mesh(
        new THREE.ConeGeometry(0.04, 0.12, 4),
        new THREE.MeshPhongMaterial({ color: 0xAADDFF, transparent: true, opacity: 0.6, shininess: 100 }),
      );
      shard.position.set(Math.cos(a) * 0.2, h * 0.4 + 0.05, Math.sin(a) * 0.2);
      shard.rotation.z = (Math.random() - 0.5) * 0.5;
      g.add(shard);
    }
  }

  // 辅助塔 - 菱形浮空+光环
  private static buildSupportTower(g: THREE.Group, color: THREE.Color, projColor: THREE.Color, sp: string, h: number, lv: number): void {
    // 底座柱
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.1, h, 6),
      new THREE.MeshLambertMaterial({ color: 0x777777 }),
    );
    pillar.position.y = h / 2;
    g.add(pillar);

    // 浮空八面体
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.2 + lv * 0.03, 0),
      new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.85, emissive: projColor, emissiveIntensity: 0.15, shininess: 60 }),
    );
    diamond.position.y = h + 0.25;
    diamond.castShadow = true;
    g.add(diamond);

    // 光环
    const auraColor = sp === 'aura_attack' ? 0xFF8844 : sp === 'aura_speed' ? 0x44CCFF : color.getHex();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.35 + lv * 0.05, 0.015, 8, 20),
      new THREE.MeshBasicMaterial({ color: auraColor, transparent: true, opacity: 0.25 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = h + 0.25;
    g.add(ring);

    // 底部圆盘
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 8),
      new THREE.MeshBasicMaterial({ color: auraColor, transparent: true, opacity: 0.1, side: THREE.DoubleSide }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.01;
    g.add(disc);
  }

  // 英雄塔/破坏塔 - 兵营风格
  private static buildHeroTower(g: THREE.Group, color: THREE.Color, h: number, lv: number): void {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.35, h, 8),
      new THREE.MeshLambertMaterial({ color }),
    );
    base.position.y = h / 2;
    base.castShadow = true;
    g.add(base);

    // 顶部平台
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.04, 8),
      new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, 0, 0.1) }),
    );
    top.position.y = h;
    g.add(top);

    // 旗杆+旗帜
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4),
      new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
    );
    pole.position.set(0.15, h + 0.25, 0);
    g.add(pole);

    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xCC2222, side: THREE.DoubleSide }),
    );
    flag.position.set(0.24, h + 0.43, 0);
    g.add(flag);

    // 盾牌装饰
    const shield = new THREE.Mesh(
      new THREE.CircleGeometry(0.06, 6),
      new THREE.MeshLambertMaterial({ color: 0xDDBB44, side: THREE.DoubleSide }),
    );
    shield.position.set(0, h * 0.6, 0.29);
    g.add(shield);
  }

  // 暗黑塔/秒杀/混乱 - 暗夜精灵风格
  private static buildDarkTower(g: THREE.Group, projColor: THREE.Color, h: number, lv: number): void {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.3, h, 6),
      new THREE.MeshLambertMaterial({ color: 0x1a0a2a }),
    );
    base.position.y = h / 2;
    base.castShadow = true;
    g.add(base);

    // 骷髅/魔法球
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 + lv * 0.02, 8, 6),
      new THREE.MeshPhongMaterial({ color: projColor, emissive: projColor, emissiveIntensity: 0.4, shininess: 80 }),
    );
    orb.position.y = h + 0.15;
    orb.castShadow = true;
    g.add(orb);

    // 尖刺装饰
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.02, 0.12, 4),
        new THREE.MeshLambertMaterial({ color: 0x442244 }),
      );
      spike.position.set(Math.cos(a) * 0.2, h * 0.5, Math.sin(a) * 0.2);
      spike.rotation.z = Math.cos(a) * 0.3;
      spike.rotation.x = Math.sin(a) * 0.3;
      g.add(spike);
    }
  }

  // 毒塔 - 绿色冒泡
  private static buildPoisonTower(g: THREE.Group, h: number, lv: number): void {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.25, h, 6),
      new THREE.MeshLambertMaterial({ color: 0x335533 }),
    );
    base.position.y = h / 2;
    base.castShadow = true;
    g.add(base);

    // 毒锅
    const cauldron = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6),
      new THREE.MeshLambertMaterial({ color: 0x222222 }),
    );
    cauldron.position.y = h;
    g.add(cauldron);

    // 绿色液面
    const liquid = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 8),
      new THREE.MeshBasicMaterial({ color: 0x44FF44, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    liquid.rotation.x = -Math.PI / 2;
    liquid.position.y = h + 0.04;
    g.add(liquid);
  }

  // 重击塔 - 锤子造型
  private static buildCriticalTower(g: THREE.Group, color: THREE.Color, h: number, lv: number): void {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, h, 0.4),
      new THREE.MeshLambertMaterial({ color }),
    );
    base.position.y = h / 2;
    base.castShadow = true;
    g.add(base);

    // 锤头
    const hammer = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.12, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x888888 }),
    );
    hammer.position.y = h + 0.06;
    hammer.castShadow = true;
    g.add(hammer);

    // 锤柄
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.2, 4),
      new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
    );
    handle.position.y = h + 0.15;
    g.add(handle);
  }

  // 弹射塔 - 弹弓造型
  private static buildBounceTower(g: THREE.Group, color: THREE.Color, h: number, lv: number): void {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.28, h, 6),
      new THREE.MeshLambertMaterial({ color }),
    );
    base.position.y = h / 2;
    base.castShadow = true;
    g.add(base);

    // Y形支架
    for (const side of [-0.12, 0.12]) {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.2, 4),
        new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
      );
      arm.position.set(side, h + 0.1, 0);
      arm.rotation.z = side > 0 ? -0.3 : 0.3;
      g.add(arm);
    }

    // 弹弦
    const stringGeo = new THREE.BufferGeometry();
    const sv = [
      -0.18, h + 0.18, 0,
      0, h + 0.05, 0,
      0.18, h + 0.18, 0,
    ];
    stringGeo.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
    const string = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: 0xCCBB88 }));
    g.add(string);
  }

  // 防空塔 - 高瘦+旋转弩
  private static buildAntiAirTower(g: THREE.Group, h: number, lv: number): void {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.12, h + 0.25, 6),
      new THREE.MeshLambertMaterial({ color: 0x666677 }),
    );
    pillar.position.y = (h + 0.25) / 2;
    pillar.castShadow = true;
    g.add(pillar);

    // 弩炮台
    const turret = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.06, 8),
      new THREE.MeshLambertMaterial({ color: 0x555566 }),
    );
    turret.position.y = h + 0.28;
    g.add(turret);

    // 弩臂
    const bow = new THREE.Mesh(
      new THREE.BoxGeometry(0.35 + lv * 0.03, 0.04, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
    );
    bow.position.y = h + 0.32;
    bow.castShadow = true;
    g.add(bow);

    // 瞄准镜
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.08, 4),
      new THREE.MeshLambertMaterial({ color: 0x333333 }),
    );
    scope.rotation.x = Math.PI / 3;
    scope.position.set(0, h + 0.35, 0.06);
    g.add(scope);
  }
}
