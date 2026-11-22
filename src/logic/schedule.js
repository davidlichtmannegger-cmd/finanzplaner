import { addDays, daysBetween, isActive, maxDate, monthlyDates } from './dates.js';

export const HORIZON_DAYS = 365 * 5;

export function upcoming(rules, from, to) {
  const events = [];
  for (const rule of rules) {
    if (!rule.tagImMonat || !(rule.betrag > 0)) continue;
    for (const datum of monthlyDates(rule.tagImMonat, from, to)) {
      if (isActive(rule, datum)) events.push({ datum, betrag: rule.betrag, ruleId: rule.id, name: rule.name });
    }
  }
  return events.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
}

export function potBalance(ledger) {
  const rank = (e) => (e.typ === 'abgleich' ? 1 : 0);
  const sorted = [...ledger].sort((a, b) => (a.datum !== b.datum ? (a.datum < b.datum ? -1 : 1) : rank(a) - rank(b) || (a.erstellt || 0) - (b.erstellt || 0)));
  let balance = 0;
  for (const e of sorted) {
    if (e.typ === 'abgleich') balance = e.betrag;
    else if (e.typ === 'entnahme') balance -= Math.abs(e.betrag);
    else balance += e.betrag;
  }
  return Math.round(balance * 100) / 100;
}

export function dueBookings(rules, ledger, since, todayYmd) {
  if (!since || since >= todayYmd) return [];
  const booked = new Set(ledger.map((e) => e.id));
  return upcoming(rules, addDays(since, 1), todayYmd)
    .map((e) => ({ id: `auto-${e.ruleId}-${e.datum}`, datum: e.datum, typ: 'einzahlung', betrag: e.betrag, auto: true }))
    .filter((e) => !booked.has(e.id));
}

export function planGoals({ balance, todayYmd, rules, goals, reserve = 0, horizonDays = HORIZON_DAYS }) {
  const open = goals.filter((g) => !g.erreichtAm).sort((a, b) => a.reihenfolge - b.reihenfolge);
  const events = upcoming(rules, addDays(todayYmd, 1), addDays(todayYmd, horizonDays));
  const result = [];
  let cumulative = Math.max(0, reserve);
  let running = balance;
  let i = 0;
  let lastDate = todayYmd;
  for (const goal of open) {
    const before = cumulative;
    cumulative += goal.kosten;
    while (running < cumulative && i < events.length) {
      running += events[i].betrag;
      lastDate = events[i].datum;
      i++;
    }
    const reachable = running >= cumulative;
    const sparDatum = reachable ? (before + goal.kosten <= balance ? todayYmd : lastDate) : null;
    const datum = sparDatum ? maxDate(sparDatum, goal.fruehestens || null) : null;
    const zugeteilt = Math.max(0, Math.min(goal.kosten, balance - before));
    result.push({
      ...goal,
      zugeteilt,
      fortschritt: goal.kosten > 0 ? zugeteilt / goal.kosten : 1,
      sparDatum,
      datum,
      tageBis: datum ? daysBetween(todayYmd, datum) : null,
      wartetAufTermin: !!(datum && sparDatum && datum > sparDatum)
    });
  }
  return result;
}

export function nextOccurrence(items, todayYmd, { includeToday = true } = {}) {
  const from = includeToday ? todayYmd : addDays(todayYmd, 1);
  const [next] = upcoming(items, from, addDays(from, 62));
  return next ? { ...next, tageBis: daysBetween(todayYmd, next.datum) } : null;
}

export const isPaused = (item, todayYmd) => !!item.pausiert && (!item.pausiertBis || todayYmd <= item.pausiertBis);

export function monthlySum(items, todayYmd) {
  return items.filter((i) => !isPaused(i, todayYmd) && isActive(i, todayYmd)).reduce((s, i) => s + (i.betrag || 0), 0);
}

export function planReserve({ balance, todayYmd, rules, reserve = 0, horizonDays = HORIZON_DAYS }) {
  const ziel = Math.max(0, reserve);
  const betrag = Math.max(0, Math.min(balance, ziel));
  if (!ziel) return { ziel: 0, betrag: 0, voll: true, datum: todayYmd, fortschritt: 1 };
  if (balance >= ziel) return { ziel, betrag, voll: true, datum: todayYmd, fortschritt: 1 };
  let running = balance;
  for (const e of upcoming(rules, addDays(todayYmd, 1), addDays(todayYmd, horizonDays))) {
    running += e.betrag;
    if (running >= ziel) return { ziel, betrag, voll: false, datum: e.datum, fortschritt: betrag / ziel };
  }
  return { ziel, betrag, voll: false, datum: null, fortschritt: betrag / ziel };
}
