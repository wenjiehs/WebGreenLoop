import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../utils/constants';
import { ThreeRenderer } from './ThreeRenderer';

/**
 * 地形生成器 — 魔兽争霸风格的明亮绿色草地
 * 鲜艳草地 + 石砖路径 + 路沿石 + 大量装饰(树林/岩石/灌木/花/火把/蘑菇/草丛)
 */
export class TerrainBuilder {
  private group: THREE.Group;

  constructor(private renderer: ThreeRenderer) {
    this.group = new THREE.Group();
  }

  build(pathTiles: Set<string>): THREE.Group {
    this.buildGround();
    this.buildPath(pathTiles);
    this.buildPathBorder(pathTiles);
    this.buildBuildableGrid(pathTiles);
    this.buildDecorations(pathTiles);
    this.buildGrassPatches(pathTiles);
    return this.group;
  }

  /** 鲜明绿色草地 + 微起伏 */
  private buildGround(): void {
    const w = GAME_WIDTH * ThreeRenderer.SCALE;
    const h = (GAME_HEIGHT - 140) * ThreeRenderer.SCALE;

    const grassGeo = new THREE.PlaneGeometry(w * 1.4, h * 1.4, 80, 60);
    const pos = grassGeo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const z = pos.getZ(i);
      const noise = Math.sin(x * 2.5) * Math.cos(z * 3.1) * 0.06
        + Math.sin(x * 5.7 + 1.3) * Math.cos(z * 4.2 - 0.7) * 0.03
        + Math.sin(x * 11 + 2.5) * Math.cos(z * 9.3) * 0.01;
      pos.setY(i, noise);
    }
    grassGeo.computeVertexNormals();

