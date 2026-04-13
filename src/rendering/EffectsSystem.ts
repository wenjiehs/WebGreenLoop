import * as THREE from 'three';
import { ThreeRenderer } from './ThreeRenderer';

/**
 * 3D 特效系统 - 闪电/爆炸/冰冻/火焰/毒雾/弹道拖尾
 */
export class EffectsSystem {
  private scene: THREE.Scene;
  private effects: { obj: THREE.Object3D; cleanup: () => void; deadline: number }[] = [];

  constructor(private renderer: ThreeRenderer) {
    this.scene = renderer.scene;
  }

  update(): void {
    const now = performance.now();
    this.effects = this.effects.filter(e => {
      if (now > e.deadline) {
        e.cleanup();
        return false;
      }
      return true;
    });
  }

  /** 3D 闪电效果 - 从 A 到 B 的锯齿发光线 */
  spawnLightning(fromX: number, fromY: number, toX: number, toY: number): void {
    const from = ThreeRenderer.toWorld(fromX, fromY, 0.3);
    const to = ThreeRenderer.toWorld(toX, toY, 0.2);

    const segments = 8;
    const points: THREE.Vector3[] = [from.clone()];
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      points.push(new THREE.Vector3(
        from.x + (to.x - from.x) * t + (Math.random() - 0.5) * 0.3,
        from.y + (to.y - from.y) * t + Math.random() * 0.15 + 0.1,
        from.z + (to.z - from.z) * t + (Math.random() - 0.5) * 0.3,
      ));
    }
    points.push(to.clone());

    // 外层发光（蓝色宽线）
    const glowGeo = new THREE.BufferGeometry().setFromPoints(points);
    const glowMat = new THREE.LineBasicMaterial({ color: 0x4488FF, linewidth: 3, transparent: true, opacity: 0.6 });
    const glow = new THREE.Line(glowGeo, glowMat);
    this.scene.add(glow);

    // 内层高亮（白色）
    const coreMat = new THREE.LineBasicMaterial({ color: 0xFFFFFF, linewidth: 1, transparent: true, opacity: 0.9 });
    const core = new THREE.Line(glowGeo.clone(), coreMat);
    this.scene.add(core);

