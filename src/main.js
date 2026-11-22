import './styles/tokens.css';
import './styles/app.css';
import './styles/components.css';
import './styles/rewards.css';
import './styles/goals.css';
import './styles/tools.css';
import './styles/mountain.css';
import { createNav } from './ui/nav.js';
import { createSheet, createToast } from './ui/sheet.js';
import { formSheet } from './ui/forms.js';
import { enableReorder } from './ui/reorder.js';
import { esc, euro, workMinutes, parseAmount, longDate } from './ui/format.js';
import { calendarMonth, whatIf } from './logic/tools.js';
import * as toolViews from './tool-views.js';
import { createMountain } from './mountain/index.js';
import { makeGoalImages } from './ui/image.js';
import { connectFirebase, isConfigured } from './firebase.js';
import { createAuth, authMessage } from './auth.js';
import { localBackend, cloudBackend, readLocal, newId, COLLECTIONS } from './data/store.js';
import { defaultData, CATEGORIES, GOAL_COLORS } from './data/defaults.js';
import { derive } from './logic/derive.js';
import { dueBookings } from './logic/schedule.js';
import { today, ymd } from './logic/dates.js';
import { XP, ROASTS, PRAISE, randomOf, impulseDelayDays } from './logic/rewards.js';
import { createFx } from './ui/fx.js';
import * as views from './views.js';

const $ = (selector) => document.querySelector(selector);
const pagesEl = $('#pages');
const loginHost = $('#login-host');
const toast = createToast($('#toast'));
const sheet = createSheet({ sheet: $('#sheet'), scrim: $('#scrim'), body: $('#sheet-body') });
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

let backend = null;
let unsubscribe = null;
let snap = null;
let derived = null;
let user = null;
let auth = null;
let booking = false;
let lastLevel = null;
const painted = new Set();
const lastCount = new Map();
const savingAchievements = new Set();

const mountain = createMountain({ reduceMotion });
document.addEventListener('visibilitychange', () => mountain.setActive(nav.current === 2 && !document.hidden));
mountain.onSoundToggle((on) => backend?.setProfile({ settings: { ...(snap?.profile?.settings || {}), bergsounds: on } }));

function openWeatherPlace() {
  const el = document.createElement('div');
  el.className = 'tool-sheet';
  const current = snap.profile?.wetterOrt;
  el.innerHTML = `
    <div class="label sheet-title">Ort fürs Bergwetter</div>
    <p class="hint" style="text-align:center;margin-top:0">Das Wetter am Berg folgt dem echten Wetter an deinem Ort (Open-Meteo, ohne Konto). Gespeichert wird nur der Ort auf etwa 1 km gerundet.${current ? ` Aktuell: <b>${esc(current.name)}</b>.` : ''}</p>
    <button class="cta" data-place="geo">📍 Meinen Standort verwenden</button>
    <form class="wish-new" data-place-search><input class="input" name="q" placeholder="Oder Ort suchen, z. B. Frankfurt" autocomplete="off"><button class="ghost" type="submit">Suchen</button></form>
    <div class="card list" data-place-results hidden></div>
    ${current ? '<button class="ghost wide danger" data-place="off">Bergwetter ausschalten</button>' : ''}
    <div class="form-error" data-place-msg></div>`;
  const msg = el.querySelector('[data-place-msg]');
  const save = async (place) => {
    await backend.setProfile({ wetterOrt: place });
    sheet.close();
    toast(place ? `Bergwetter für ${place.name}` : 'Bergwetter aus');
  };
  el.querySelector('[data-place="geo"]').addEventListener('click', async () => {
    msg.textContent = 'Standort wird abgefragt …';
    try {
      const { currentPlace } = await import('./mountain/weather-service.js');
      await save(await currentPlace());
    } catch (err) {
      msg.textContent = err.message;
    }
  });
  el.querySelector('[data-place="off"]')?.addEventListener('click', () => save(null));
  el.querySelector('[data-place-search]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = e.target.q.value.trim();
    if (q.length < 2) return;
    const box = el.querySelector('[data-place-results]');
    try {
      const { searchPlace } = await import('./mountain/weather-service.js');
      const hits = await searchPlace(q);
      box.hidden = false;
      box.innerHTML = hits.length ? hits.map((h, i) => `<button class="row" data-hit="${i}"><div class="t"><b>${esc(h.name)}</b></div></button>`).join('') : '<div class="hint" style="padding:8px">Nichts gefunden</div>';
      box.querySelectorAll('[data-hit]').forEach((b) => b.addEventListener('click', () => save(hits[Number(b.dataset.hit)])));
    } catch (err) {
      msg.textContent = err.message;
    }
  });
  sheet.open(el);
}

const fx = createFx({ canvas: $('#fx'), host: $('#app'), reduceMotion, soundsOn: () => snap?.profile?.settings?.sounds === true });

const visitedKey = () => `finanzplaner:ziele-besucht:${today()}`;
const visitedGoals = () => {
  try {
    return localStorage.getItem(visitedKey()) === '1';
  } catch {
    return false;
  }
};

const nav = createNav({
  pages: pagesEl,
  tabs: [...document.querySelectorAll('.tab')],
  onChange: (i) => {
    mountain.setActive(i === 2 && !document.hidden);
    if (i !== 2) return;
    animate($('#page-goals'), 'goals', true);
    if (!visitedGoals()) {
      try {
        localStorage.setItem(visitedKey(), '1');
      } catch {}
      setTimeout(render, 500);
    }
  }
});

const settings = () => snap?.profile?.settings || {};

