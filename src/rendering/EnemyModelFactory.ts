import * as THREE from 'three';
import { EnemyConfig } from '../config/enemies';
import { ThreeRenderer } from './ThreeRenderer';

/**
 * 怪物 3D 模型工厂 - 程序化低多边形模型
 */
export class EnemyModelFactory {
  static create(config: EnemyConfig): THREE.Group {
    const group = new THREE.Group();
    const color = new THREE.Color(config.color);
    const r = config.radius * ThreeRenderer.SCALE;
    const bodyScale = Math.max(0.08, r * 0.7);

    if (config.isFlying) {
      // 飞行单位 - 翼形
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(bodyScale, bodyScale * 1.5, 5),
        new THREE.MeshLambertMaterial({ color }),
      );
      body.rotation.x = Math.PI / 6;
      body.castShadow = true;
      group.add(body);

      // 翅膀
      const wingGeo = new THREE.PlaneGeometry(bodyScale * 3, bodyScale * 0.8);
      const wingMat = new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, 0, 0.1), side: THREE.DoubleSide });
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.rotation.x = -Math.PI / 8;
      wing.position.y = bodyScale * 0.2;
      group.add(wing);

      group.position.y = 0.6; // 飞在空中
    } else if (config.isBoss) {
      // Boss - 大型复杂体
      const body = new THREE.Mesh(
        new THREE.DodecahedronGeometry(bodyScale * 1.5, 1),
        new THREE.MeshPhongMaterial({ color, emissive: 0x331100, emissiveIntensity: 0.2 }),
      );
      body.position.y = bodyScale * 1.5;
      body.castShadow = true;
      group.add(body);

      // 角
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(
          new THREE.ConeGeometry(bodyScale * 0.2, bodyScale * 0.8, 4),
          new THREE.MeshLambertMaterial({ color: 0xCCBB88 }),
        );
        horn.position.set(side * bodyScale * 0.8, bodyScale * 2.5, 0);
        horn.rotation.z = side * 0.3;
        group.add(horn);
      }

      // 金色光环
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(bodyScale * 1.8, 0.02, 8, 16),
        new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.4 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = bodyScale * 0.5;
      group.add(ring);
    } else if (config.radius >= 9) {
      // 重型 - 四足兽形
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(bodyScale * 2, bodyScale * 1.2, bodyScale * 1.5),
        new THREE.MeshLambertMaterial({ color }),
      );
      body.position.y = bodyScale * 1;
      body.castShadow = true;
      group.add(body);

      // 头
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(bodyScale * 0.6, 5, 4),
        new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, 0, 0.05) }),
      );
      head.position.set(0, bodyScale * 1.4, bodyScale * 0.9);
      group.add(head);

      // 四条腿
      for (const [lx, lz] of [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(bodyScale * 0.15, bodyScale * 0.12, bodyScale * 0.8, 4),
          new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, 0, -0.1) }),
        );
        leg.position.set(lx * bodyScale, bodyScale * 0.4, lz * bodyScale);
        group.add(leg);
      }
    } else {
      // 人形 - 球头+方身+两腿
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(bodyScale * 1.2, bodyScale * 1.5, bodyScale * 0.8),
        new THREE.MeshLambertMaterial({ color }),
      );
      body.position.y = bodyScale * 1.2;
      body.castShadow = true;
      group.add(body);

      // 头
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(bodyScale * 0.5, 6, 5),
        new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, -0.1, 0.15) }),
      );
      head.position.y = bodyScale * 2.2;
      head.castShadow = true;
      group.add(head);

      // 两条腿
      for (const side of [-0.3, 0.3]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(bodyScale * 0.15, bodyScale * 0.12, bodyScale * 0.7, 4),
          new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, 0, -0.1) }),
        );
        leg.position.set(side * bodyScale, bodyScale * 0.35, 0);
        group.add(leg);
      }
    }

    // 隐形材质
    if (config.isInvisible) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.MeshLambertMaterial).transparent = true;
          (child.material as THREE.MeshLambertMaterial).opacity = 0.35;
        }
      });
    }

    // 魔免标记 - 蓝色护盾环
    if (config.isMagicImmune) {
      const shield = new THREE.Mesh(
        new THREE.TorusGeometry(bodyScale * 1.2, 0.015, 6, 12),
        new THREE.MeshBasicMaterial({ color: 0x4488FF, transparent: true, opacity: 0.4 }),
      );
      shield.rotation.x = Math.PI / 2;
      shield.position.y = bodyScale * 1;
      group.add(shield);
    }

    return group;
  }
}
