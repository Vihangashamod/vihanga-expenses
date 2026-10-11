import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, type Firestore,
} from "firebase/firestore";

/* Firebase web config is public by design; access is protected by Auth + firestore.rules. */
const firebaseConfig = {
  apiKey: "AIzaSyDTff75XDsMmUeb_U8Z3nKxhWls6OG-MXQ",
  authDomain: "vihanga-expenses.firebaseapp.com",
  projectId: "vihanga-expenses",
  storageBucket: "vihanga-expenses.firebasestorage.app",
  messagingSenderId: "714165177936",
  appId: "1:714165177936:web:ea127fdb830809c1a44b55",
  measurementId: "G-3EJB6TXHTL",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

let db: Firestore;
try {
  // Offline cache: the app keeps working without a connection and syncs later.
  db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch {
  db = getFirestore(app);
}
export { db };
