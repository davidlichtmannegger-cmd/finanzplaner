import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarMonth, wishState, formatRest, resistedSum, whatIf, roundUpOf, roundUpPot, monthlyCheckDue, COOL_OFF_MS } from '../src/logic/tools.js';
import { monthlySum } from '../src/logic/schedule.js';
import { defaultData } from '../src/data/defaults.js';

test('Kalender November 2026: beginnt am Sonntag, Zahltage, Daueraufträge, Ausgaben', () => {
  const d = defaultData('2026-11-22');
  const cal = calendarMonth({
    year: 2026,
    month: 10,
    income: d.income,
    savingsRules: d.savingsRules,
    fixed: [{ name: 'Miete', betrag: 50, tagImMonat: 1 }],
    expenses: [{ datum: '2026-11-22', betrag: 4.79 }, { datum: '2026-11-22', betrag: 1.21 }],
    plan: [{ name: 'PS5', kosten: 1000, datum: '2026-11-30' }],
    todayYmd: '2026-11-22'
  });
  assert.equal(cal.cells.length % 7, 0);
  assert.equal(cal.cells.slice(0, 6).every((c) => c === null), true);
  const day = (n) => cal.cells.find((c) => c?.tag === n);
  assert.equal(day(1).events[0].typ, 'fix');
  assert.deepEqual(day(15).events.map((e) => e.typ), ['einnahme']);
  assert.deepEqual(day(16).events.map((e) => [e.typ, e.betrag]), [['sparen', 485]]);
  assert.equal(day(22).ausgaben, 6);
  assert.equal(day(22).heute, true);
  assert.equal(day(30).events[0].typ, 'ziel');
});

test('Abkühl-Wunschliste: 72 Stunden gesperrt', () => {
  const t0 = Date.UTC(2026, 10, 22, 12);
  const w = wishState({ name: 'Controller', preis: 70, erstellt: t0 }, t0 + 10 * 3600 * 1000);
  assert.equal(w.frei, false);
  assert.equal(formatRest(w.restMs), '2 T 14 Std.');
  assert.equal(wishState({ erstellt: t0 }, t0 + COOL_OFF_MS).frei, true);
  assert.equal(formatRest(30 * 60000), '30 Min.');
  assert.equal(resistedSum([{ status: 'verzichtet', preis: 70 }, { status: 'gekauft', preis: 20 }, { status: 'verzichtet', preis: 9.99 }]), 79.99);
});

test('Was wäre wenn: 100 € mehr im Monat bringt die Ziele nach vorn', () => {
  const d = defaultData('2026-11-22');
  const r = whatIf({ balance: 0, todayYmd: '2026-11-22', rules: d.savingsRules, goals: d.goals, extraMonthly: 100 });
  assert.equal(r[0].vorher, '2026-12-29');
  assert.ok(r[2].delta < 0, 'PC kommt früher');
  const one = whatIf({ balance: 0, todayYmd: '2026-11-22', rules: d.savingsRules, goals: d.goals, oneTime: 1000 });
  assert.equal(one[0].nachher, '2026-11-22');
  const none = whatIf({ balance: 0, todayYmd: '2026-11-22', rules: d.savingsRules, goals: d.goals });
  assert.ok(none.every((g) => g.delta === 0));
});

test('Virtuelles Aufrunden', () => {
  assert.equal(roundUpOf(4.79), 0.21);
  assert.equal(roundUpOf(5), 0);
  assert.equal(roundUpOf(12.3, 5), 2.7);
  const ex = [
    { betrag: 4.79, erstellt: 10 },
    { betrag: 2.5, erstellt: 20 },
    { betrag: 9.1, erstellt: 30, taschengeld: true },
    { betrag: 1.2, erstellt: 5 }
  ];
  assert.deepEqual(roundUpPot(ex, { seit: 8, bis: 0 }), { betrag: 0.71, anzahl: 2 });
  assert.deepEqual(roundUpPot(ex, { seit: 8, bis: 10 }), { betrag: 0.5, anzahl: 1 });
});

test('Monatsabgleich fällig, bis ein Abgleich im Monat existiert', () => {
  assert.equal(monthlyCheckDue([{ id: 'start', typ: 'abgleich', datum: '2026-11-22' }], '2026-11-25'), true);
  assert.equal(monthlyCheckDue([{ id: 'x', typ: 'abgleich', datum: '2026-11-02' }], '2026-11-25'), false);
  assert.equal(monthlyCheckDue([{ id: 'x', typ: 'abgleich', datum: '2026-10-30' }], '2026-11-01'), true);
});

test('Trade Republic pausieren bis zu einem Datum', () => {
  const fixed = [{ betrag: 100, pausiert: true, pausiertBis: '2026-12-31' }, { betrag: 50 }];
  assert.equal(monthlySum(fixed, '2026-12-15'), 50);
  assert.equal(monthlySum(fixed, '2027-01-15'), 150);
  assert.equal(monthlySum([{ betrag: 100, pausiert: true }], '2030-01-01'), 0);
});
