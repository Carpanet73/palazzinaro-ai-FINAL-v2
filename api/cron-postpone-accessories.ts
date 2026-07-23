
/**
 * Vercel Cron Serverless Function — /api/cron-postpone-accessories
 *
 * CORREZIONE D — Sostituisce la vecchia logica client-side (useEffect + localStorage
 * in App.tsx) con un vero cron job Vercel che gira il giorno 1 di ogni mese alle 3:00.
 * Configurazione in vercel.json:
 *   { "path": "/api/cron-postpone-accessories", "schedule": "0 3 1 * *" }
 *
 * REGOLA DI BUSINESS:
 * Trova tutte le voci Fast Closing NON di tipo canone (source diverso da "contract",
 * o titolo che non contiene "canone"/"affitto") con status "Pending" o "Overdue",
 * sposta la dueDate di un mese avanti, resetta lo status a "Pending".
 *
 * SICUREZZA:
 * - Vercel Cron invia header `Authorization: Bearer ${CRON_SECRET}` automaticamente.
 * - Verifichiamo che matchi la variabile d'ambiente CRON_SECRET.
 * - Rifiutiamo con 401 qualsiasi altra richiesta.
 *
 * LOG:
 * - Salva un documento nella collezione "systemJobsLog" con timestamp,
 *   numero di voci spostate, eventuali errori. Così l'utente può verificare
 *   in Firestore che il job sia effettivamente girato.
 *
 * FIREBASE ADMIN SDK:
 * - Inizializzato con FIREBASE_SERVICE_ACCOUNT_KEY (JSON stringificato).
 * - Usa Admin SDK perché gira lato server con privilegi amministrativi,
 *   non richiede Auth ma è protetto dal CRON_SECRET.
 *
 * VARIABILI D'AMBIENTE RICHIESTE (su Vercel → Project → Settings → Environment Variables):
 * - FIREBASE_SERVICE_ACCOUNT_KEY: JSON della service account Firebase, stringificato.
 *   Ottenerlo: Firebase Console → Project Settings → Service Accounts → Generate new private key.
 *   Poi: `cat serviceAccount.json | jq -c .` per stringificarlo su una riga.
 * - CRON_SECRET: stringa arbitraria lunga (es. 32+ caratteri random).
 *   Vercel la invia automaticamente nelle chiamate cron come header Authorization.
 * - FIREBASE_FIRESTORE_DATABASE_ID: (opzionale) ID del database Firestore.
 *   Se vuoto, usa il default database.
 */

import admin from 'firebase-admin';
import type { IncomingMessage, ServerResponse } from 'http';

// ── Singleton initialization ──────────────────────────────────────────────
let adminApp: admin.app.App | null = null;

