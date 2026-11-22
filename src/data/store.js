import { defaultData } from './defaults.js';
import { today } from '../logic/dates.js';

export const COLLECTIONS = ['income', 'fixed', 'savingsRules', 'goals', 'expenses', 'ledger'];

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

const LOCAL_KEY = 'finanzplaner:data:v1';

export function readLocal(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function localBackend({ storage = globalThis.localStorage, now = () => new Date() } = {}) {
  let data = readLocal(storage) || defaultData(today(now()));
  const listeners = new Set();
  const persist = () => {
    try {
      storage?.setItem(LOCAL_KEY, JSON.stringify(data));
    } catch {}
  };
  const emit = () => {
    const snap = structuredClone(data);
    listeners.forEach((cb) => cb({ ...snap, ready: true }));
  };
  persist();
  globalThis.addEventListener?.('storage', (e) => {
    if (e.key !== LOCAL_KEY || !e.newValue) return;
    data = JSON.parse(e.newValue);
    emit();
  });
  const commit = () => {
    persist();
    emit();
    return Promise.resolve();
  };
  return {
    mode: 'local',
    subscribe(cb) {
      listeners.add(cb);
      cb({ ...structuredClone(data), ready: true });
      return () => listeners.delete(cb);
    },
    set(col, id, value) {
      const list = data[col];
      const i = list.findIndex((x) => x.id === id);
      const doc = { ...value, id };
      if (i >= 0) list[i] = doc;
      else list.push(doc);
      return commit();
    },
    update(col, id, patch) {
      const item = data[col].find((x) => x.id === id);
      if (item) Object.assign(item, patch);
      return commit();
    },
    remove(col, id) {
      data[col] = data[col].filter((x) => x.id !== id);
      return commit();
    },
    setMany(col, docs) {
      for (const doc of docs) {
        const i = data[col].findIndex((x) => x.id === doc.id);
        if (i >= 0) data[col][i] = doc;
        else data[col].push(doc);
      }
      return commit();
    },
    setProfile(patch) {
      data.profile = { ...data.profile, ...patch, settings: { ...data.profile.settings, ...(patch.settings || {}) } };
      return commit();
    },
    exportAll: () => structuredClone(data)
  };
}

export async function cloudBackend({ db, uid, seed }) {
  const fs = await import('firebase/firestore');
  const userRef = fs.doc(db, 'users', uid);
  const existing = await fs.getDoc(userRef);
  if (!existing.exists()) {
    const batch = fs.writeBatch(db);
    batch.set(userRef, seed.profile);
    for (const col of COLLECTIONS) {
      for (const item of seed[col] || []) {
        const { id, ...rest } = item;
        batch.set(fs.doc(db, 'users', uid, col, id), rest);
      }
    }
    await batch.commit();
  }

  const state = { profile: null, ready: false, ...Object.fromEntries(COLLECTIONS.map((c) => [c, []])) };
  const loaded = new Set();
  const listeners = new Set();
  let pending = false;
  const emit = () => {
    state.ready = loaded.size === COLLECTIONS.length + 1;
    listeners.forEach((cb) => cb(structuredClone(state)));
  };
  const unsubs = [
    fs.onSnapshot(userRef, { includeMetadataChanges: true }, (snap) => {
      state.profile = snap.data() || null;
      pending = snap.metadata.hasPendingWrites;
      state.syncPending = pending;
      loaded.add('profile');
      emit();
    }),
    ...COLLECTIONS.map((col) =>
      fs.onSnapshot(fs.collection(db, 'users', uid, col), (snap) => {
        state[col] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        loaded.add(col);
        emit();
      })
    )
  ];

  const clean = (value) => Object.fromEntries(Object.entries(value).filter(([k, v]) => k !== 'id' && v !== undefined));
  const ref = (col, id) => fs.doc(db, 'users', uid, col, id);

  return {
    mode: 'cloud',
    subscribe(cb) {
      listeners.add(cb);
      cb(structuredClone(state));
      return () => listeners.delete(cb);
    },
    set: (col, id, value) => fs.setDoc(ref(col, id), clean(value)),
    update: (col, id, patch) => fs.updateDoc(ref(col, id), clean(patch)),
    remove: (col, id) => fs.deleteDoc(ref(col, id)),
    async setMany(col, docs) {
      const batch = fs.writeBatch(db);
      docs.forEach((d) => batch.set(ref(col, d.id), clean(d)));
      await batch.commit();
    },
    setProfile: (patch) => fs.setDoc(userRef, clean(patch), { merge: true }),
    close: () => unsubs.forEach((u) => u()),
    exportAll: () => structuredClone(state)
  };
}