async function award(id, betrag, grund) {
  await backend.set('xpLog', id, { datum: today(), betrag, grund, erstellt: Date.now() });
}

function celebrate() {
  if (!derived) return;
  const level = derived.level.level;
  if (lastLevel !== null && level > lastLevel) {
    fx.fireworks(5);
    fx.sound('level');
    toast(`Level ${level}: ${derived.level.name}! +5 € Taschengeld`);
  }
  lastLevel = level;
  const fresh = derived.achievements.filter((a) => a.unlocked && !a.stored && !savingAchievements.has(a.id));
  if (!fresh.length) return;
  fresh.forEach((a) => savingAchievements.add(a.id));
  Promise.all(fresh.map((a) => backend.set('achievements', a.id, { freigeschaltetAm: today() }))).finally(() => fresh.forEach((a) => savingAchievements.delete(a.id)));
  setTimeout(() => {
    fx.confetti(null, 120);
    fx.sound('win');
    toast(fresh.length === 1 ? `Erfolg freigeschaltet: ${fresh[0].icon} ${fresh[0].label}` : `${fresh.length} Erfolge freigeschaltet!`);
  }, 600);
}

const PAGES = [
  ['overview', '#page-overview'],
  ['expenses', '#page-expenses'],
  ['goals', '#page-goals'],
  ['profile', '#page-profile']
];

