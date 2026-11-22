import test from 'node:test';
import assert from 'node:assert/strict';
import { localBackend, readLocal } from '../src/data/store.js';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};

test('Lokales Backend startet mit Davids Startwerten und speichert Änderungen', async () => {
  const storage = memoryStorage();
  const store = localBackend({ storage, now: () => new Date(2026, 10, 22) });
  let snap;
  store.subscribe((s) => (snap = s));
  assert.equal(snap.goals.length, 6);
  assert.equal(snap.profile.startDatum, '2026-11-22');
  await store.set('expenses', 'e1', { betrag: 4.79, haendler: 'Rewe', datum: '2026-11-22' });
  assert.equal(snap.expenses[0].haendler, 'Rewe');
  await store.update('fixed', 'fix-tr', { pausiert: true });
  assert.equal(snap.fixed.find((f) => f.id === 'fix-tr').pausiert, true);
  await store.remove('expenses', 'e1');
  assert.equal(snap.expenses.length, 0);
  await store.setProfile({ settings: { roast: false } });
  assert.deepEqual(snap.profile.settings, { roast: false, sounds: false, push: false });
  assert.equal(readLocal(storage).fixed.find((f) => f.id === 'fix-tr').pausiert, true);
  const again = localBackend({ storage });
  let snap2;
  again.subscribe((s) => (snap2 = s));
  assert.equal(snap2.fixed.find((f) => f.id === 'fix-tr').pausiert, true);
});
