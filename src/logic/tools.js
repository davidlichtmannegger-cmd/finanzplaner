import { addDays, dateInMonth, daysBetween, daysInMonth, isActive, ymd } from './dates.js';
import { isPaused, planGoals, upcoming } from './schedule.js';

export const COOL_OFF_MS = 72 * 3600 * 1000;

export function calendarMonth({ year, month, income = [], savingsRules = [], fixed = [], expenses = [], plan = [], todayYmd }) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = daysInMonth(year, month);
  const from = dateInMonth(year, month, 1);
  const to = dateInMonth(year, month, count);
  const days = new Map();
  const add = (datum, ev) => {
    if (!days.has(datum)) days.set(datum, []);
    days.get(datum).push(ev);
  };
  upcoming(income, from, to).forEach((e) => add(e.datum, { typ: 'einnahme', name: e.name, betrag: e.betrag }));
  upcoming(savingsRules, from, to).forEach((e) => add(e.datum, { typ: 'sparen', name: e.name || 'Dauerauftrag', betrag: e.betrag }));
  for (const f of fixed) {
    if (!f.tagImMonat) continue;
    const datum = dateInMonth(year, month, f.tagImMonat);
    if (isActive(f, datum) && !isPaused(f, datum)) add(datum, { typ: 'fix', name: f.name, betrag: f.betrag });
  }
  for (const g of plan) if (g.datum && g.datum >= from && g.datum <= to) add(g.datum, { typ: 'ziel', name: g.name, betrag: g.kosten });
  const spent = new Map();
  for (const e of expenses) if (e.datum >= from && e.datum <= to) spent.set(e.datum, Math.round(((spent.get(e.datum) || 0) + (e.betrag || 0)) * 100) / 100);
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= count; d++) {
    const datum = dateInMonth(year, month, d);
    cells.push({ datum, tag: d, events: days.get(datum) || [], ausgaben: spent.get(datum) || 0, heute: datum === todayYmd });
  }
  while (cells.length % 7) cells.push(null);
  return { year, month, cells };
}

export function wishState(wish, nowMs = Date.now()) {
  if (wish.status === 'gekauft' || wish.status === 'verzichtet') return { ...wish, offen: false, restMs: 0 };
  const restMs = Math.max(0, (wish.erstellt || 0) + COOL_OFF_MS - nowMs);
  return { ...wish, offen: true, restMs, frei: restMs === 0 };
}

export const formatRest = (ms) => {
  const h = Math.ceil(ms / 3600000);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const r = h % 24;
    return r ? `${d} T ${r} Std.` : `${d} T`;
  }
  return h <= 1 ? `${Math.max(1, Math.ceil(ms / 60000))} Min.` : `${h} Std.`;
};

export const resistedSum = (wishes = []) => Math.round(wishes.filter((w) => w.status === 'verzichtet').reduce((s, w) => s + (w.preis || 0), 0) * 100) / 100;

export function whatIf({ balance, todayYmd, rules, goals, reserve = 0, extraMonthly = 0, oneTime = 0, extraDay = 16 }) {
  const base = planGoals({ balance, todayYmd, rules, goals, reserve });
  const extraRules = extraMonthly ? [...rules, { id: 'whatif', tagImMonat: extraDay, betrag: extraMonthly, aktivAb: addDays(todayYmd, 1) }] : rules;
  const tuned = planGoals({ balance: balance + (oneTime || 0), todayYmd, rules: extraRules.filter((r) => r.betrag > 0 || r.id !== 'whatif'), goals, reserve });
  return base.map((g, i) => {
    const t = tuned[i];
    const delta = g.datum && t.datum ? daysBetween(g.datum, t.datum) : null;
    return { id: g.id, name: g.name, vorher: g.datum, nachher: t.datum, delta, wartetAufTermin: t.wartetAufTermin };
  });
}

export const roundUpOf = (betrag, step = 1) => {
  const cents = Math.round(betrag * 100);
  const stepC = Math.round(step * 100);
  const up = Math.ceil(cents / stepC) * stepC - cents;
  return up / 100;
};

export function roundUpPot(expenses = [], { seit = 0, bis = 0, step = 1 } = {}) {
  const items = expenses.filter((e) => (e.erstellt || 0) >= seit && (e.erstellt || 0) > bis && !e.taschengeld);
  const sum = items.reduce((s, e) => s + roundUpOf(e.betrag || 0, step), 0);
  return { betrag: Math.round(sum * 100) / 100, anzahl: items.length };
}

export function monthlyCheckDue(ledger = [], todayYmd) {
  const month = todayYmd.slice(0, 7);
  return !ledger.some((e) => e.typ === 'abgleich' && e.datum?.startsWith(month) && e.id !== 'start');
}

export const monthKey = (todayYmd) => todayYmd.slice(0, 7);

export const nowYmd = (now = new Date()) => ymd(now);
