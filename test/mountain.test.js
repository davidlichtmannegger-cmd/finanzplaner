import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoute, positionAt, hutsAlong, impulseSum, peakHeight, dayPhase } from '../src/logic/mountain.js';

const goals = [
  { id: 'ps5', name: 'PS5', kosten: 1000 },
  { id: 'tv', name: 'TV', kosten: 1130 },
  { id: 'pc', name: 'PC', kosten: 2000 }
];

test('Gipfel: Reihenfolge, Geldspannen und Höhe nach Kosten', () => {
  const r = buildRoute(goals);
  assert.deepEqual(r.peaks.map((p) => [p.id, p.from, p.to]), [['ps5', 0, 1000], ['tv', 1000, 2130], ['pc', 2130, 4130]]);
  assert.equal(r.total, 4130);
  assert.ok(r.peaks[2].h > r.peaks[0].h);
  assert.ok(r.peaks[1].x > r.peaks[0].x);
  assert.ok(peakHeight(600) < peakHeight(1500));
});

test('Notfalltopf ist das Basislager vor dem ersten Gipfel', () => {
  const r = buildRoute(goals, { reserve: 300 });
  assert.equal(r.peaks[0].id, 'notfall');
  assert.equal(r.peaks[1].from, 300);
  assert.deepEqual(positionAt(r, 150), { index: 0, t: 0.5, done: false });
  assert.equal(positionAt(r, 300).index, 1);
});

test('Bergsteiger-Position aus dem gesparten Geld', () => {
  const r = buildRoute(goals);
  assert.deepEqual(positionAt(r, 0), { index: 0, t: 0, done: false });
  assert.deepEqual(positionAt(r, 500), { index: 0, t: 0.5, done: false });
  const tv = positionAt(r, 1565);
  assert.equal(tv.index, 1);
  assert.ok(Math.abs(tv.t - 0.5) < 1e-9);
  assert.deepEqual(positionAt(r, 9999), { index: 2, t: 1, done: true });
  assert.equal(positionAt(buildRoute([]), 100).index, -1);
});

test('Hütten an den nächsten Daueraufträgen', () => {
  const r = buildRoute(goals);
  const huts = hutsAlong(r, 0, [{ datum: '2026-11-29', betrag: 270 }, { datum: '2026-12-16', betrag: 485 }, { datum: '2026-12-29', betrag: 270 }]);
  assert.deepEqual(huts.map((h) => [h.datum, h.money, h.index]), [['2026-11-29', 270, 0], ['2026-12-16', 755, 0], ['2026-12-29', 1025, 1]]);
});

test('Impulskäufe für den Geister-Kletterer, Taschengeld zählt nicht', () => {
  assert.equal(impulseSum([{ betrag: 12.99, impuls: true }, { betrag: 5, impuls: true, taschengeld: true }, { betrag: 3 }]), 12.99);
});

test('Tageszeiten', () => {
  assert.equal(dayPhase(3), 'nacht');
  assert.equal(dayPhase(6, 30), 'morgen');
  assert.equal(dayPhase(13), 'tag');
  assert.equal(dayPhase(18), 'abend');
  assert.equal(dayPhase(20), 'daemmerung');
  assert.equal(dayPhase(22), 'nacht');
});
