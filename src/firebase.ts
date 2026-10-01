import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Firebase se conserva solo para la autenticación: los datos ya viven en PostgreSQL.
export const firebaseReady = Boolean(cfg.apiKey)

const app = initializeApp(cfg)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
