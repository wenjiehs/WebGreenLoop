/**
 * 音效系统 - Web Audio API 合成，零外部素材依赖
 * 含 BGM 系统 + 塔类型区分音效 + UI 音效
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.3;
  private bgmGain: GainNode | null = null;
  private bgmOscillators: OscillatorNode[] = [];
  private bgmPlaying: boolean = false;
  private bgmType: 'menu' | 'game' | 'boss' | 'victory' | 'defeat' | 'none' = 'none';

  constructor() {
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      this.ctx = null;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stopBGM();
  }
  isEnabled(): boolean { return this.enabled; }
  setVolume(vol: number): void { this.volume = Math.max(0, Math.min(1, vol)); }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) return null;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  // ====== 塔类型区分音效 ======

  /** 箭/弹射塔 - 弦音 */
  playArrow(): void { this.playTone(900, 0.03, 'triangle', 0.12); }

  /** 炮塔/攻城 - 低频爆炸 */
  playCannon(): void {
    this.playNoise(0.08, 0.3);
    this.playTone(80, 0.1, 'sine', 0.25);
  }

  /** 魔法塔 - 上升扫频 */
  playMagic(): void { this.playSweep(400, 900, 0.1, 'sine', 0.18); }

  /** 冰冻塔 - 下降玻璃音 */
  playFreeze(): void {
    this.playSweep(1400, 500, 0.12, 'sine', 0.12);
    this.playTone(2000, 0.03, 'sine', 0.06);
  }

  /** 闪电塔 - 噪声+锯齿 */
  playLightning(): void {
    this.playNoise(0.04, 0.25);
    this.playTone(180, 0.07, 'sawtooth', 0.18);
  }

  /** 毒塔 - 低沉冒泡 */
  playPoison(): void {
    this.playTone(150, 0.06, 'sine', 0.15);
    setTimeout(() => this.playTone(180, 0.04, 'sine', 0.1), 40);
    setTimeout(() => this.playTone(120, 0.04, 'sine', 0.1), 80);
  }

  /** 火焰塔 - 呼啸上升 */
  playFire(): void { this.playSweep(200, 600, 0.12, 'sawtooth', 0.2); }

  /** 重击暴击 */
  playCritical(): void {
    this.playTone(600, 0.05, 'square', 0.25);
    this.playNoise(0.06, 0.2);
  }

  /** 秒杀 */
  playExecute(): void {
    this.playSweep(1000, 100, 0.15, 'sawtooth', 0.3);
    this.playNoise(0.1, 0.35);
  }

  /** 弹射 */
  playBounce(): void { this.playTone(1100, 0.03, 'triangle', 0.1); }

  /** 通用射击（fallback） */
  playShoot(): void { this.playTone(800, 0.04, 'square', 0.12); }

  // ====== 系统音效 ======

  playBuild(): void {
    this.playTone(440, 0.05, 'square', 0.2);
    setTimeout(() => this.playTone(660, 0.05, 'square', 0.2), 60);
  }

  playUpgrade(): void {
    this.playTone(440, 0.06, 'sine', 0.25);
    setTimeout(() => this.playTone(550, 0.06, 'sine', 0.25), 70);
    setTimeout(() => this.playTone(660, 0.06, 'sine', 0.25), 140);
    setTimeout(() => this.playTone(880, 0.08, 'sine', 0.3), 210);
  }

  playHeroLevelUp(): void {
    // 更华丽的五音上行 + 和弦结尾
    this.playTone(440, 0.08, 'sine', 0.3);
    setTimeout(() => this.playTone(554, 0.08, 'sine', 0.3), 80);
    setTimeout(() => this.playTone(659, 0.08, 'sine', 0.3), 160);
    setTimeout(() => this.playTone(880, 0.08, 'sine', 0.35), 240);
    setTimeout(() => this.playTone(1108, 0.12, 'sine', 0.35), 320);
    // 和弦
    setTimeout(() => { this.playTone(880, 0.15, 'sine', 0.2); this.playTone(1108, 0.15, 'sine', 0.2); this.playTone(1318, 0.15, 'sine', 0.15); }, 440);
  }

  playSell(): void {
    this.playTone(500, 0.05, 'triangle', 0.2);
    setTimeout(() => this.playTone(350, 0.05, 'triangle', 0.2), 80);
  }

  playEnemyDeath(): void { this.playTone(300, 0.05, 'sawtooth', 0.1); }

  playBossDeath(): void {
    this.playNoise(0.15, 0.4);
    this.playSweep(400, 50, 0.3, 'sawtooth', 0.35);
    setTimeout(() => this.playNoise(0.2, 0.3), 150);
    setTimeout(() => this.playSweep(300, 40, 0.25, 'sawtooth', 0.25), 300);
  }

  playBossHit(): void {
    this.playTone(120, 0.08, 'square', 0.2);
    this.playNoise(0.04, 0.15);
  }

  playBossAlert(): void {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.playTone(150, 0.15, 'sawtooth', 0.3), i * 200);
    }
  }

  playWaveStart(): void {
    this.playTone(440, 0.08, 'square', 0.2);
    setTimeout(() => this.playTone(550, 0.1, 'square', 0.25), 100);
  }

  playGameOver(): void { this.playSweep(500, 100, 0.5, 'sawtooth', 0.3); }

  playVictory(): void {
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.2, 'sine', 0.3), i * 150);
    });
  }

  playError(): void { this.playTone(200, 0.08, 'square', 0.15); }
  playGold(): void { this.playTone(1200, 0.03, 'sine', 0.1); }

  // UI 音效
  playHover(): void { this.playTone(1500, 0.02, 'sine', 0.05); }
  playClick(): void { this.playTone(800, 0.03, 'square', 0.1); }
  playSkillLearn(): void {
    this.playSweep(400, 1200, 0.2, 'sine', 0.25);
    setTimeout(() => this.playTone(1200, 0.1, 'sine', 0.2), 200);
  }

  // ====== BGM 系统 ======

  startMenuBGM(): void { this.startBGM('menu'); }
  startGameBGM(): void { this.startBGM('game'); }
  startBossBGM(): void { this.startBGM('boss'); }

  stopBGM(): void {
    for (const osc of this.bgmOscillators) {
      try { osc.stop(); } catch {}
    }
    this.bgmOscillators = [];
    this.bgmPlaying = false;
    this.bgmType = 'none';
  }

  private startBGM(type: 'menu' | 'game' | 'boss'): void {
    if (this.bgmType === type && this.bgmPlaying) return;
    this.stopBGM();
    if (!this.enabled) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    this.bgmType = type;
    this.bgmPlaying = true;

    this.bgmGain = ctx.createGain();
    this.bgmGain.gain.value = this.volume * 0.08; // BGM 很轻
    this.bgmGain.connect(ctx.destination);

    if (type === 'menu') this.playMenuLoop(ctx);
    else if (type === 'game') this.playGameLoop(ctx);
    else if (type === 'boss') this.playBossLoop(ctx);
  }

  private playMenuLoop(ctx: AudioContext): void {
    // 柔和的 Am 和弦琶音循环
    const notes = [220, 261.6, 329.6, 440, 329.6, 261.6]; // Am 琶音
    const noteLen = 0.8;
    const loopLen = notes.length * noteLen;

    const playNote = (freq: number, startTime: number) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, startTime);
      env.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      env.gain.exponentialRampToValueAtTime(0.001, startTime + noteLen - 0.05);
      osc.connect(env);
      env.connect(this.bgmGain!);
      osc.start(startTime);
      osc.stop(startTime + noteLen);
      this.bgmOscillators.push(osc);
    };

    // 播放4个循环，然后递归
    const scheduleLoop = () => {
      if (!this.bgmPlaying || this.bgmType !== 'menu') return;
      const now = ctx.currentTime;
      for (let loop = 0; loop < 4; loop++) {
        notes.forEach((freq, i) => {
          playNote(freq, now + loop * loopLen + i * noteLen);
        });
      }
      setTimeout(() => scheduleLoop(), (4 * loopLen - 0.5) * 1000);
    };
    scheduleLoop();
  }

  private playGameLoop(ctx: AudioContext): void {
    // 低音节奏 + 简单旋律
    const bassNotes = [110, 110, 130.8, 110, 146.8, 146.8, 130.8, 110];
    const noteLen = 0.5;
    const loopLen = bassNotes.length * noteLen;

    const playBass = (freq: number, startTime: number) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, startTime);
      env.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, startTime + noteLen - 0.05);
      osc.connect(env);
      env.connect(this.bgmGain!);
      osc.start(startTime);
      osc.stop(startTime + noteLen);
      this.bgmOscillators.push(osc);
    };

    const scheduleLoop = () => {
      if (!this.bgmPlaying || this.bgmType !== 'game') return;
      const now = ctx.currentTime;
      for (let loop = 0; loop < 4; loop++) {
        bassNotes.forEach((freq, i) => {
          playBass(freq, now + loop * loopLen + i * noteLen);
        });
      }
      setTimeout(() => scheduleLoop(), (4 * loopLen - 0.5) * 1000);
    };
    scheduleLoop();
  }

  private playBossLoop(ctx: AudioContext): void {
    // 紧张的低音脉冲
    const noteLen = 0.3;

    const playPulse = (startTime: number, freq: number) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, startTime);
      env.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, startTime + noteLen);
      osc.connect(env);
      env.connect(this.bgmGain!);
      osc.start(startTime);
      osc.stop(startTime + noteLen + 0.01);
      this.bgmOscillators.push(osc);
    };

    const pattern = [73.4, 0, 73.4, 73.4, 0, 87.3, 73.4, 0]; // D2 pattern
    const loopLen = pattern.length * noteLen;

    const scheduleLoop = () => {
      if (!this.bgmPlaying || this.bgmType !== 'boss') return;
      const now = ctx.currentTime;
      for (let loop = 0; loop < 4; loop++) {
        pattern.forEach((freq, i) => {
          if (freq > 0) playPulse(now + loop * loopLen + i * noteLen, freq);
        });
      }
      setTimeout(() => scheduleLoop(), (4 * loopLen - 0.3) * 1000);
    };
    scheduleLoop();
  }

  // ====== 底层合成 ======

  private playTone(freq: number, duration: number, type: OscillatorType, vol: number): void {
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

  private playSweep(freqStart: number, freqEnd: number, duration: number, type: OscillatorType, vol: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.enabled) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), ctx.currentTime + duration);
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
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * vol;
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

export const soundManager = new SoundManager();
