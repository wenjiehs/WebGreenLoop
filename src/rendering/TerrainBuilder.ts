import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../utils/constants';
import { ThreeRenderer } from './ThreeRenderer';

/**
 * 地形生成器 - 草地+路径+环境装饰
 */
export class TerrainBuilder {
  private group: THREE.Group;

  constructor(private renderer: ThreeRenderer) {
    this.group = new THREE.Group();
  }

  build(pathTiles: Set<string>): THREE.Group {
    this.buildGround();
    this.buildPath(pathTiles);
    this.buildDecorations(pathTiles);
    return this.group;
  }

  private buildGround(): void {
    const w = GAME_WIDTH * ThreeRenderer.SCALE;
    const h = (GAME_HEIGHT - 140) * ThreeRenderer.SCALE;

    // 草地平面
    const grassGeo = new THREE.PlaneGeometry(w, h, 40, 30);
    // 给顶点微调Y做起伏
    const pos = grassGeo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, (Math.sin(x * 3) * Math.cos(z * 3)) * 0.03);
    }
    grassGeo.computeVertexNormals();

    // 顶点色：随机深浅绿色
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const shade = 0.15 + Math.random() * 0.15;
      colors[i * 3] = shade * 0.5;     // R
      colors[i * 3 + 1] = shade;       // G
      colors[i * 3 + 2] = shade * 0.3; // B
    }
    grassGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const grassMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    });

    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    grass.position.y = -0.01;
    this.group.add(grass);
  }

  private buildPath(pathTiles: Set<string>): void {
    const tileSize3D = TILE_SIZE * ThreeRenderer.SCALE;

    // 批量 InstancedMesh 渲染路径瓦片
    const geo = new THREE.BoxGeometry(tileSize3D * 0.95, 0.08, tileSize3D * 0.95);
    const mat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });

    const tiles = Array.from(pathTiles);
    const mesh = new THREE.InstancedMesh(geo, mat, tiles.length);
    mesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    tiles.forEach((key, i) => {
      const [col, row] = key.split(',').map(Number);
      const px = col * TILE_SIZE + TILE_SIZE / 2;
      const py = row * TILE_SIZE + TILE_SIZE / 2;
      const pos = ThreeRenderer.toWorld(px, py, 0.04);
      dummy.position.copy(pos);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // 随机砖色变化
      const shade = 0.45 + Math.random() * 0.15;
      mesh.setColorAt(i, new THREE.Color(shade, shade * 0.8, shade * 0.6));
    });
    mesh.instanceColor!.needsUpdate = true;

    this.group.add(mesh);

    // 路径边缘线
    const edgeGeo = new THREE.BoxGeometry(tileSize3D, 0.12, tileSize3D);
    const edgeMat = new THREE.MeshLambertMaterial({ color: 0x5a4025 });

    // 找路径边缘瓦片（至少有一个相邻非路径）
    const edgeTiles: string[] = [];
    tiles.forEach(key => {
      const [c, r] = key.split(',').map(Number);
      const neighbors = [[c-1,r],[c+1,r],[c,r-1],[c,r+1]];
      if (neighbors.some(([nc, nr]) => !pathTiles.has(`${nc},${nr}`))) {
        edgeTiles.push(key);
      }
    });

    if (edgeTiles.length > 0) {
      const edgeMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(tileSize3D * 0.98, 0.03, tileSize3D * 0.98),
        new THREE.MeshLambertMaterial({ color: 0x6b5335 }),
        edgeTiles.length,
      );
      edgeTiles.forEach((key, i) => {
        const [col, row] = key.split(',').map(Number);
        const px = col * TILE_SIZE + TILE_SIZE / 2;
        const py = row * TILE_SIZE + TILE_SIZE / 2;
        const pos = ThreeRenderer.toWorld(px, py, 0.09);
        dummy.position.copy(pos);
        dummy.updateMatrix();
        edgeMesh.setMatrixAt(i, dummy.matrix);
      });
      edgeMesh.receiveShadow = true;
      this.group.add(edgeMesh);
    }
  }

  private buildDecorations(pathTiles: Set<string>): void {
    const treeGroup = new THREE.Group();
    const cols = Math.floor(GAME_WIDTH / TILE_SIZE);
    const rows = Math.floor((GAME_HEIGHT - 140) / TILE_SIZE);

    for (let i = 0; i < 80; i++) {
      const col = Math.floor(Math.random() * cols);
      const row = Math.floor(Math.random() * rows);
      if (pathTiles.has(`${col},${row}`)) continue;

      const px = col * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * TILE_SIZE * 0.6;
      const py = row * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * TILE_SIZE * 0.6;
      const pos = ThreeRenderer.toWorld(px, py, 0);

      if (Math.random() < 0.5) {
        // 树
        treeGroup.add(this.createTree(pos, 0.2 + Math.random() * 0.3));
      } else if (Math.random() < 0.5) {
        // 石头
        treeGroup.add(this.createRock(pos, 0.08 + Math.random() * 0.12));
      } else {
        // 灌木
        treeGroup.add(this.createBush(pos, 0.1 + Math.random() * 0.1));
      }
    }
    this.group.add(treeGroup);
  }

  private createTree(pos: THREE.Vector3, scale: number): THREE.Group {
    const tree = new THREE.Group();
    // 树干
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04 * scale, 0.06 * scale, 0.4 * scale, 5),
      new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
    );
    trunk.position.set(pos.x, 0.2 * scale, pos.z);
    trunk.castShadow = true;
    tree.add(trunk);

    // 树冠（多层锥体）
    for (let layer = 0; layer < 3; layer++) {
      const r = (0.2 - layer * 0.04) * scale;
      const h = 0.2 * scale;
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(r, h, 6),
        new THREE.MeshLambertMaterial({
          color: new THREE.Color(0.1 + Math.random() * 0.1, 0.35 + Math.random() * 0.15, 0.1),
        }),
      );
      crown.position.set(pos.x, (0.35 + layer * 0.12) * scale, pos.z);
      crown.castShadow = true;
      tree.add(crown);
    }
    return tree;
  }

  private createRock(pos: THREE.Vector3, scale: number): THREE.Mesh {
    const geo = new THREE.DodecahedronGeometry(scale, 0);
    const mat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(0.4 + Math.random() * 0.15, 0.38 + Math.random() * 0.1, 0.35),
    });
    const rock = new THREE.Mesh(geo, mat);
    rock.position.set(pos.x, scale * 0.3, pos.z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.scale.y = 0.6;
    rock.castShadow = true;
    return rock;
  }

  private createBush(pos: THREE.Vector3, scale: number): THREE.Mesh {
    const geo = new THREE.SphereGeometry(scale, 5, 4);
    const mat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(0.12, 0.3 + Math.random() * 0.15, 0.1),
    });
    const bush = new THREE.Mesh(geo, mat);
    bush.position.set(pos.x, scale * 0.5, pos.z);
    bush.scale.y = 0.7;
    bush.castShadow = true;
    return bush;
  }
}