function countUp(el, key) {
  const to = Number(el.dataset.count);
  const suffix = el.dataset.suffix || '';
  const from = lastCount.has(key) ? lastCount.get(key) : 0;
  lastCount.set(key, to);
  const format = (v) => `${Math.round(v).toLocaleString('de-DE')}${suffix}`;
  if (reduceMotion.matches || from === to) {
    el.innerHTML = format(to);
    return;
  }
  let t0 = null;
  const step = (t) => {
    t0 ??= t;
    const p = Math.min(1, (t - t0) / 1100);
    el.innerHTML = format(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function animate(root, key, force = false) {
  const first = !painted.has(key) || force;
  painted.add(key);
  root.querySelectorAll('[data-count]').forEach((el, i) => countUp(el, `${key}:${i}`));
  const apply = () => {
    root.querySelectorAll('.bar i[data-w]').forEach((b) => (b.style.width = `${b.dataset.w}%`));
    root.querySelectorAll('.ring-fill[data-offset]').forEach((c) => (c.style.strokeDashoffset = c.dataset.offset));
  };
  if (first && !reduceMotion.matches) requestAnimationFrame(() => requestAnimationFrame(apply));
  else {
    root.classList.add('instant');
    apply();
    requestAnimationFrame(() => root.classList.remove('instant'));
  }
}

function render() {
  if (!snap?.ready || !snap.profile) return;
  derived = derive(snap, today(), { hour: new Date().getHours(), visitedGoals: visitedGoals() });
  const ctx = { mode: backend.mode, user, syncPending: snap.syncPending };
  for (const [name, sel] of PAGES) {
    const el = $(sel);
    const top = el.scrollTop;
    el.innerHTML = views[name](snap, derived, ctx);
    el.scrollTop = top;
    animate(el, name);
  }
  const list = $('#goal-list');
  if (list) enableReorder(list, { itemSelector: '.goal', handleSelector: '.handle', onDrop: reorderGoals });
  autoBook();
  celebrate();
  celebrateReady();
  mountain.mount($('#mountain-slot'));
  mountain.update(snap, derived, today());
  mountain.setActive(nav.current === 2 && !document.hidden);
}

async function autoBook() {
  if (booking) return;
  const due = dueBookings(snap.savingsRules, snap.ledger, snap.profile.startDatum, today());
  if (!due.length) return;
  booking = true;
  try {
    await backend.setMany('ledger', due.map((e) => ({ ...e, erstellt: Date.now() })));
    toast(`${due.length === 1 ? 'Dauerauftrag' : `${due.length} Daueraufträge`} gebucht · +${euro(due.reduce((s, e) => s + e.betrag, 0))}`);
  } finally {
    booking = false;
  }
}

function attach(next) {
  unsubscribe?.();
  backend?.close?.();
  backend = next;
  painted.clear();
  lastLevel = null;
  unsubscribe = backend.subscribe((s) => {
    snap = s;
    render();
  });
}

const guessCategory = (name) => {
  const n = (name || '').toLowerCase();
  if (/rewe|lidl|aldi|edeka|netto|penny|kaufland|bäcker|baecker/.test(n)) return 'Lebensmittel';
  if (/zigarett|tabak|kippe/.test(n)) return 'Tabak';
  if (/döner|doener|mc|burger|pizza|kebab|imbiss|kfc/.test(n)) return 'Essen unterwegs';
  if (/steam|playstation|psn|xbox|kino|netflix|spotify/.test(n)) return 'Freizeit';
  if (/amazon|media ?markt|saturn/.test(n)) return 'Technik';
  return 'Sonstiges';
};

const expenseXp = (doc) => (doc.taschengeld ? 0 : doc.impuls ? XP.impulse : XP.expense);

function openExpense(existing = null, preset = {}) {
  const values = existing || { datum: today(), impuls: false, ...preset, kategorie: preset.kategorie || guessCategory(preset.haendler) };
  const merchants = [...new Set((snap.expenses || []).map((e) => e.haendler).filter(Boolean))].slice(0, 30);
  const freeAllowance = derived.taschengeld.frei + (existing?.taschengeld ? existing.betrag : 0);
  const fields = [
    { key: 'betrag', label: 'Betrag', type: 'amount', big: true, required: true },
    { key: 'haendler', label: 'Wofür?', placeholder: 'z. B. Rewe', list: merchants, required: true },
    { key: 'kategorie', label: 'Kategorie', type: 'select', options: CATEGORIES },
    { key: 'datum', label: 'Datum', type: 'date' },
    { key: 'art', label: 'Art', type: 'segments', options: [{ value: 'noetig', label: 'Nötig' }, { value: 'impuls', label: 'Impulskauf' }] }
  ];
  if (freeAllowance > 0) fields.push({ key: 'taschengeld', label: `Aus Taschengeld bezahlen (${euro(freeAllowance, { cents: true })} frei)`, type: 'checkbox' });
  const form = formSheet({
    title: existing ? 'Ausgabe bearbeiten' : 'Neue Ausgabe',
    fields,
    values: { ...values, art: values.impuls ? 'impuls' : 'noetig' },
    submitLabel: existing ? 'Speichern' : 'Eintragen',
    extraActions: existing ? [{ label: 'Löschen', danger: true, onClick: () => removeExpense(existing) }] : [],
    onSubmit: async (data) => {
      const useAllowance = !!data.taschengeld && data.betrag <= freeAllowance;
      if (data.taschengeld && !useAllowance) {
        form.querySelector('.form-error').textContent = `Nur ${euro(freeAllowance, { cents: true })} Taschengeld frei`;
        return;
      }
      const id = existing?.id || newId();
      const doc = {
        betrag: data.betrag,
        haendler: data.haendler,
        kategorie: data.kategorie,
        datum: data.datum || today(),
        impuls: data.art === 'impuls',
        taschengeld: useAllowance,
        quelle: existing?.quelle || 'manuell',
        erstellt: existing?.erstellt || Date.now()
      };
      sheet.close();
      await backend.set('expenses', id, doc);
      const xp = expenseXp(doc);
      if (!existing || expenseXp(existing) !== xp) await award(`exp-${id}`, xp, doc.impuls ? 'Impulskauf' : 'Ausgabe eingetragen');
      if (existing) {
        toast('Gespeichert');
        return;
      }
      nav.go(1);
      if (doc.taschengeld) {
        fx.sound('xp');
        toast(`Aus Taschengeld bezahlt · gönn dir`);
      } else if (doc.impuls) {
        fx.sound('fail');
        fx.buzz([20, 40, 20]);
        mountain.slip(doc.betrag);
        const delay = impulseDelayDays(doc.betrag, derived.savingsSum);
        toast(settings().roast !== false ? `${randomOf(ROASTS)} ${XP.label(XP.impulse)} XP` : `Impulskauf · ${XP.label(XP.impulse)} XP · Ziel ${delay.toFixed(1).replace('.', ',')} Tage später`);
      } else {
        fx.confetti($('#plus'), 40);
        fx.sound('xp');
        if (Math.random() < XP.bonusChance) {
          await award(`bonus-${id}`, XP.bonus, 'Glücksbonus');
          setTimeout(() => {
            fx.confetti(null, 140);
            fx.sound('win');
            toast(`🍀 Glücksbonus! +${XP.bonus} XP`);
          }, 700);
        } else toast(`Eingetragen · +${XP.expense} XP · ${workMinutes(doc.betrag)} Min. Arbeit`);
      }
    }
  });
  const nameInput = form.querySelector('[data-key="haendler"]');
  const catSelect = form.querySelector('[data-key="kategorie"]');
  nameInput.addEventListener('change', () => {
    if (!existing) catSelect.value = guessCategory(nameInput.value);
  });
  const impact = document.createElement('div');
  impact.className = 'impact';
  form.querySelector('.segs').after(impact);
  const updateImpact = () => {
    const { betrag, art, taschengeld: fromAllowance } = form.read();
    if (!(betrag > 0)) return (impact.innerHTML = '');
    const goal = derived.nextGoal;
    const delay = impulseDelayDays(betrag, derived.savingsSum);
    const delayText = delay < 1 ? `${Math.max(1, Math.round(delay * 24))} Std.` : `${delay.toFixed(1).replace('.', ',')} Tage`;
    impact.innerHTML =
      art === 'impuls' && !fromAllowance
        ? `= ${workMinutes(betrag)} Min. Arbeit · ${goal ? `${goal.name.split(' ')[0]} rückt` : 'Ziel rückt'} <b>${delayText}</b> nach hinten · ${XP.label(XP.impulse)} XP`
        : `= ${workMinutes(betrag)} Min. Arbeit${fromAllowance ? ' · aus Taschengeld, ohne XP-Abzug' : ` · +${XP.expense} XP`}`;
  };
  form.addEventListener('input', updateImpact);
  form.addEventListener('change', updateImpact);
  updateImpact();
  sheet.open(form);
}

async function removeExpense(e) {
  sheet.close();
  await backend.remove('expenses', e.id);
  await backend.remove('xpLog', `exp-${e.id}`);
  await backend.remove('xpLog', `bonus-${e.id}`);
  toast(`${e.haendler || 'Ausgabe'} gelöscht`);
}

async function claim(button) {
  const id = button.dataset.claim;
  const xp = Number(button.dataset.xp);
  if (!id || (snap.xpLog || []).some((e) => e.id === id)) return;
  button.disabled = true;
  fx.confetti(button, id.startsWith('week-') ? 120 : 60);
  fx.sound(id.startsWith('week-') ? 'win' : 'xp');
  fx.buzz(10);
  await award(id, xp, id.startsWith('week-') ? 'Wochen-Challenge' : 'Quest');
  toast(`+${xp} XP · ${randomOf(PRAISE)}`);
}

async function confirmTransfer(button) {
  const entry = snap.ledger.find((e) => e.id === button.dataset.id);
  if (!entry) return;
  const yes = button.dataset.confirm === 'yes';
  const card = button.closest('.confirm');
  if (yes) {
    fx.confetti(button, 110);
    fx.sound('win');
    await backend.update('ledger', entry.id, { bestaetigt: true });
    await award(`transfer-${entry.id}`, XP.transferYes, 'Überweisung bestätigt');
    toast(`Stark! +${XP.transferYes} XP · ${euro(entry.betrag)} im Topf`);
  } else {
    card?.classList.add('leaving');
    await backend.update('ledger', entry.id, { uebersprungen: true, geplant: entry.betrag, betrag: 0 });
    await award(`transfer-${entry.id}`, XP.transferNo, 'Ehrlich geantwortet');
    toast(`Danke für die Ehrlichkeit · +${XP.transferNo} XP. Hol sie nach, wenn's geht.`);
  }
}

const bigImages = new Map();

async function loadBigImage(goalId) {
  if (bigImages.has(goalId)) return bigImages.get(goalId);
  const doc = await backend.getOne('goalImages', goalId).catch(() => null);
  bigImages.set(goalId, doc?.bild || null);
  return doc?.bild || null;
}

function imagePicker(goal, progress) {
  const box = document.createElement('div');
  box.className = 'image-pick';
  let pending;
  const paint = (src) => {
    box.innerHTML = src
      ? `<div class="image-preview"><img src="${src}" alt="" style="filter:grayscale(${Math.round(100 - progress * 100)}%)"><span>${Math.round(progress * 100)} % farbig</span></div>`
      : '<div class="image-empty">Noch kein Bild – es wird mit deinem Sparfortschritt von grau zu farbig.</div>';
    box.insertAdjacentHTML(
      'beforeend',
      `<div class="image-actions"><label class="ghost file-btn">${src ? 'Bild ändern' : 'Bild hinzufügen'}<input type="file" accept="image/*" hidden></label>${src ? '<button type="button" class="ghost danger" data-remove-image>Entfernen</button>' : ''}</div><div class="form-error image-error"></div>`
    );
    box.querySelector('input[type=file]').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      box.querySelector('.image-error').textContent = 'Bild wird verkleinert …';
      try {
        pending = await makeGoalImages(file);
        paint(pending.bild);
      } catch (err) {
        box.querySelector('.image-error').textContent = err.message || 'Bild konnte nicht gelesen werden';
      }
    });
    box.querySelector('[data-remove-image]')?.addEventListener('click', () => {
      pending = null;
      paint(null);
    });
  };
  paint(goal?.bildThumb || null);
  if (goal?.bildThumb) loadBigImage(goal.id).then((big) => big && pending === undefined && paint(big));
  return { el: box, result: () => pending };
}

async function saveGoalImage(id, picked) {
  if (picked === undefined) return {};
  if (picked === null) {
    bigImages.delete(id);
    await backend.remove('goalImages', id);
    return { bildThumb: null };
  }
  bigImages.set(id, picked.bild);
  await backend.set('goalImages', id, { bild: picked.bild });
  return { bildThumb: picked.thumb };
}

function openGoal(goal = null) {
  const open = (snap.goals || []).filter((g) => !g.erreichtAm);
  const planned = derived.plan.find((g) => g.id === goal?.id);
  const actions = [];
  if (goal && !goal.erreichtAm) actions.push({ label: 'Als gekauft markieren', onClick: () => markBought(goal) });
  if (goal?.erreichtAm) actions.push({ label: 'Kauf rückgängig', onClick: () => undoBought(goal) });
  if (goal) actions.push({ label: 'Ziel löschen', danger: true, onClick: () => removeGoal(goal) });
  const picker = imagePicker(goal, goal?.erreichtAm ? 1 : planned?.fortschritt || 0);
  const form = formSheet({
    title: goal ? 'Ziel bearbeiten' : 'Neues Ziel',
    fields: [
      { key: 'name', label: 'Name', required: true, placeholder: 'z. B. PS5 Pro + GTA 6' },
      { key: 'kosten', label: 'Kosten', type: 'amount', required: true },
      { key: 'fruehestens', label: 'Nicht vor', type: 'date', hint: 'optional, z. B. Erscheinungstermin' },
      { key: 'farbe', label: 'Farbe', type: 'swatches', options: GOAL_COLORS }
    ],
    values: goal || { farbe: GOAL_COLORS[open.length % GOAL_COLORS.length] },
    extraActions: actions,
    onSubmit: async (data) => {
      const id = goal?.id || newId();
      const base = { name: data.name, kosten: data.kosten, fruehestens: data.fruehestens || null, farbe: data.farbe };
      sheet.close();
      const image = await saveGoalImage(id, picker.result());
      if (goal) await backend.update('goals', id, { ...base, ...image, ...(goal.kosten !== data.kosten ? { bereitGefeiert: false } : {}) });
      else await backend.set('goals', id, { ...base, ...image, reihenfolge: Math.max(0, ...open.map((g) => g.reihenfolge || 0)) + 1 });
      toast(goal ? 'Ziel gespeichert' : 'Ziel angelegt – Termin ist berechnet');
    }
  });
  form.querySelector('.field').after(picker.el);
  sheet.open(form);
}

function reveal(goal, src) {
  const host = $('#reveal');
  host.innerHTML = `
    <div class="reveal-card">
      <div class="reveal-label">Gipfel erreicht</div>
      ${src ? `<img class="reveal-img" src="${src}" alt="">` : `<div class="reveal-img reveal-color" style="background:${goal.farbe || 'var(--gold)'}">⛰</div>`}
      <h2>${esc(goal.name)}</h2>
      <p class="sub">${euro(goal.kosten)} zusammengespart – das Bild wandert in deine Trophäensammlung.</p>
      <button class="cta" data-close-reveal>Weiter</button>
    </div>`;
  host.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => host.classList.add('show')));
  host.querySelector('[data-close-reveal]').addEventListener('click', () => {
    host.classList.remove('show');
    setTimeout(() => {
      host.hidden = true;
      host.innerHTML = '';
    }, 300);
  });
  setTimeout(() => {
    if (goal.kosten > 100) fx.fireworks(6);
    fx.confetti(null, 160);
    fx.sound('level');
  }, 400);
}

