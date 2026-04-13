import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../utils/constants';
import { ThreeRenderer } from './ThreeRenderer';

/**
 * 地形生成器 - 草地+路径+边缘+建造网格+环境装饰(树/石/灌木/花/火把)
 */
export class TerrainBuilder {
  private group: THREE.Group;

  constructor(private renderer: ThreeRenderer) {
    this.group = new THREE.Group();
  }

  build(pathTiles: Set<string>): THREE.Group {
    this.buildGround();
    this.buildPath(pathTiles);
    this.buildBuildableGrid(pathTiles);
    this.buildDecorations(pathTiles);
    this.buildEdgeFog();
    return this.group;
  }

  private buildGround(): void {
    const w = GAME_WIDTH * ThreeRenderer.SCALE;
    const h = (GAME_HEIGHT - 140) * ThreeRenderer.SCALE;

    const grassGeo = new THREE.PlaneGeometry(w * 1.3, h * 1.3, 60, 45);
    const pos = grassGeo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // 柏林噪声近似
      const noise = Math.sin(x * 2.5) * Math.cos(z * 3.1) * 0.04
        + Math.sin(x * 5.7 + 1.3) * Math.cos(z * 4.2 - 0.7) * 0.02;
      pos.setY(i, noise);
    }
    grassGeo.computeVertexNormals();

