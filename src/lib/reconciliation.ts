// CORREZIONE (13/08/2026) — Motore di riconciliazione condiviso per i pagamenti parziali,
// richiesto esplicitamente da Massimo dopo aver verificato che la regola già scritta nel
// documento di progetto ("se il bonifico è insufficiente... se parziale, genera riga
// residua") non era in realtà mai stata implementata così: il codice esistente in
// FastClosingView.tsx segnava TUTTE le voci selezionate come "Pagato" per intero anche
// quando il bonifico non le copriva, creando poi una riga di residuo generica scollegata
// dalla voce specifica rimasta scoperta. Massimo ha chiesto invece che la singola voce
// scoperta resti visibile con il proprio importo residuo ridotto (mai segnata Pagato finché
// non è saldata per intero) — questo file è l'UNICA implementazione di questa logica,
// riusata sia da Fast Closing sia dall'Area Solleciti (regola "un solo flusso per ogni
// azione").
//
// Selezione delle voci da includere: resta manuale (l'utente sceglie quali voci spuntare),
// come già avveniva in Fast Closing. Questo motore si occupa SOLO di decidere, tra le voci
// scelte, in che ORDINE il pagamento viene assorbito quando non basta per tutte: prima i
// canoni d'affitto (mai una voce accessoria a scapito di un canone scaduto), poi a parità di
// tipo la scadenza più vecchia prima.

export interface AllocatableItem {
  id: string;
  amount: number;
  dueDate: string;
  source?: string;
  title?: string;
  description?: string;
}

export interface AllocationResult {
  itemId: string;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  fullyPaid: boolean;
}

// Stessa euristica "è un canone d'affitto?" già usata in più punti dell'app (FastClosingView,
// OwnersView, RemindersView): source "contract" oppure testo che parla di canone/affitto.
export function isRentItem(item: { source?: string; title?: string; description?: string }): boolean {
  const t = (item.title || "").toLowerCase();
  const d = (item.description || "").toLowerCase();
  return item.source === "contract" || t.includes("canone") || t.includes("affitto") || d.includes("canone") || d.includes("affitto");
}

/**
 * Distribuisce `paymentAmount` sulle `items` fornite (già selezionate dall'utente), in ordine
 * di priorità: canoni d'affitto prima delle spese accessorie, poi scadenza più vecchia prima.
 * Le voci che restano scoperte (perché il pagamento si esaurisce prima) mantengono il loro
 * importo originario invariato (nessuna modifica) — solo la voce su cui il pagamento si
 * esaurisce a metà viene ridotta al residuo effettivo.
 */
export function allocatePayment(items: AllocatableItem[], paymentAmount: number): AllocationResult[] {
  const sorted = [...items].sort((a, b) => {
    const aRent = isRentItem(a) ? 0 : 1;
    const bRent = isRentItem(b) ? 0 : 1;
    if (aRent !== bRent) return aRent - bRent;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  let remaining = Math.max(0, paymentAmount);
  const results: AllocationResult[] = [];

  for (const item of sorted) {
    if (remaining <= 0) {
      results.push({ itemId: item.id, originalAmount: item.amount, paidAmount: 0, remainingAmount: item.amount, fullyPaid: false });
      continue;
    }
    if (remaining >= item.amount) {
      results.push({ itemId: item.id, originalAmount: item.amount, paidAmount: item.amount, remainingAmount: 0, fullyPaid: true });
      remaining = Number((remaining - item.amount).toFixed(2));
    } else {
      const residual = Number((item.amount - remaining).toFixed(2));
      results.push({ itemId: item.id, originalAmount: item.amount, paidAmount: remaining, remainingAmount: residual, fullyPaid: false });
      remaining = 0;
    }
  }

  return results;
}

// Nota testuale da accodare alla descrizione di una voce parzialmente saldata, per lasciare
// traccia leggibile di cosa è stato pagato e quando — senza perdere lo storico precedente.
export function buildPartialPaymentNote(paidAmount: number, sourceLabel: string): string {
  const today = new Date().toLocaleDateString("it-IT");
  return `[Pagamento parziale di €${paidAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })} il ${today} tramite ${sourceLabel} — residuo riportato in questa riga]`;
}
