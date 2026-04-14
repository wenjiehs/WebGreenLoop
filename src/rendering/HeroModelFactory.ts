import * as THREE from 'three';
import { HeroTowerConfig } from '../config/heroTowers';

/**
 * 英雄 3D 模型工厂 — 每个英雄独特的魔兽争霸风格低多边形程序化模型
 *
 * 12 种英雄各有辨识度：
 * - 火魂: 火焰元素体 + 浮空火球
 * - 小黑: 暗夜弓手 + 弓
 * - 剑神: 武士 + 双刀
 * - 电法: 闪电球体 + 电弧环
 * - 水魔: 水晶体 + 水波环
 * - 风神: 绿色旋风体 + 翅膀
 * - 战神: 重甲战士 + 战锤
 * - 兽王: 兽形底座 + 角
 * - 恶魔之子: 恶魔翅膀 + 暗影球
 * - 寒冰: 冰晶塔 + 冰环
 * - 幻影: 隐匿暗影体 + 匕首
 * - 神牛: 牛头 + 大锤
 */
export class HeroModelFactory {
  static create(config: HeroTowerConfig): THREE.Group {
    switch (config.id) {
      case 'fire_soul':     return this.buildFireSoul(config);
      case 'shadow_hunter': return this.buildShadowHunter(config);
      case 'blade_master':  return this.buildBladeMaster(config);
      case 'storm_spirit':  return this.buildStormSpirit(config);
      case 'water_mage':    return this.buildWaterMage(config);
      case 'wind_god':      return this.buildWindGod(config);
      case 'war_god':       return this.buildWarGod(config);
      case 'beast_master':  return this.buildBeastMaster(config);
      case 'demon_child':   return this.buildDemonChild(config);
      case 'ice_witch':     return this.buildIceWitch(config);
      case 'phantom':       return this.buildPhantom(config);
      case 'tauren_chief':  return this.buildTaurenChief(config);
      default:              return this.buildDefault(config);
    }
  }