async function markBought(goal) {
  sheet.close();
  const src = goal.bildThumb ? (await loadBigImage(goal.id)) || goal.bildThumb : null;
  const planned = derived.plan.find((g) => g.id === goal.id);
  const fromPot = Math.round((planned ? planned.zugeteilt : goal.kosten) * 100) / 100;
  reveal(goal, src);
  await backend.set('ledger', `kauf-${goal.id}`, { datum: today(), typ: 'entnahme', betrag: fromPot, goalId: goal.id, erstellt: Date.now() });
  if (fromPot < goal.kosten) setTimeout(() => toast(`Aus dem Spar-Topf: ${euro(fromPot)} – den Rest hast du anders bezahlt`), 2600);
  await backend.update('goals', goal.id, { erreichtAm: today() });
  await backend.remove('goalImages', goal.id);
  bigImages.delete(goal.id);
}

async function undoBought(goal) {
  sheet.close();
  await backend.remove('ledger', `kauf-${goal.id}`);
  await backend.update('goals', goal.id, { erreichtAm: null });
  toast('Kauf zurückgenommen');
}

async function removeGoal(goal) {
  sheet.close();
  await backend.remove('goals', goal.id);
  await backend.remove('goalImages', goal.id);
  bigImages.delete(goal.id);
  toast(`${goal.name} gelöscht`);
}

