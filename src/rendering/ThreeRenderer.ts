import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

const SCALE = 0.05;
const UI_HEIGHT_3D = 140;
const MAP_H = GAME_HEIGHT - UI_HEIGHT_3D;

/**
 * Three.js 渲染器 - Scene/Camera/Lights/PostProcessing/Camera Controls
 */
export class ThreeRenderer {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  sunLight!: THREE.DirectionalLight;

  // 摄像机
  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private cameraZoom = 1;
  private isDragging = false;
  private lastMouse = { x: 0, y: 0 };
  private targetZoom = 1;

  // 时间
  private clock = new THREE.Clock();
  private elapsed = 0;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2a0e);
    this.scene.fog = new THREE.FogExp2(0x1a2a0e, 0.005);

    // 固定渲染尺寸
    const renderW = GAME_WIDTH;
    const renderH = GAME_HEIGHT;

    // Camera - 魔兽3 经典 45° 俯视
    const aspect = renderW / renderH;
    const frustumSize = 20;
    this.camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2, frustumSize * aspect / 2,
      frustumSize / 2, -frustumSize / 2, 0.1, 200,
    );
    this.camera.position.set(12, 22, 12);
    this.camera.lookAt(0, 0, 0);

    // Renderer - 使用固定尺寸
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(renderW, renderH);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    // 后处理
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(renderW, renderH),
      0.35, 0.4, 0.85,
    );
    this.composer.addPass(bloom);

    const fxaa = new FXAAPass();
    fxaa.uniforms['resolution'].value.set(1 / renderW, 1 / renderH);
    this.composer.addPass(fxaa);

    this.setupLights();
    this.setupCameraControls(this.renderer.domElement);
  }

  private setupLights(): void {
    // 太阳光
    this.sunLight = new THREE.DirectionalLight(0xFFEECC, 2.2);
    this.sunLight.position.set(20, 35, 15);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 100;
    this.sunLight.shadow.camera.left = -35;
    this.sunLight.shadow.camera.right = 35;
    this.sunLight.shadow.camera.top = 35;
    this.sunLight.shadow.camera.bottom = -35;
    this.sunLight.shadow.bias = -0.0003;
    this.scene.add(this.sunLight);

    this.scene.add(new THREE.AmbientLight(0x445566, 0.5));
    this.scene.add(new THREE.HemisphereLight(0x88BBEE, 0x445522, 0.35));

    const fill = new THREE.DirectionalLight(0x8888CC, 0.25);
    fill.position.set(-15, 20, -10);
    this.scene.add(fill);

    // 地面微弱点光（暖色氛围）
    const warm = new THREE.PointLight(0xFF8844, 0.15, 30);
    warm.position.set(0, 3, 0);
    this.scene.add(warm);
  }

  private setupCameraControls(canvas: HTMLElement): void {
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) { this.isDragging = true; this.lastMouse = { x: e.clientX, y: e.clientY }; }
    });
    canvas.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = (e.clientX - this.lastMouse.x) * 0.04 / this.cameraZoom;
      const dy = (e.clientY - this.lastMouse.y) * 0.04 / this.cameraZoom;
      this.cameraTarget.x -= dx;
      this.cameraTarget.z -= dy;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => { this.isDragging = false; });
    canvas.addEventListener('wheel', (e) => {
      this.targetZoom = Math.max(0.4, Math.min(3.0, this.targetZoom + e.deltaY * 0.0015));
    });
  }

  /** 聚焦到 Phaser 坐标 */
  focusOn(px: number, py: number): void {
    const pos = ThreeRenderer.toWorld(px, py, 0);
    this.cameraTarget.set(pos.x, 0, pos.z);
  }

  render(): void {
    this.elapsed = this.clock.getElapsedTime();

    // 平滑缩放
    this.cameraZoom += (this.targetZoom - this.cameraZoom) * 0.1;
    this.updateCameraPosition();

    this.composer.render();
  }

  private updateCameraPosition(): void {
    const d = 22 / this.cameraZoom;
    this.camera.position.set(this.cameraTarget.x + d * 0.55, d, this.cameraTarget.z + d * 0.55);
    this.camera.lookAt(this.cameraTarget);
    const frustumSize = 20 / this.cameraZoom;
    const aspect = GAME_WIDTH / GAME_HEIGHT;
    this.camera.left = -frustumSize * aspect / 2;
    this.camera.right = frustumSize * aspect / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();
  }

  getTime(): number { return this.elapsed; }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  dispose(): void { this.renderer.dispose(); }

  static toWorld(px: number, py: number, elevation: number = 0): THREE.Vector3 {
    return new THREE.Vector3(
      (px - GAME_WIDTH / 2) * SCALE,
      elevation,
      (py - MAP_H / 2) * SCALE,
    );
  }

  static get SCALE(): number { return SCALE; }
}
