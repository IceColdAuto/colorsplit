import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getStorage } from 'firebase/storage'

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL

export const DEMO_MODE = !apiKey || apiKey === 'REPLACE_ME' || !databaseURL || databaseURL === 'REPLACE_ME'

// Startup mode indicator
if (DEMO_MODE) {
  console.log('%cColorSplit running in DEMO_MODE — multiplayer disabled', 'color: orange; font-weight: bold')
} else {
  console.log('%cColorSplit running with Firebase ✓', 'color: green; font-weight: bold')
}

let db = null
let app = null
let storage = null

if (!DEMO_MODE) {
  const firebaseConfig = {
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }
  app = initializeApp(firebaseConfig)
  db = getDatabase(app)
  storage = getStorage(app)
}

export { db, app, storage }
