// Synthesize a warm, low-pitch, soft marimba droplet chime using Web Audio API
export function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Master low-pass filter to remove all harsh/piercing high frequencies
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now);
    filter.Q.setValueAtTime(1, now);

    // Warm, low-pitch tone 1 (F4 - 349Hz transitioning smoothly to G4 - 392Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(349.23, now);
    osc1.frequency.exponentialRampToValueAtTime(392.0, now + 0.06);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.09, now + 0.015); // Gentle soft attack
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc1.connect(gain1);
    gain1.connect(filter);

    // Warm harmonious second tone (C5 - 523Hz) triggered softly right after
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(440.0, now + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(523.25, now + 0.10);

    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.setValueAtTime(0.0001, now + 0.05);
    gain2.gain.linearRampToValueAtTime(0.08, now + 0.065);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

    osc2.connect(gain2);
    gain2.connect(filter);

    filter.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.05);
    osc1.stop(now + 0.20);
    osc2.stop(now + 0.28);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 400);
  } catch (e) {
    // Graceful fallback for environments with strict audio autoplay policies
  }
}
