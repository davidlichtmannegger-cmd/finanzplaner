import test from 'node:test';
import assert from 'node:assert/strict';
import { euro, parseAmount, esc, goalDateLabel, inDays } from '../src/ui/format.js';

test('Beträge werden deutsch formatiert', () => {
  assert.equal(euro(1000).replace(/\s/g, ' '), '1.000 €');
  assert.equal(euro(4.79).replace(/\s/g, ' '), '4,79 €');
});

test('Eingaben mit Komma, Punkt und Euro-Zeichen werden gelesen', () => {
  assert.equal(parseAmount('4,79'), 4.79);
  assert.equal(parseAmount('1.130'), 1130);
  assert.equal(parseAmount('12.5 €'), 12.5);
  assert.ok(Number.isNaN(parseAmount('abc')));
});

test('HTML in Namen wird entschärft', () => {
  assert.equal(esc('<b>Rewe</b> & Co'), '&lt;b&gt;Rewe&lt;/b&gt; &amp; Co');
});

test('Zieldatum: Monat bei Release-Termin, sonst Tag', () => {
  assert.equal(goalDateLabel({ datum: '2027-09-01', wartetAufTermin: true }), 'September 2027');
  assert.equal(goalDateLabel({ datum: '2026-12-29' }), '29. Dezember 2026');
  assert.equal(inDays(0), 'heute');
  assert.equal(inDays(5), 'in 5 Tagen');
});
