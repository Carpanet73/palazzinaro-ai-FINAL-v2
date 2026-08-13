
/**
 * Vercel Cron Serverless Function — /api/cron-close-fast-closing
 *
 * Chiusura automatica REALE del Fast Closing, per ogni utente, il giorno 1 di ogni mese.
 * Configurazione in vercel.json:
 *   { "path": "/api/cron-close-fast-closing", "schedule": "0 2 1 * *" }
 *
 * PERCHÉ ESISTE:
 * Prima di questo file esisteva solo un conto alla rovescia decorativo lato client
 * (FastClosingView.tsx) — se l'utente non apriva l'app in quella finestra di giorni, la
 * chiusura del mese non succedeva mai: nessun Sollecito veniva creato, i canoni scaduti
 * non venivano riproposti, le spese accessorie non marcate non venivano rinviate.
 * Questo cron replica fedelmente, lato server e per OGNI utente registrato, la stessa
 * identica logica di business di `handleConfirmCloseFastClosing` (FastClosingView.tsx) +
 * la logica di aggancio a un Sollecito già attivo di `handleUpdateClosingItemStatus`
 * (App.tsx) — stesso comportamento, sia che l'azione parta dal client sia che parta da qui.
 *
 * REGOLA DI BUSINESS (replicata 1:1 dal client):
 * - CORREZIONE CO (13/08/2026): Voci rigide (canone, source "contract"): passano SOLO a
 *   "Overdue" e SOLO in Sollecito — MAI riproposte come nuova voce pending il mese
 *   successivo (bug reale corretto in questa data: causava doppia contabilizzazione dello
 *   stesso debito, righe "[Arretrato]" impilate). Questo commento descriveva in precedenza
 *   il comportamento sbagliato: aggiornato per restare allineato al codice reale.
 * - Voci accessorie già Overdue: restano Overdue (confluiscono nei Solleciti sotto).
 * - Voci accessorie ancora Pending: vengono rinviate di un mese, stato torna a Pending.
 *   Questo cron sostituisce interamente lo scopo di api/cron-postpone-accessories.ts (che
 *   restava non schedulato in vercel.json): tenerne due separati avrebbe rischiato di far
 *   girare due job che processano le stesse voci due volte, violando la regola "un solo
 *   flusso per ogni azione". cron-postpone-accessories.ts resta nel repository per
 *   trasparenza di cronologia ma non è più referenziato in vercel.json.
 * - Un Sollecito consolidato per debitore (canoni + accessorie insolute): se il debitore ha
 *   già un Sollecito attivo (status diverso da Closed/Cancelled/Paid), le nuove voci si
 *   aggiungono al gruppo esistente (associatedItemsIds, importo, causale) invece di
 *   generarne uno nuovo — stessa identica funzione già usata per il pulsante "Insoluto".
 * - I Proprietari non generano MAI Solleciti (causa a se stessi: non ha senso). La voce
 *   resta Overdue, senza sollecito.
 * - Se il debitore ha già una pratica legale ATTIVA e AFFIDATA a un avvocato, non si crea
 *   un nuovo Sollecito: la voce resta Overdue, pronta per l'invio diretto all'avvocato.
 * - Indennità di Occupazione: per i contratti terminati (scadenza naturale O disdetta
 *   anticipata, CORREZIONE CL 05/08/2026) ma senza Verbale di Riconsegna registrato, il
 *   canone continua a fluire ogni mese con lo stesso importo, rinominato.
 * - Il periodo attivo (appState/{userId}.fastClosingActivePeriod) avanza SEMPRE al mese
 *   successivo il giorno 1, anche se non c'era nulla da chiudere quel mese — altrimenti
 *   l'etichetta "Stai modificando -> FAST CLOSING [MESE ANNO]" mostrata in pagina resterebbe
 *   ferma al mese vecchio.
 *
 * NESSUNA DATA HARDCODED: ogni calcolo di mese/periodo deriva da `new Date()` al momento
 * dell'esecuzione del job, mai da una stringa fissa.
 *
 * SICUREZZA: stesso pattern di api/cron-postpone-accessories.ts — Vercel Cron invia
 * `Authorization: Bearer ${CRON_SECRET}`, verificato contro la variabile d'ambiente.
 *
 * VARIABILI D'AMBIENTE RICHIESTE (Vercel → Project → Settings → Environment Variables):
 * - FIREBASE_SERVICE_ACCOUNT_KEY: JSON della service account Firebase, stringificato.
 * - CRON_SECRET: stringa arbitraria lunga, inviata automaticamente da Vercel Cron.
 * - FIREBASE_FIRESTORE_DATABASE_ID: (opzionale) ID del database Firestore.
 */