const celebratingReady = new Set();

function celebrateReady() {
  const ready = derived.plan.filter((g) => g.fortschritt >= 1 && !g.bereitGefeiert && !celebratingReady.has(g.id));
  if (!ready.length) return;
  ready.forEach((g) => celebratingReady.add(g.id));
  const [first] = ready;
  Promise.all(ready.map((g) => backend.update('goals', g.id, { bereitGefeiert: true }))).finally(() => ready.forEach((g) => celebratingReady.delete(g.id)));
  nav.go(2);
  setTimeout(() => {
    const flying = mountain.celebrate(first.id);
    if (first.kosten > 100) fx.fireworks(flying ? 5 : 3);
    fx.confetti(null, 120);
    fx.sound('win');
    toast(`Gipfel erreicht: ${first.name} ist bezahlbar! Markier es als gekauft, sobald du es hast.`);
  }, 1200);
}

function openReserve(take = false) {
  sheet.open(
    formSheet({
      title: take ? 'Aus dem Notfalltopf nehmen' : 'Notfalltopf',
      fields: [{ key: 'betrag', label: take ? 'Betrag' : 'Höhe des Notfalltopfs (0 = aus)', type: 'amount', big: true }],
      values: { betrag: take ? '' : snap.profile?.notfall || 300 },
      submitLabel: take ? 'Entnehmen' : 'Speichern',
      onSubmit: async (data) => {
        if (take) {
          if (!(data.betrag > 0) || data.betrag > derived.reserve.betrag) {
            sheet.close();
            return toast(`Im Notfalltopf sind ${euro(derived.reserve.betrag, { cents: true })}`);
          }
          sheet.close();
          await backend.set('ledger', newId(), { datum: today(), typ: 'entnahme', betrag: data.betrag, notfall: true, erstellt: Date.now() });
          return toast(`${euro(data.betrag, { cents: true })} entnommen – der Topf füllt sich mit den nächsten Daueraufträgen wieder`);
        }
        sheet.close();
        await backend.setProfile({ notfall: Number.isFinite(data.betrag) ? Math.max(0, data.betrag) : 0 });
        toast(data.betrag > 0 ? `Notfalltopf: ${euro(data.betrag)} – Termine neu berechnet` : 'Notfalltopf ausgeschaltet');
      }
    })
  );
}

async function reorderGoals(ids) {
  const byId = new Map(snap.goals.map((g) => [g.id, g]));
  const docs = ids.map((id, i) => ({ ...byId.get(id), reihenfolge: i + 1 }));
  await backend.setMany('goals', docs);
  toast('Reihenfolge geändert – Termine neu berechnet');
}

const ITEM_FORMS = {
  income: {
    title: 'Einnahme',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'betrag', label: 'Betrag', type: 'amount', required: true },
      { key: 'tagImMonat', label: 'Tag im Monat', type: 'number', min: 1, max: 31, required: true },
      { key: 'aktivAb', label: 'Gilt ab', type: 'date', hint: 'optional' },
      { key: 'aktivBis', label: 'Gilt bis', type: 'date', hint: 'optional' }
    ]
  },
  fixed: {
    title: 'Feste Ausgabe',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'betrag', label: 'Betrag', type: 'amount', required: true },
      { key: 'tagImMonat', label: 'Tag im Monat', type: 'number', min: 1, max: 31, hint: 'optional' },
      { key: 'pausiert', label: 'Pausiert', type: 'checkbox' },
      { key: 'pausiertBis', label: 'Pausiert bis', type: 'date', hint: 'optional, danach läuft es automatisch wieder' }
    ]
  },
  savingsRules: {
    title: 'Dauerauftrag',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'betrag', label: 'Betrag', type: 'amount', required: true },
      { key: 'tagImMonat', label: 'Tag im Monat', type: 'number', min: 1, max: 31, required: true },
      { key: 'aktivAb', label: 'Gilt ab', type: 'date', hint: 'optional' },
      { key: 'aktivBis', label: 'Gilt bis', type: 'date', hint: 'optional' }
    ]
  }
};

