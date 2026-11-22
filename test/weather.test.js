import test from 'node:test';
import assert from 'node:assert/strict';
import { weatherType, parseWeather, season, gearFor, nextGear, roundCoord } from '../src/logic/weather.js';

test('WMO-Codes werden Wetterarten zugeordnet', () => {
  assert.equal(weatherType(0), 'klar');
  assert.equal(weatherType(3), 'bewoelkt');
  assert.equal(weatherType(45), 'nebel');
  assert.equal(weatherType(61), 'regen');
  assert.equal(weatherType(81), 'regen');
  assert.equal(weatherType(73), 'schnee');
  assert.equal(weatherType(86), 'schnee');
  assert.equal(weatherType(95), 'gewitter');
});

test('Open-Meteo-Antwort wird gelesen', () => {
  const w = parseWeather({ current: { time: '2026-11-22T23:15', weather_code: 2, temperature_2m: 1.04, is_day: 0, wind_speed_10m: 5.1, cloud_cover: 43 } });
  assert.deepEqual(w, { typ: 'bewoelkt', code: 2, temp: 1, wind: 5, wolken: 43, tag: false, zeit: '2026-11-22T23:15' });
  assert.equal(parseWeather({}), null);
});

test('Jahreszeiten nach Monat', () => {
  assert.deepEqual([0, 3, 6, 9, 11].map(season), ['winter', 'fruehling', 'sommer', 'herbst', 'winter']);
});

test('Ausrüstung nach Level', () => {
  assert.deepEqual(gearFor(1), []);
  assert.deepEqual(gearFor(4).map((g) => g.id), ['rucksack', 'kopflampe', 'eispickel']);
  assert.equal(nextGear(4).id, 'seil');
  assert.equal(nextGear(10), null);
  assert.equal(roundCoord(50.11234), 50.11);
});
