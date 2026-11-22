import * as THREE from 'three';

const rand = (seed) => {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
};

export const SEASON_GROUND = { winter: 0xd6e0e6, fruehling: 0x4c8a4f, sommer: 0x3a6f3f, herbst: 0x8a6d34 };
export const SEASON_TREE = { winter: 0x2f4a3a, fruehling: 0x3f8f4a, sommer: 0x2f6e38, herbst: 0xb5652a };
export const SNOW_LINE = { winter: 0.42, fruehling: 0.62, sommer: 0.8, herbst: 0.68 };

export function makeTrees(route, season, seed = 5) {
  const rnd = rand(seed);
  const spots = [];
  const len = route.peaks.length ? route.peaks.at(-1).x : 0;
  let tries = 0;
  while (spots.length < 140 && tries < 2000) {
    tries++;
    const x = -14 + rnd() * (len + 28);
    const z = -16 + rnd() * 30;
    const blocked = route.peaks.some((p) => {
      const r = (p.camp ? 3.2 : p.h * 0.72) + 0.8;
      return (x - p.x) ** 2 + (z - p.z) ** 2 < r * r;
    });
    if (!blocked) spots.push({ x, z, s: 0.5 + rnd() * 0.7, r: rnd() * Math.PI });
  }
  const geo = new THREE.ConeGeometry(0.35, 1.1, 6);
  geo.translate(0, 0.55, 0);
  const mat = new THREE.MeshStandardMaterial({ color: SEASON_TREE[season], flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  const m = new THREE.Matrix4();
  spots.forEach((sp, i) => {
    m.compose(new THREE.Vector3(sp.x, 0, sp.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp.r), new THREE.Vector3(sp.s, sp.s, sp.s));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (season === 'winter') {
    const caps = new THREE.InstancedMesh(new THREE.ConeGeometry(0.2, 0.45, 6).translate(0, 0.88, 0), new THREE.MeshStandardMaterial({ color: 0xf4f8fa, flatShading: true }), spots.length);
    spots.forEach((sp, i) => {
      m.compose(new THREE.Vector3(sp.x, 0, sp.z), new THREE.Quaternion(), new THREE.Vector3(sp.s, sp.s, sp.s));
      caps.setMatrixAt(i, m);
    });
    const g = new THREE.Group();
    g.add(mesh, caps);
    return g;
  }
  return mesh;
}

function makeCloud(rnd) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.88 });
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 + rnd() * 0.9, 0), mat);
    puff.position.set(i * 0.9 - n * 0.45, rnd() * 0.4, (rnd() - 0.5) * 0.8);
    g.add(puff);
  }
  return g;
}

export function createWeatherFx(scene) {
  const root = new THREE.Group();
  scene.add(root);
  let clouds = [];
  let rain = null;
  let snow = null;
  let state = { typ: 'klar', wind: 5, wolken: 0 };
  let span = { x0: -20, x1: 40 };
  let flash = 0;
  let nextFlash = 0;

  const clear = () => {
    root.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) [].concat(o.material).forEach((m) => m.dispose?.());
    });
    root.clear();
    clouds = [];
    rain = null;
    snow = null;
  };

  const particles = (count, color, size) => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = span.x0 + Math.random() * (span.x1 - span.x0);
      pos[i * 3 + 1] = Math.random() * 22;
      pos[i * 3 + 2] = -14 + Math.random() * 30;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.8, depthWrite: false }));
  };

  return {
    set(weather, bounds, lowPower) {
      state = weather || { typ: 'klar', wind: 5, wolken: 20 };
      span = { x0: bounds.x0 - 15, x1: bounds.x1 + 15 };
      clear();
      const rnd = rand(17);
      const cover = state.typ === 'klar' ? Math.min(state.wolken, 25) : state.wolken;
      const count = Math.round((cover / 100) * (lowPower ? 6 : 10));
      for (let i = 0; i < count; i++) {
        const c = makeCloud(rnd);
        c.position.set(span.x0 + rnd() * (span.x1 - span.x0), 11 + rnd() * 5, -10 + rnd() * 14);
        const dark = state.typ === 'regen' || state.typ === 'gewitter' ? 0x8a929a : state.typ === 'schnee' ? 0xe4e8ec : 0xffffff;
        c.children.forEach((p) => p.material.color.set(dark));
        root.add(c);
        clouds.push(c);
      }
      if (state.typ === 'regen' || state.typ === 'gewitter') {
        rain = particles(lowPower ? 600 : 1200, 0xaecbff, 0.08);
        root.add(rain);
      }
      if (state.typ === 'schnee') {
        snow = particles(lowPower ? 400 : 800, 0xffffff, 0.16);
        root.add(snow);
      }
    },
    fogDensity() {
      return state.typ === 'nebel' ? { near: 4, far: 30 } : state.typ === 'regen' || state.typ === 'schnee' ? { near: 14, far: 70 } : null;
    },
    tick(dt, t) {
      const wind = Math.max(0.3, (state.wind || 5) / 10);
      for (const c of clouds) {
        c.position.x += dt * wind * 0.6;
        if (c.position.x > span.x1) c.position.x = span.x0;
      }
      for (const [pts, speed, drift] of [[rain, 18, 0.2], [snow, 1.4, 0.6]]) {
        if (!pts) continue;
        const a = pts.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) {
          let y = a.getY(i) - dt * speed;
          let x = a.getX(i) + dt * wind * drift + (pts === snow ? Math.sin(t / 700 + i) * dt * 0.3 : 0);
          if (y < 0) y = 22;
          if (x > span.x1) x = span.x0;
          a.setXY(i, x, y);
        }
        a.needsUpdate = true;
      }
      if (state.typ === 'gewitter') {
        if (t > nextFlash) {
          flash = 1;
          nextFlash = t + 2500 + Math.random() * 6000;
        }
        flash = Math.max(0, flash - dt * 4);
      } else flash = 0;
      return flash;
    },
    dispose: clear
  };
}

export function decorateClimber(group, gear, { opacity = 1 } = {}) {
  const ids = new Set(gear.map((g) => g.id));
  const mats = (color, emissive = 0) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: emissive ? 0.9 : 0, flatShading: true, transparent: opacity < 1, opacity });
  const pack = group.children[2];
  pack.visible = ids.has('rucksack');
  if (ids.has('kopflampe')) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), mats(0xfff3c4, 0xfff3c4));
    lamp.position.set(0, 0.68, 0.11);
    lamp.name = 'lamp';
    group.add(lamp);
  }
  if (ids.has('eispickel')) {
    const axe = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 4), mats(0x8a5a33));
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), mats(0xcfd6dc));
    head.position.y = 0.2;
    axe.add(shaft, head);
    axe.position.set(0.18, 0.35, 0.05);
    axe.rotation.z = -0.4;
    group.add(axe);
  }
  if (ids.has('seil')) {
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 4, 10), mats(0xd94f2b));
    rope.position.set(-0.13, 0.36, -0.05);
    rope.rotation.y = Math.PI / 2;
    group.add(rope);
  }
  if (ids.has('goldhelm')) {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mats(0xc9a24a, 0x6b5320));
    helm.position.y = 0.68;
    group.add(helm);
  }
  return group;
}
