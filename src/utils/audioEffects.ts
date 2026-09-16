/**
 * Synthesizes camera shutter and countdown sounds using the standard Web Audio API.
 * Does not require external audio assets.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    console.warn('AudioContext tidak didukung:', e);
    return null;
  }
}

export function playCountdownBeep(highPitch = false) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(highPitch ? 880 : 440, ctx.currentTime);

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (highPitch ? 0.25 : 0.15));

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + (highPitch ? 0.25 : 0.15));
}

export function playShutterSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Mechanical dual-click simulation
  const now = ctx.currentTime;

  // Click 1: shutter curtain open
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(120, now);
  osc1.frequency.exponentialRampToValueAtTime(40, now + 0.08);

  gain1.gain.setValueAtTime(0.4, now);
  gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.08);

  // Click 2: shutter curtain snap shut (60ms later)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(320, now + 0.06);
  osc2.frequency.exponentialRampToValueAtTime(60, now + 0.14);

  gain2.gain.setValueAtTime(0.3, now + 0.06);
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.06);
  osc2.stop(now + 0.14);
}

export const playCameraClickSound = playShutterSound;

export function playSuccessChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = ctx.currentTime + idx * 0.08;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.15, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.35);
  });
}
