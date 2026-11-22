import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { positionAt, dayPhase, sunAngle } from '../logic/mountain.js';
import { createWeatherFx, makeTrees, decorateClimber, SEASON_GROUND, SNOW_LINE } from './effects.js';

const NEON = 0x39ff88;
const GOLD = 0xc9a24a;

const SKY = {
  nacht: { top: 0x070b1c, bottom: 0x1a2a52, fog: 0x121c3a, sun: 0xa9b8ff, sunI: 0.75, hemi: 0.6, dark: 0.55 },
  morgen: { top: 0x3b4f8a, bottom: 0xf4a46b, fog: 0xd99a7a, sun: 0xffc18a, sunI: 1.1, hemi: 0.7, dark: 0.15 },
  tag: { top: 0x3f8fd8, bottom: 0xbfe3ff, fog: 0xb5d8f2, sun: 0xfff4e0, sunI: 1.6, hemi: 0.9, dark: 0 },
  abend: { top: 0x2c3e7a, bottom: 0xff9a5a, fog: 0xd9875f, sun: 0xffa060, sunI: 1.0, hemi: 0.65, dark: 0.15 },
  daemmerung: { top: 0x101a3a, bottom: 0x5a3a6a, fog: 0x3a2f55, sun: 0xb08cff, sunI: 0.7, hemi: 0.55, dark: 0.4 }
};

const GREY_SKY = { top: 0x6f7c88, bottom: 0xb7c0c8 };

const rand = (seed) => {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
};

const hashStr = (s) => [...String(s)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

function makePeak(p, snowLine) {
  const radius = p.camp ? 3.2 : p.h * 0.72;
  const geo = new THREE.ConeGeometry(radius, p.h, 9, 5, false);
  const seed = hashStr(p.id);
  const pos = geo.attributes.position;
  const colors = [];
  const rock = new THREE.Color(0x56605b);
  const rockDark = new THREE.Color(0x3c4541);
  const grass = new THREE.Color(0x3f6b47);
  const snow = new THREE.Color(0xf2f6f8);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const rel = (y + p.h / 2) / p.h;
    const rnd = rand(seed ^ hashStr(`${Math.round(pos.getX(i) * 100)}:${Math.round(y * 100)}:${Math.round(pos.getZ(i) * 100)}`));
    if (rel > 0.02 && rel < 0.98) {
      const s = 0.88 + rnd() * 0.24;
      pos.setX(i, pos.getX(i) * s);
      pos.setZ(i, pos.getZ(i) * s);
      pos.setY(i, y + (rnd() - 0.5) * 0.25);
    }
    const c = p.camp ? grass.clone().lerp(rock, rel * 0.6) : rel > snowLine ? snow : rel > 0.25 ? rock.clone().lerp(rockDark, rnd() * 0.6) : grass.clone().lerp(rock, rel * 2);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  geo.dispose();
  const mesh = new THREE.Mesh(flat, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  mesh.position.set(p.x, p.h / 2, p.z);
  return { mesh, radius };
}

function spiralPoint(p, radius, t) {
  const y = t * p.h;
  const rr = radius * (1 - t) * 1.02 + 0.12;
  const a = Math.PI / 2 + Math.sin(t * Math.PI * 3.5) * 0.6 * (1 - t * 0.5);
  return new THREE.Vector3(p.x + Math.cos(a) * rr, y + 0.12, p.z + Math.sin(a) * rr);
}

function makeLabel(text, color = '#eef4f0') {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = '600 44px Inter, system-ui, sans-serif';
  ctx.font = font;
  const w = Math.min(900, Math.ceil(ctx.measureText(text).width) + 48);
  canvas.width = w;
  canvas.height = 76;
  ctx.font = font;
  ctx.fillStyle = 'rgba(5,7,6,0.72)';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 76, 38);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 24, 40, w - 48);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
  sprite.scale.set((w / 76) * 0.042, 0.042, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function makeClimber(color, opacity = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: opacity < 1 ? 0.2 : 0.55, transparent: opacity < 1, opacity, flatShading: true });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.42, 6), mat);
  body.position.y = 0.32;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat);
  head.position.y = 0.64;
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.12), new THREE.MeshStandardMaterial({ color: opacity < 1 ? 0xffffff : 0x1a2a22, transparent: opacity < 1, opacity, flatShading: true }));
  pack.position.set(0, 0.36, -0.14);
  g.add(body, head, pack);
  return g;
}

