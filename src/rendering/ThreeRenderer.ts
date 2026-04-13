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
 * Three.js 渲染器
 * 关键数学：
 * - Phaser 地图区域: 1280 x 580 像素
 * - 3D 世界: 64 x 29 世界单位 (SCALE=0.05)
 * - 摄像机 frustum 必须 >= 64 宽才能看到整个地图
 */
export class ThreeRenderer {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;

  // 摄像机
  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private cameraZoom = 1;
  private targetZoom = 1;
  private baseFrustum = WORLD_W * 1.15; // 比地图宽一点留边距

  // 时间
  private clock = new THREE.Clock();
  private elapsed = 0;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2a0e);
    this.scene.fog = new THREE.FogExp2(0x1a2a0e, 0.003);

    const renderW = GAME_WIDTH;
    const renderH = GAME_HEIGHT;
    const aspect = renderW / renderH;

    // Camera — frustum 基于世界实际大小
    this.camera = new THREE.OrthographicCamera(
      -this.baseFrustum * aspect / 2, this.baseFrustum * aspect / 2,
      this.baseFrustum / 2, -this.baseFrustum / 2,
      0.1, 500,
    );
    // 正 45° 俯视 — 位置够远以覆盖全图
    this.camera.position.set(40, 60, 40);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(renderW, renderH);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    // 后处理 — 只用 Bloom，跳过 FXAA（兼容性问题）
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(renderW, renderH), 0.3, 0.4, 0.9,
    ));

    this.setupLights();
    this.setupCameraControls(this.renderer.domElement);
  }

  private setupLights(): void {
    // 太阳光 — 位置要覆盖整个世界
    const sun = new THREE.DirectionalLight(0xFFEECC, 2.0);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const shadowCam = sun.shadow.camera;
    shadowCam.near = 0.5; shadowCam.far = 150;
    shadowCam.left = -50; shadowCam.right = 50;
    shadowCam.top = 50; shadowCam.bottom = -50;
    sun.shadow.bias = -0.0003;
    this.scene.add(sun);

    this.scene.add(new THREE.AmbientLight(0x556677, 0.6));
    this.scene.add(new THREE.HemisphereLight(0x88BBEE, 0x445522, 0.4));

    // 补光
    const fill = new THREE.DirectionalLight(0x8888CC, 0.2);
    fill.position.set(-20, 30, -15);
    this.scene.add(fill);
  }

  private setupCameraControls(_canvas: HTMLElement): void {
    // 事件由 main.ts 统一转发，不再直接监听 canvas
  }

  /** 由 main.ts 事件转发调用 — 拖拽3D摄像机 */
  handleDrag(dx: number, dy: number): void {
    const speed = 0.08 / this.cameraZoom;
    this.cameraTarget.x -= dx * speed;
    this.cameraTarget.z -= dy * speed;
  }

  /** 由 main.ts 事件转发调用 — 缩放3D摄像机 */
  handleZoom(deltaY: number): void {
    this.targetZoom = Math.max(0.5, Math.min(3.0, this.targetZoom + deltaY * 0.001));
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
    const frustum = this.baseFrustum / this.cameraZoom;
    const aspect = GAME_WIDTH / GAME_HEIGHT;
    this.camera.left = -frustum * aspect / 2;
    this.camera.right = frustum * aspect / 2;
    this.camera.top = frustum / 2;
    this.camera.bottom = -frustum / 2;

    const d = 60 / this.cameraZoom;
    this.camera.position.set(
      this.cameraTarget.x + d * 0.5,
      d,
      this.cameraTarget.z + d * 0.5,
    );
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateProjectionMatrix();
  }

  getTime(): number { return this.elapsed; }
  dispose(): void { this.renderer.dispose(); }

  /** Phaser 像素坐标 → 3D 世界坐标 */
  static toWorld(px: number, py: number, elevation: number = 0): THREE.Vector3 {
    return new THREE.Vector3(
      (px - GAME_WIDTH / 2) * SCALE,
      elevation,
      (py - MAP_H / 2) * SCALE,
    );
  }

  static get SCALE(): number { return SCALE; }
}