import admin from 'firebase-admin';

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

  adminApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  }, 'palazzinaro-cron-close-' + Date.now());

  return adminApp;
}

function getFirestore() {
  const app = getAdminApp();
  const databaseId = process.env.FIREBASE_FIRESTORE_DATABASE_ID || undefined;
  return (app.firestore as any)(databaseId);
}

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

// ── Helpers di data (SEMPRE da new Date(), mai stringhe fisse) ───────────
function periodToDate(period: string): Date {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1);
}

function nextPeriodOf(period: string): string {
  const d = periodToDate(period);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function realCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function addOneMonthToDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const today = new Date();
    today.setMonth(today.getMonth() + 1);
    return today.toISOString().split('T')[0];
  }
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
}

// CORREZIONE CP (13/08/2026) — Fase 2 punto 1: stessa identica logica di formatLedgerLabel
// in src/lib/ledgerLabel.ts, duplicata qui volutamente (non importata) perché questa funzione
// serverless resta un file autonomo senza dipendenze dall'albero src/ (stesso pattern già in
// uso in questo file: solo firebase-admin viene importato). Se il formato cambia in un posto,
// va aggiornato in entrambi.
const ITALIAN_MONTHS_FULL_SERVER = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

function getDebtorSurnameServer(fullName: string | undefined | null, isCompany?: boolean): string {
  const name = (fullName || '').trim();
  if (!name) return 'Debitore';
  if (isCompany) return name;
  const lastSpaceIdx = name.lastIndexOf(' ');
  if (lastSpaceIdx === -1) return name;
  return name.substring(lastSpaceIdx + 1).trim() || name;
}

function parsePropertyStreetServer(address: string | undefined | null): string {
  const raw = (address || '').trim();
  if (!raw) return '';
  return raw.split(',')[0].trim();
}

function formatLedgerLabelServer(input: {
  debtorName: string | undefined | null;
  isCompany?: boolean;
  propertyAddress?: string | null;
  tipologia: string;
  dateForPeriod?: string;
}): string {
  const surname = getDebtorSurnameServer(input.debtorName, input.isCompany);
  const street = parsePropertyStreetServer(input.propertyAddress);
  let month: string | undefined;
  let year: number | undefined;
  const match = (input.dateForPeriod || '').match(/^(\d{4})-(\d{2})/);
  if (match) {
    const y = parseInt(match[1], 10);
    const mIdx = parseInt(match[2], 10) - 1;
    if (mIdx >= 0 && mIdx <= 11) {
      month = ITALIAN_MONTHS_FULL_SERVER[mIdx];
      year = y;
    }
  }
  const parts: string[] = [];
  parts.push(street ? `${surname}/${street}` : surname);
  if (input.tipologia) parts.push(input.tipologia);
  if (month) parts.push(month);
  if (year) parts.push(String(year));
  return parts.join(' ');
}

function isRigidItem(item: any): boolean {
  if (item.source === 'contract') return true;
  const titleLower = (item.title || '').toLowerCase();
  const descLower = (item.description || '').toLowerCase();
  return titleLower.includes('canone') || titleLower.includes('affitto') ||
         descLower.includes('canone') || descLower.includes('affitto');
}

