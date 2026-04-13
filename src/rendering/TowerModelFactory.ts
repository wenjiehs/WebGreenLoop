import * as THREE from 'three';
import { ThreeRenderer } from './ThreeRenderer';
import { TowerConfig } from '../config/towers';

/**
 * 塔 3D 模型工厂 - 根据塔类型生成不同几何形状
 */
export class TowerModelFactory {
  static create(config: TowerConfig, level: number = 0): THREE.Group {
    const group = new THREE.Group();
    const cat = config.category;
    const sp = config.special || '';
    const color = new THREE.Color(config.color);
    const s = ThreeRenderer.SCALE;
    const baseH = 0.3 + level * 0.06;

    if (cat === 'aoe' || sp === 'aoe') {
      // 炮塔 - 粗短圆柱+炮管
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35 * s * 32, 0.4 * s * 32, baseH, 8),
        new THREE.MeshLambertMaterial({ color }),
      );
      base.position.y = baseH / 2;
      base.castShadow = true;
      group.add(base);

      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.3, 6),
        new THREE.MeshLambertMaterial({ color: 0x444444 }),
      );
      barrel.rotation.x = Math.PI / 4;
      barrel.position.set(0, baseH + 0.05, 0.12);
      barrel.castShadow = true;
      group.add(barrel);
    } else if (cat === 'support') {
      // 辅助塔 - 菱形浮空
      const diamond = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.3, 0),
        new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.8 }),
      );
      diamond.position.y = baseH + 0.2;
      diamond.castShadow = true;
      group.add(diamond);

      // 底座柱
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.12, baseH, 6),
        new THREE.MeshLambertMaterial({ color: 0x888888 }),
      );
      pillar.position.y = baseH / 2;
      group.add(pillar);

      // 光环环
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.02, 8, 16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = baseH + 0.2;
      group.add(ring);
    } else if (cat === 'slow') {
      // 减速/冰塔 - 水晶形
      const crystal = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.5, 6),
        new THREE.MeshPhongMaterial({ color: 0x66CCFF, transparent: true, opacity: 0.7, shininess: 100 }),
      );
      crystal.position.y = baseH + 0.25;
      crystal.castShadow = true;
      group.add(crystal);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.3, baseH * 0.6, 6),
        new THREE.MeshLambertMaterial({ color: 0x446688 }),
      );
      base.position.y = baseH * 0.3;
      base.castShadow = true;
      group.add(base);
    } else if (cat === 'hero' || sp === 'hero_grow') {
      // 英雄塔 - 圆台+旗帜
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, baseH, 8),
        new THREE.MeshLambertMaterial({ color }),
      );
      base.position.y = baseH / 2;
      base.castShadow = true;
      group.add(base);

      // 旗杆
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4),
        new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
      );
      pole.position.set(0.15, baseH + 0.3, 0);
      group.add(pole);

      // 旗帜
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xFF4444, side: THREE.DoubleSide }),
      );
      flag.position.set(0.25, baseH + 0.5, 0);
      group.add(flag);
    } else if (sp === 'execute' || sp === 'chaos') {
      // 特殊塔 - 暗黑风
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.35, baseH, 6),
        new THREE.MeshLambertMaterial({ color: 0x220022 }),
      );
      base.position.y = baseH / 2;
      base.castShadow = true;
      group.add(base);

      // 骷髅球
      const skull = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 6, 5),
        new THREE.MeshPhongMaterial({ color: 0xCCBBAA, emissive: 0x331111, emissiveIntensity: 0.3 }),
      );
      skull.position.y = baseH + 0.15;
      skull.castShadow = true;
      group.add(skull);
    } else if (sp === 'antiair') {
      // 防空塔 - 高细柱+十字弩
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.15, baseH + 0.3, 6),
        new THREE.MeshLambertMaterial({ color: 0x888888 }),
      );
      pillar.position.y = (baseH + 0.3) / 2;
      pillar.castShadow = true;
      group.add(pillar);

      // 弩炮头
      const bow = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.06, 0.06),
        new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
      );
      bow.position.y = baseH + 0.35;
      bow.castShadow = true;
      group.add(bow);
    } else {
      // 默认箭塔 - 方底+锥顶
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, baseH, 0.5),
        new THREE.MeshLambertMaterial({ color }),
      );
      base.position.y = baseH / 2;
      base.castShadow = true;
      group.add(base);

      const top = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 0.2, 4),
        new THREE.MeshLambertMaterial({ color: color.clone().offsetHSL(0, 0, 0.1) }),
      );
      top.position.y = baseH + 0.1;
      top.castShadow = true;
      group.add(top);
    }

    return group;
  }
}
