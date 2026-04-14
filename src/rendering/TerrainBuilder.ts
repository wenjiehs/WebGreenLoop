import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../utils/constants';
import { ThreeRenderer } from './ThreeRenderer';

// 高度常量
const BANK_Y = 0.15;      // 岸/草地平台高度
const PATH_Y = -0.18;     // 路面底部高度
const GROUND_Y = 0.10;    // 草地平面高度

/**
 * 地形生成器 — 沟壑跑道 + 绿色草地高台
 */
export class TerrainBuilder {
  private group: THREE.Group;

  constructor(private renderer: ThreeRenderer) {
    this.group = new THREE.Group();
  }

  build(pathTiles: Set<string>): THREE.Group {
    this.buildGround();
    this.buildPath(pathTiles);
    this.buildBanks(pathTiles);
    this.buildDecorations(pathTiles);
    return this.group;
  }

  /** 大地草地平面 — canvas 生成草地纹理 */
  private buildGround(): void {
    const w = GAME_WIDTH * ThreeRenderer.SCALE;
    const h = (GAME_HEIGHT - 140) * ThreeRenderer.SCALE;

    // canvas 生成草地纹理
    const texSize = 512;
    const canvas = document.createElement('canvas');
    canvas.width = texSize; canvas.height = texSize;
    const ctx = canvas.getContext('2d')!;

    // 基础绿色
    ctx.fillStyle = '#3a7a2a';
    ctx.fillRect(0, 0, texSize, texSize);

    // 多层噪点模拟草地
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * texSize;
      const y = Math.random() * texSize;
      const shade = 40 + Math.random() * 60;
      const g = 90 + Math.random() * 80;
      ctx.fillStyle = `rgb(${shade},${g},${shade * 0.4})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 3);
    }

    // 深色斑点
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * texSize;
      const y = Math.random() * texSize;
      ctx.fillStyle = `rgba(20,40,10,${0.1 + Math.random() * 0.15})`;
      ctx.beginPath();
      ctx.arc(x, y, 2 + Math.random() * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 6);
    texture.minFilter = THREE.LinearMipMapLinearFilter;

    const grassGeo = new THREE.PlaneGeometry(w * 1.6, h * 1.6, 80, 60);
    const pos = grassGeo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const z = pos.getZ(i);
      pos.setY(i, Math.sin(x * 1.2) * Math.cos(z * 1.5) * 0.06 + Math.sin(x * 4) * Math.cos(z * 3) * 0.02);
    }
    grassGeo.computeVertexNormals();

    const grass = new THREE.Mesh(grassGeo, new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }));
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    grass.position.y = GROUND_Y;
    this.group.add(grass);
  }

  /** 凹陷路面 — canvas 石砖纹理 */
  private buildPath(pathTiles: Set<string>): void {
    const ts = TILE_SIZE * ThreeRenderer.SCALE;
    const tiles = Array.from(pathTiles);
    const dummy = new THREE.Object3D();

    // canvas 石砖纹理
    const texSize = 128;
    const cv = document.createElement('canvas');
    cv.width = texSize; cv.height = texSize;
    const cx = cv.getContext('2d')!;
    cx.fillStyle = '#7a6345';
    cx.fillRect(0, 0, texSize, texSize);
    // 砖缝
    cx.strokeStyle = '#4a3a20';
    cx.lineWidth = 2;
    for (let y = 0; y < texSize; y += 32) {
      cx.beginPath(); cx.moveTo(0, y); cx.lineTo(texSize, y); cx.stroke();
      const offset = (y / 32) % 2 === 0 ? 0 : 32;
      for (let x = offset; x < texSize; x += 64) {
        cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x, y + 32); cx.stroke();
      }
    }
    // 噪点
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * texSize, y = Math.random() * texSize;
      const v = 80 + Math.random() * 50;
      cx.fillStyle = `rgba(${v},${v * 0.8},${v * 0.5},0.3)`;
      cx.fillRect(x, y, 1, 1);
    }
    const pathTex = new THREE.CanvasTexture(cv);
    pathTex.wrapS = pathTex.wrapT = THREE.RepeatWrapping;

    const pathMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(ts * 0.99, 0.04, ts * 0.99),
      new THREE.MeshStandardMaterial({ map: pathTex, roughness: 0.85, metalness: 0.05 }),
      tiles.length,
    );
    pathMesh.receiveShadow = true;

    tiles.forEach((key, i) => {
      const [c, r] = key.split(',').map(Number);
      const p = ThreeRenderer.toWorld(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, 0);
      dummy.position.set(p.x, PATH_Y, p.z);
      dummy.updateMatrix();
      pathMesh.setMatrixAt(i, dummy.matrix);
      const v = 0.38 + Math.random() * 0.14;
      pathMesh.setColorAt(i, new THREE.Color(v, v * 0.72, v * 0.5));
    });
    pathMesh.instanceColor!.needsUpdate = true;
    this.group.add(pathMesh);

    // 砖缝
    const lineGeo = new THREE.BufferGeometry();
    const verts: number[] = [];
    tiles.forEach(key => {
      const [c, r] = key.split(',').map(Number);
      const p = ThreeRenderer.toWorld(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, 0);
      const half = ts * 0.46;
      const ly = PATH_Y + 0.025;
      verts.push(p.x - half, ly, p.z, p.x + half, ly, p.z);
      verts.push(p.x, ly, p.z - half, p.x, ly, p.z + half);
    });
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    this.group.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x2a1a05, transparent: true, opacity: 0.2 })));
  }

  /** 沟壑岸壁 — 路径旁的绿色土块+泥土侧面+顶部草皮 */
  private buildBanks(pathTiles: Set<string>): void {
    const ts = TILE_SIZE * ThreeRenderer.SCALE;
    const cols = Math.floor(GAME_WIDTH / TILE_SIZE);
    const rows = Math.floor((GAME_HEIGHT - 140) / TILE_SIZE);
    const dummy = new THREE.Object3D();

    // 找路径相邻的非路径格（8方向，含对角线，填满角落）
    const bankKeys: string[] = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (pathTiles.has(`${c},${r}`)) continue;
        const neighbors = [
          [c-1,r],[c+1,r],[c,r-1],[c,r+1],  // 正交
          [c-1,r-1],[c+1,r-1],[c-1,r+1],[c+1,r+1],  // 对角
        ];
        if (neighbors.some(([nc, nr]) => pathTiles.has(`${nc},${nr}`))) {
          bankKeys.push(`${c},${r}`);
        }
      }
    }
    if (bankKeys.length === 0) return;

    const bankH = BANK_Y - PATH_Y; // 岸高度 = 0.33

    // 泥土层（棕色，从路面延伸到草地高度）
    const dirtMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(ts * 1.01, bankH, ts * 1.01),
      new THREE.MeshLambertMaterial({ color: 0x6B5B3A }),
      bankKeys.length,
    );
    dirtMesh.receiveShadow = true;
    dirtMesh.castShadow = true;

    bankKeys.forEach((key, i) => {
      const [c, r] = key.split(',').map(Number);
      const p = ThreeRenderer.toWorld(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, 0);
      dummy.position.set(p.x, PATH_Y + bankH / 2, p.z);
      dummy.updateMatrix();
      dirtMesh.setMatrixAt(i, dummy.matrix);
      const s = 0.32 + Math.random() * 0.08;
      dirtMesh.setColorAt(i, new THREE.Color(s, s * 0.78, s * 0.5));
    });
    dirtMesh.instanceColor!.needsUpdate = true;
    this.group.add(dirtMesh);

    // 草皮顶层（深绿色薄板覆盖在泥土上面）
    const grassCapMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(ts * 1.03, 0.04, ts * 1.03),
      new THREE.MeshLambertMaterial({ color: 0x3A7A2A }),
      bankKeys.length,
    );
    grassCapMesh.receiveShadow = true;

    bankKeys.forEach((key, i) => {
      const [c, r] = key.split(',').map(Number);
      const p = ThreeRenderer.toWorld(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, 0);
      dummy.position.set(p.x, BANK_Y + 0.02, p.z);
      dummy.updateMatrix();
      grassCapMesh.setMatrixAt(i, dummy.matrix);
      const g = 0.28 + Math.random() * 0.12;
      grassCapMesh.setColorAt(i, new THREE.Color(g * 0.45, g, g * 0.25));
    });
    grassCapMesh.instanceColor!.needsUpdate = true;
    this.group.add(grassCapMesh);

    // 石沿（路面侧的装饰石条）
    const pathEdgeTiles = Array.from(pathTiles).filter(key => {
      const [c, r] = key.split(',').map(Number);
      return [[c-1,r],[c+1,r],[c,r-1],[c,r+1]].some(([nc, nr]) => !pathTiles.has(`${nc},${nr}`));
    });
    if (pathEdgeTiles.length > 0) {
      const stoneMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(ts * 1.04, 0.06, ts * 1.04),
        new THREE.MeshLambertMaterial({ color: 0x8A7A5A }),
        pathEdgeTiles.length,
      );
      stoneMesh.receiveShadow = true;
      pathEdgeTiles.forEach((key, i) => {
        const [c, r] = key.split(',').map(Number);
        const p = ThreeRenderer.toWorld(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, 0);
        dummy.position.set(p.x, PATH_Y + 0.04, p.z);
        dummy.updateMatrix();
        stoneMesh.setMatrixAt(i, dummy.matrix);
      });
      this.group.add(stoneMesh);
    }

    // 角落圆滑 — 在岸壁的"外角"放圆柱体填充
    const bankSet = new Set(bankKeys);
    const cornerPositions: THREE.Vector3[] = [];
    for (const key of bankKeys) {
      const [c, r] = key.split(',').map(Number);
      // 检测外角：正交方向有两个不是bank/path的格子
      const dirs: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];
      const diags: [number, number, number, number][] = [
        [-1,-1, -1,0, 0,-1], [1,-1, 1,0, 0,-1],
        [-1,1, -1,0, 0,1], [1,1, 1,0, 0,1],
      ] as any;
      // 找到当前格子暴露在外的角
      for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]] as [number,number][]) {
        const diagKey = `${c+dx},${r+dy}`;
        const adjX = `${c+dx},${r}`;
        const adjY = `${c},${r+dy}`;
        // 如果对角格不是bank也不是path，而两个正交邻居中至少一个也不是bank
        if (!bankSet.has(diagKey) && !pathTiles.has(diagKey)) {
          if (!bankSet.has(adjX) && !pathTiles.has(adjX) && !bankSet.has(adjY) && !pathTiles.has(adjY)) {
            // 这是一个外角 — 在格子的这个角放圆柱
            const p = ThreeRenderer.toWorld(
              (c + dx * 0.5) * TILE_SIZE + TILE_SIZE / 2,
              (r + dy * 0.5) * TILE_SIZE + TILE_SIZE / 2, 0
            );
            cornerPositions.push(new THREE.Vector3(p.x, 0, p.z));
          }
        }
      }
    }

    // 用圆柱体填充角落
    for (const cp of cornerPositions) {
      const dirtCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(ts * 0.52, ts * 0.52, bankH, 8),
        new THREE.MeshLambertMaterial({ color: 0x6B5B3A }),
      );
      dirtCyl.position.set(cp.x, PATH_Y + bankH / 2, cp.z);
      dirtCyl.receiveShadow = true;
      dirtCyl.castShadow = true;
      this.group.add(dirtCyl);

      const grassCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(ts * 0.54, ts * 0.54, 0.04, 8),
        new THREE.MeshLambertMaterial({ color: 0x3A7A2A }),
      );
      grassCyl.position.set(cp.x, BANK_Y + 0.02, cp.z);
      grassCyl.receiveShadow = true;
      this.group.add(grassCyl);
    }
  }

  /** 装饰物 — 都放在岸上(y=BANK_Y) */
  private buildDecorations(pathTiles: Set<string>): void {
    const decoGroup = new THREE.Group();
    const cols = Math.floor(GAME_WIDTH / TILE_SIZE);
    const rows = Math.floor((GAME_HEIGHT - 140) / TILE_SIZE);
    const BY = BANK_Y + 0.02; // 装饰物基准高度

    for (let i = 0; i < 400; i++) {
      const c = Math.floor(Math.random() * cols);
      const r = Math.floor(Math.random() * rows);
      if (pathTiles.has(`${c},${r}`)) continue;

      const px = c * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * TILE_SIZE * 0.6;
      const py = r * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * TILE_SIZE * 0.6;
      const wp = ThreeRenderer.toWorld(px, py, 0);
      const pos = new THREE.Vector3(wp.x, BY, wp.z);

      const nearPath = [[c-1,r],[c+1,r],[c,r-1],[c,r+1]].some(([nc, nr]) => pathTiles.has(`${nc},${nr}`));
      const rand = Math.random();

      if (rand < 0.22) decoGroup.add(this.makeTree(pos));
      else if (rand < 0.34) decoGroup.add(this.makeRock(pos));
      else if (rand < 0.48) decoGroup.add(this.makeBush(pos));
      else if (rand < 0.60) decoGroup.add(this.makeFlowers(pos));
      else if (rand < 0.70) decoGroup.add(this.makeGrassClump(pos));
      else if (nearPath && rand > 0.92) decoGroup.add(this.makeTorch(pos));
    }

    // 沿路火把
    const pathArr = Array.from(pathTiles);
    for (let i = 0; i < pathArr.length; i += 10) {
      const [c, r] = pathArr[i].split(',').map(Number);
      for (const [dc, dr] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nc = c + dc, nr = r + dr;
        if (!pathTiles.has(`${nc},${nr}`)) {
          const wp = ThreeRenderer.toWorld(nc * TILE_SIZE + TILE_SIZE / 2, nr * TILE_SIZE + TILE_SIZE / 2, 0);
          decoGroup.add(this.makeTorch(new THREE.Vector3(wp.x, BY, wp.z)));
          break;
        }
      }
    }
    this.group.add(decoGroup);
  }

  // ===== 装饰物 =====

  private makeTree(pos: THREE.Vector3): THREE.Group {
    const g = new THREE.Group();
    const s = 0.3 + Math.random() * 0.5;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03 * s, 0.06 * s, 0.4 * s, 5),
      new THREE.MeshLambertMaterial({ color: 0x6B4422 }),
    );
    trunk.position.set(pos.x, pos.y + 0.2 * s, pos.z);
    trunk.castShadow = true;
    g.add(trunk);
    for (let l = 0; l < 3; l++) {
      const cr = (0.20 - l * 0.04) * s;
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(cr, 0.2 * s, 6),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(0.05 + Math.random() * 0.05, 0.3 + Math.random() * 0.18, 0.03 + Math.random() * 0.03) }),
      );
      crown.position.set(pos.x, pos.y + (0.35 + l * 0.12) * s, pos.z);
      crown.castShadow = true;
      g.add(crown);
    }
    return g;
  }

  private makeRock(pos: THREE.Vector3): THREE.Mesh {
    const s = 0.05 + Math.random() * 0.1;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(s, 0),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(0.45 + Math.random() * 0.12, 0.42 + Math.random() * 0.08, 0.38) }),
    );
    rock.position.set(pos.x, pos.y + s * 0.2, pos.z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.scale.y = 0.5;
    rock.castShadow = true;
    return rock;
  }

  private makeBush(pos: THREE.Vector3): THREE.Group {
    const g = new THREE.Group();
    const s = 0.08 + Math.random() * 0.12;
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(
        new THREE.SphereGeometry(s * (0.5 + Math.random() * 0.5), 5, 4),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(0.06, 0.25 + Math.random() * 0.15, 0.04) }),
      );
      sp.position.set(pos.x + (Math.random() - 0.5) * s, pos.y + s * 0.25, pos.z + (Math.random() - 0.5) * s);
      sp.scale.y = 0.6;
      sp.castShadow = true;
      g.add(sp);
    }
    return g;
  }

  private makeFlowers(pos: THREE.Vector3): THREE.Group {
    const g = new THREE.Group();
    const colors = [0xFF6688, 0xFFCC44, 0xFF88CC, 0xFFFFAA, 0xCC88FF, 0xFF9944];
    for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
      const ox = (Math.random() - 0.5) * 0.12;
      const oz = (Math.random() - 0.5) * 0.12;
      const f = new THREE.Mesh(
        new THREE.SphereGeometry(0.015 + Math.random() * 0.008, 4, 3),
        new THREE.MeshBasicMaterial({ color: colors[Math.floor(Math.random() * colors.length)] }),
      );
      f.position.set(pos.x + ox, pos.y + 0.02, pos.z + oz);
      g.add(f);
    }
    return g;
  }

  private makeGrassClump(pos: THREE.Vector3): THREE.Group {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.005, 0.05 + Math.random() * 0.04, 3),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(0.12, 0.38 + Math.random() * 0.18, 0.08) }),
      );
      blade.position.set(pos.x + (Math.random() - 0.5) * 0.05, pos.y + 0.025, pos.z + (Math.random() - 0.5) * 0.05);
      blade.rotation.z = (Math.random() - 0.5) * 0.25;
      g.add(blade);
    }
    return g;
  }

  private makeTorch(pos: THREE.Vector3): THREE.Group {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.015, 0.3, 4),
      new THREE.MeshLambertMaterial({ color: 0x6B3A1F }),
    );
    pole.position.set(pos.x, pos.y + 0.15, pos.z);
    pole.castShadow = true;
    g.add(pole);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.018, 0.05, 4),
      new THREE.MeshBasicMaterial({ color: 0xFF8822 }),
    );
    flame.position.set(pos.x, pos.y + 0.32, pos.z);
    g.add(flame);
    const light = new THREE.PointLight(0xFF8833, 0.4, 2.5);
    light.position.set(pos.x, pos.y + 0.33, pos.z);
    g.add(light);
    return g;
  }
}
