import test from 'node:test';
import assert from 'node:assert/strict';
import { swipeTarget, clampPage } from '../src/ui/nav.js';
import { isConfigured } from '../src/firebase.js';

test('Wischen nach links geht eine Seite weiter, nach rechts zurück', () => {
  assert.equal(swipeTarget(0, -120, 5), 1);
  assert.equal(swipeTarget(2, 120, 5), 1);
});

test('kurze oder schräge Wischer ändern die Seite nicht', () => {
  assert.equal(swipeTarget(1, -40, 0), 1);
  assert.equal(swipeTarget(1, -100, 90), 1);
});

test('Seiten bleiben im gültigen Bereich', () => {
  assert.equal(swipeTarget(3, -200, 0), 3);
  assert.equal(swipeTarget(0, 200, 0), 0);
  assert.equal(clampPage(9), 3);
});

test('Firebase gilt erst mit vollständiger Konfiguration als eingerichtet', () => {
  assert.equal(isConfigured({ apiKey: '', authDomain: '', projectId: '', appId: '' }), false);
  assert.equal(isConfigured({ apiKey: 'a', authDomain: 'b.firebaseapp.com', projectId: 'b', appId: '1:2:web:3' }), true);
});
