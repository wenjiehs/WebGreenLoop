import * as THREE from 'three';
import { SummonConfig } from '../entities/SummonLogic';

/**
 * 召唤物 3D 模型工厂 — 简单低多边形
 */
export class SummonModelFactory {
  static create(config: SummonConfig): THREE.Group {
    const g = new THREE.Group();
    const color = new THREE.Color(config.color);

    switch (config.type) {
      case 'water_elemental': return this.buildWaterElemental(g, color);
      case 'hawk': return this.buildHawk(g, color);
      case 'bear': return this.buildBear(g, color);
      case 'imp': return this.buildImp(g, color);
      default: return this.buildGeneric(g, color);
    }
  }

  private static buildWaterElemental(g: THREE.Group, color: THREE.Color): THREE.Group {
    // 半透明水滴形
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 6),
      new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.7, emissive: color, emissiveIntensity: 0.2 }),
    );
    body.position.y = 0.2; body.castShadow = true; g.add(body);

    // 水波环
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.015, 4, 12),
      new THREE.MeshBasicMaterial({ color: 0x66CCFF, transparent: true, opacity: 0.4 }),
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; ring.name = 'summonAura'; g.add(ring);

    // 顶部小水滴
    const drop = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.06, 0),
      new THREE.MeshPhongMaterial({ color: 0xAAEEFF, transparent: true, opacity: 0.6 }),
    );
    drop.position.y = 0.4; drop.name = 'summonCore'; g.add(drop);
    return g;
  }

  private static buildHawk(g: THREE.Group, color: THREE.Color): THREE.Group {
    // 流线身体
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.25, 5),
      new THREE.MeshLambertMaterial({ color }),
    );
    body.position.y = 0.35; body.rotation.x = Math.PI / 6; body.castShadow = true; g.add(body);

    // 翅膀
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.01, 0.1),
        new THREE.MeshLambertMaterial({ color: 0xAA7733 }),
      );
      wing.position.set(side * 0.15, 0.35, 0);
      wing.rotation.z = side * 0.3;
      wing.name = side === 1 ? 'wingR' : 'wingL';
      g.add(wing);
    }

    // 地面阴影
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.1, 6),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 }),
    );
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; g.add(shadow);
    return g;
  }

  private static buildBear(g: THREE.Group, color: THREE.Color): THREE.Group {
    // 粗壮身体
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.18, 0.15),
      new THREE.MeshLambertMaterial({ color }),
    );
    body.position.y = 0.15; body.castShadow = true; g.add(body);

    // 头
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 6, 5),
      new THREE.MeshLambertMaterial({ color: 0x775522 }),
    );
    head.position.set(0, 0.28, 0.08); g.add(head);

    // 四腿
    for (const [dx, dz] of [[-0.07,-0.05],[0.07,-0.05],[-0.07,0.05],[0.07,0.05]]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.03, 0.12, 4),
        new THREE.MeshLambertMaterial({ color: 0x664422 }),
      );
      leg.position.set(dx, 0.06, dz); g.add(leg);
    }
    return g;
  }

  private static buildImp(g: THREE.Group, color: THREE.Color): THREE.Group {
    // 小身体
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 6, 5),
      new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.15 }),
    );
    body.position.y = 0.18; body.castShadow = true; g.add(body);

    // 角
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.02, 0.08, 4),
        new THREE.MeshLambertMaterial({ color: 0x440022 }),
      );
      horn.position.set(side * 0.06, 0.3, 0);
      horn.rotation.z = side * 0.3;
      g.add(horn);
    }

    // 小翅膀
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.08, 0.01),
        new THREE.MeshLambertMaterial({ color: 0x660044, transparent: true, opacity: 0.6 }),
      );
      wing.position.set(side * 0.12, 0.22, -0.02);
      wing.rotation.y = side * 0.4;
      g.add(wing);
    }

    // 发光眼睛
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0xFF0044 }),
    );
    eye.position.set(0, 0.22, 0.08); g.add(eye);
    return g;
  }

  private static buildGeneric(g: THREE.Group, color: THREE.Color): THREE.Group {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 6, 5),
      new THREE.MeshLambertMaterial({ color }),
    );
    body.position.y = 0.15; g.add(body);
    return g;
  }
}
