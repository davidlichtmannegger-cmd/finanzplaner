import test from 'node:test';
import assert from 'node:assert/strict';
import { planGoals, potBalance, dueBookings, nextOccurrence, upcoming, monthlySum } from '../src/logic/schedule.js';
import { monthlyDates, dateInMonth, daysBetween } from '../src/logic/dates.js';
import { defaultData } from '../src/data/defaults.js';

const TABLE = {
  'goal-ps5': '2026-12-28',
  'goal-tv': '2027-02-15',
  'goal-pc': '2027-05-15',
  'goal-peri': '2027-05-28',
  'goal-mon': '2027-06-28'
};

test('29. im Februar wird zum letzten Tag', () => {
  assert.equal(dateInMonth(2027, 1, 29), '2027-02-28');
  assert.deepEqual([...monthlyDates(29, '2027-01-01', '2027-03-31')], ['2027-01-29', '2027-02-28', '2027-03-29']);
});

test('Daueraufträge mit Gültigkeitszeitraum (Gehaltserhöhung ab 1.8.2027)', () => {
  const { savingsRules } = defaultData('2026-11-22');
  const july = upcoming(savingsRules, '2027-07-01', '2027-07-31').map((e) => e.betrag);
  const aug = upcoming(savingsRules, '2027-08-01', '2027-08-31').map((e) => e.betrag);
  assert.deepEqual(july, [485, 270]);
  assert.deepEqual(aug, [685, 270]);
  assert.equal(monthlySum(savingsRules, '2027-07-15'), 755);
  assert.equal(monthlySum(savingsRules, '2027-08-15'), 955);
});

test('Termine stimmen mit Davids Tabelle überein (Start 22.11.2026, Spar-Topf 0 €)', () => {
  const d = defaultData('2026-11-22');
  const plan = planGoals({ balance: 0, todayYmd: '2026-11-22', rules: d.savingsRules, goals: d.goals });
  for (const goal of plan) {
    if (TABLE[goal.id]) {
      const diff = daysBetween(TABLE[goal.id], goal.datum);
      assert.ok(diff >= 0 && diff <= 1, `${goal.name}: ${goal.datum} statt ${TABLE[goal.id]}`);
    }
  }
  const iphone = plan.find((g) => g.id === 'goal-iphone');
  assert.equal(iphone.datum.slice(0, 7), '2027-09');
  assert.equal(iphone.wartetAufTermin, true);
  assert.deepEqual(
    plan.map((g) => g.datum),
    ['2026-12-29', '2027-02-16', '2027-05-16', '2027-05-29', '2027-06-29', '2027-09-01']
  );
});

test('Vorhandenes Guthaben wird den Zielen der Reihe nach zugeteilt', () => {
  const d = defaultData('2026-11-22');
  const plan = planGoals({ balance: 1500, todayYmd: '2026-11-22', rules: d.savingsRules, goals: d.goals });
  assert.equal(plan[0].zugeteilt, 1000);
  assert.equal(plan[0].datum, '2026-11-22');
  assert.equal(plan[0].tageBis, 0);
  assert.equal(plan[1].zugeteilt, 500);
  assert.ok(Math.abs(plan[1].fortschritt - 500 / 1130) < 1e-9);
  assert.equal(plan[2].zugeteilt, 0);
});

test('Erreichte Ziele fallen raus, Reihenfolge zählt', () => {
  const d = defaultData('2026-11-22');
  d.goals[0].erreichtAm = '2026-11-20';
  d.goals[1].reihenfolge = 9;
  const plan = planGoals({ balance: 0, todayYmd: '2026-11-22', rules: d.savingsRules, goals: d.goals });
  assert.equal(plan[0].id, 'goal-pc');
  assert.equal(plan.at(-1).id, 'goal-tv');
  assert.ok(!plan.some((g) => g.id === 'goal-ps5'));
});

test('Spar-Topf: Abgleich setzt den Stand, Ein- und Entnahmen rechnen weiter', () => {
  const ledger = [
    { id: 'a', datum: '2026-11-01', typ: 'einzahlung', betrag: 100 },
    { id: 'b', datum: '2026-11-10', typ: 'abgleich', betrag: 400 },
    { id: 'c', datum: '2026-11-16', typ: 'einzahlung', betrag: 485 },
    { id: 'd', datum: '2026-11-20', typ: 'entnahme', betrag: 85 }
  ];
  assert.equal(potBalance(ledger), 800);
});

test('Fällige Daueraufträge werden genau einmal gebucht', () => {
  const d = defaultData('2026-11-22');
  const due = dueBookings(d.savingsRules, d.ledger, '2026-11-22', '2026-12-20');
  assert.deepEqual(due.map((e) => [e.datum, e.betrag]), [['2026-11-29', 270], ['2026-12-16', 485]]);
  assert.equal(dueBookings(d.savingsRules, [...d.ledger, ...due], '2026-11-22', '2026-12-20').length, 0);
  assert.equal(dueBookings(d.savingsRules, d.ledger, '2026-11-22', '2026-11-22').length, 0);
});

test('Nächster Zahltag und nächster Dauerauftrag', () => {
  const d = defaultData('2026-11-22');
  const pay = nextOccurrence(d.income, '2026-11-22');
  assert.equal(pay.datum, '2026-11-28');
  assert.equal(pay.betrag, 270);
  assert.equal(pay.tageBis, 6);
  assert.equal(nextOccurrence(d.income, '2026-11-28').datum, '2026-11-28');
  assert.equal(nextOccurrence(d.savingsRules, '2026-11-22').datum, '2026-11-29');
});
