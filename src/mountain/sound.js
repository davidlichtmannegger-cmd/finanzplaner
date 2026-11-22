export function createAmbience() {
  let ctx = null;
  let master = null;
  let windGain = null;
  let rainGain = null;
  let timers = [];
  let running = false;
  let mood = { night: false, wind: 10, rain: false };

  const noiseBuffer = () => {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buf;
  };

  const loopSource = (buffer) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  };

  const chirp = () => {
    if (!running) return;
    const t = ctx.currentTime;
    const notes = mood.night ? 3 : 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const start = t + i * (mood.night ? 0.07 : 0.12);
      if (mood.night) {
        osc.frequency.setValueAtTime(4200, start);
      } else {
        const base = 2400 + Math.random() * 1600;
        osc.frequency.setValueAtTime(base, start);
        osc.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), start + 0.08);
      }
      osc.type = 'sine';
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(mood.night ? 0.012 : 0.03, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, start + (mood.night ? 0.05 : 0.1));
      osc.connect(g).connect(master);
      osc.start(start);
      osc.stop(start + 0.15);
    }
    timers.push(setTimeout(chirp, (mood.night ? 900 : 2500) + Math.random() * (mood.night ? 900 : 5000)));
  };

  const applyMood = () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    windGain.gain.setTargetAtTime(Math.min(0.5, 0.08 + mood.wind / 80), t, 1.5);
    rainGain.gain.setTargetAtTime(mood.rain ? 0.22 : 0, t, 1.5);
  };

  return {
    start() {
      if (running) return;
      try {
        ctx ??= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
      } catch {
        return;
      }
      ctx.resume?.();
      running = true;
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      master.gain.setTargetAtTime(0.9, ctx.currentTime, 1);
      const buf = noiseBuffer();
      const wind = loopSource(buf);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      windGain = ctx.createGain();
      windGain.gain.value = 0.15;
      wind.connect(lp).connect(windGain).connect(master);
      wind.start();
      const rain = loopSource(buf);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      rainGain = ctx.createGain();
      rainGain.gain.value = 0;
      rain.connect(hp).connect(rainGain).connect(master);
      rain.start(0, 0.7);
      master.userData = [wind, rain];
      applyMood();
      chirp();
    },
    stop() {
      if (!running) return;
      running = false;
      timers.forEach(clearTimeout);
      timers = [];
      const m = master;
      m.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      setTimeout(() => {
        m.userData?.forEach((s) => s.stop());
        m.disconnect();
      }, 1200);
    },
    setMood(next) {
      mood = { ...mood, ...next };
      applyMood();
    },
    get running() {
      return running;
    }
  };
}
