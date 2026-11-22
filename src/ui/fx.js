const COLORS = ['#39ff88', '#c9a24a', '#eef4f0', '#1fd17a'];

export function createFx({ canvas, host, reduceMotion, soundsOn }) {
  const ctx = canvas.getContext('2d');
  let parts = [];
  let running = false;
  let audio = null;

  const size = () => {
    const r = host.getBoundingClientRect();
    canvas.width = r.width * devicePixelRatio;
    canvas.height = r.height * devicePixelRatio;
    canvas.style.width = `${r.width}px`;
    canvas.style.height = `${r.height}px`;
  };
  size();
  addEventListener('resize', size);

  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.g;
      p.vx *= 0.98;
      p.l -= p.decay;
      p.r += 0.2;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.l);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      if (p.spark) {
        ctx.beginPath();
        ctx.arc(0, 0, p.s / 2, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    parts = parts.filter((p) => p.l > 0);
    if (parts.length) requestAnimationFrame(tick);
    else {
      running = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const start = () => {
    if (running) return;
    running = true;
    requestAnimationFrame(tick);
  };

  const origin = (el) => {
    const a = host.getBoundingClientRect();
    if (!el) return { x: (a.width / 2) * devicePixelRatio, y: a.height * 0.35 * devicePixelRatio };
    const r = el.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - a.left) * devicePixelRatio, y: (r.top + r.height / 2 - a.top) * devicePixelRatio };
  };

  const confetti = (el, count = 70) => {
    if (reduceMotion.matches) return;
    size();
    const { x, y } = origin(el);
    const d = devicePixelRatio;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = (3 + Math.random() * 7) * d;
      parts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 5 * d, g: 0.35 * d, l: 1, decay: 0.012, c: COLORS[i % COLORS.length], s: (3 + Math.random() * 4) * d, r: Math.random() * 6 });
    }
    start();
  };

  const fireworks = (bursts = 4) => {
    if (reduceMotion.matches) return;
    size();
    const d = devicePixelRatio;
    for (let b = 0; b < bursts; b++) {
      setTimeout(() => {
        const x = canvas.width * (0.2 + Math.random() * 0.6);
        const y = canvas.height * (0.15 + Math.random() * 0.3);
        const c = COLORS[b % COLORS.length];
        for (let i = 0; i < 60; i++) {
          const ang = (i / 60) * Math.PI * 2;
          const sp = (2 + Math.random() * 4) * d;
          parts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: 0.06 * d, l: 1, decay: 0.014, c, s: 3 * d, r: 0, spark: true });
        }
        start();
        sound('pop');
      }, b * 320);
    }
  };

  const sound = (kind = 'win') => {
    if (!soundsOn()) return;
    try {
      audio ??= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
      const now = audio.currentTime;
      const notes = { win: [660, 880, 1320], xp: [880, 1175], pop: [520], fail: [220, 165], level: [523, 659, 784, 1047] }[kind] || [880];
      notes.forEach((f, i) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = kind === 'fail' ? 'sawtooth' : 'triangle';
        osc.frequency.value = f;
        const t = now + i * 0.09;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(kind === 'fail' ? 0.05 : 0.12, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        osc.connect(gain).connect(audio.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    } catch {}
  };

  const buzz = (pattern = 12) => navigator.vibrate?.(pattern);

  return { confetti, fireworks, sound, buzz };
}