    // 鲜明绿色顶点色 — 像魔兽争霸的 Felwood/Lordaeron 草地
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const z = pos.getZ(i);
      const n1 = (Math.sin(x * 6 + 0.5) * Math.cos(z * 5) + 1) * 0.5;
      const n2 = (Math.sin(x * 13 + 2) * Math.cos(z * 11 - 1) + 1) * 0.5;
      const base = 0.22 + n1 * 0.12 + n2 * 0.06;
      // 鲜绿色为主
      colors[i * 3]     = base * 0.55 + Math.random() * 0.04;  // R
      colors[i * 3 + 1] = base * 1.5  + Math.random() * 0.06;  // G（高绿）
      colors[i * 3 + 2] = base * 0.3  + Math.random() * 0.03;  // B
    }
    grassGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const grass = new THREE.Mesh(grassGeo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    grass.position.y = -0.02;
    this.group.add(grass);
  }

  /** 石砖路面 — 更有质感 */
  private buildPath(pathTiles: Set<string>): void {
    const ts = TILE_SIZE * ThreeRenderer.SCALE;
    const tiles = Array.from(pathTiles);
    const dummy = new THREE.Object3D();

    // 路面（稍微凸起）
    const pathMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(ts * 0.97, 0.08, ts * 0.97),
      new THREE.MeshLambertMaterial({ color: 0x9b8365 }),
      tiles.length,
    );
    pathMesh.receiveShadow = true;

    tiles.forEach((key, i) => {
      const [c, r] = key.split(',').map(Number);
      const p = ThreeRenderer.toWorld(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, 0.04);
      dummy.position.copy(p);
      dummy.updateMatrix();
      pathMesh.setMatrixAt(i, dummy.matrix);
      // 砖块色差 — 暖棕色调
      const v = 0.48 + Math.random() * 0.18;
      pathMesh.setColorAt(i, new THREE.Color(v, v * 0.78, v * 0.55));
    });
    pathMesh.instanceColor!.needsUpdate = true;
    this.group.add(pathMesh);

    // 砖缝 — 深色细线
    const lineGeo = new THREE.BufferGeometry();
    const lineVerts: number[] = [];
    tiles.forEach(key => {
      const [c, r] = key.split(',').map(Number);
      const p = ThreeRenderer.toWorld(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, 0.085);
      const half = ts * 0.48;
      lineVerts.push(p.x - half, p.y, p.z, p.x + half, p.y, p.z);
      lineVerts.push(p.x, p.y, p.z - half, p.x, p.y, p.z + half);
    });
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
    this.group.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x3a2a15, transparent: true, opacity: 0.25 })));
  }

  /** 路沿石 — 路径边缘凸起的石头边框 */
  private buildPathBorder(pathTiles: Set<string>): void {
    const ts = TILE_SIZE * ThreeRenderer.SCALE;
    const tiles = Array.from(pathTiles);
    const dummy = new THREE.Object3D();

    const edgeTiles = tiles.filter(key => {
      const [c, r] = key.split(',').map(Number);
      return [[c-1,r],[c+1,r],[c,r-1],[c,r+1]].some(([nc, nr]) => !pathTiles.has(`${nc},${nr}`));
    });

    if (edgeTiles.length === 0) return;

    // 路沿石（比路面稍高）
    const borderMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(ts * 1.02, 0.14, ts * 1.02),
      new THREE.MeshLambertMaterial({ color: 0x6a5a42 }),
      edgeTiles.length,
    );
    borderMesh.receiveShadow = true;
    borderMesh.castShadow = true;

    edgeTiles.forEach((key, i) => {
      const [c, r] = key.split(',').map(Number);
      const p = ThreeRenderer.toWorld(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, 0.07);
      dummy.position.copy(p);
      dummy.updateMatrix();
      borderMesh.setMatrixAt(i, dummy.matrix);
      const s = 0.35 + Math.random() * 0.1;
      borderMesh.setColorAt(i, new THREE.Color(s, s * 0.85, s * 0.65));
    });
    borderMesh.instanceColor!.needsUpdate = true;
    this.group.add(borderMesh);
  }

  /** 可建造网格 — 非常淡 */
  private buildBuildableGrid(pathTiles: Set<string>): void {
    const ts = TILE_SIZE * ThreeRenderer.SCALE;
    const cols = Math.floor(GAME_WIDTH / TILE_SIZE);
    const rows = Math.floor((GAME_HEIGHT - 140) / TILE_SIZE);
    const verts: number[] = [];

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (pathTiles.has(`${c},${r}`)) continue;
        if (r >= rows - 3) continue;
        const p = ThreeRenderer.toWorld(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, 0.005);
        const half = ts * 0.49;
        verts.push(p.x - half, p.y, p.z - half, p.x + half, p.y, p.z - half);
        verts.push(p.x + half, p.y, p.z - half, p.x + half, p.y, p.z + half);
        verts.push(p.x + half, p.y, p.z + half, p.x - half, p.y, p.z + half);
        verts.push(p.x - half, p.y, p.z + half, p.x - half, p.y, p.z - half);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    // 非常淡，几乎看不见，hover 时才需要看到
    this.group.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x88CC88, transparent: true, opacity: 0.03 })));
  }

  /** 大量装饰物 — 让地图生机勃勃 */
  private buildDecorations(pathTiles: Set<string>): void {
    const decoGroup = new THREE.Group();
    const cols = Math.floor(GAME_WIDTH / TILE_SIZE);
    const rows = Math.floor((GAME_HEIGHT - 140) / TILE_SIZE);

    // 300+ 装饰物（比之前 120 多很多）
    for (let i = 0; i < 350; i++) {
      const c = Math.floor(Math.random() * cols);
      const r = Math.floor(Math.random() * rows);
      if (pathTiles.has(`${c},${r}`)) continue;

      const nearPath = [[c-1,r],[c+1,r],[c,r-1],[c,r+1]].some(([nc, nr]) => pathTiles.has(`${nc},${nr}`));

      const px = c * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * TILE_SIZE * 0.6;
      const py = r * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * TILE_SIZE * 0.6;
      const pos = ThreeRenderer.toWorld(px, py, 0);

      const rand = Math.random();
      if (rand < 0.25) {
        decoGroup.add(this.createTree(pos, 0.3 + Math.random() * 0.5));
      } else if (rand < 0.38) {
        decoGroup.add(this.createRock(pos, 0.06 + Math.random() * 0.12));
      } else if (rand < 0.52) {
        decoGroup.add(this.createBush(pos, 0.1 + Math.random() * 0.15));
      } else if (rand < 0.68) {
        decoGroup.add(this.createFlowers(pos));
      } else if (rand < 0.78) {
        decoGroup.add(this.createMushroom(pos));
      } else if (rand < 0.88) {
        decoGroup.add(this.createTallGrass(pos));
      } else if (nearPath && rand > 0.94) {
        decoGroup.add(this.createTorch(pos));
      } else if (nearPath && rand > 0.90) {
        decoGroup.add(this.createFencePost(pos));
      }
    }

    // 路径旁的火把（沿跑道每隔几格一个）
    const pathArr = Array.from(pathTiles);
    for (let i = 0; i < pathArr.length; i += 8) {
      const [c, r] = pathArr[i].split(',').map(Number);
      // 找相邻的空格放火把
      for (const [dc, dr] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nc = c + dc, nr = r + dr;
        if (!pathTiles.has(`${nc},${nr}`)) {
          const px = nc * TILE_SIZE + TILE_SIZE / 2;
          const py = nr * TILE_SIZE + TILE_SIZE / 2;
          decoGroup.add(this.createTorch(ThreeRenderer.toWorld(px, py, 0)));
          break;
        }
      }
    }

    this.group.add(decoGroup);
  }

  /** 草丛点缀 — 让草地不平坦 */
  private buildGrassPatches(pathTiles: Set<string>): void {
    const cols = Math.floor(GAME_WIDTH / TILE_SIZE);
    const rows = Math.floor((GAME_HEIGHT - 140) / TILE_SIZE);
    const patchGroup = new THREE.Group();

    for (let i = 0; i < 200; i++) {
      const c = Math.floor(Math.random() * cols);
      const r = Math.floor(Math.random() * rows);
      if (pathTiles.has(`${c},${r}`)) continue;

      const px = c * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * TILE_SIZE;
      const py = r * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * TILE_SIZE;
      const pos = ThreeRenderer.toWorld(px, py, 0);

      // 小绿色半球（草丛）
      const patch = new THREE.Mesh(
        new THREE.SphereGeometry(0.03 + Math.random() * 0.04, 4, 3, 0, Math.PI * 2, 0, Math.PI * 0.5),
        new THREE.MeshLambertMaterial({
          color: new THREE.Color(0.1 + Math.random() * 0.08, 0.35 + Math.random() * 0.2, 0.08 + Math.random() * 0.05),
        }),
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(pos.x, 0.005, pos.z);
      patchGroup.add(patch);
    }
    this.group.add(patchGroup);
  }

  // =================== 装饰物工厂 ===================

  private createTree(pos: THREE.Vector3, scale: number): THREE.Group {
    const tree = new THREE.Group();

    // 树干（更粗更明显）
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04 * scale, 0.07 * scale, 0.45 * scale, 5),
      new THREE.MeshLambertMaterial({ color: 0x7B4A2F }),
    );
    trunk.position.set(pos.x, 0.225 * scale, pos.z);
    trunk.castShadow = true;
    tree.add(trunk);

    // 树冠（3层锥体，颜色更鲜明）
    for (let layer = 0; layer < 3; layer++) {
      const r = (0.22 - layer * 0.05) * scale;
      const h = 0.22 * scale;
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(r, h, 6),
        new THREE.MeshLambertMaterial({
          color: new THREE.Color(0.06 + Math.random() * 0.06, 0.35 + Math.random() * 0.2, 0.04 + Math.random() * 0.04),
        }),
      );
      crown.position.set(pos.x, (0.38 + layer * 0.13) * scale, pos.z);
      crown.castShadow = true;
      tree.add(crown);
    }
    return tree;
  }

  private createRock(pos: THREE.Vector3, scale: number): THREE.Mesh {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(scale, 0),
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(0.45 + Math.random() * 0.15, 0.42 + Math.random() * 0.1, 0.38 + Math.random() * 0.05),
      }),
    );
    rock.position.set(pos.x, scale * 0.3, pos.z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.scale.y = 0.55;
    rock.castShadow = true;
    return rock;
  }

  private createBush(pos: THREE.Vector3, scale: number): THREE.Group {
    const bush = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(scale * (0.5 + Math.random() * 0.5), 5, 4),
        new THREE.MeshLambertMaterial({
          color: new THREE.Color(0.08 + Math.random() * 0.06, 0.3 + Math.random() * 0.15, 0.06 + Math.random() * 0.04),
        }),
      );
      sphere.position.set(
        pos.x + (Math.random() - 0.5) * scale * 0.6,
        scale * 0.3,
        pos.z + (Math.random() - 0.5) * scale * 0.6,
      );
      sphere.scale.y = 0.65;
      sphere.castShadow = true;
      bush.add(sphere);
    }
    return bush;
  }

  private createFlowers(pos: THREE.Vector3): THREE.Group {
    const flowers = new THREE.Group();
    const flowerColors = [0xFF6688, 0xFFCC44, 0xFF88CC, 0xFFFFAA, 0xCC88FF, 0xFF9944, 0x88DDFF];
    for (let i = 0; i < 4 + Math.floor(Math.random() * 4); i++) {
      // 花茎
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.003, 0.003, 0.04, 3),
        new THREE.MeshLambertMaterial({ color: 0x338833 }),
      );
      const ox = (Math.random() - 0.5) * 0.15;
      const oz = (Math.random() - 0.5) * 0.15;
      stem.position.set(pos.x + ox, 0.02, pos.z + oz);
      flowers.add(stem);

      // 花朵
      const f = new THREE.Mesh(
        new THREE.SphereGeometry(0.018 + Math.random() * 0.01, 4, 3),
        new THREE.MeshBasicMaterial({ color: flowerColors[Math.floor(Math.random() * flowerColors.length)] }),
      );
      f.position.set(pos.x + ox, 0.04 + Math.random() * 0.01, pos.z + oz);
      flowers.add(f);
    }
    return flowers;
  }

  private createMushroom(pos: THREE.Vector3): THREE.Group {
    const mush = new THREE.Group();
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.012, 0.03, 4),
      new THREE.MeshLambertMaterial({ color: 0xEEDDCC }),
    );
    stem.position.set(pos.x, 0.015, pos.z);
    mush.add(stem);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.6),
      new THREE.MeshLambertMaterial({
        color: Math.random() > 0.5 ? 0xDD4444 : 0xCC8844,
      }),
    );
    cap.position.set(pos.x, 0.032, pos.z);
    mush.add(cap);
    return mush;
  }

  private createTallGrass(pos: THREE.Vector3): THREE.Group {
    const tg = new THREE.Group();
    for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.005, 0.06 + Math.random() * 0.04, 3),
        new THREE.MeshLambertMaterial({
          color: new THREE.Color(0.15 + Math.random() * 0.1, 0.4 + Math.random() * 0.2, 0.1),
        }),
      );
      blade.position.set(
        pos.x + (Math.random() - 0.5) * 0.06,
        0.03 + Math.random() * 0.02,
        pos.z + (Math.random() - 0.5) * 0.06,
      );
      blade.rotation.z = (Math.random() - 0.5) * 0.3;
      tg.add(blade);
    }
    return tg;
  }

  private createTorch(pos: THREE.Vector3): THREE.Group {
    const torch = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.018, 0.35, 4),
      new THREE.MeshLambertMaterial({ color: 0x6B3A1F }),
    );
    pole.position.set(pos.x, 0.175, pos.z);
    pole.castShadow = true;
    torch.add(pole);

    // 火盆
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.015, 0.02, 6),
      new THREE.MeshLambertMaterial({ color: 0x444444 }),
    );
    bowl.position.set(pos.x, 0.36, pos.z);
    torch.add(bowl);

    // 火焰（多层）
    const flame1 = new THREE.Mesh(
      new THREE.ConeGeometry(0.02, 0.06, 4),
      new THREE.MeshBasicMaterial({ color: 0xFF8822 }),
    );
    flame1.position.set(pos.x, 0.40, pos.z);
    torch.add(flame1);

    const flame2 = new THREE.Mesh(
      new THREE.ConeGeometry(0.012, 0.04, 3),
      new THREE.MeshBasicMaterial({ color: 0xFFCC44 }),
    );
    flame2.position.set(pos.x, 0.42, pos.z);
    torch.add(flame2);

    // 暖色点光源
    const light = new THREE.PointLight(0xFF8833, 0.5, 3);
    light.position.set(pos.x, 0.42, pos.z);
    torch.add(light);

    return torch;
  }

  private createFencePost(pos: THREE.Vector3): THREE.Group {
    const fence = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.15, 0.02),
      new THREE.MeshLambertMaterial({ color: 0x8B6B4F }),
    );
    post.position.set(pos.x, 0.075, pos.z);
    post.castShadow = true;
    fence.add(post);

    // 顶部
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(0.018, 0.025, 4),
      new THREE.MeshLambertMaterial({ color: 0x6B4B2F }),
    );
    cap.position.set(pos.x, 0.16, pos.z);
    fence.add(cap);
    return fence;
  }
}