function makeHut() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.36), new THREE.MeshStandardMaterial({ color: 0x8a5a33, flatShading: true }));
  base.position.y = 0.14;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.26, 4), new THREE.MeshStandardMaterial({ color: 0x9b2f2f, flatShading: true }));
  roof.position.y = 0.41;
  roof.rotation.y = Math.PI / 4;
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  light.position.set(0, 0.15, 0.19);
  g.add(base, roof, light);
  return g;
}

function makeFlag(color) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 5), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
  pole.position.y = 0.45;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.28), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.3 }));
  cloth.position.set(0.23, 0.76, 0);
  g.add(pole, cloth);
  g.userData.cloth = cloth;
  return g;
}

function makeGround(len, seed) {
  const geo = new THREE.PlaneGeometry(len + 80, 70, 48, 28);
  geo.rotateX(-Math.PI / 2);
  const rnd = rand(seed);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, (rnd() - 0.5) * 0.7 - 0.05);
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  geo.dispose();
  return new THREE.Mesh(flat, new THREE.MeshStandardMaterial({ color: 0x31503a, flatShading: true, roughness: 1 }));
}

function makeStars() {
  const rnd = rand(7);
  const pts = [];
  for (let i = 0; i < 260; i++) {
    const a = rnd() * Math.PI * 2;
    const e = 0.15 + rnd() * 1.2;
    pts.push(Math.cos(a) * Math.cos(e) * 150, Math.sin(e) * 150, Math.sin(a) * Math.cos(e) * 150);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, sizeAttenuation: true, transparent: true, opacity: 0.85 }));
}