function openItem(col, item = null) {
  const conf = ITEM_FORMS[col];
  sheet.open(
    formSheet({
      title: `${conf.title} ${item ? 'bearbeiten' : 'anlegen'}`,
      fields: conf.fields,
      values: item || {},
      extraActions: item
        ? [
            {
              label: 'Löschen',
              danger: true,
              onClick: async () => {
                sheet.close();
                await backend.remove(col, item.id);
                toast(`${item.name} gelöscht`);
              }
            }
          ]
        : [],
      onSubmit: async (data) => {
        sheet.close();
        const doc = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? null]));
        if (item) await backend.update(col, item.id, doc);
        else await backend.set(col, newId(), doc);
        toast('Gespeichert');
      }
    })
  );
}

const endOfMonth = (months) => {
  const d = new Date();
  return ymd(new Date(d.getFullYear(), d.getMonth() + months, 0));
};

function openPause(item) {
  sheet.open(
    formSheet({
      title: `${item.name} pausieren`,
      fields: [{ key: 'dauer', label: 'Wie lange?', type: 'segments', options: [{ value: '1', label: 'Diesen Monat' }, { value: '2', label: '2 Monate' }, { value: '0', label: 'Bis ich es ändere' }] }],
      values: { dauer: '1' },
      submitLabel: 'Pausieren',
      onSubmit: async ({ dauer }) => {
        sheet.close();
        const bis = dauer === '0' ? null : endOfMonth(Number(dauer));
        await backend.update('fixed', item.id, { pausiert: true, pausiertBis: bis });
        toast(`${item.name} pausiert${bis ? ` bis ${longDate(bis)}` : ''} · +${euro(item.betrag)} frei im Monat`);
      }
    })
  );
}

async function award15(id, grund) {
  if ((snap.xpLog || []).some((e) => e.id === id)) return;
  await award(id, 15, grund);
}

async function monthlyCheck(kind) {
  const id = `abgleich-${today().slice(0, 7)}`;
  if (kind === 'ok') {
    await backend.set('ledger', newId(), { datum: today(), typ: 'abgleich', betrag: derived.balance, erstellt: Date.now() });
    await award15(id, 'Monatsabgleich');
    fx.confetti(null, 60);
    fx.sound('xp');
    return toast('Abgeglichen · +15 XP');
  }
  openPotAdjust(() => award15(id, 'Monatsabgleich'));
}

function openRoundUpStep() {
  sheet.open(
    formSheet({
      title: 'Aufrunden auf …',
      fields: [{ key: 'stufe', label: 'Stufe', type: 'segments', options: [{ value: '1', label: 'volle 1 €' }, { value: '5', label: 'volle 5 €' }, { value: '10', label: 'volle 10 €' }] }],
      values: { stufe: String(settings().aufrundenStufe || 1) },
      onSubmit: async ({ stufe }) => {
        sheet.close();
        await backend.setProfile({ settings: { ...settings(), aufrundenStufe: Number(stufe) } });
        toast(`Aufrunden auf volle ${stufe} €`);
      }
    })
  );
}

async function roundUpDone() {
  const betrag = derived.roundUp.betrag;
  if (!(betrag > 0)) return;
  await backend.set('ledger', newId(), { datum: today(), typ: 'einzahlung', betrag, quelle: 'aufrunden', erstellt: Date.now() });
  await backend.setProfile({ aufrundenBis: Date.now() });
  fx.confetti(null, 70);
  fx.sound('win');
  toast(`${euro(betrag, { cents: true })} aus dem Aufrunden-Topf gespart`);
}

let activeTool = null;

function toolSheet(name, renderHtml, bind) {
  const el = document.createElement('div');
  el.className = `tool-sheet tool-${name}`;
  const paint = () => {
    el.innerHTML = renderHtml();
    bind?.(el, paint);
  };
  paint();
  activeTool = { name, paint };
  sheet.open(el);
  return el;
}

function openTool(name) {
  if (name === 'kalender') return openCalendar();
  if (name === 'wuensche') return openWishes();
  if (name === 'wasware') return openWhatIf();
  if (name === 'backup') return openBackup();
}

function openCalendar() {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let selected = today();
  toolSheet(
    'kalender',
    () => toolViews.calendarView(calendarMonth({ year, month, income: snap.income, savingsRules: snap.savingsRules, fixed: snap.fixed, expenses: snap.expenses, plan: derived.plan, todayYmd: today() }), selected),
    (el, paint) => {
      el.querySelectorAll('[data-cal]').forEach((b) =>
        b.addEventListener('click', () => {
          month += Number(b.dataset.cal);
          if (month < 0) (month = 11), year--;
          if (month > 11) (month = 0), year++;
          selected = `${year}-${String(month + 1).padStart(2, '0')}-01`;
          paint();
        })
      );
      el.querySelectorAll('[data-day]').forEach((b) =>
        b.addEventListener('click', () => {
          selected = b.dataset.day;
          paint();
        })
      );
    }
  );
}