  /** 火魂 — 火焰元素体：浮空火焰核心+旋转火环+底部焦土 */
  private static buildFireSoul(c: HeroTowerConfig): THREE.Group {
    const g = new THREE.Group();
    // 焦土底座
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.08, 8), new THREE.MeshLambertMaterial({ color: 0x331100 }));
    base.position.y = 0.04; base.castShadow = true; g.add(base);
    // 火焰核心（锥体向上）
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 6), new THREE.MeshPhongMaterial({ color: 0xFF4400, emissive: 0xFF2200, emissiveIntensity: 0.5 }));
    core.position.y = 0.42; core.castShadow = true; core.name = 'heroCore'; g.add(core);
    // 外层火焰（更大的半透明锥体）
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 6), new THREE.MeshBasicMaterial({ color: 0xFF6600, transparent: true, opacity: 0.3 }));
    outer.position.y = 0.4; g.add(outer);
    // 火环
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 16), new THREE.MeshBasicMaterial({ color: 0xFFAA00, transparent: true, opacity: 0.4 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.35; ring.name = 'heroAura'; g.add(ring);
    // 浮空小火球
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const fb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), new THREE.MeshBasicMaterial({ color: 0xFFCC22 }));
      fb.position.set(Math.cos(a) * 0.28, 0.5 + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.28);
      g.add(fb);
    }
    return g;
  }

  /** 小黑 — 暗夜弓手：暗色身体+弓+箭袋 */
  private static buildShadowHunter(c: HeroTowerConfig): THREE.Group {
    const g = new THREE.Group();
    // 底座
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.12, 8), new THREE.MeshLambertMaterial({ color: 0x222244 }));
    base.position.y = 0.06; base.castShadow = true; g.add(base);
    // 身体（修长）
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.4, 6), new THREE.MeshLambertMaterial({ color: 0x334466 }));
    body.position.y = 0.32; body.castShadow = true; g.add(body);
    // 头部
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshLambertMaterial({ color: 0x445577 }));
    head.position.y = 0.58; head.castShadow = true; head.name = 'heroCore'; g.add(head);
    // 弓（弧形）
    const bowCurve = new THREE.EllipseCurve(0, 0, 0.25, 0.08, -Math.PI * 0.7, Math.PI * 0.7, false, 0);
    const bowPts = bowCurve.getPoints(16).map(p => new THREE.Vector3(p.x, p.y, 0));
    const bowGeo = new THREE.BufferGeometry().setFromPoints(bowPts);
    const bow = new THREE.Line(bowGeo, new THREE.LineBasicMaterial({ color: 0x8B6B4F, linewidth: 2 }));
    bow.position.set(-0.22, 0.35, 0); bow.rotation.z = Math.PI / 2; g.add(bow);
    // 弦
    const stringGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.23, 0), new THREE.Vector3(0, 0.23, 0)]);
    const str = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: 0xCCBB88 }));
    str.position.set(-0.22, 0.35, 0); str.rotation.z = Math.PI / 2; g.add(str);
    // 兜帽
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.1, 6), new THREE.MeshLambertMaterial({ color: 0x223344 }));
    hood.position.y = 0.66; g.add(hood);
    // 光环
    const aura = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.012, 6, 16), new THREE.MeshBasicMaterial({ color: 0x5566AA, transparent: true, opacity: 0.25 }));
    aura.rotation.x = Math.PI / 2; aura.position.y = 0.08; aura.name = 'heroAura'; g.add(aura);
    return g;
  }

  /** 剑神 — 武士：粗壮身体+双刀+头盔 */
  private static buildBladeMaster(c: HeroTowerConfig): THREE.Group {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.1, 8), new THREE.MeshLambertMaterial({ color: 0x664422 }));
    base.position.y = 0.05; base.castShadow = true; g.add(base);
    // 身体
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.35, 0.2), new THREE.MeshLambertMaterial({ color: 0xCC8844 }));
    body.position.y = 0.3; body.castShadow = true; g.add(body);
    // 头
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), new THREE.MeshLambertMaterial({ color: 0xDDAA77 }));
    head.position.y = 0.55; head.castShadow = true; head.name = 'heroCore'; g.add(head);
    // 头盔
    const helmet = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.12, 6), new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 60 }));
    helmet.position.y = 0.65; g.add(helmet);
    // 左刀
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.35, 0.01), new THREE.MeshPhongMaterial({ color: 0xCCCCDD, shininess: 100 }));
    blade1.position.set(-0.22, 0.4, 0); blade1.rotation.z = 0.15; blade1.castShadow = true; g.add(blade1);
    // 右刀
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.35, 0.01), new THREE.MeshPhongMaterial({ color: 0xCCCCDD, shininess: 100 }));
    blade2.position.set(0.22, 0.4, 0); blade2.rotation.z = -0.15; blade2.castShadow = true; g.add(blade2);
    // 光环
    const aura = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.012, 6, 16), new THREE.MeshBasicMaterial({ color: 0xFFAA44, transparent: true, opacity: 0.25 }));
    aura.rotation.x = Math.PI / 2; aura.position.y = 0.08; aura.name = 'heroAura'; g.add(aura);
    return g;
  }

  /** 电法 — 闪电球体+电弧环+蓝色闪电 */
  private static buildStormSpirit(c: HeroTowerConfig): THREE.Group {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.1, 8), new THREE.MeshLambertMaterial({ color: 0x223355 }));
    base.position.y = 0.05; base.castShadow = true; g.add(base);
    // 闪电球体
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshPhongMaterial({ color: 0x4488FF, emissive: 0x2244AA, emissiveIntensity: 0.4, shininess: 80 }));
    orb.position.y = 0.42; orb.castShadow = true; orb.name = 'heroCore'; g.add(orb);
    // 电弧环（两个交叉的环）
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.015, 6, 16), new THREE.MeshBasicMaterial({ color: 0x66AAFF, transparent: true, opacity: 0.35 }));
      ring.position.y = 0.42; ring.rotation.x = Math.PI / 2 + i * Math.PI / 3; ring.rotation.z = i * Math.PI / 4;
      g.add(ring);
    }
    // 底部光环
    const aura = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.012, 6, 16), new THREE.MeshBasicMaterial({ color: 0x4488FF, transparent: true, opacity: 0.3 }));
    aura.rotation.x = Math.PI / 2; aura.position.y = 0.08; aura.name = 'heroAura'; g.add(aura);
    // 闪电柱
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 3), new THREE.MeshBasicMaterial({ color: 0xAADDFF }));
    bolt.position.set(0, 0.65, 0); g.add(bolt);
    return g;
  }

  /** 水魔 — 水晶体+水波纹+水滴 */
  private static buildWaterMage(c: HeroTowerConfig): THREE.Group {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.1, 8), new THREE.MeshLambertMaterial({ color: 0x114466 }));
    base.position.y = 0.05; base.castShadow = true; g.add(base);
    // 水晶主体
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshPhongMaterial({ color: 0x2288CC, transparent: true, opacity: 0.8, shininess: 100, emissive: 0x114466, emissiveIntensity: 0.2 }));
    crystal.position.y = 0.42; crystal.castShadow = true; crystal.name = 'heroCore'; g.add(crystal);
    // 水波纹（多层环）
    for (let i = 0; i < 3; i++) {
      const wave = new THREE.Mesh(new THREE.TorusGeometry(0.2 + i * 0.08, 0.008, 6, 20), new THREE.MeshBasicMaterial({ color: 0x44AAEE, transparent: true, opacity: 0.2 - i * 0.05 }));
      wave.rotation.x = Math.PI / 2; wave.position.y = 0.12 + i * 0.02; g.add(wave);
    }
    // 浮空水滴
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 3), new THREE.MeshPhongMaterial({ color: 0x66CCEE, transparent: true, opacity: 0.6, shininess: 100 }));
      drop.position.set(Math.cos(a) * 0.25, 0.45 + Math.sin(a * 3) * 0.06, Math.sin(a) * 0.25);
      g.add(drop);
    }
    const aura = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.012, 6, 16), new THREE.MeshBasicMaterial({ color: 0x44AAEE, transparent: true, opacity: 0.25 }));
    aura.rotation.x = Math.PI / 2; aura.position.y = 0.08; aura.name = 'heroAura'; g.add(aura);
    return g;
  }

  /** 风神 — 绿色旋风+翅膀 */
  private static buildWindGod(c: HeroTowerConfig): THREE.Group {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.1, 8), new THREE.MeshLambertMaterial({ color: 0x336633 }));
    base.position.y = 0.05; base.castShadow = true; g.add(base);
    // 旋风锥体
    const wind = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 8, 1, true), new THREE.MeshPhongMaterial({ color: 0x88CC88, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    wind.position.y = 0.38; wind.name = 'heroCore'; g.add(wind);
    // 核心球
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshPhongMaterial({ color: 0xAAEEAA, emissive: 0x448844, emissiveIntensity: 0.3 }));
    core.position.y = 0.42; core.castShadow = true; g.add(core);
    // 翅膀
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.2), new THREE.MeshLambertMaterial({ color: 0x88CC88, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
      wing.position.set(side * 0.25, 0.45, 0); wing.rotation.y = side * 0.4; wing.rotation.z = side * 0.15;
      g.add(wing);
    }
    const aura = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.012, 6, 16), new THREE.MeshBasicMaterial({ color: 0xAAEEAA, transparent: true, opacity: 0.25 }));
    aura.rotation.x = Math.PI / 2; aura.position.y = 0.08; aura.name = 'heroAura'; g.add(aura);
    return g;
  }

  /** 战神 — 重甲战士+战锤 */
  private static buildWarGod(c: HeroTowerConfig): THREE.Group {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.12, 8), new THREE.MeshLambertMaterial({ color: 0x553311 }));
    base.position.y = 0.06; base.castShadow = true; g.add(base);
    // 粗壮身体（重甲）
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.35, 0.25), new THREE.MeshPhongMaterial({ color: 0xDD6622, shininess: 30 }));
    body.position.y = 0.3; body.castShadow = true; g.add(body);
    // 肩甲
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), new THREE.MeshPhongMaterial({ color: 0xAA5511, shininess: 40 }));
      shoulder.position.set(side * 0.2, 0.48, 0); shoulder.castShadow = true; g.add(shoulder);
    }
    // 头
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), new THREE.MeshLambertMaterial({ color: 0xDD9955 }));
    head.position.y = 0.56; head.castShadow = true; head.name = 'heroCore'; g.add(head);
    // 战锤
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 4), new THREE.MeshLambertMaterial({ color: 0x6B3A1F }));
    handle.position.set(0.26, 0.35, 0); handle.rotation.z = -0.2; g.add(handle);
    const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.08), new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 60 }));
    hammerHead.position.set(0.3, 0.58, 0); g.add(hammerHead);
    const aura = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.015, 6, 16), new THREE.MeshBasicMaterial({ color: 0xFF8844, transparent: true, opacity: 0.25 }));
    aura.rotation.x = Math.PI / 2; aura.position.y = 0.08; aura.name = 'heroAura'; g.add(aura);
    return g;
  }

  /** 兽王 — 兽形底座+角+毛皮 */
  private static buildBeastMaster(c: HeroTowerConfig): THREE.Group {
    const g = new THREE.Group();
    // 毛皮底座
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.12, 8), new THREE.MeshLambertMaterial({ color: 0x554422 }));
    base.position.y = 0.06; base.castShadow = true; g.add(base);
    // 身体（宽厚）
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.25), new THREE.MeshLambertMaterial({ color: 0x886622 }));
    body.position.y = 0.28; body.castShadow = true; g.add(body);
    // 头
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshLambertMaterial({ color: 0x997733 }));
    head.position.y = 0.5; head.castShadow = true; head.name = 'heroCore'; g.add(head);
    // 角
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.15, 4), new THREE.MeshLambertMaterial({ color: 0xCCBB88 }));
      horn.position.set(side * 0.1, 0.6, 0); horn.rotation.z = side * 0.3; g.add(horn);
    }
    // 小战鹰
    const hawk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), new THREE.MeshLambertMaterial({ color: 0xBB9944 }));
    hawk.position.set(0.2, 0.65, 0.1); hawk.rotation.x = Math.PI / 4; g.add(hawk);
    const aura = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.012, 6, 16), new THREE.MeshBasicMaterial({ color: 0xAA8844, transparent: true, opacity: 0.25 }));
    aura.rotation.x = Math.PI / 2; aura.position.y = 0.08; aura.name = 'heroAura'; g.add(aura);
    return g;
  }

  /** 恶魔之子 — 恶魔翅膀+暗影球+角 */
  private static buildDemonChild(c: HeroTowerConfig): THREE.Group {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.1, 8), new THREE.MeshLambertMaterial({ color: 0x220022 }));
    base.position.y = 0.05; base.castShadow = true; g.add(base);
    // 身体
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.35, 6), new THREE.MeshPhongMaterial({ color: 0x660044, emissive: 0x330022, emissiveIntensity: 0.2 }));
    body.position.y = 0.3; body.castShadow = true; g.add(body);
    // 头+角
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshLambertMaterial({ color: 0x882255 }));
    head.position.y = 0.54; head.castShadow = true; head.name = 'heroCore'; g.add(head);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 4), new THREE.MeshLambertMaterial({ color: 0x440022 }));
      horn.position.set(side * 0.08, 0.63, 0); horn.rotation.z = side * 0.25; g.add(horn);
    }
    // 恶魔翅膀（三角平面）
    for (const side of [-1, 1]) {
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0); wingShape.lineTo(side * 0.3, 0.15); wingShape.lineTo(side * 0.2, -0.1); wingShape.lineTo(0, 0);
      const wing = new THREE.Mesh(new THREE.ShapeGeometry(wingShape), new THREE.MeshLambertMaterial({ color: 0x440033, side: THREE.DoubleSide }));
      wing.position.set(side * 0.05, 0.42, -0.05); wing.rotation.y = side * 0.3; g.add(wing);
    }
    // 暗影球（发光）
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), new THREE.MeshBasicMaterial({ color: 0x990066 }));
    orb.position.y = 0.72; g.add(orb);
    const aura = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.012, 6, 16), new THREE.MeshBasicMaterial({ color: 0x990066, transparent: true, opacity: 0.3 }));
    aura.rotation.x = Math.PI / 2; aura.position.y = 0.08; aura.name = 'heroAura'; g.add(aura);
    return g;
  }

  /** 寒冰 — 冰晶塔+冰环+冰碎片 */
  private static buildIceWitch(c: HeroTowerConfig): THREE.Group {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.1, 6), new THREE.MeshPhongMaterial({ color: 0x4488AA, shininess: 80 }));
    base.position.y = 0.05; base.castShadow = true; g.add(base);
    // 冰晶主塔
    const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 6), new THREE.MeshPhongMaterial({ color: 0x88CCFF, transparent: true, opacity: 0.75, shininess: 120, emissive: 0x224466, emissiveIntensity: 0.3 }));
    crystal.position.y = 0.38; crystal.castShadow = true; crystal.name = 'heroCore'; g.add(crystal);
    // 冰碎片环
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.1, 4), new THREE.MeshPhongMaterial({ color: 0xAADDFF, transparent: true, opacity: 0.6, shininess: 100 }));
      shard.position.set(Math.cos(a) * 0.25, 0.2, Math.sin(a) * 0.25);
      shard.rotation.z = (Math.random() - 0.5) * 0.4;
      g.add(shard);
    }
    // 冰环
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.015, 6, 16), new THREE.MeshPhongMaterial({ color: 0xAADDFF, transparent: true, opacity: 0.3, shininess: 100 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.15; g.add(ring);
    const aura = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.012, 6, 16), new THREE.MeshBasicMaterial({ color: 0x88CCFF, transparent: true, opacity: 0.25 }));
    aura.rotation.x = Math.PI / 2; aura.position.y = 0.08; aura.name = 'heroAura'; g.add(aura);
    return g;
  }

  /** 幻影 — 暗影隐匿体+匕首+烟雾 */
  private static buildPhantom(c: HeroTowerConfig): THREE.Group {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.1, 8), new THREE.MeshLambertMaterial({ color: 0x221133 }));
    base.position.y = 0.05; base.castShadow = true; g.add(base);
    // 隐匿身体（半透明）
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.4, 6), new THREE.MeshPhongMaterial({ color: 0x553366, transparent: true, opacity: 0.7 }));
    body.position.y = 0.32; body.castShadow = true; g.add(body);
    // 头（暗色兜帽）
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.15, 6), new THREE.MeshLambertMaterial({ color: 0x332244 }));
    head.position.y = 0.58; head.castShadow = true; head.name = 'heroCore'; g.add(head);
    // 匕首
    for (const side of [-1, 1]) {
      const dagger = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.2, 4), new THREE.MeshPhongMaterial({ color: 0xCCCCDD, shininess: 100 }));
      dagger.position.set(side * 0.18, 0.35, 0); dagger.rotation.z = side * 0.4; g.add(dagger);
    }
    // 暗影烟雾
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 5), new THREE.MeshBasicMaterial({ color: 0x553366, transparent: true, opacity: 0.12 }));
    smoke.position.y = 0.3; smoke.scale.y = 0.6; g.add(smoke);
    const aura = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.012, 6, 16), new THREE.MeshBasicMaterial({ color: 0x775588, transparent: true, opacity: 0.25 }));
    aura.rotation.x = Math.PI / 2; aura.position.y = 0.08; aura.name = 'heroAura'; g.add(aura);
    return g;
  }

  /** 神牛 — 牛头人酋长：巨大牛头+大锤+图腾 */
  private static buildTaurenChief(c: HeroTowerConfig): THREE.Group {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.12, 8), new THREE.MeshLambertMaterial({ color: 0x664422 }));
    base.position.y = 0.06; base.castShadow = true; g.add(base);
    // 粗壮身体
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.35, 0.28), new THREE.MeshLambertMaterial({ color: 0x996633 }));
    body.position.y = 0.3; body.castShadow = true; g.add(body);
    // 牛头（扁椭圆）
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), new THREE.MeshLambertMaterial({ color: 0xBB8844 }));
    head.position.y = 0.55; head.scale.set(1.2, 0.9, 1); head.castShadow = true; head.name = 'heroCore'; g.add(head);
    // 大角
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 5), new THREE.MeshLambertMaterial({ color: 0xDDCC88 }));
      horn.position.set(side * 0.16, 0.6, 0); horn.rotation.z = side * 0.5; g.add(horn);
    }
    // 鼻环
    const noseRing = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 4, 8), new THREE.MeshPhongMaterial({ color: 0xFFDD44, shininess: 80 }));
    noseRing.position.set(0, 0.5, 0.12); g.add(noseRing);
    // 大锤
    const hHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), new THREE.MeshLambertMaterial({ color: 0x6B3A1F }));
    hHandle.position.set(0.28, 0.35, 0); hHandle.rotation.z = -0.15; g.add(hHandle);
    const hHead = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.1), new THREE.MeshPhongMaterial({ color: 0x777788, shininess: 50 }));
    hHead.position.set(0.3, 0.6, 0); g.add(hHead);
    // 图腾（背上）
    const totem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.25, 4), new THREE.MeshLambertMaterial({ color: 0x884422 }));
    totem.position.set(0, 0.45, -0.15); totem.rotation.x = 0.2; g.add(totem);
    const aura = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.015, 6, 16), new THREE.MeshBasicMaterial({ color: 0xBB8855, transparent: true, opacity: 0.25 }));
    aura.rotation.x = Math.PI / 2; aura.position.y = 0.08; aura.name = 'heroAura'; g.add(aura);
    return g;
  }

  /** 默认（兜底） */
  private static buildDefault(c: HeroTowerConfig): THREE.Group {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.25, 8), new THREE.MeshPhongMaterial({ color: c.color, emissive: c.color, emissiveIntensity: 0.15 }));
    base.position.y = 0.125; base.castShadow = true; g.add(base);
    const hero = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 1), new THREE.MeshPhongMaterial({ color: c.color, emissive: 0xFFD700, emissiveIntensity: 0.2 }));
    hero.position.y = 0.5; hero.castShadow = true; hero.name = 'heroCore'; g.add(hero);
    const aura = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.015, 6, 20), new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.25 }));
    aura.rotation.x = Math.PI / 2; aura.position.y = 0.1; aura.name = 'heroAura'; g.add(aura);
    return g;
  }
}
