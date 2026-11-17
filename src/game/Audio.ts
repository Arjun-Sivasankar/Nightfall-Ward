import { loadMuted, saveMuted } from './storage';

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = loadMuted();

  get isMuted(): boolean {
    return this.muted;
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.22;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    saveMuted(this.muted);
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.22;
    return this.muted;
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    slideTo?: number,
  ): void {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  private noise(duration: number, volume: number, filterFrequency: number): void {
    if (!this.context || !this.master || this.muted) return;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);
  }

  click(): void {
    this.tone(520, 0.045, 'sine', 0.22, 760);
  }

  shoot(): void {
    this.tone(130, 0.075, 'square', 0.42, 58);
    this.noise(0.055, 0.16, 1900);
  }

  reload(): void {
    this.tone(220, 0.09, 'triangle', 0.18, 125);
    window.setTimeout(() => this.tone(380, 0.12, 'triangle', 0.15, 540), 180);
  }

  hit(headshot: boolean): void {
    if (headshot) {
      this.tone(780, 0.08, 'square', 0.28, 1180);
      this.tone(1080, 0.11, 'sine', 0.18, 650);
    } else {
      this.tone(240, 0.06, 'triangle', 0.2, 170);
    }
  }

  zombieAttack(): void {
    this.tone(92, 0.18, 'sawtooth', 0.18, 48);
  }

  wave(): void {
    this.tone(330, 0.14, 'sine', 0.2, 480);
    window.setTimeout(() => this.tone(480, 0.2, 'sine', 0.18, 720), 130);
  }

  gameOver(): void {
    this.tone(230, 0.28, 'sawtooth', 0.28, 72);
    window.setTimeout(() => this.tone(130, 0.45, 'triangle', 0.23, 45), 180);
  }
}
