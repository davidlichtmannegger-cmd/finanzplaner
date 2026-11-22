import { buildRoute, hutsAlong, impulseSum } from '../logic/mountain.js';
import { upcoming } from '../logic/schedule.js';
import { addDays } from '../logic/dates.js';
import { esc, euro, shortDate } from '../ui/format.js';

export function createMountain({ reduceMotion }) {
  const card = document.createElement('div');
  card.className = 'mountain-card';
  card.innerHTML = `
    <div class="mountain-canvas"><div class="mountain-loading">Berg wird aufgebaut …</div></div>
    <div class="mountain-hud">
      <div class="mountain-info"></div>
      <div class="mountain-buttons"><button class="mtn-btn" data-mtn="center" aria-label="Zum Bergsteiger">◎</button><button class="mtn-btn" data-mtn="full" aria-label="Vollbild">⤢</button></div>
    </div>`;
  const canvasHost = card.querySelector('.mountain-canvas');
  const info = card.querySelector('.mountain-info');
  let scene = null;
  let loading = null;
  let pending = null;
  let wantActive = false;
  let failed = false;

  ['touchstart', 'touchmove', 'touchend'].forEach((type) => canvasHost.addEventListener(type, (e) => e.stopPropagation(), { passive: true }));

  const ensure = () => {
    if (scene || loading || failed) return loading;
    loading = import('./scene.js')
      .then(({ createMountainScene }) => {
        scene = createMountainScene(canvasHost, { reduceMotion });
        canvasHost.querySelector('.mountain-loading')?.remove();
        if (pending) apply(pending);
        scene.setActive(wantActive);
      })
      .catch((err) => {
        failed = true;
        console.error(err);
        canvasHost.querySelector('.mountain-loading').textContent = '3D wird auf diesem Gerät nicht unterstützt';
      });
    return loading;
  };

  const apply = (data) => {
    pending = data;
    if (!scene) return;
    scene.update(data);
  };

  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mtn]');
    if (!b) return;
    if (b.dataset.mtn === 'center') scene?.recenter();
    if (b.dataset.mtn === 'full') {
      const full = card.classList.toggle('full');
      b.textContent = full ? '✕' : '⤢';
      if (full) document.getElementById('app').append(card);
      else (lastSlot?.isConnected ? lastSlot : document.getElementById('mountain-slot'))?.append(card);
      requestAnimationFrame(() => scene?.resize());
    }
  });

  let lastSlot = null;

  return {
    el: card,
    mount(slot) {
      if (!slot) return;
      lastSlot = slot;
      if (!card.classList.contains('full') && card.parentElement !== slot) slot.append(card);
      ensure();
    },
    update(snap, d, todayYmd) {
      const open = d.plan.map((g) => ({ id: g.id, name: g.name, kosten: g.kosten, farbe: g.farbe }));
      const route = buildRoute(open, { reserve: d.reserve.ziel });
      const transfers = upcoming(snap.savingsRules || [], addDays(todayYmd, 1), addDays(todayYmd, 200));
      const huts = hutsAlong(route, d.balance, transfers, 6);
      const ghostMoney = d.balance + impulseSum(snap.expenses);
      apply({ route, money: d.balance, ghostMoney, huts });
      const next = huts[0];
      const lost = ghostMoney - d.balance;
      const goal = d.nextGoal;
      info.innerHTML = goal
        ? `<b>${esc(goal.name)}</b><span>${Math.round(goal.fortschritt * 100)} % des Aufstiegs${next ? ` · nächste Hütte ${esc(shortDate(next.datum))} (+${euro(next.betrag)})` : ''}</span>${lost >= 1 ? `<span class="ghost-note">👻 Ohne Impulskäufe wärst du ${euro(lost)} weiter oben</span>` : ''}`
        : '<b>Alle Gipfel bestiegen</b><span>Leg ein neues Ziel an für den nächsten Berg.</span>';
    },
    setActive(on) {
      wantActive = on;
      if (on) ensure();
      scene?.setActive(on);
    }
  };
}
