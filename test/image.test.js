import test from 'node:test';
import assert from 'node:assert/strict';
import { fitSize, squareCrop, dataUrlBytes } from '../src/ui/image.js';

test('Bilder werden proportional verkleinert, nie vergrößert', () => {
  assert.deepEqual(fitSize(4032, 3024, 1000), { w: 1000, h: 750 });
  assert.deepEqual(fitSize(3024, 4032, 1000), { w: 750, h: 1000 });
  assert.deepEqual(fitSize(400, 300, 1000), { w: 400, h: 300 });
});

test('Vorschaubild wird mittig quadratisch zugeschnitten', () => {
  assert.deepEqual(squareCrop(4000, 3000), { sx: 500, sy: 0, side: 3000 });
  assert.deepEqual(squareCrop(3000, 4000), { sx: 0, sy: 500, side: 3000 });
});

test('Größe einer Data-URL wird geschätzt', () => {
  assert.equal(dataUrlBytes('data:image/jpeg;base64,AAAA'), 3);
});
