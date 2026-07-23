
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================
//
// Config is read from Vite env vars (VITE_FIREBASE_*) so you can deploy the
// same code to multiple environments without touching this file.
//
// In development:  create a `.env.local` file with your values.
// On Vercel:       add the same vars in Project Settings → Environment Variables.
//
// If env vars are missing, we fall back to the demo project baked into the
// repo. The demo project works out-of-the-box for testing, BUT you should
// configure your own Firebase project for production use to avoid sharing
// data with other users of this template.
// ============================================================================

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyA0PANlB10xZCY-g4J8Uy8Uxk7dA6mm320",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "wise-thinker-25jvd.firebaseapp.com",
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || "wise-thinker-25jvd",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "wise-thinker-25jvd.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "708063794172",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:708063794172:web:7bca26eeff1f96c8cad879",
};

// Optional: Firestore named database ID. Leave empty to use the default DB.
// The demo project uses a named database ("ai-studio-147bfb7a-43d4-4990-a977-083cb4237404").
// Your own Firebase project will most likely use the default database, so set
// VITE_FIRESTORE_DATABASE_ID="" in your .env.local to use the default.
const firestoreDatabaseId =
  import.meta.env.VITE_FIRESTORE_DATABASE_ID ??
  "ai-studio-147bfb7a-43d4-4990-a977-083cb4237404";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
// Request standard profile info + Calendar scope (used for reminder scheduling)
googleProvider.addScope("profile");
googleProvider.addScope("email");
googleProvider.addScope("https://www.googleapis.com/auth/calendar.events");

// Initialize Firestore with the configured database ID.
// Pass undefined (not empty string) to use the default database.
const db = getFirestore(
  app,
  firestoreDatabaseId && firestoreDatabaseId.length > 0
    ? firestoreDatabaseId
    : undefined
);

export { app, auth, googleProvider, db };

