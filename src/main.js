import './styles/tokens.css';
import './styles/app.css';
import './styles/components.css';
import './styles/rewards.css';
import { createNav } from './ui/nav.js';
import { createSheet, createToast } from './ui/sheet.js';
import { formSheet } from './ui/forms.js';
import { enableReorder } from './ui/reorder.js';
import { euro, workMinutes } from './ui/format.js';
import { connectFirebase, isConfigured } from './firebase.js';
import { createAuth, authMessage } from './auth.js';
import { localBackend, cloudBackend, readLocal, newId } from './data/store.js';
import { defaultData, CATEGORIES, GOAL_COLORS } from './data/defaults.js';
import { derive } from './logic/derive.js';
import { dueBookings } from './logic/schedule.js';
import { today } from './logic/dates.js';
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

function openGoal(goal = null) {
  const open = (snap.goals || []).filter((g) => !g.erreichtAm);
  const actions = [];
  if (goal && !goal.erreichtAm) actions.push({ label: 'Als gekauft markieren', onClick: () => markBought(goal) });
  if (goal?.erreichtAm) actions.push({ label: 'Kauf rückgängig', onClick: () => undoBought(goal) });
  if (goal) actions.push({ label: 'Ziel löschen', danger: true, onClick: () => removeGoal(goal) });
  sheet.open(
    formSheet({
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
        sheet.close();
        if (goal) await backend.update('goals', goal.id, { name: data.name, kosten: data.kosten, fruehestens: data.fruehestens || null, farbe: data.farbe });
        else await backend.set('goals', newId(), { name: data.name, kosten: data.kosten, fruehestens: data.fruehestens || null, farbe: data.farbe, reihenfolge: Math.max(0, ...open.map((g) => g.reihenfolge || 0)) + 1 });
        toast(goal ? 'Ziel gespeichert' : 'Ziel angelegt – Termin ist berechnet');
      }
    })
  );
}

async function markBought(goal) {
  sheet.close();
  await backend.set('ledger', `kauf-${goal.id}`, { datum: today(), typ: 'entnahme', betrag: goal.kosten, goalId: goal.id, erstellt: Date.now() });
  await backend.update('goals', goal.id, { erreichtAm: today() });
  toast(`${goal.name} gekauft – Glückwunsch!`);
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
  toast(`${goal.name} gelöscht`);
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
      { key: 'pausiert', label: 'Pausiert', type: 'checkbox' }
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

function openPotAdjust() {
  sheet.open(
    formSheet({
      title: 'Stand laut PayPal',
      fields: [{ key: 'betrag', label: 'Aktueller Stand', type: 'amount', big: true, required: false }],
      values: { betrag: derived.balance },
      submitLabel: 'Stand übernehmen',
      onSubmit: async (data) => {
        if (!Number.isFinite(data.betrag) || data.betrag < 0) return;
        sheet.close();
        await backend.set('ledger', newId(), { datum: today(), typ: 'abgleich', betrag: data.betrag, erstellt: Date.now() });
        toast(`Spar-Topf auf ${euro(data.betrag, { cents: true })} gesetzt`);
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
    const on = key === 'roast' ? settings().roast === false : !settings().sounds;
    await backend.setProfile({ settings: { ...settings(), [key]: on } });
    if (key === 'sounds' && on) fx.sound('xp');
    return toast(`${key === 'roast' ? 'Roast-Modus' : 'Sounds'} ${on ? 'an' : 'aus'}`);
  }
  if (t.id === 'rewe-btn') return openExpense(null, { haendler: 'Rewe', kategorie: 'Lebensmittel' });
  if (t.dataset.expense) return openExpense(snap.expenses.find((x) => x.id === t.dataset.expense));
  if (t.dataset.goal) return openGoal(snap.goals.find((g) => g.id === t.dataset.goal));
  if (t.id === 'goal-add') return openGoal();
  if (t.dataset.add) return openItem(t.dataset.add);
  if (t.dataset.edit) return openItem(t.dataset.edit, snap[t.dataset.edit].find((x) => x.id === t.dataset.id));
  if (t.dataset.toggleFixed) {
    const item = snap.fixed.find((x) => x.id === t.dataset.toggleFixed);
    await backend.update('fixed', item.id, { pausiert: !item.pausiert });
    return toast(`${item.name} ${item.pausiert ? 'läuft wieder' : 'pausiert'}`);
  }
  if (t.id === 'pot-adjust') return openPotAdjust();
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