function openWishes() {
  toolSheet(
    'wuensche',
    () => toolViews.wishesView(derive(snap, today(), { nowMs: Date.now() })),
    (el, paint) => {
      const form = el.querySelector('[data-wish-new]');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = form.name.value.trim();
        const preis = parseAmount(form.preis.value);
        const link = form.link.value.trim();
        if (!name || !(preis > 0)) {
          form.querySelector('.form-error').textContent = 'Name und Preis bitte';
          return;
        }
        await backend.set('wishes', newId(), { name, preis, link: /^https?:\/\//.test(link) ? link : null, erstellt: Date.now(), status: 'wartet' });
        toast('Auf der Liste – in 72 Stunden fragst du dich nochmal');
        paint();
      });
      el.querySelectorAll('[data-wish-skip]').forEach((b) => b.addEventListener('click', () => resolveWish(b.dataset.wishSkip, 'verzichtet', b).then(paint)));
      el.querySelectorAll('[data-wish-buy]').forEach((b) => b.addEventListener('click', () => resolveWish(b.dataset.wishBuy, 'gekauft', b)));
      el.querySelectorAll('[data-wish-goal]').forEach((b) => b.addEventListener('click', () => resolveWish(b.dataset.wishGoal, 'ziel', b)));
    }
  );
}

async function resolveWish(id, kind, button) {
  const wish = snap.wishes.find((w) => w.id === id);
  if (!wish) return;
  if (kind === 'verzichtet') {
    await backend.update('wishes', id, { status: 'verzichtet', erledigt: Date.now() });
    await award(`wish-${id}`, 20, 'Wunsch widerstanden');
    fx.confetti(button, 90);
    fx.sound('win');
    toast(`Stark! ${euro(wish.preis, { cents: true })} nicht ausgegeben · +20 XP`);
    return;
  }
  if (kind === 'ziel') {
    const open = snap.goals.filter((g) => !g.erreichtAm);
    await backend.set('goals', newId(), { name: wish.name, kosten: wish.preis, farbe: GOAL_COLORS[open.length % GOAL_COLORS.length], reihenfolge: Math.max(0, ...open.map((g) => g.reihenfolge || 0)) + 1 });
    await backend.update('wishes', id, { status: 'verzichtet', erledigt: Date.now(), alsZiel: true });
    await award(`wish-${id}`, 20, 'Wunsch als Ziel geplant');
    sheet.close();
    nav.go(2);
    return toast(`${wish.name} ist jetzt ein Ziel – Termin ist berechnet`);
  }
  await backend.update('wishes', id, { status: 'gekauft', erledigt: Date.now() });
  sheet.close();
  openExpense(null, { haendler: wish.name, betrag: wish.preis, kategorie: guessCategory(wish.name) });
}

function openWhatIf() {
  const state = { extraMonthly: 0, oneTime: 0 };
  const results = () => whatIf({ balance: derived.balance, todayYmd: today(), rules: snap.savingsRules, goals: snap.goals, reserve: derived.reserve.ziel, ...state });
  toolSheet(
    'wasware',
    () => toolViews.whatIfView(results(), state),
    (el, paint) => {
      el.querySelectorAll('[data-whatif]').forEach((input) =>
        input.addEventListener('change', () => {
          state[input.dataset.whatif] = Number(input.value);
          paint();
        })
      );
      el.querySelectorAll('[data-whatif]').forEach((input) =>
        input.addEventListener('input', () => {
          const b = input.parentElement.querySelector('b');
          const v = Number(input.value);
          b.textContent = `${input.dataset.whatif === 'extraMonthly' && v > 0 ? '+' : ''}${euro(v)}`;
        })
      );
      el.querySelectorAll('[data-preset]').forEach((b) =>
        b.addEventListener('click', () => {
          if (b.dataset.preset === 'rewe') state.extraMonthly = 60;
          if (b.dataset.preset === 'tr') state.extraMonthly = 100;
          if (b.dataset.preset === 'zero') Object.assign(state, { extraMonthly: 0, oneTime: 0 });
          paint();
        })
      );
    }
  );
}