// ── Risoluzione debitore, stessa logica (con fallback legacy) di getDebtorName ──
function resolveDebtor(item: any, tenants: any[], owners: any[]): { name: string | null; id?: string; type?: 'tenant' | 'owner' } {
  if (item.debtorId && item.debtorType === 'tenant') {
    const t = tenants.find((tt) => tt.id === item.debtorId);
    if (t) return { name: t.name, id: t.id, type: 'tenant' };
  }
  if (item.debtorId && item.debtorType === 'owner') {
    const o = owners.find((oo) => oo.id === item.debtorId);
    if (o) return { name: o.name, id: o.id, type: 'owner' };
  }
  // Fallback legacy: riconoscimento dal testo per voci create prima del collegamento ID reale.
  const titleLower = (item.title || '').toLowerCase();
  const descLower = (item.description || '').toLowerCase();
  const matchQuota = (item.title || '').match(/Quota\s+([^-]+?)\s*-\s*Manutenzione:/i);
  if (matchQuota) {
    const name = matchQuota[1].trim();
    const t = tenants.find((tt) => tt.name === name);
    if (t) return { name: t.name, id: t.id, type: 'tenant' };
    return { name, type: undefined };
  }
  const matchingTenant = tenants.find((t) => {
    const nameClean = (t.name || '').replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase().trim();
    return nameClean && (titleLower.includes(nameClean) || descLower.includes(nameClean));
  });
  if (matchingTenant) return { name: matchingTenant.name, id: matchingTenant.id, type: 'tenant' };
  const matchingBySurname = tenants.find((t) => {
    const lastSpace = (t.name || '').lastIndexOf(' ');
    if (lastSpace === -1) return false;
    const surname = t.name.substring(lastSpace + 1).toLowerCase().trim();
    return surname.length > 2 && (titleLower.includes(surname) || descLower.includes(surname));
  });
  if (matchingBySurname) return { name: matchingBySurname.name, id: matchingBySurname.id, type: 'tenant' };
  return { name: null };
}

