import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../utils/constants';

const SCALE = 0.05;
const UI_HEIGHT_3D = 140;

/**
 * Three.js 渲染器 - Scene/Camera/Lights/PostProcessing
 */
export class ThreeRenderer {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;

  // 摄像机控制
  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private cameraZoom = 1;
  private isDragging = false;
  private lastMouse = { x: 0, y: 0 };

  // 时间
  private clock = new THREE.Clock();

  constructor(container: HTMLElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2a0e);
    this.scene.fog = new THREE.FogExp2(0x1a2a0e, 0.006);

    // Camera - 45° 俯视
    const aspect = GAME_WIDTH / (GAME_HEIGHT - UI_HEIGHT_3D);
    const frustumSize = 22;
    this.camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2, frustumSize * aspect / 2,
      frustumSize / 2, -frustumSize / 2,
      0.1, 200,
    );
    this.camera.position.set(15, 25, 15);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';

    // 后处理 - Bloom
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      0.4,   // strength
      0.3,   // radius
      0.85,  // threshold
    );
    this.composer.addPass(this.bloomPass);

    this.setupLights();
    this.setupCameraControls(this.renderer.domElement);
  }

  private setupLights(): void {
    // 太阳光（暖色，带阴影）
    const sunLight = new THREE.DirectionalLight(0xFFEECC, 2.0);
    sunLight.position.set(20, 30, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 80;
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    // 环境光
    this.scene.add(new THREE.AmbientLight(0x445566, 0.5));

    // 半球光
    this.scene.add(new THREE.HemisphereLight(0x88BBEE, 0x445522, 0.4));

    // 微弱补光（填补阴影暗部）
    const fillLight = new THREE.DirectionalLight(0x8888CC, 0.3);
    fillLight.position.set(-10, 15, -10);
    this.scene.add(fillLight);
  }

  private setupCameraControls(canvas: HTMLElement): void {
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) { this.isDragging = true; this.lastMouse = { x: e.clientX, y: e.clientY }; }
    });
    canvas.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = (e.clientX - this.lastMouse.x) * 0.05;
      const dy = (e.clientY - this.lastMouse.y) * 0.05;
      this.cameraTarget.x -= dx;
      this.cameraTarget.z -= dy;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.updateCameraPosition();
    });
    canvas.addEventListener('mouseup', () => { this.isDragging = false; });
    canvas.addEventListener('wheel', (e) => {
      this.cameraZoom = Math.max(0.5, Math.min(2.5, this.cameraZoom + e.deltaY * 0.001));
      this.updateCameraPosition();
    });
  }

  private updateCameraPosition(): void {
    const d = 25 / this.cameraZoom;
    this.camera.position.set(this.cameraTarget.x + d * 0.6, d, this.cameraTarget.z + d * 0.6);
    this.camera.lookAt(this.cameraTarget);
    const frustumSize = 22 / this.cameraZoom;
    const aspect = GAME_WIDTH / (GAME_HEIGHT - UI_HEIGHT_3D);
    this.camera.left = -frustumSize * aspect / 2;
    this.camera.right = frustumSize * aspect / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.composer.render();
  }

  getTime(): number { return this.clock.getElapsedTime(); }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.updateCameraPosition();
  }

  dispose(): void {
    this.renderer.dispose();
  }

  static toWorld(px: number, py: number, elevation: number = 0): THREE.Vector3 {
    return new THREE.Vector3(
      (px - GAME_WIDTH / 2) * SCALE,
      elevation,
      (py - (GAME_HEIGHT - UI_HEIGHT_3D) / 2) * SCALE,
    );
  }

  static get SCALE(): number { return SCALE; }
}
