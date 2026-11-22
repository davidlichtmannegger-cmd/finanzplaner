import test from 'node:test';
import assert from 'node:assert/strict';
import {
  levelFor,
  xpForLevel,
  totalXp,
  streak,
  dailyQuests,
  weekChallenge,
  weekStart,
  pendingConfirmations,
  taschengeld,
  impulseDelayDays,
  achievementState,
  daysSinceRewe
} from '../src/logic/rewards.js';

test('Level-Schwellen und Namen', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(xpForLevel), [0, 100, 300, 600, 1000]);
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(0).name, 'Spar-Neuling');
  assert.equal(levelFor(99).level, 1);
  assert.equal(levelFor(100).level, 2);
  const l = levelFor(450);
  assert.equal(l.level, 3);
  assert.equal(l.into, 150);
  assert.equal(l.needed, 300);
  assert.equal(levelFor(-50).level, 1);
  assert.equal(totalXp([{ betrag: 50 }, { betrag: -15 }, { betrag: 5 }]), 40);
});

test('Streak zählt Tage seit dem letzten Impulskauf, Taschengeld zählt nicht', () => {
  const ex = [
    { datum: '2026-11-10', impuls: true },
    { datum: '2026-11-15', impuls: true, taschengeld: true },
    { datum: '2026-11-18', impuls: false }
  ];
  assert.equal(streak(ex, '2026-11-01', '2026-11-22'), 12);
  assert.equal(streak([], '2026-11-20', '2026-11-22'), 2);
});

test('Tägliche Quests sind pro Tag fest, Abend-Quests erst ab 18 Uhr', () => {
  const base = { todayYmd: '2026-11-22', expenses: [], xpLog: [], visitedGoals: false };
  const morning = dailyQuests({ ...base, hour: 9 });
  const again = dailyQuests({ ...base, hour: 9 });
  assert.equal(morning.length, 3);
  assert.equal(morning[0].questId, 'eintragen');
  assert.deepEqual(morning.map((q) => q.id), again.map((q) => q.id));
  assert.equal(morning[0].status, 'open');
  const withExpense = dailyQuests({ ...base, hour: 20, expenses: [{ datum: '2026-11-22', haendler: 'Rewe', betrag: 4 }] });
  assert.equal(withExpense[0].status, 'ready');
  const reweQuest = dailyQuests({ ...base, hour: 20, expenses: [{ datum: '2026-11-22', haendler: 'Rewe', betrag: 4 }] }).find((q) => q.questId === 'kein-rewe');
  if (reweQuest) assert.equal(reweQuest.status, 'failed');
  const claimed = dailyQuests({ ...base, hour: 9, xpLog: [{ id: morning[0].id, betrag: 10 }] });
  assert.equal(claimed[0].status, 'claimed');
  const otherDay = dailyQuests({ ...base, todayYmd: '2026-11-23', hour: 9 });
  assert.ok(otherDay.every((q) => q.id.includes('2026-11-23')));
});

test('Wochen-Challenge: Woche Mo–So, abholbar am Sonntag', () => {
  assert.equal(weekStart('2026-11-22'), '2026-11-16');
  assert.equal(weekStart('2026-11-16'), '2026-11-16');
  const sunday = weekChallenge({ todayYmd: '2026-11-22', expenses: [], xpLog: [] });
  assert.equal(sunday.status, 'ready');
  assert.equal(sunday.daysLeft, 0);
  const wed = weekChallenge({ todayYmd: '2026-11-18', expenses: [], xpLog: [] });
  assert.equal(wed.status, 'open');
  assert.equal(weekChallenge({ todayYmd: '2026-11-22', expenses: [], xpLog: [], startDatum: '2026-11-22' }).status, 'warmup');
  assert.equal(weekChallenge({ todayYmd: '2026-11-29', expenses: [], xpLog: [], startDatum: '2026-11-22' }).status, 'ready');
  const many = Array.from({ length: 5 }, (_, i) => ({ datum: '2026-11-17', haendler: 'Rewe', betrag: 20, impuls: i === 0 }));
  assert.equal(weekChallenge({ todayYmd: '2026-11-22', expenses: many, xpLog: [] }).status, 'failed');
});

test('Offene Bestätigungen: nur automatische, unbestätigte Buchungen der letzten 14 Tage', () => {
  const ledger = [
    { id: 'auto-a-2026-11-16', datum: '2026-11-16', auto: true },
    { id: 'auto-a-2026-10-16', datum: '2026-10-16', auto: true },
    { id: 'auto-b-2026-11-29', datum: '2026-11-29', auto: true },
    { id: 'x', datum: '2026-11-20', typ: 'abgleich' },
    { id: 'auto-c-2026-11-10', datum: '2026-11-10', auto: true, bestaetigt: true }
  ];
  assert.deepEqual(pendingConfirmations(ledger, '2026-11-22').map((e) => e.id), ['auto-a-2026-11-16']);
});

test('Taschengeld: 5 € pro Level-Aufstieg, verbrauchtes wird abgezogen', () => {
  assert.deepEqual(taschengeld(1, []), { earned: 0, used: 0, frei: 0 });
  assert.deepEqual(taschengeld(4, [{ betrag: 6.5, taschengeld: true }, { betrag: 3 }]), { earned: 15, used: 6.5, frei: 8.5 });
});

test('Impulskauf verschiebt das Ziel um Tage gemessen an der Sparrate', () => {
  assert.ok(Math.abs(impulseDelayDays(24.84, 755) - 1) < 0.01);
  assert.equal(impulseDelayDays(10, 0), 0);
});

test('Erfolge werden aus dem Zustand erkannt', () => {
  const ctx = { expenses: [{}], ledger: [], streak: 8, balance: 600, reachedSum: 0, reached: 0, daysSinceRewe: 2, questsDone: 0, level: 2 };
  const s = achievementState(ctx, new Set(['level-5']));
  const on = s.filter((a) => a.unlocked).map((a) => a.id);
  assert.deepEqual(on.sort(), ['erste-ausgabe', 'gespart-500', 'level-5', 'streak-7'].sort());
  assert.equal(daysSinceRewe([{ datum: '2026-11-20', haendler: 'REWE City' }], '2026-11-01', '2026-11-22'), 2);
});
