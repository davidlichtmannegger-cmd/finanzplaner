import { firebaseConfig } from './firebase-config.js';

export const isConfigured = (config = firebaseConfig) =>
  ['apiKey', 'authDomain', 'projectId', 'appId'].every((key) => typeof config[key] === 'string' && config[key].trim() !== '');

let services = null;

export async function connectFirebase() {
  if (!isConfigured()) return null;
  if (services) return services;
  const [{ initializeApp }, { getAuth }, { initializeFirestore, persistentLocalCache, persistentMultipleTabManager }] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore')
  ]);
  const app = initializeApp(firebaseConfig);
  services = {
    app,
    auth: getAuth(app),
    db: initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  };
  return services;
}
