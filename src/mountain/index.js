import { buildRoute, hutsAlong, impulseSum } from '../logic/mountain.js';
import { upcoming } from '../logic/schedule.js';
import { addDays } from '../logic/dates.js';
import { season, gearFor, nextGear, WEATHER_ICON, WEATHER_LABEL, SEASON_LABEL } from '../logic/weather.js';
import { esc, euro, shortDate } from '../ui/format.js';
import { fetchWeather } from './weather-service.js';
import { createAmbience } from './sound.js';

export function createMountain({ reduceMotion }) {
  const card = document.createElement('div');
  card.className = 'mountain-card';
  card.innerHTML = `
    <div class="mountain-canvas"><div class="mountain-loading">Berg wird aufgebaut …</div></div>
    <div class="mountain-top"><span class="mountain-weather"></span><span class="mountain-gear"></span></div>
    <div class="mountain-hud">
      <div class="mountain-info"></div>
      <div class="mountain-buttons"><button class="mtn-btn" data-mtn="sound" aria-label="Bergsounds">🔇</button><button class="mtn-btn" data-mtn="center" aria-label="Zum Bergsteiger">◎</button><button class="mtn-btn" data-mtn="full" aria-label="Vollbild">⤢</button></div>
    </div>`;
  const canvasHost = card.querySelector('.mountain-canvas');
  const info = card.querySelector('.mountain-info');
  const weatherEl = card.querySelector('.mountain-weather');
  const gearEl = card.querySelector('.mountain-gear');
  const soundBtn = card.querySelector('[data-mtn="sound"]');
  const ambience = createAmbience();
  let scene = null;
  let loading = null;
  let pending = null;
  let wantActive = false;
  let failed = false;
  let lastSlot = null;
  let weather = null;
  let weatherFor = '';
  let soundsWanted = false;
  let onSoundToggle = null;

  ['touchstart', 'touchmove', 'touchend'].forEach((type) => canvasHost.addEventListener(type, (e) => e.stopPropagation(), { passive: true }));

  const ensure = () => {
    if (scene || loading || failed) return loading;
    loading = import('./scene.js')
      .then(({ createMountainScene }) => {
        scene = createMountainScene(canvasHost, { reduceMotion });
        canvasHost.querySelector('.mountain-loading')?.remove();
        if (pending) scene.update(pending);
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
    scene?.update(data);
  };

  const syncSound = () => {
    const on = soundsWanted && wantActive;
    soundBtn.textContent = soundsWanted ? '🔊' : '🔇';
    if (on && !ambience.running) ambience.start();
    if (!on && ambience.running) ambience.stop();
    const h = new Date().getHours();
    ambience.setMood({ night: h < 6 || h >= 21, wind: weather?.wind ?? 10, rain: weather?.typ === 'regen' || weather?.typ === 'gewitter' });
  };

  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mtn]');
    if (!b) return;
    if (b.dataset.mtn === 'center') scene?.recenter();
    if (b.dataset.mtn === 'sound') {
      soundsWanted = !soundsWanted;
      onSoundToggle?.(soundsWanted);
      syncSound();
    }
    if (b.dataset.mtn === 'full') {
      const full = card.classList.toggle('full');
      b.textContent = full ? '✕' : '⤢';
      if (full) document.getElementById('app').append(card);
      else (lastSlot?.isConnected ? lastSlot : document.getElementById('mountain-slot'))?.append(card);
      requestAnimationFrame(() => scene?.resize());
    }
  });

  const loadWeather = (place, rerender) => {
    const key = place ? `${place.lat},${place.lon}` : '';
    if (!place) {
      weather = null;
      weatherFor = '';
      return;
    }
    if (key === weatherFor) return;
    weatherFor = key;
    fetchWeather(place)
      .then((w) => {
        weather = w;
        rerender();
      })
      .catch(() => {
        weatherFor = '';
      });
  };

  let lastArgs = null;
  const render = () => lastArgs && update(...lastArgs);

  function update(snap, d, todayYmd) {
    lastArgs = [snap, d, todayYmd];
    const open = d.plan.map((g) => ({ id: g.id, name: g.name, kosten: g.kosten, farbe: g.farbe }));
    const route = buildRoute(open, { reserve: d.reserve.ziel });
    const transfers = upcoming(snap.savingsRules || [], addDays(todayYmd, 1), addDays(todayYmd, 200));
    const huts = hutsAlong(route, d.balance, transfers, 6);
    const ghostMoney = d.balance + impulseSum(snap.expenses);
    const currentSeason = season(new Date().getMonth());
    const gear = gearFor(d.level.level);
    loadWeather(snap.profile?.wetterOrt, render);
    soundsWanted = snap.profile?.settings?.bergsounds === true;
    syncSound();
    apply({ route, money: d.balance, ghostMoney, huts, season: currentSeason, weather, gear });
    const next = huts[0];
    const lost = ghostMoney - d.balance;
    const goal = d.nextGoal;
    info.innerHTML = goal
      ? `<b>${esc(goal.name)}</b><span>${Math.round(goal.fortschritt * 100)} % des Aufstiegs${next ? ` · nächste Hütte ${esc(shortDate(next.datum))} (+${euro(next.betrag)})` : ''}</span>${lost >= 1 ? `<span class="ghost-note">👻 Ohne Impulskäufe wärst du ${euro(lost)} weiter oben</span>` : ''}`
      : '<b>Alle Gipfel bestiegen</b><span>Leg ein neues Ziel an für den nächsten Berg.</span>';
    weatherEl.textContent = weather ? `${WEATHER_ICON[weather.typ]} ${weather.temp}° ${WEATHER_LABEL[weather.typ]} · ${SEASON_LABEL[currentSeason]}` : SEASON_LABEL[currentSeason];
    const ng = nextGear(d.level.level);
    gearEl.textContent = `${gear.map((g) => g.icon).join(' ')}${ng ? `${gear.length ? ' · ' : ''}${ng.icon} ab Level ${ng.level}` : ''}`;
  }

  return {
    el: card,
    mount(slot) {
      if (!slot) return;
      lastSlot = slot;
      if (!card.classList.contains('full') && card.parentElement !== slot) slot.append(card);
      ensure();
    },
    update,
    onSoundToggle(fn) {
      onSoundToggle = fn;
    },
    slip(amount) {
      scene?.slip(amount);
    },
    celebrate(goalId) {
      return scene?.celebrate(goalId) || false;
    },
    setActive(on) {
      wantActive = on;
      if (on) ensure();
      scene?.setActive(on);
      syncSound();
    }
  };
}
