import { getRuntimeConfig } from '@/config/runtimeConfig'
import { initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'

const runtime = getRuntimeConfig()

const firebaseConfig = {
  apiKey: runtime.FIREBASE_API_KEY,
  authDomain: runtime.FIREBASE_AUTH_DOMAIN,
  projectId: runtime.FIREBASE_PROJECT_ID,
  storageBucket: runtime.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: runtime.FIREBASE_MESSAGING_SENDER_ID,
  appId: runtime.FIREBASE_APP_ID,
}

const firebaseApp: FirebaseApp = initializeApp(firebaseConfig)

export default firebaseApp
