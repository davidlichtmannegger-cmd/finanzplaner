const MESSAGES = {
  'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht.',
  'auth/wrong-password': 'E-Mail oder Passwort stimmt nicht.',
  'auth/user-not-found': 'Zu dieser E-Mail gibt es noch kein Konto.',
  'auth/email-already-in-use': 'Für diese E-Mail gibt es schon ein Konto – bitte anmelden.',
  'auth/weak-password': 'Das Passwort braucht mindestens 6 Zeichen.',
  'auth/invalid-email': 'Die E-Mail-Adresse sieht nicht richtig aus.',
  'auth/popup-closed-by-user': 'Anmeldefenster wurde geschlossen.',
  'auth/popup-blocked': 'Das Anmeldefenster wurde blockiert – bitte Pop-ups erlauben.',
  'auth/unauthorized-domain': 'Diese Adresse ist in Firebase noch nicht als autorisierte Domain eingetragen.',
  'auth/network-request-failed': 'Keine Verbindung – bitte Internet prüfen.',
  'auth/too-many-requests': 'Zu viele Versuche – bitte kurz warten.'
};

export const authMessage = (err) => MESSAGES[err?.code] || 'Anmeldung hat nicht geklappt.';

export async function createAuth(auth) {
  const m = await import('firebase/auth');
  await m.setPersistence(auth, m.browserLocalPersistence).catch(() => {});
  return {
    onChange: (cb) => m.onAuthStateChanged(auth, cb),
    google: () => m.signInWithPopup(auth, new m.GoogleAuthProvider()),
    login: (email, password) => m.signInWithEmailAndPassword(auth, email, password),
    register: (email, password) => m.createUserWithEmailAndPassword(auth, email, password),
    reset: (email) => m.sendPasswordResetEmail(auth, email),
    logout: () => m.signOut(auth)
  };
}
