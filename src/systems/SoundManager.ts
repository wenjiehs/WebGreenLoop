/**
 * 简易音效系统 - 使用 Web Audio API 合成，无需外部素材文件
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.3;

  constructor() {
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      this.ctx = null;
    }
  }

  setEnabled(enabled: boolean): void { this.enabled = enabled; }
  isEnabled(): boolean { return this.enabled; }
  setVolume(vol: number): void { this.volume = Math.max(0, Math.min(1, vol)); }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) return null;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** 塔攻击音效 */
  playShoot(): void {
    this.playTone(800, 0.04, 'square', 0.15);
  }

  /** 炮塔爆炸 */
  playCannon(): void {
    this.playNoise(0.08, 0.4);
  }

  /** 魔法音效 */
  playMagic(): void {
    this.playSweep(400, 800, 0.1, 'sine', 0.2);
  }

  /** 冰冻音效 */
  playFreeze(): void {
    this.playSweep(1200, 600, 0.12, 'sine', 0.15);
  }

  /** 闪电音效 */
  playLightning(): void {
    this.playNoise(0.05, 0.3);
    this.playTone(200, 0.08, 'sawtooth', 0.2);
  }

  /** 建造音效 */
  playBuild(): void {
    this.playTone(440, 0.05, 'square', 0.2);
    setTimeout(() => this.playTone(660, 0.05, 'square', 0.2), 60);
  }

  /** 升级音效 */
  playUpgrade(): void {
    this.playTone(440, 0.06, 'sine', 0.25);
    setTimeout(() => this.playTone(550, 0.06, 'sine', 0.25), 70);
    setTimeout(() => this.playTone(660, 0.06, 'sine', 0.25), 140);
  }

  /** 出售音效 */
  playSell(): void {
    this.playTone(500, 0.05, 'triangle', 0.2);
    setTimeout(() => this.playTone(350, 0.05, 'triangle', 0.2), 80);
  }

  /** 怪物死亡 */
  playEnemyDeath(): void {
    this.playTone(300, 0.06, 'sawtooth', 0.12);
  }

  /** Boss 出现 */
  playBossAlert(): void {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.playTone(150, 0.15, 'sawtooth', 0.3);
      }, i * 200);
    }
  }

  /** 波次开始 */
  playWaveStart(): void {
    this.playTone(440, 0.08, 'square', 0.2);
    setTimeout(() => this.playTone(550, 0.1, 'square', 0.25), 100);
  }

  /** 游戏结束 */
  playGameOver(): void {
    this.playSweep(500, 150, 0.4, 'sawtooth', 0.3);
  }

  /** 胜利 */
  playVictory(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.15, 'sine', 0.3), i * 150);
    });
  }

  /** 错误/无法操作 */
  playError(): void {
    this.playTone(200, 0.08, 'square', 0.15);
  }

  /** 金钱获取 */
  playGold(): void {
    this.playTone(1200, 0.03, 'sine', 0.1);
  }

  // ====== 底层 ======

  private playTone(
    freq: number, duration: number,
    type: OscillatorType, vol: number,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.enabled) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol * this.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.01);
  }

  private playSweep(
    freqStart: number, freqEnd: number,
    duration: number, type: OscillatorType, vol: number,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.enabled) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration);
    gain.gain.setValueAtTime(vol * this.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.01);
  }

  private playNoise(duration: number, vol: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.enabled) return;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * vol;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol * this.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime);
  }
}

// 全局单例
export const soundManager = new SoundManager();