function openBackup() {
  toolSheet(
    'backup',
    () => toolViews.backupView({ lastBackup: snap.profile?.letztesBackup }),
    (el) => {
      const msg = el.querySelector('[data-backup-msg]');
      el.querySelector('[data-backup="export"]').addEventListener('click', async () => {
        const data = backend.exportAll();
        delete data.ready;
        delete data.syncPending;
        delete data.goalImages;
        const blob = new Blob([JSON.stringify({ app: 'finanzplaner', version: 1, erstellt: new Date().toISOString(), daten: data }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finanzplaner-backup-${today()}.json`;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        await backend.setProfile({ letztesBackup: today() });
        toast('Backup gespeichert');
      });
      el.querySelector('[data-backup="import"]').addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const parsed = JSON.parse(await file.text());
          const data = parsed?.daten;
          if (parsed?.app !== 'finanzplaner' || !data) throw new Error('Das ist kein Finanzplaner-Backup');
          let count = 0;
          for (const col of COLLECTIONS) {
            const docs = (data[col] || []).filter((d) => d && d.id);
            if (docs.length) await backend.setMany(col, docs);
            count += docs.length;
          }
          if (data.profile) await backend.setProfile(data.profile);
          msg.textContent = '';
          sheet.close();
          toast(`Backup eingespielt · ${count} Einträge`);
        } catch (err) {
          msg.textContent = err.message || 'Datei konnte nicht gelesen werden';
        }
      });
    }
  );
}

function openPotAdjust(onDone) {
  sheet.open(
    formSheet({
      title: 'Stand laut PayPal',
      fields: [{ key: 'betrag', label: 'Aktueller Stand', type: 'amount', big: true, required: false }],
      values: { betrag: derived.balance },
      submitLabel: 'Stand übernehmen',
      onSubmit: async (data) => {
        if (!Number.isFinite(data.betrag) || data.betrag < 0) return;
        sheet.close();
        const diff = Math.round((data.betrag - derived.balance) * 100) / 100;
        await backend.set('ledger', newId(), { datum: today(), typ: 'abgleich', betrag: data.betrag, erstellt: Date.now() });
        await onDone?.();
        toast(`Spar-Topf auf ${euro(data.betrag, { cents: true })} gesetzt${diff ? ` (${diff > 0 ? '+' : '−'}${euro(Math.abs(diff), { cents: true })})` : ''}`);
      }
    })
  );
}

pagesEl.addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t || !snap) return;
  if (t.dataset.claim) return claim(t);
  if (t.dataset.confirm) return confirmTransfer(t);
  if (t.dataset.setting) {
    const key = t.dataset.setting;
    const on = key === 'roast' ? settings().roast === false : !settings()[key];
    const extra = key === 'aufrunden' && on ? { aufrundenSeit: Date.now(), aufrundenStufe: settings().aufrundenStufe || 1 } : {};
    await backend.setProfile({ settings: { ...settings(), [key]: on, ...extra } });
    if (key === 'sounds' && on) fx.sound('xp');
    const names = { roast: 'Roast-Modus', sounds: 'Sounds', aufrunden: 'Aufrunden', bergsounds: 'Bergsounds' };
    return toast(`${names[key]} ${on ? 'an' : 'aus'}`);
  }
  if (t.id === 'weather-place') return openWeatherPlace();
  if (t.dataset.roundupStep !== undefined) return openRoundUpStep();
  if (t.dataset.roundupDone !== undefined) return roundUpDone();
  if (t.dataset.tool) return openTool(t.dataset.tool);
  if (t.dataset.monthly) return monthlyCheck(t.dataset.monthly);
  if (t.id === 'rewe-btn') return openExpense(null, { haendler: 'Rewe', kategorie: 'Lebensmittel' });
  if (t.dataset.expense) return openExpense(snap.expenses.find((x) => x.id === t.dataset.expense));
  if (t.dataset.goal) return openGoal(snap.goals.find((g) => g.id === t.dataset.goal));
  if (t.id === 'goal-add') return openGoal();
  if (t.dataset.add) return openItem(t.dataset.add);
  if (t.dataset.edit) return openItem(t.dataset.edit, snap[t.dataset.edit].find((x) => x.id === t.dataset.id));
  if (t.dataset.toggleFixed) {
    const item = snap.fixed.find((x) => x.id === t.dataset.toggleFixed);
    if (item.pausiert && !(item.pausiertBis && item.pausiertBis < today())) {
      await backend.update('fixed', item.id, { pausiert: false, pausiertBis: null });
      return toast(`${item.name} läuft wieder`);
    }
    return openPause(item);
  }
  if (t.id === 'pot-adjust') return openPotAdjust();
  if (t.id === 'reserve-set') return openReserve(false);
  if (t.id === 'reserve-take') return openReserve(true);
  if (t.id === 'logout') {
    await auth?.logout();
    toast('Abgemeldet');
  }
});

$('#plus').addEventListener('click', () => snap && openExpense());

function showLogin() {
  loginHost.hidden = false;
  loginHost.innerHTML = views.loginScreen();
  const error = $('#login-error');
  const email = $('#login-email');
  const password = $('#login-password');
  const run = async (fn) => {
    error.textContent = '';
    try {
      await fn();
    } catch (err) {
      error.textContent = authMessage(err);
    }
  };
  $('#login-google').addEventListener('click', () => run(() => auth.google()));
  $('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    run(() => auth.login(email.value.trim(), password.value));
  });
  $('#login-register').addEventListener('click', () => run(() => auth.register(email.value.trim(), password.value)));
  $('#login-reset').addEventListener('click', () =>
    run(async () => {
      if (!email.value.trim()) throw { code: 'auth/invalid-email' };
      await auth.reset(email.value.trim());
      error.textContent = '';
      toast('Link zum Zurücksetzen ist unterwegs');
    })
  );
}

function hideLogin() {
  loginHost.hidden = true;
  loginHost.innerHTML = '';
}

async function start() {
  if (!isConfigured() || new URLSearchParams(location.search).has('lokal')) {
    attach(localBackend());
    return;
  }
  loginHost.hidden = false;
  loginHost.innerHTML = '<div class="login"><div class="login-logo">€</div><p class="sub">Verbinde …</p></div>';
  try {
    const services = await connectFirebase();
    auth = await createAuth(services.auth);
    auth.onChange(async (u) => {
      user = u;
      if (!u) {
        unsubscribe?.();
        backend?.close?.();
        backend = null;
        snap = null;
        showLogin();
        return;
      }
      hideLogin();
      const seed = readLocal() || defaultData(today());
      attach(await cloudBackend({ db: services.db, uid: u.uid, seed }));
    });
  } catch (err) {
    console.error(err);
    toast('Firebase nicht erreichbar – lokaler Modus');
    hideLogin();
    attach(localBackend());
  }
}

start();

window.__finanzplaner = { get snap() { return snap; }, get derived() { return derived; } };
