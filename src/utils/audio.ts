// Web Audio API Sound Synthesizer for Lintas Alam Matematika SMP
// Operates server-side and client-side safely without loading external MP3 files.

let audioCtx: AudioContext | null = null;
let ambientOscillator: OscillatorNode | null = null;
let ambientGain: GainNode | null = null;
let ambientActiveType: string | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
  }
  // Try to resume if suspended (browser security policy)
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export const playClick = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // sliding up
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    console.warn("Audio blocked or failed:", e);
  }
};

export const playCorrect = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "triangle";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
    osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.warn(e);
  }
};

export const playWrong = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
    osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.3); // sliding down to low buzz

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.warn(e);
  }
};

export const playLevelUp = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const nodes = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50]; // Octave scale
    nodes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.08 + 0.2);

      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.2);
    });
  } catch (e) {
    console.warn(e);
  }
};

export const playVictory = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const chords = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C Major majestic arpeggio
    chords.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + idx * 0.12 + 0.8);

      gain.gain.setValueAtTime(0.08, ctx.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.12 + 1.2);

      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 1.25);
    });
  } catch (e) {
    console.warn(e);
  }
};

// Ambient Sound Generator (synthesizes gentle sounds depending on Level)
export const playAmbient = (type: string) => {
  if (typeof window === "undefined") return;
  const ctx = getAudioContext();
  if (!ctx) return;

  // If already playing the same ambient, do nothing
  if (ambientActiveType === type && ambientOscillator) return;

  // Stop current ambient first
  stopAmbient();

  try {
    ambientActiveType = type;
    ambientOscillator = ctx.createOscillator();
    ambientGain = ctx.createGain();

    ambientOscillator.connect(ambientGain);
    ambientGain.connect(ctx.destination);

    // Default configuration
    let baseFreq = 150;
    let oscType: OscillatorType = "sine";
    let gainVal = 0.02;

    switch (type) {
      case "rainforest":
        baseFreq = 180;
        oscType = "triangle";
        gainVal = 0.015;
        break;
      case "river":
        baseFreq = 110;
        oscType = "sine";
        gainVal = 0.02;
        break;
      case "mountain_wind":
        baseFreq = 90;
        oscType = "sine";
        gainVal = 0.025;
        break;
      case "lava_fire":
        baseFreq = 65;
        oscType = "triangle";
        gainVal = 0.035;
        break;
      case "farm_morning":
        baseFreq = 220;
        oscType = "sine";
        gainVal = 0.012;
        break;
      case "cave_echo":
        baseFreq = 50;
        oscType = "sine";
        gainVal = 0.04;
        break;
      case "epic_boss":
        baseFreq = 80;
        oscType = "sawtooth";
        gainVal = 0.015;
        break;
    }

    ambientOscillator.type = oscType;
    ambientOscillator.frequency.value = baseFreq;

    // Apply soft rhythmic modulation or drone filtering
    ambientGain.gain.setValueAtTime(gainVal, ctx.currentTime);
    
    // Smooth fade in
    ambientGain.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + 1.5);

    ambientOscillator.start();
  } catch (e) {
    console.warn("Ambient playback failed:", e);
  }
};

export const stopAmbient = () => {
  try {
    if (ambientOscillator) {
      ambientOscillator.stop();
      ambientOscillator.disconnect();
      ambientOscillator = null;
    }
    if (ambientGain) {
      ambientGain.disconnect();
      ambientGain = null;
    }
    ambientActiveType = null;
  } catch (e) {
    // already stopped
  }
};
