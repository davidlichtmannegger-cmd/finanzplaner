import { addDays, daysBetween, parseYmd, ymd } from './dates.js';

export const XP = {
  expense: 5,
  impulse: -15,
  label: (n) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`),
  transferYes: 50,
  transferNo: 10,
  bonus: 25,
  bonusChance: 0.1
};

export const LEVEL_NAMES = [
  'Spar-Neuling',
  'Kleingeld-Jäger',
  'Budget-Rookie',
  'Spar-Scout',
  'Zins-Ritter',
  'Cashflow-Kapitän',
  'Gipfelstürmer',
  'Tresor-Meister',
  'Finanz-Ninja',
  'Spar-Legende'
];

export const TASCHENGELD_PER_LEVEL = 5;

export const xpForLevel = (level) => 50 * (level - 1) * level;

export function levelFor(xp) {
  const total = Math.max(0, xp);
  let level = 1;
  while (total >= xpForLevel(level + 1)) level++;
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return {
    level,
    name: LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1],
    from,
    to,
    into: total - from,
    needed: to - from,
    progress: (total - from) / (to - from)
  };
}

export const totalXp = (xpLog) => (xpLog || []).reduce((s, e) => s + (e.betrag || 0), 0);

export function streak(expenses, startDatum, todayYmd) {
  const impulses = (expenses || []).filter((e) => e.impuls && !e.taschengeld && e.datum <= todayYmd).map((e) => e.datum).sort();
  const since = impulses.length ? impulses[impulses.length - 1] : startDatum || todayYmd;
  return Math.max(0, daysBetween(since, todayYmd));
}

export const isRewe = (e) => /rewe/i.test(e?.haendler || '');

const hash = (s) => [...s].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);

function pick(pool, seed, count) {
  const order = pool.map((item, i) => ({ item, k: hash(`${seed}:${item.id}:${i}`) })).sort((a, b) => a.k - b.k);
  return order.slice(0, count).map((o) => o.item);
}

const EVENING = 18;

export const QUEST_POOL = [
  { id: 'eintragen', text: 'Ausgaben von heute eintragen', xp: 10, check: (c) => (c.dayExpenses.length ? 'ready' : 'open'), hint: 'Trag eine Ausgabe von heute ein' },
  { id: 'kein-rewe', text: 'Heute nichts bei Rewe kaufen', xp: 20, check: (c) => (c.dayExpenses.some(isRewe) ? 'failed' : c.hour >= EVENING ? 'ready' : 'open'), hint: 'ab 18 Uhr abholbar' },
  { id: 'kein-impuls', text: 'Heute kein Impulskauf', xp: 15, check: (c) => (c.dayExpenses.some((e) => e.impuls) ? 'failed' : c.hour >= EVENING ? 'ready' : 'open'), hint: 'ab 18 Uhr abholbar' },
  { id: 'unter-10', text: 'Heute unter 10 € Kleinkram', xp: 15, check: (c) => (c.daySum >= 10 ? 'failed' : c.hour >= EVENING ? 'ready' : 'open'), hint: 'ab 18 Uhr abholbar' },
  { id: 'ziele', text: 'Einmal deine Ziele anschauen', xp: 5, check: (c) => (c.visitedGoals ? 'ready' : 'open'), hint: 'Öffne den Ziele-Tab' }
];

export function dailyQuests({ todayYmd, hour, expenses, xpLog, visitedGoals }) {
  const dayExpenses = (expenses || []).filter((e) => e.datum === todayYmd);
  const ctx = { dayExpenses, daySum: dayExpenses.reduce((s, e) => s + (e.betrag || 0), 0), hour, visitedGoals };
  const claimed = new Set((xpLog || []).map((e) => e.id));
  const base = QUEST_POOL.find((q) => q.id === 'eintragen');
  const rest = pick(QUEST_POOL.filter((q) => q !== base), todayYmd, 2);
  return [base, ...rest].map((q) => {
    const id = `quest-${todayYmd}-${q.id}`;
    const status = claimed.has(id) ? 'claimed' : q.check(ctx);
    return { id, questId: q.id, text: q.text, xp: q.xp, status, hint: q.hint };
  });
}

export const weekStart = (dateYmd) => {
  const d = parseYmd(dateYmd);
  const dow = (d.getDay() + 6) % 7;
  return addDays(dateYmd, -dow);
};

export const WEEK_POOL = [
  { id: 'rewe-3', text: 'Max. 3× Rewe diese Woche', xp: 60, value: (w) => w.filter(isRewe).length, limit: 3, unit: 'Besuche' },
  { id: 'impuls-0', text: 'Eine ganze Woche ohne Impulskauf', xp: 80, value: (w) => w.filter((e) => e.impuls).length, limit: 0, unit: 'Impulskäufe' },
  { id: 'max-50', text: 'Diese Woche unter 50 € Kleinkram', xp: 70, value: (w) => Math.round(w.reduce((s, e) => s + (e.betrag || 0), 0)), limit: 49, unit: '€' }
];

export function weekChallenge({ todayYmd, expenses, xpLog, startDatum }) {
  const start = weekStart(todayYmd);
  const end = addDays(start, 6);
  const [def] = pick(WEEK_POOL, start, 1);
  const week = (expenses || []).filter((e) => e.datum >= start && e.datum <= end);
  const value = def.value(week);
  const id = `week-${start}-${def.id}`;
  const claimed = (xpLog || []).some((e) => e.id === id);
  const lastDay = todayYmd === end;
  const partial = !!startDatum && startDatum > start;
  const status = claimed ? 'claimed' : value > def.limit ? 'failed' : partial ? 'warmup' : lastDay ? 'ready' : 'open';
  return { id, text: def.text, xp: def.xp, value, limit: def.limit, unit: def.unit, status, start, end, daysLeft: daysBetween(todayYmd, end) };
}

export function pendingConfirmations(ledger, todayYmd, days = 14) {
  const from = addDays(todayYmd, -days);
  return (ledger || [])
    .filter((e) => e.auto && !e.bestaetigt && !e.uebersprungen && e.datum <= todayYmd && e.datum >= from)
    .sort((a, b) => (a.datum < b.datum ? -1 : 1));
}

export function taschengeld(level, expenses) {
  const earned = (level - 1) * TASCHENGELD_PER_LEVEL;
  const used = (expenses || []).filter((e) => e.taschengeld).reduce((s, e) => s + (e.betrag || 0), 0);
  return { earned, used: Math.round(used * 100) / 100, frei: Math.max(0, Math.round((earned - used) * 100) / 100) };
}

export const impulseDelayDays = (betrag, monthlySavings) => (monthlySavings > 0 ? betrag / (monthlySavings / 30.4) : 0);

export const ACHIEVEMENTS = [
  { id: 'erste-ausgabe', label: 'Erste Ausgabe', icon: '1.', check: (c) => c.expenses.length > 0 },
  { id: 'erste-ueberweisung', label: 'Überweisung bestätigt', icon: '✓', check: (c) => c.ledger.some((e) => e.bestaetigt) },
  { id: 'streak-7', label: 'Tage-Streak', icon: '7', check: (c) => c.streak >= 7 },
  { id: 'streak-30', label: 'Tage-Streak', icon: '30', check: (c) => c.streak >= 30 },
  { id: 'gespart-500', label: '€ gespart', icon: '500', check: (c) => c.balance >= 500 || c.reachedSum >= 500 },
  { id: 'gespart-1000', label: '€ gespart', icon: '1k', check: (c) => c.balance >= 1000 || c.reachedSum >= 1000 },
  { id: 'erster-gipfel', label: 'Gipfel erreicht', icon: '⛰', check: (c) => c.reached > 0 },
  { id: 'rewe-frei', label: 'Rewe-freie Woche', icon: '0', check: (c) => c.daysSinceRewe >= 7 },
  { id: 'quests-10', label: 'Quests geschafft', icon: '10', check: (c) => c.questsDone >= 10 },
  { id: 'level-5', label: 'Level erreicht', icon: '5', check: (c) => c.level >= 5 }
];

export function achievementState(ctx, unlockedIds = new Set()) {
  return ACHIEVEMENTS.map((a) => ({ id: a.id, label: a.label, icon: a.icon, unlocked: unlockedIds.has(a.id) || a.check(ctx), stored: unlockedIds.has(a.id) }));
}

export function daysSinceRewe(expenses, startDatum, todayYmd) {
  const last = (expenses || []).filter(isRewe).map((e) => e.datum).sort().pop();
  return Math.max(0, daysBetween(last || startDatum || todayYmd, todayYmd));
}

export const ROASTS = [
  'Schon wieder? Die PS5 weint leise.',
  'GTA 6 hat das gesehen.',
  'Der Bergsteiger rutscht ein Stück runter …',
  'Dein zukünftiges Ich schüttelt den Kopf.',
  'Rewe freut sich. Dein Spar-Topf nicht.',
  'Teurer Spaß für so wenig Glück.',
  'Das war nicht der Weg zum Gipfel.'
];

export const PRAISE = ['Stark!', 'Sauber!', 'Weiter so!', 'Ehrenmann.', 'Spar-Modus aktiv!'];

export const randomOf = (list, rnd = Math.random) => list[Math.floor(rnd() * list.length)];

export const nowHour = (now = new Date()) => now.getHours();

export const todayFrom = (now = new Date()) => ymd(now);