    // 顶点色
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const z = pos.getZ(i);
      const noise = (Math.sin(x * 8) * Math.cos(z * 6) + 1) * 0.5;
      const base = 0.12 + noise * 0.12;
      colors[i * 3] = base * 0.6 + Math.random() * 0.03;
      colors[i * 3 + 1] = base * 1.1 + Math.random() * 0.05;
      colors[i * 3 + 2] = base * 0.35 + Math.random() * 0.02;
    }
    grassGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const grass = new THREE.Mesh(grassGeo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    grass.position.y = -0.02;
    this.group.add(grass);
  }

  private buildPath(pathTiles: Set<string>): void {
    const ts = TILE_SIZE * ThreeRenderer.SCALE;
    const tiles = Array.from(pathTiles);
    const dummy = new THREE.Object3D();

    // 路面
    const pathMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(ts * 0.96, 0.06, ts * 0.96),
      new THREE.MeshLambertMaterial({ color: 0x8b7355 }),
      tiles.length,
    );
    pathMesh.receiveShadow = true;

    tiles.forEach((key, i) => {
      const [c, r] = key.split(',').map(Number);
      const p = ThreeRenderer.toWorld(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, 0.03);
      dummy.position.copy(p);
      dummy.updateMatrix();
      pathMesh.setMatrixAt(i, dummy.matrix);
      const s = 0.42 + Math.random() * 0.16;
      pathMesh.setColorAt(i, new THREE.Color(s, s * 0.82, s * 0.62));
    });
    pathMesh.instanceColor!.needsUpdate = true;
    this.group.add(pathMesh);

    // 路缘石 - 在边缘瓦片加高一点
    const edgeTiles = tiles.filter(key => {
      const [c, r] = key.split(',').map(Number);
      return [[c-1,r],[c+1,r],[c,r-1],[c,r+1]].some(([nc, nr]) => !pathTiles.has(`${nc},${nr}`));
    });

    if (edgeTiles.length > 0) {
      const edgeMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(ts, 0.1, ts),
        new THREE.MeshLambertMaterial({ color: 0x5a4025 }),
        edgeTiles.length,
      );
      edgeMesh.receiveShadow = true;
      edgeTiles.forEach((key, i) => {
        const [c, r] = key.split(',').map(Number);
        const p = ThreeRenderer.toWorld(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, 0.05);
        dummy.position.copy(p);
        dummy.updateMatrix();
        edgeMesh.setMatrixAt(i, dummy.matrix);
      });
      this.group.add(edgeMesh);
    }

    // 路面砖缝线（十字线）
    const lineGeo = new THREE.BufferGeometry();
    const lineVerts: number[] = [];
    tiles.forEach(key => {
      const [c, r] = key.split(',').map(Number);
      const p = ThreeRenderer.toWorld(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, 0.065);
      const half = ts * 0.48;
      // 水平线
      lineVerts.push(p.x - half, p.y, p.z, p.x + half, p.y, p.z);
      // 垂直线
      lineVerts.push(p.x, p.y, p.z - half, p.x, p.y, p.z + half);
    });
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
    const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08 }));
    this.group.add(lines);
  }

  private buildBuildableGrid(pathTiles: Set<string>): void {
    // 半透明可建造网格线
    const ts = TILE_SIZE * ThreeRenderer.SCALE;
    const cols = Math.floor(GAME_WIDTH / TILE_SIZE);
    const rows = Math.floor((GAME_HEIGHT - 140) / TILE_SIZE);
    const verts: number[] = [];

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (pathTiles.has(`${c},${r}`)) continue;
        if (r >= rows - 3) continue; // UI区域
        const p = ThreeRenderer.toWorld(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, 0.01);
        const half = ts * 0.49;
        // 4条边
        verts.push(p.x - half, p.y, p.z - half, p.x + half, p.y, p.z - half);
        verts.push(p.x + half, p.y, p.z - half, p.x + half, p.y, p.z + half);
        verts.push(p.x + half, p.y, p.z + half, p.x - half, p.y, p.z + half);
        verts.push(p.x - half, p.y, p.z + half, p.x - half, p.y, p.z - half);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const grid = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x44AA44, transparent: true, opacity: 0.06 }));
    this.group.add(grid);
  }

  private buildDecorations(pathTiles: Set<string>): void {
    const decoGroup = new THREE.Group();
    const cols = Math.floor(GAME_WIDTH / TILE_SIZE);
    const rows = Math.floor((GAME_HEIGHT - 140) / TILE_SIZE);

    // 在路径外圈和地图边缘放置装饰
    for (let i = 0; i < 120; i++) {
      const c = Math.floor(Math.random() * cols);
      const r = Math.floor(Math.random() * rows);
      if (pathTiles.has(`${c},${r}`)) continue;
      // 路径附近（1-3格内）更多装饰
      const nearPath = [[c-1,r],[c+1,r],[c,r-1],[c,r+1],[c-2,r],[c+2,r],[c,r-2],[c,r+2]]
        .some(([nc, nr]) => pathTiles.has(`${nc},${nr}`));

      const px = c * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * TILE_SIZE * 0.5;
      const py = r * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * TILE_SIZE * 0.5;
      const pos = ThreeRenderer.toWorld(px, py, 0);

      const rand = Math.random();
      if (rand < 0.35) {
        decoGroup.add(this.createTree(pos, 0.15 + Math.random() * 0.35));
      } else if (rand < 0.55) {
        decoGroup.add(this.createRock(pos, 0.06 + Math.random() * 0.1));
      } else if (rand < 0.75) {
        decoGroup.add(this.createBush(pos, 0.08 + Math.random() * 0.1));
      } else if (rand < 0.88) {
        decoGroup.add(this.createFlowers(pos));
      } else if (nearPath && rand > 0.95) {
        decoGroup.add(this.createTorch(pos));
      }
    }
    this.group.add(decoGroup);
  }

  private buildEdgeFog(): void {
    // 地图边缘渐隐平面（战争迷雾感）
    const w = GAME_WIDTH * ThreeRenderer.SCALE;
    const h = (GAME_HEIGHT - 140) * ThreeRenderer.SCALE;

    for (const [dx, dz, sx, sz] of [
      [0, -h * 0.65, w * 1.3, h * 0.15],
      [0, h * 0.65, w * 1.3, h * 0.15],
      [-w * 0.65, 0, w * 0.15, h * 1.3],
      [w * 0.65, 0, w * 0.15, h * 1.3],
    ]) {
      const fog = new THREE.Mesh(
        new THREE.PlaneGeometry(sx, sz),
        new THREE.MeshBasicMaterial({ color: 0x1a2a0e, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
      );
      fog.rotation.x = -Math.PI / 2;
      fog.position.set(dx, 0.15, dz);
      this.group.add(fog);
    }
  }

  private createTree(pos: THREE.Vector3, scale: number): THREE.Group {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03 * scale, 0.05 * scale, 0.35 * scale, 5),
      new THREE.MeshLambertMaterial({ color: 0x6B3A1F }),
    );
    trunk.position.set(pos.x, 0.175 * scale, pos.z);
    trunk.castShadow = true;
    tree.add(trunk);

    for (let layer = 0; layer < 3; layer++) {
      const r = (0.18 - layer * 0.04) * scale;
      const h = 0.18 * scale;
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(r, h, 6),
        new THREE.MeshLambertMaterial({
          color: new THREE.Color(0.08 + Math.random() * 0.08, 0.3 + Math.random() * 0.15, 0.06 + Math.random() * 0.04),
        }),
      );
      crown.position.set(pos.x, (0.3 + layer * 0.1) * scale, pos.z);
      crown.castShadow = true;
      tree.add(crown);
    }
    return tree;
  }

  private createRock(pos: THREE.Vector3, scale: number): THREE.Mesh {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(scale, 0),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(0.38 + Math.random() * 0.12, 0.36 + Math.random() * 0.08, 0.33) }),
    );
    rock.position.set(pos.x, scale * 0.25, pos.z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.scale.y = 0.55;
    rock.castShadow = true;
    return rock;
  }

  private createBush(pos: THREE.Vector3, scale: number): THREE.Group {
    const bush = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(scale * (0.6 + Math.random() * 0.4), 5, 4),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(0.1, 0.28 + Math.random() * 0.12, 0.08) }),
      );
      sphere.position.set(
        pos.x + (Math.random() - 0.5) * scale * 0.5,
        scale * 0.3,
        pos.z + (Math.random() - 0.5) * scale * 0.5,
      );
      sphere.scale.y = 0.6;
      sphere.castShadow = true;
      bush.add(sphere);
    }
    return bush;
  }

  private createFlowers(pos: THREE.Vector3): THREE.Group {
    const flowers = new THREE.Group();
    const flowerColors = [0xFF6688, 0xFFCC44, 0xFF88CC, 0xFFFFFF, 0xAA88FF];
    for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
      const f = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 4, 3),
        new THREE.MeshBasicMaterial({ color: flowerColors[Math.floor(Math.random() * flowerColors.length)] }),
      );
      f.position.set(
        pos.x + (Math.random() - 0.5) * 0.12,
        0.015,
        pos.z + (Math.random() - 0.5) * 0.12,
      );
      flowers.add(f);
    }
    return flowers;
  }

  private createTorch(pos: THREE.Vector3): THREE.Group {
    const torch = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.015, 0.3, 4),
      new THREE.MeshLambertMaterial({ color: 0x6B3A1F }),
    );
    pole.position.set(pos.x, 0.15, pos.z);
    torch.add(pole);

    // 火焰光（发光球）
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 4, 3),
      new THREE.MeshBasicMaterial({ color: 0xFF8822 }),
    );
    flame.position.set(pos.x, 0.32, pos.z);
    torch.add(flame);

    // 点光源
    const light = new THREE.PointLight(0xFF6622, 0.3, 2);
    light.position.set(pos.x, 0.35, pos.z);
    torch.add(light);

    return torch;
  }
}