    // 击中火花
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xFFFF88, transparent: true, opacity: 0.8 }),
    );
    spark.position.copy(to);
    this.scene.add(spark);

    const deadline = performance.now() + 200;
    this.effects.push({
      obj: glow, deadline,
      cleanup: () => {
        this.scene.remove(glow); this.scene.remove(core); this.scene.remove(spark);
        glowGeo.dispose(); glowMat.dispose(); coreMat.dispose();
        spark.geometry.dispose(); (spark.material as THREE.Material).dispose();
      },
    });

    // 渐隐
    let frame = 0;
    const animate = () => {
      frame++;
      glowMat.opacity -= 0.08;
      coreMat.opacity -= 0.1;
      (spark.material as THREE.MeshBasicMaterial).opacity -= 0.1;
      spark.scale.multiplyScalar(1.15);
      if (frame < 10) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /** 3D AOE 爆炸 - 半球扩散波 + 粒子 */
  spawnExplosion(px: number, py: number, radius: number, color: number = 0xFF6600): void {
    const pos = ThreeRenderer.toWorld(px, py, 0.1);
    const r3d = radius * ThreeRenderer.SCALE;

    // 扩散环
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.03, 8, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(pos);
    this.scene.add(ring);

    // 发光球
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xFFFF88, transparent: true, opacity: 0.8 }),
    );
    flash.position.copy(pos);
    flash.position.y += 0.1;
    this.scene.add(flash);

    // 碎片粒子
    const particles: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.03, 0.03),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
      );
      p.position.copy(pos);
      p.position.y += 0.15;
      this.scene.add(p);
      particles.push(p);
    }

    const dirs = particles.map(() => new THREE.Vector3(
      (Math.random() - 0.5) * 0.06,
      Math.random() * 0.04 + 0.02,
      (Math.random() - 0.5) * 0.06,
    ));

    const deadline = performance.now() + 600;
    this.effects.push({
      obj: ring, deadline,
      cleanup: () => {
        this.scene.remove(ring); this.scene.remove(flash);
        ring.geometry.dispose(); (ring.material as THREE.Material).dispose();
        flash.geometry.dispose(); (flash.material as THREE.Material).dispose();
        particles.forEach(p => {
          this.scene.remove(p);
          p.geometry.dispose(); (p.material as THREE.Material).dispose();
        });
      },
    });

    let frame = 0;
    const animate = () => {
      frame++;
      // 环扩散
      const scale = 1 + frame * 0.3;
      ring.scale.set(scale, scale, 1);
      (ring.material as THREE.MeshBasicMaterial).opacity -= 0.05;
      // 闪光缩小
      flash.scale.multiplyScalar(0.9);
      (flash.material as THREE.MeshBasicMaterial).opacity -= 0.06;
      // 粒子飞散
      particles.forEach((p, i) => {
        p.position.add(dirs[i]);
        dirs[i].y -= 0.003;
        p.rotation.x += 0.15;
        (p.material as THREE.MeshBasicMaterial).opacity -= 0.04;
      });
      if (frame < 15) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /** 冰冻效果 - 地面冰晶扩散 */
  spawnFreezeEffect(px: number, py: number, radius: number): void {
    const pos = ThreeRenderer.toWorld(px, py, 0.02);
    const r3d = radius * ThreeRenderer.SCALE;

    const ice = new THREE.Mesh(
      new THREE.CircleGeometry(0.1, 6),
      new THREE.MeshBasicMaterial({ color: 0x88CCFF, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    ice.rotation.x = -Math.PI / 2;
    ice.position.copy(pos);
    this.scene.add(ice);

    // 冰晶柱
    for (let i = 0; i < 5; i++) {
      const crystal = new THREE.Mesh(
        new THREE.ConeGeometry(0.02, 0.08 + Math.random() * 0.06, 4),
        new THREE.MeshPhongMaterial({ color: 0xAADDFF, transparent: true, opacity: 0.7, shininess: 100 }),
      );
      const angle = (i / 5) * Math.PI * 2;
      crystal.position.set(
        pos.x + Math.cos(angle) * 0.15,
        0.04 + Math.random() * 0.03,
        pos.z + Math.sin(angle) * 0.15,
      );
      this.scene.add(crystal);

      const deadline = performance.now() + 800;
      this.effects.push({
        obj: crystal, deadline,
        cleanup: () => {
          this.scene.remove(crystal);
          crystal.geometry.dispose(); (crystal.material as THREE.Material).dispose();
        },
      });
    }

    const deadline = performance.now() + 800;
    this.effects.push({
      obj: ice, deadline,
      cleanup: () => {
        this.scene.remove(ice);
        ice.geometry.dispose(); (ice.material as THREE.Material).dispose();
      },
    });

    let frame = 0;
    const animate = () => {
      frame++;
      const s = 1 + frame * 0.15;
      ice.scale.set(s, s, 1);
      (ice.material as THREE.MeshBasicMaterial).opacity -= 0.03;
      if (frame < 16) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /** 火焰喷射效果 */
  spawnFireEffect(px: number, py: number): void {
    const pos = ThreeRenderer.toWorld(px, py, 0.2);

    for (let i = 0; i < 8; i++) {
      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.03 + Math.random() * 0.03, 4, 3),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.05 + Math.random() * 0.08, 1, 0.5 + Math.random() * 0.3),
          transparent: true, opacity: 0.8,
        }),
      );
      flame.position.copy(pos);
      this.scene.add(flame);

      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 0.03,
        Math.random() * 0.03 + 0.01,
        (Math.random() - 0.5) * 0.03,
      );

      const deadline = performance.now() + 500;
      this.effects.push({
        obj: flame, deadline,
        cleanup: () => {
          this.scene.remove(flame);
          flame.geometry.dispose(); (flame.material as THREE.Material).dispose();
        },
      });

      let frame = 0;
      const animate = () => {
        frame++;
        flame.position.add(dir);
        flame.scale.multiplyScalar(0.95);
        (flame.material as THREE.MeshBasicMaterial).opacity -= 0.06;
        if (frame < 12) requestAnimationFrame(animate);
      };
      setTimeout(() => requestAnimationFrame(animate), i * 30);
    }
  }

  /** 毒雾效果 */
  spawnPoisonCloud(px: number, py: number): void {
    const pos = ThreeRenderer.toWorld(px, py, 0.15);

    const cloud = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0x44FF44, transparent: true, opacity: 0.3 }),
    );
    cloud.position.copy(pos);
    cloud.scale.y = 0.5;
    this.scene.add(cloud);

    const deadline = performance.now() + 1000;
    this.effects.push({
      obj: cloud, deadline,
      cleanup: () => {
        this.scene.remove(cloud);
        cloud.geometry.dispose(); (cloud.material as THREE.Material).dispose();
      },
    });

    let frame = 0;
    const animate = () => {
      frame++;
      cloud.scale.multiplyScalar(1.02);
      cloud.position.y += 0.005;
      (cloud.material as THREE.MeshBasicMaterial).opacity -= 0.012;
      if (frame < 25) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /** Boss 死亡大爆炸 */
  spawnBossExplosion(px: number, py: number): void {
    const pos = ThreeRenderer.toWorld(px, py, 0);

    for (let wave = 0; wave < 3; wave++) {
      setTimeout(() => {
        // 大型爆炸环
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.2, 0.05, 8, 24),
          new THREE.MeshBasicMaterial({ color: 0xFFAA00, transparent: true, opacity: 0.8 }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(pos);
        ring.position.y = 0.2 + wave * 0.3;
        this.scene.add(ring);

        // 大量碎片
        const frags: THREE.Mesh[] = [];
        for (let i = 0; i < 15; i++) {
          const frag = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.04, 0.04),
            new THREE.MeshBasicMaterial({
              color: new THREE.Color().setHSL(0.08 + Math.random() * 0.05, 1, 0.5),
              transparent: true, opacity: 0.9,
            }),
          );
          frag.position.copy(pos);
          frag.position.y += 0.3;
          this.scene.add(frag);
          frags.push(frag);
        }

        const fragDirs = frags.map(() => new THREE.Vector3(
          (Math.random() - 0.5) * 0.08,
          Math.random() * 0.06 + 0.02,
          (Math.random() - 0.5) * 0.08,
        ));

        const deadline = performance.now() + 1000;
        this.effects.push({
          obj: ring, deadline,
          cleanup: () => {
            this.scene.remove(ring);
            ring.geometry.dispose(); (ring.material as THREE.Material).dispose();
            frags.forEach(f => {
              this.scene.remove(f);
              f.geometry.dispose(); (f.material as THREE.Material).dispose();
            });
          },
        });

        let frame = 0;
        const animate = () => {
          frame++;
          ring.scale.set(1 + frame * 0.4, 1 + frame * 0.4, 1);
          (ring.material as THREE.MeshBasicMaterial).opacity -= 0.06;
          frags.forEach((f, i) => {
            f.position.add(fragDirs[i]);
            fragDirs[i].y -= 0.003;
            f.rotation.x += 0.2;
            f.rotation.z += 0.15;
            (f.material as THREE.MeshBasicMaterial).opacity -= 0.04;
          });
          if (frame < 20) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }, wave * 250);
    }
  }
}
