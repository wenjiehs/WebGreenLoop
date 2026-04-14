import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

const SCALE = 0.05;
const UI_HEIGHT_3D = 140;
const MAP_H = GAME_HEIGHT - UI_HEIGHT_3D; // 580

// 3D 世界尺寸
const WORLD_W = GAME_WIDTH * SCALE;   // 64
const WORLD_H = MAP_H * SCALE;        // 29

/**
 * Three.js 渲染器 — 透视摄像机版本
 * 透视摄像机 = 近大远小 = 真正的纵深感
 */
export class ThreeRenderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;

  // 摄像机
  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private cameraZoom = 1;
  private targetZoom = 1;
  // 基础距离 — 摄像机到目标的距离，控制能看到多大范围
  private baseDistance = 42;

  // 时间
  private clock = new THREE.Clock();
  private elapsed = 0;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    // 天空渐变色（顶部蓝 → 底部浅蓝白）
    this.scene.background = new THREE.Color(0x7EC8E3);
    this.scene.fog = new THREE.Fog(0xBBDDCC, 30, 80); // 线性雾：远处渐隐

    const renderW = GAME_WIDTH;
    const renderH = GAME_HEIGHT;
    const aspect = renderW / renderH;

    // 透视摄像机 — FOV=45° 是经典 RTS 角度
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.5, 200);
    this.camera.position.set(0, 35, 28);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(renderW, renderH);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    container.appendChild(this.renderer.domElement);

    // 后处理
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(renderW, renderH), 0.25, 0.4, 0.92,
    ));

    this.setupLights();
    this.setupCameraControls(this.renderer.domElement);
  }

  private setupLights(): void {
    // 主太阳光 — 温暖午后
    const sun = new THREE.DirectionalLight(0xFFF5E0, 2.2);
    sun.position.set(25, 45, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.near = 0.5; sc.far = 120;
    sc.left = -50; sc.right = 50;
    sc.top = 50; sc.bottom = -50;
    sun.shadow.bias = -0.0003;
    this.scene.add(sun);

    // 环境光
    this.scene.add(new THREE.AmbientLight(0x8899AA, 0.7));
    // 半球光（天空蓝 + 地面绿）
    this.scene.add(new THREE.HemisphereLight(0x99CCFF, 0x558833, 0.5));

    // 补光（从对面）
    const fill = new THREE.DirectionalLight(0xAABBDD, 0.25);
    fill.position.set(-20, 25, -15);
    this.scene.add(fill);
  }

  private setupCameraControls(_canvas: HTMLElement): void {
    // 事件由 Game.ts 转发
  }

  handleDrag(dx: number, dy: number): void {
    const speed = 0.06 / this.cameraZoom;
    this.cameraTarget.x -= dx * speed;
    this.cameraTarget.z -= dy * speed;
  }

  handleZoom(deltaY: number): void {
    this.targetZoom = Math.max(0.6, Math.min(2.5, this.targetZoom + deltaY * 0.001));
  }

  focusOn(px: number, py: number): void {
    const pos = ThreeRenderer.toWorld(px, py, 0);
    this.cameraTarget.set(pos.x, 0, pos.z);
  }

  render(): void {
    this.elapsed = this.clock.getElapsedTime();
    this.cameraZoom += (this.targetZoom - this.cameraZoom) * 0.1;
    this.updateCamera();
    this.composer.render();
  }

  private updateCamera(): void {
    const d = this.baseDistance / this.cameraZoom;

    // 经典 RTS 45° 俯视角 — 摄像机在目标的后上方
    // 角度约 50°（tan50°≈1.19，即 y/z ≈ 1.19）
    const camY = d * 0.82;   // 高度
    const camZ = d * 0.65;   // 后退距离

    this.camera.position.set(
      this.cameraTarget.x,
      camY,
      this.cameraTarget.z + camZ,
    );
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateProjectionMatrix();
  }

  getTime(): number { return this.elapsed; }
  dispose(): void { this.renderer.dispose(); }

  /** 像素坐标 → 3D 世界坐标 */
  static toWorld(px: number, py: number, elevation: number = 0): THREE.Vector3 {
    return new THREE.Vector3(
      (px - GAME_WIDTH / 2) * SCALE,
      elevation,
      (py - MAP_H / 2) * SCALE,
    );
  }

  static get SCALE(): number { return SCALE; }
}
