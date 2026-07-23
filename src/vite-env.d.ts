
/// <reference types="vite/client" />

// ============================================================================
// Vite client env type declarations
// ============================================================================
// This file makes TypeScript aware of `import.meta.env.*` variables used by
// Vite. Without it, `tsc --noEmit` fails on `import.meta.env`.
// See: https://vitejs.dev/guide/env-and-mode.html
// ============================================================================

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIRESTORE_DATABASE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

