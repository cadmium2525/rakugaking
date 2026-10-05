export class CombatAudio {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.lastId = 0;
    this.source = null;
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }
  unlock() {
    if (!this.enabled) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      this.context ||= new Audio({ latencyHint: 'interactive' });
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    } catch {
      /* Sound is optional on browsers that restrict audio. */
    }
  }
  tone(frequency, end, duration, volume, type = 'sine', delay = 0) {
    const ctx = this.context;
    if (!this.enabled || !ctx || ctx.state !== 'running') return;
    const at = ctx.currentTime + delay,
      oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), at + duration);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.01);
  }
  update(combat) {
    if (!combat) return;
    if (this.source !== combat) {
      this.source = combat;
      this.lastId = 0;
    }
    for (const e of combat.events) {
      if (e.id <= this.lastId) continue;
      this.lastId = e.id;
      if (e.type === 'swing') this.tone(250 + e.combo * 80, 80, 0.09, 0.025, 'triangle');
      if (e.type === 'hit') {
        this.tone(140, 40, 0.13, 0.09, 'triangle');
        this.tone(780, 120, 0.06, 0.028, 'square');
      }
      if (e.type === 'block') this.tone(1000, 360, 0.12, 0.035, 'triangle');
      if (e.type === 'defeat')
        for (let i = 0; i < 3; i++)
          this.tone(330 * 2 ** (i / 4), 660 * 2 ** (i / 4), 0.16, 0.04, 'sine', i * 0.06);
      if (e.type === 'switch') {
        this.tone(660, 990, 0.16, 0.055);
        this.tone(990, 1320, 0.18, 0.04, 'sine', 0.08);
      }
      if (e.type === 'hurt') this.tone(160, 55, 0.22, 0.05, 'sawtooth');
    }
  }
}