function getAdminApp(): admin.app.App {
  if (adminApp) return adminApp;

  const serviceAccountKeyStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKeyStr) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is missing.');
  }

  let serviceAccount: admin.ServiceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountKeyStr);
  } catch (e: any) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON: ${e.message}`);
  }

  // Inizializza senza firestoreDatabaseId in AppOptions (non supportato da tutti i tipi),
  // il databaseId viene passato a getFirestore() sotto.
  adminApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  }, 'palazzinaro-cron-' + Date.now());

  return adminApp;
}

// ── Helper: ottiene Firestore con il databaseId opzionale ────────────────
function getFirestore() {
  const app = getAdminApp();
  const databaseId = process.env.FIREBASE_FIRESTORE_DATABASE_ID || undefined;
  // Il secondo argomento di app.firestore() è il databaseId (supportato da firebase-admin 12+)
  return (app.firestore as any)(databaseId);
}

// ── Helper: sposta una data avanti di 1 mese ──────────────────────────────
function addOneMonth(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const today = new Date();
    today.setMonth(today.getMonth() + 1);
    return today.toISOString().split('T')[0];
  }
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
}

// ── Helper: determina se una voce è un canone d'affitto (NON rinviabile) ─
function isRentItem(item: any): boolean {
  if (item.source === 'contract') return true;
  const titleLower = (item.title || '').toLowerCase();
  const descLower = (item.description || '').toLowerCase();
  if (titleLower.includes('canone') || titleLower.includes('affitto')) return true;
  if (descLower.includes('canone') || descLower.includes('affitto')) return true;
  return false;
}

// ── Tipi minimi per req/res (compatibili con Vercel Node.js runtime) ─────
interface VercelRequestLike {
  method?: string;
  headers: { [key: string]: string | string[] | undefined };
  body?: any;
  query?: any;
}

interface VercelResponseLike {
  status(code: number): VercelResponseLike;
  json(body: any): void;
  setHeader(name: string, value: string): void;
  end(): void;
}

// ── Handler principale ────────────────────────────────────────────────────
export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  const startedAt = new Date();
  let totalScanned = 0;
  let totalPostponed = 0;
  let totalErrors = 0;
  const errorMessages: string[] = [];
  const samplePostponedTitles: string[] = [];

  try {
    // ── 1. Sicurezza: verifica CRON_SECRET ────────────────────────────────
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('[cron-postpone] CRON_SECRET env var not set — refusing to run.');
      return res.status(500).json({
        success: false,
        error: 'CRON_SECRET env var not set. Configure it in Vercel → Settings → Environment Variables.',
      });
    }

    const authHeader = req.headers['authorization'];
    const providedSecret = Array.isArray(authHeader)
      ? authHeader[0]?.replace(/^Bearer\s+/i, '')
      : authHeader?.replace(/^Bearer\s+/i, '');

    if (providedSecret !== cronSecret) {
      console.warn('[cron-postpone] Unauthorized request — secret mismatch.');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. This endpoint can only be called by Vercel Cron with the correct CRON_SECRET.',
      });
    }

    // ── 2. Inizializza Firebase Admin ─────────────────────────────────────
    const firestore = getFirestore();

    console.log('[cron-postpone] Starting monthly accessory postpone job at', startedAt.toISOString());

    // ── 3. Leggi tutte le voci Fast Closing NON paid ──────────────────────
    const pendingSnapshot = await firestore
      .collection('fastClosing')
      .where('status', '==', 'Pending')
      .get();

    const overdueSnapshot = await firestore
      .collection('fastClosing')
      .where('status', '==', 'Overdue')
      .get();

    const candidates: { id: string; data: any }[] = [];
    pendingSnapshot.forEach((d: any) => candidates.push({ id: d.id, data: d.data() }));
    overdueSnapshot.forEach((d: any) => candidates.push({ id: d.id, data: d.data() }));

    totalScanned = candidates.length;
    console.log(`[cron-postpone] Scanned ${totalScanned} pending/overdue items.`);

    // ── 4. Filtra solo le spese accessorie (NON affitti) ──────────────────
    const toPostpone = candidates.filter(({ data }) => !isRentItem(data));
    console.log(`[cron-postpone] ${toPostpone.length} accessory items to postpone (rents excluded).`);

    // ── 5. Sposta ogni voce di 1 mese avanti e resetta status a Pending ──
    const batch = firestore.batch();
    for (const { id, data } of toPostpone) {
      try {
        const newDueDate = addOneMonth(data.dueDate || new Date().toISOString().split('T')[0]);
        const ref = firestore.collection('fastClosing').doc(id);
        batch.update(ref, {
          dueDate: newDueDate,
          status: 'Pending',
          autoPostponedAt: admin.firestore.FieldValue.serverTimestamp(),
          autoPostponedBy: 'cron-job-server-side',
        });
        totalPostponed++;
        if (samplePostponedTitles.length < 10 && data.title) {
          samplePostponedTitles.push(data.title);
        }
      } catch (e: any) {
        totalErrors++;
        errorMessages.push(`Item ${id}: ${e.message}`);
      }
    }

    if (totalPostponed > 0) {
      await batch.commit();
    }

    console.log(`[cron-postpone] Successfully postponed ${totalPostponed} items.`);

    // ── 6. Scrivi il log in systemJobsLog ─────────────────────────────────
    const finishedAt = new Date();
    const logRef = firestore.collection('systemJobsLog').doc();
    await logRef.set({
      jobName: 'cron-postpone-accessories',
      startedAt: admin.firestore.Timestamp.fromDate(startedAt),
      finishedAt: admin.firestore.Timestamp.fromDate(finishedAt),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      totalScanned,
      totalPostponed,
      totalErrors,
      errorMessages: errorMessages.slice(0, 50),
      samplePostponedTitles,
      status: totalErrors === 0 ? 'success' : 'partial',
      triggeredBy: 'vercel-cron',
    });

    return res.status(200).json({
      success: true,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      totalScanned,
      totalPostponed,
      totalErrors,
      samplePostponedTitles,
      logDocumentId: logRef.id,
    });
  } catch (error: any) {
    totalErrors++;
    const errorMsg = error?.message || String(error);
    errorMessages.push(errorMsg);
    console.error('[cron-postpone] FATAL ERROR:', errorMsg);

    try {
      const firestore = getFirestore();
      const finishedAt = new Date();
      await firestore.collection('systemJobsLog').add({
        jobName: 'cron-postpone-accessories',
        startedAt: admin.firestore.Timestamp.fromDate(startedAt),
        finishedAt: admin.firestore.Timestamp.fromDate(finishedAt),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        totalScanned,
        totalPostponed,
        totalErrors,
        errorMessages: errorMessages.slice(0, 50),
        status: 'failed',
        triggeredBy: 'vercel-cron',
        fatalError: errorMsg,
      });
    } catch (logErr) {
      console.error('[cron-postpone] Could not write error log to Firestore:', logErr);
    }

    return res.status(500).json({
      success: false,
      error: errorMsg,
      totalScanned,
      totalPostponed,
      totalErrors,
    });
  }
}