// ── Handler principale ────────────────────────────────────────────────────
export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  const startedAt = new Date();
  const perUserResults: any[] = [];
  let totalUsersProcessed = 0;
  let totalErrors = 0;
  const errorMessages: string[] = [];

  try {
    // ── 1. Sicurezza: verifica CRON_SECRET ────────────────────────────────
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('[cron-close-fast-closing] CRON_SECRET env var not set — refusing to run.');
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
      console.warn('[cron-close-fast-closing] Unauthorized request — secret mismatch.');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. This endpoint can only be called by Vercel Cron with the correct CRON_SECRET.',
      });
    }

    const firestore = getFirestore();
    console.log('[cron-close-fast-closing] Starting monthly close job at', startedAt.toISOString());

    // ── 2. Enumera tutti gli utenti che hanno un periodo Fast Closing attivo ──
    const appStateSnapshot = await firestore.collection('appState').get();
    const users: { userId: string; activePeriod: string }[] = [];
    appStateSnapshot.forEach((d: any) => {
      const data = d.data();
      users.push({
        userId: d.id,
        activePeriod: data.fastClosingActivePeriod || realCurrentPeriod(),
      });
    });

    for (const { userId, activePeriod } of users) {
      let closedCount = 0;
      let solleciti = 0;
      let reproposed = 0;
      let postponed = 0;
      let indennita = 0;
      try {
        const today = new Date();

        const [fastClosingSnap, tenantsSnap, ownersSnap, remindersSnap, legalCasesSnap, contractsSnap, deliveryReportsSnap, propertiesSnap] = await Promise.all([
          firestore.collection('fastClosing').where('userId', '==', userId).get(),
          firestore.collection('tenants').where('userId', '==', userId).get(),
          firestore.collection('owners').where('userId', '==', userId).get(),
          firestore.collection('reminders').where('userId', '==', userId).get(),
          firestore.collection('legalCases').where('userId', '==', userId).get(),
          firestore.collection('contracts').where('userId', '==', userId).get(),
          firestore.collection('deliveryReports').where('userId', '==', userId).get(),
          // CORREZIONE CP (13/08/2026) — serve l'indirizzo immobile per l'etichetta standard
          // (Fase 2 punto 1) delle righe di Indennità di Occupazione generate qui.
          firestore.collection('properties').where('userId', '==', userId).get(),
        ]);

        const fastClosingItems: any[] = [];
        fastClosingSnap.forEach((d: any) => fastClosingItems.push({ id: d.id, ...d.data() }));
        const tenants: any[] = [];
        tenantsSnap.forEach((d: any) => tenants.push({ id: d.id, ...d.data() }));
        const owners: any[] = [];
        ownersSnap.forEach((d: any) => owners.push({ id: d.id, ...d.data() }));
        const reminders: any[] = [];
        remindersSnap.forEach((d: any) => reminders.push({ id: d.id, ...d.data() }));
        const legalCases: any[] = [];
        legalCasesSnap.forEach((d: any) => legalCases.push({ id: d.id, ...d.data() }));
        const contracts: any[] = [];
        contractsSnap.forEach((d: any) => contracts.push({ id: d.id, ...d.data() }));
        const deliveryReports: any[] = [];
        deliveryReportsSnap.forEach((d: any) => deliveryReports.push({ id: d.id, ...d.data() }));
        const properties: any[] = [];
        propertiesSnap.forEach((d: any) => properties.push({ id: d.id, ...d.data() }));

        // Stessa identica selezione di monthFilteredItems (selectedMonthYear === "current")
        const pendingItems = fastClosingItems.filter((item) => {
          if (item.status !== 'Pending' && item.status !== 'Overdue') return false;
          const dateStr = item.dueDate || '';
          return dateStr.startsWith(activePeriod) || item.status === 'Overdue' ||
                 (item.status === 'Pending' && new Date(dateStr) < today);
        });

        const rigidItems: any[] = [];
        const accessoryOverdueItems: any[] = [];
        const accessoryPendingItems: any[] = [];
        pendingItems.forEach((item) => {
          if (isRigidItem(item)) rigidItems.push(item);
          else if (item.status === 'Overdue') accessoryOverdueItems.push(item);
          else accessoryPendingItems.push(item);
        });

        // Gruppi Sollecito per debitore (canoni scaduti + accessorie già insolute)
        const sollecitiGroups: { [debtorName: string]: { debtorId?: string; debtorType?: 'tenant' | 'owner'; items: any[]; total: number } } = {};
        for (const item of [...rigidItems, ...accessoryOverdueItems]) {
          const resolved = resolveDebtor(item, tenants, owners);
          if (!resolved.name || resolved.name === 'Spese Generali / Condomini') continue;
          if (!sollecitiGroups[resolved.name]) {
            sollecitiGroups[resolved.name] = { debtorId: resolved.id, debtorType: resolved.type, items: [], total: 0 };
          }
          sollecitiGroups[resolved.name].items.push(item);
          sollecitiGroups[resolved.name].total += Number(item.amount) || 0;
        }

        const batch = firestore.batch();
        const todayStr = today.toISOString().split('T')[0];

        // 1. Crea/aggancia Solleciti consolidati per debitore
        for (const debtorName of Object.keys(sollecitiGroups)) {
          const group = sollecitiGroups[debtorName];
          if (group.items.length === 0) continue;

          // I Proprietari non generano mai Solleciti (causa a se stessi).
          if (group.debtorType === 'owner') continue;

          // Se ha già una pratica legale attiva affidata a un avvocato, non si tocca il Sollecito.
          const activeLegalCase = legalCases.find(
            (lc) => lc.tenantName === debtorName && lc.status !== 'Closed' && !!lc.assignedLawyerId
          );
          if (activeLegalCase) continue;

          const existingActiveReminder = reminders.find(
            (r) => r.tenantName === debtorName && r.status !== 'Closed' && r.status !== 'Cancelled' && r.status !== 'Paid'
          );

          if (existingActiveReminder) {
            // CORREZIONE CO (13/08/2026) — stessa correzione applicata lato client in
            // FastClosingView.tsx: un canone rimasto Overdue da una chiusura precedente
            // resta candidato del gruppo Sollecito ad OGNI chiusura successiva (finché non
            // saldato). Prima di questa correzione l'intero importo del gruppo veniva
            // risommato al Sollecito ad ogni chiusura anche per voci già associate,
            // gonfiando l'importo del Sollecito senza nuovo insoluto reale. Ora si sommano
            // SOLO le voci non ancora presenti in associatedItemsIds.
            const currentAssociated: string[] = existingActiveReminder.associatedItemsIds || [];
            const alreadyAssociatedIds = new Set(currentAssociated);
            const newItems = group.items.filter((item) => !alreadyAssociatedIds.has(item.id));

            if (newItems.length > 0) {
              const newItemsListText = newItems
                .map((item) => `${(item.title || '').split(' - ')[1] || item.title} (€${(Number(item.amount) || 0).toFixed(2)})`)
                .join(', ');
              const addedAmount = newItems.reduce((s, item) => s + (Number(item.amount) || 0), 0);
              const newAmount = (Number(existingActiveReminder.amount) || 0) + addedAmount;
              const newAssociated = Array.from(new Set([...currentAssociated, ...newItems.map((item) => item.id)]));
              const newReason = existingActiveReminder.reason
                ? `${existingActiveReminder.reason} + Chiusura Fast Closing: ${newItemsListText}`
                : `Sollecito automatico Fast Closing: ${newItemsListText}`;
              batch.update(firestore.collection('reminders').doc(existingActiveReminder.id), {
                associatedItemsIds: newAssociated,
                amount: newAmount,
                reason: newReason,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }
            // Se newItems è vuoto, tutte le voci del gruppo sono già nel Sollecito attivo:
            // nessun aggiornamento, evita di risommare lo stesso importo più volte.
          } else {
            const itemsListText = group.items
              .map((item) => `${(item.title || '').split(' - ')[1] || item.title} (€${(Number(item.amount) || 0).toFixed(2)})`)
              .join(', ');
            const associatedItemsIds = group.items.map((item) => item.id);
            const reminderRef = firestore.collection('reminders').doc();
            batch.set(reminderRef, {
              userId,
              tenantId: group.debtorId || '',
              tenantName: debtorName,
              debtorType: group.debtorType || 'tenant',
              amount: group.total,
              reason: `Sollecito automatico Fast Closing: ${itemsListText}`,
              dueDate: todayStr,
              status: 'Pending',
              isSequence: true,
              step: 1,
              associatedItemsIds,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
          solleciti++;
        }

        // 2. Voci rigide (canoni) -> Overdue. MAI riproposte il mese successivo: sono voci
        // rigide, la loro unica destinazione da insolute è il Sollecito creato/aggiornato al
        // passo 1 sopra (CORREZIONE CO 13/08/2026 — stessa correzione lato client in
        // FastClosingView.tsx; prima si generava qui anche una nuova riga "[Arretrato] ..."
        // per il mese successivo, che si accumulava ad ogni chiusura mensile).
        for (const item of rigidItems) {
          batch.update(firestore.collection('fastClosing').doc(item.id), { status: 'Overdue' });
          closedCount++;
          reproposed++;
        }

        // 3. Voci accessorie già Overdue -> restano Overdue (già confluite nei Solleciti sopra)
        for (const item of accessoryOverdueItems) {
          batch.update(firestore.collection('fastClosing').doc(item.id), { status: 'Overdue' });
          closedCount++;
        }

        // 4. Voci accessorie Pending -> rinviate di un mese
        for (const item of accessoryPendingItems) {
          const nextDueDate = addOneMonthToDate(item.dueDate);
          batch.update(firestore.collection('fastClosing').doc(item.id), {
            dueDate: nextDueDate,
            status: 'Pending',
          });
          postponed++;
        }

        // 5. Indennità di Occupazione per contratti terminati (scadenza naturale O
        // disdetta anticipata — CORREZIONE CL 05/08/2026, stesso identico criterio usato
        // lato client in FastClosingView.tsx) senza Verbale di Riconsegna
        const nextPeriod = nextPeriodOf(activePeriod);
        for (const contract of contracts) {
          if (!contract.rentAmount) continue;
          const referenceEndDateStr = contract.earlyTerminationDate || contract.endDate;
          if (!referenceEndDateStr) continue;
          if (new Date(referenceEndDateStr) >= today) continue;
          const hasRiconsegna = deliveryReports.some(
            (dr) => dr.contractId === contract.id && dr.type === 'riconsegna'
          );
          if (hasRiconsegna) continue;
          // CORREZIONE CP (13/08/2026) — rimosso il controllo su fc.title.startsWith(...):
          // dal momento della disdetta non vengono più generate righe canone per questo
          // contratto, quindi source==="contract" + sourceId===contract.id + stesso mese è
          // già una combinazione univoca (stesso fix applicato lato client in
          // FastClosingView.tsx, per restare un solo flusso identico).
          const alreadyExists = fastClosingItems.some(
            (fc) => fc.source === 'contract' &&
                    fc.sourceId === contract.id &&
                    (fc.dueDate || '').startsWith(nextPeriod)
          );
          if (alreadyExists) continue;
          const indennitaRef = firestore.collection('fastClosing').doc();
          const description = contract.earlyTerminationDate
            ? `Contratto chiuso anticipatamente il ${referenceEndDateStr} ma immobile non ancora riconsegnato (nessun Verbale di Riconsegna registrato). Stesso importo del canone precedente.`
            : `Contratto scaduto il ${referenceEndDateStr} ma immobile non ancora riconsegnato (nessun Verbale di Riconsegna registrato). Stesso importo del canone precedente.`;
          const indennitaDueDate = `${nextPeriod}-01`;
          const contractProperty = properties.find((p) => p.id === contract.propertyId);
          batch.set(indennitaRef, {
            userId,
            // CORREZIONE CP (13/08/2026) — etichetta standard Fase 2 punto 1.
            title: formatLedgerLabelServer({
              debtorName: contract.tenantName,
              propertyAddress: contractProperty?.address,
              tipologia: 'Indennità di Occupazione',
              dateForPeriod: indennitaDueDate,
            }),
            description,
            amount: contract.rentAmount,
            dueDate: indennitaDueDate,
            propertyId: contract.propertyId,
            source: 'contract',
            sourceId: contract.id,
            status: 'Pending',
            debtorId: contract.tenantId || null,
            debtorType: 'tenant',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          indennita++;
        }

        // 6. Avanza SEMPRE il periodo attivo al mese successivo
        batch.set(firestore.collection('appState').doc(userId), {
          fastClosingActivePeriod: nextPeriod,
          userId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        await batch.commit();

        totalUsersProcessed++;
        perUserResults.push({
          userId,
          closedPeriod: activePeriod,
          advancedToPeriod: nextPeriod,
          closedCount,
          solleciti,
          reproposed,
          postponed,
          indennita,
        });
        console.log(`[cron-close-fast-closing] User ${userId}: closed ${activePeriod} -> advanced to ${nextPeriod}. closed=${closedCount} solleciti=${solleciti} reproposed=${reproposed} postponed=${postponed} indennita=${indennita}`);
      } catch (userErr: any) {
        totalErrors++;
        const msg = `User ${userId}: ${userErr?.message || String(userErr)}`;
        errorMessages.push(msg);
        console.error('[cron-close-fast-closing]', msg);
      }
    }

    const finishedAt = new Date();
    const logRef = firestore.collection('systemJobsLog').doc();
    await logRef.set({
      jobName: 'cron-close-fast-closing',
      startedAt: admin.firestore.Timestamp.fromDate(startedAt),
      finishedAt: admin.firestore.Timestamp.fromDate(finishedAt),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      totalUsersProcessed,
      totalErrors,
      errorMessages: errorMessages.slice(0, 50),
      perUserResults: perUserResults.slice(0, 200),
      status: totalErrors === 0 ? 'success' : 'partial',
      triggeredBy: 'vercel-cron',
    });

    return res.status(200).json({
      success: true,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      totalUsersProcessed,
      totalErrors,
      perUserResults,
      logDocumentId: logRef.id,
    });
  } catch (error: any) {
    totalErrors++;
    const errorMsg = error?.message || String(error);
    errorMessages.push(errorMsg);
    console.error('[cron-close-fast-closing] FATAL ERROR:', errorMsg);
    try {
      const firestore = getFirestore();
      await firestore.collection('systemJobsLog').add({
        jobName: 'cron-close-fast-closing',
        startedAt: admin.firestore.Timestamp.fromDate(startedAt),
        finishedAt: admin.firestore.Timestamp.fromDate(new Date()),
        totalUsersProcessed,
        totalErrors,
        errorMessages: errorMessages.slice(0, 50),
        status: 'failed',
        triggeredBy: 'vercel-cron',
        fatalError: errorMsg,
      });
    } catch (logErr) {
      console.error('[cron-close-fast-closing] Could not write error log to Firestore:', logErr);
    }
    return res.status(500).json({ success: false, error: errorMsg, totalUsersProcessed, totalErrors });
  }
}