function skyTexture(top, bottom) {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, `#${new THREE.Color(top).getHexString()}`);
  g.addColorStop(1, `#${new THREE.Color(bottom).getHexString()}`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMountainScene(host, { reduceMotion }) {
  const lowPower = (navigator.hardwareConcurrency || 4) <= 4 || /iPhone|iPad|Android/i.test(navigator.userAgent);
  const renderer = new THREE.WebGLRenderer({ antialias: !lowPower, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 6;
  controls.maxDistance = 45;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minPolarAngle = Math.PI * 0.15;

  const hemi = new THREE.HemisphereLight(0xffffff, 0x223322, 0.8);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  const lampLight = new THREE.PointLight(0xfff0c0, 0, 4, 1.6);
  scene.add(hemi, sun, sun.target, lampLight);
  const stars = makeStars();
  scene.add(stars);
  const weatherFx = createWeatherFx(scene);

  let world = new THREE.Group();
  scene.add(world);
  let climber = makeClimber(NEON);
  let ghost = makeClimber(0xffffff, 0.35);
  scene.add(climber, ghost);

  let route = null;
  let signature = '';
  let gearSig = '';
  let weatherSig = '';
  let peakData = [];
  let flags = [];
  let climberTarget = new THREE.Vector3();
  let ghostTarget = new THREE.Vector3();
  let focus = new THREE.Vector3();
  let userMoved = false;
  let active = false;
  let raf = 0;
  let phase = '';
  let season = 'herbst';
  let weather = null;
  let lastFrame = 0;
  let money = 0;
  let slip = null;
  let tour = null;
  let hemiBase = 0.8;

  controls.addEventListener('start', () => {
    userMoved = true;
    tour = null;
  });

  const pointFor = (pos) => {
    if (!route || pos.index < 0) return new THREE.Vector3();
    return spiralPoint(route.peaks[pos.index], peakData[pos.index].radius, pos.t);
  };

  const disposeTree = (obj) =>
    obj.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) [].concat(o.material).forEach((m) => {
        m.map?.dispose?.();
        m.dispose?.();
      });
    });

  const clearWorld = () => {
    disposeTree(world);
    scene.remove(world);
    world = new THREE.Group();
    scene.add(world);
  };

  function build(nextRoute, huts) {
    clearWorld();
    route = nextRoute;
    peakData = [];
    flags = [];
    const len = route.peaks.length ? route.peaks.at(-1).x : 0;
    const ground = makeGround(len, 11);
    ground.position.x = len / 2;
    world.add(ground);
    world.userData.ground = ground;
    world.add(makeTrees(route, season));
    route.peaks.forEach((p, i) => {
      const { mesh, radius } = makePeak(p, SNOW_LINE[season]);
      world.add(mesh);
      peakData.push({ radius });
      const pts = [];
      for (let k = 0; k <= 40; k++) pts.push(spiralPoint(p, radius, k / 40));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.04, 4, false), new THREE.MeshBasicMaterial({ color: 0xe8e2d0, transparent: true, opacity: 0.75 }));
      world.add(tube);
      if (i < route.peaks.length - 1) {
        const next = route.peaks[i + 1];
        const nr = next.camp ? 3.2 : next.h * 0.72;
        const a = spiralPoint(p, radius, 1);
        const b = spiralPoint(next, nr, 0);
        const mid = a.clone().lerp(b, 0.5);
        mid.y = Math.max(0.3, Math.min(a.y, b.y) * 0.35);
        world.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 30, 0.03, 4, false), new THREE.MeshBasicMaterial({ color: 0xe8e2d0, transparent: true, opacity: 0.4 })));
      }
      const flag = makeFlag(p.camp ? 0x5ab0ff : new THREE.Color(p.farbe || GOLD).getHex());
      flag.position.set(p.x, p.h + 0.05, p.z);
      world.add(flag);
      flags.push(flag);
      const label = makeLabel(p.camp ? 'Notfalltopf' : p.name);
      label.position.set(p.x, p.h + 1.35, p.z);
      world.add(label);
    });
    for (const hut of huts) {
      const h = makeHut();
      const pt = pointFor(hut);
      h.position.copy(pt);
      h.position.y -= 0.12;
      h.lookAt(new THREE.Vector3(pt.x, pt.y - 0.12, pt.z + 5));
      world.add(h);
    }
    const x0 = route.peaks[0]?.x ?? 0;
    weatherFx.set(weather, { x0, x1: len }, lowPower);
  }

  function setGear(gear) {
    const sig = gear.map((g) => g.id).join(',');
    if (sig === gearSig) return;
    gearSig = sig;
    for (const [old, make] of [[climber, () => makeClimber(NEON)], [ghost, () => makeClimber(0xffffff, 0.35)]]) {
      const next = decorateClimber(make(), gear, { opacity: old === ghost ? 0.35 : 1 });
      next.position.copy(old.position);
      next.visible = old.visible;
      scene.remove(old);
      disposeTree(old);
      scene.add(next);
      if (old === climber) climber = next;
      else ghost = next;
    }
  }

  function applySky(now = new Date()) {
    phase = dayPhase(now.getHours(), now.getMinutes());
    const s = SKY[phase];
    const grey = weather && ['regen', 'gewitter', 'nebel', 'schnee'].includes(weather.typ) && (phase === 'tag' || phase === 'morgen' || phase === 'abend');
    const top = grey ? GREY_SKY.top : s.top;
    const bottom = grey ? GREY_SKY.bottom : s.bottom;
    scene.background?.dispose?.();
    scene.background = skyTexture(top, bottom);
    const fogOverride = weatherFx.fogDensity();
    const fogColor = grey ? new THREE.Color(GREY_SKY.bottom) : new THREE.Color(s.fog);
    scene.fog = new THREE.Fog(fogColor, fogOverride?.near ?? 28, fogOverride?.far ?? 120);
    hemi.color.set(top).lerp(new THREE.Color(0xffffff), 0.5);
    const groundColor = new THREE.Color(SEASON_GROUND[season]).lerp(new THREE.Color(0x0b120f), s.dark);
    hemi.groundColor.copy(groundColor);
    hemiBase = s.hemi * (grey ? 0.85 : 1);
    hemi.intensity = hemiBase;
    sun.color.set(s.sun);
    sun.intensity = s.sunI * (grey ? 0.45 : 1);
    stars.visible = (phase === 'nacht' || phase === 'daemmerung') && !(weather && weather.wolken > 70);
    world.userData.ground?.material.color.copy(groundColor);
    const night = phase === 'nacht' || phase === 'daemmerung';
    const a = sunAngle(now.getHours(), now.getMinutes());
    sun.position.set(focus.x + (night ? -15 : Math.cos(a) * 40), night ? 30 : Math.max(6, Math.sin(a) * 50), 25);
    sun.target.position.set(focus.x, 0, 0);
  }

  function resize() {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (route && !userMoved && !tour) frameCamera(true);
  }

  function frameCamera(snap = false) {
    const offset = new THREE.Vector3(4, 4.2, 12).multiplyScalar(Math.min(1.7, Math.max(1, 0.85 / camera.aspect)));
    const target = climberTarget.clone().add(new THREE.Vector3(2.5, 1.2, 0));
    if (snap || !userMoved) {
      focus.copy(target);
      controls.target.copy(target);
      camera.position.copy(target.clone().add(offset));
    }
  }

  function slipFactor(t) {
    if (!slip) return 0;
    const e = (t - slip.start) / 2600;
    if (e >= 1) {
      slip = null;
      return 0;
    }
    return e < 0.18 ? e / 0.18 : 1 - (e - 0.18) / 0.82;
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (t - lastFrame) / 1000);
    if (t - lastFrame < (lowPower ? 33 : 25)) return;
    lastFrame = t;
    const k = reduceMotion.matches ? 1 : 0.07;
    if (slip && route) {
      const f = slipFactor(t);
      climberTarget = pointFor(positionAt(route, money - slip.amount * f));
    } else if (route) climberTarget = pointFor(positionAt(route, money));
    climber.position.lerp(climberTarget, slip ? 0.25 : k);
    ghost.position.lerp(ghostTarget, k);
    const bob = reduceMotion.matches ? 0 : Math.sin(t / 260) * 0.03;
    climber.children[0].position.y = 0.32 + bob;
    climber.children[1].position.y = 0.64 + bob;
    flags.forEach((f, i) => (f.userData.cloth.rotation.y = Math.sin(t / (weather?.wind > 25 ? 220 : 500) + i) * 0.25));
    const flash = reduceMotion.matches ? 0 : weatherFx.tick(dt, t);
    hemi.intensity = hemiBase + flash * 2.2;
    const night = phase === 'nacht' || phase === 'daemmerung';
    const lamp = climber.getObjectByName('lamp');
    lampLight.intensity = lamp && night ? 2.2 : 0;
    if (lamp) lampLight.position.copy(climber.position).add(new THREE.Vector3(0, 0.75, 0.3));
    if (tour) {
      const e = Math.min(1, (t - tour.start) / tour.ms);
      const ang = tour.from + e * Math.PI * 2;
      camera.position.set(tour.center.x + Math.cos(ang) * tour.r, tour.center.y + 2 + Math.sin(e * Math.PI) * 2.5, tour.center.z + Math.sin(ang) * tour.r);
      controls.target.copy(tour.center);
      camera.lookAt(tour.center);
      flags[tour.index] && (flags[tour.index].scale.setScalar(1 + Math.sin(e * Math.PI) * 0.8));
      if (e >= 1) {
        flags[tour.index]?.scale.setScalar(1);
        tour = null;
        userMoved = false;
        frameCamera(true);
      }
    } else {
      if (!userMoved) {
        const desired = climberTarget.clone().add(new THREE.Vector3(2.5, 1.2, 0));
        controls.target.lerp(desired, 0.05);
        focus.copy(controls.target);
      }
      controls.update();
    }
    renderer.render(scene, camera);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  applySky();

  return {
    update({ route: nextRoute, money: m, ghostMoney, huts, season: nextSeason, weather: nextWeather, gear }) {
      season = nextSeason || season;
      const wSig = nextWeather ? `${nextWeather.typ}:${Math.round((nextWeather.wolken || 0) / 20)}:${Math.round((nextWeather.wind || 0) / 10)}` : 'none';
      const weatherChanged = wSig !== weatherSig;
      weatherSig = wSig;
      weather = nextWeather || null;
      const sig = JSON.stringify([season, nextRoute.peaks.map((p) => [p.id, p.kosten, p.name, p.farbe]), huts.map((h) => h.money)]);
      const rebuilt = sig !== signature;
      if (rebuilt) {
        signature = sig;
        build(nextRoute, huts);
      } else if (weatherChanged) {
        const len = route.peaks.length ? route.peaks.at(-1).x : 0;
        weatherFx.set(weather, { x0: route.peaks[0]?.x ?? 0, x1: len }, lowPower);
      }
      setGear(gear || []);
      money = m;
      climberTarget = pointFor(positionAt(route, money));
      ghostTarget = pointFor(positionAt(route, ghostMoney));
      ghost.visible = ghostMoney - money >= 1 && route.peaks.length > 0;
      climber.visible = route.peaks.length > 0;
      if (rebuilt) {
        climber.position.copy(climberTarget);
        ghost.position.copy(ghostTarget);
        frameCamera(true);
      }
      applySky();
      if (!active) renderer.render(scene, camera);
    },
    slip(amount) {
      if (!route || reduceMotion.matches) return;
      slip = { amount: Math.max(30, amount * 3), start: performance.now() };
    },
    celebrate(peakId) {
      if (!route) return false;
      const index = route.peaks.findIndex((p) => p.id === peakId);
      if (index < 0) return false;
      const p = route.peaks[index];
      const center = new THREE.Vector3(p.x, p.h * 0.75, p.z);
      tour = { index, center, r: p.h * 1.6 + 6, from: Math.PI / 2, start: performance.now(), ms: reduceMotion.matches ? 1 : 6500 };
      return true;
    },
    recenter() {
      userMoved = false;
      tour = null;
      frameCamera(true);
    },
    setActive(on) {
      if (on === active) return;
      active = on;
      if (on) {
        resize();
        applySky();
        lastFrame = performance.now();
        raf = requestAnimationFrame(loop);
      } else cancelAnimationFrame(raf);
    },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      weatherFx.dispose();
      clearWorld();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
