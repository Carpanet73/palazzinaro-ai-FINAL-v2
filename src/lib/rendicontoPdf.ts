/**
 * rendicontoPdf.ts
 * ============================================================================
 * Genera i PDF di riepilogo per una spesa comune, in due varianti (richieste
 * da Massimo il 03/09/2026):
 *
 *  - PARTICOLARE (per singola unità/inquilino): da inviare al singolo
 *    inquilino per pretendere il pagamento della sua quota. Contiene
 *    descrizione spesa, importo totale bolletta, criterio di ripartizione,
 *    importo dovuto da QUESTO inquilino, ed eventuale elenco rate.
 *  - GENERALE (tutte le unità insieme): stessa spesa, ma con la ripartizione
 *    completa su ogni unità dell'edificio in un'unica tabella.
 *
 * Le rate: per Fast Closing servono mese+giorno+anno (data di addebito
 * precisa), ma nel documento per l'inquilino compaiono SOLO mese e anno —
 * il giorno esatto è un dettaglio di gestione interna, non riguarda
 * l'inquilino.
 *
 * Usa jsPDF, stessa libreria già in uso per la Messa in Mora (sezione 5 delle
 * linee guida) — nessuna nuova dipendenza da aggiungere al progetto.
 * ============================================================================
 */

import jsPDF from "jspdf";
import type { Property, OwnerProfile } from "../types";
import type { SharedExpense, SharedExpenseAllocationLine } from "../types-shared-expenses";
import { SHARED_EXPENSE_CATEGORY_LABELS, SPLIT_CRITERIA_LABELS } from "../types-shared-expenses";

const MESI_ITALIANI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

// Solo mese e anno (mai il giorno): quello che vede l'inquilino, mai la data
// di addebito precisa che serve solo lato Fast Closing.
function formatMeseAnno(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return `${MESI_ITALIANI[d.getMonth()]} ${d.getFullYear()}`;
}

function totaleBolletta(expense: SharedExpense): number {
  return expense.lineItems.reduce((sum, li) => sum + (Number(li.amount) || 0), 0);
}

// Elenco criteri distinti usati nelle voci della spesa (spesso una sola, ma
// una bolletta può avere voci con criteri diversi: es. quota fissa a
// millesimi + quota consumo a contatore).
function criteriUsati(expense: SharedExpense): string {
  const set = new Set(expense.lineItems.map((li) => SPLIT_CRITERIA_LABELS[li.splitCriteria]));
  return Array.from(set).join(", ");
}

function disegnaIntestazione(doc: jsPDF, marginX: number, y: number, expense: SharedExpense, buildingName: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Riepilogo Spesa Comune", marginX, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Edificio: ${buildingName}`, marginX, y);
  y += 6;
  doc.text(`Spesa: ${expense.title}`, marginX, y);
  y += 6;
  doc.text(`Categoria: ${SHARED_EXPENSE_CATEGORY_LABELS[expense.category]} (${expense.isExtraordinary ? "Straordinaria" : "Ordinaria"})`, marginX, y);
  y += 6;
  if (expense.billingPeriodStart && expense.billingPeriodEnd) {
    doc.text(`Periodo fatturato: ${expense.billingPeriodStart} — ${expense.billingPeriodEnd}`, marginX, y);
    y += 6;
  }
  doc.text(`Importo totale bolletta: € ${totaleBolletta(expense).toFixed(2)}`, marginX, y);
  y += 6;
  doc.text(`Criterio di ripartizione: ${criteriUsati(expense)}`, marginX, y);
  y += 10;
  return y;
}

function disegnaRate(doc: jsPDF, marginX: number, y: number, rate: { label: string; amount: number }[], titolo: string): number {
  if (rate.length === 0) return y;
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(titolo, marginX, y);
  y += 6;
  doc.setFontSize(9);
  rate.forEach((r, i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "normal");
    doc.text(`${i + 1}ª rata — ${r.label}`, marginX, y);
    doc.text(`€ ${r.amount.toFixed(2)}`, marginX + 130, y);
    y += 6;
  });
  y += 4;
  return y;
}

function disegnaFooter(doc: jsPDF, marginX: number, y: number) {
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    "Riepilogo generato mediante procedura automatizzata del sistema, in nome e per conto del proprietario,\ncon supporto dell'intelligenza artificiale.",
    marginX,
    y
  );
}

/**
 * PARTICOLARE — riepilogo per una singola unità/inquilino, da inviare per
 * pretendere il pagamento della sua quota.
 */
export function generateRendicontoPdf(
  expense: SharedExpense,
  property: Property,
  tenantName: string,
  owner: OwnerProfile,
  buildingName: string
): jsPDF {
  const doc = new jsPDF();
  const marginX = 18;
  let y = disegnaIntestazione(doc, marginX, 20, expense, buildingName);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Unità: ${property.name}${property.address ? " — " + property.address : ""}`, marginX, y);
  y += 6;
  doc.text(`Inquilino: ${tenantName}`, marginX, y);
  y += 6;
  doc.text(`Proprietario: ${owner.name}`, marginX, y);
  y += 10;

  // Tabella voce per voce: RICALCA la bolletta originale (una riga per ogni voce con il suo
  // totale così com'è in bolletta), poi la QUOTA calcolata per questo inquilino, con la base
  // di calcolo sempre visibile (03/09/2026, su richiesta di Massimo: "una ripetizione della
  // voce con gli importi... secondo il criterio" — piena trasparenza verso l'inquilino).
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Voce (come in bolletta)", marginX, y);
  doc.text("Totale Bolletta", marginX + 82, y);
  doc.text("Tua Quota", marginX + 122, y);
  y += 4;
  doc.setDrawColor(200);
  doc.line(marginX, y, 192, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  const propertyAllocations = expense.allocations.filter((a) => a.propertyId === property.id);
  let totalTenant = 0;
  let totalOwner = 0;

  propertyAllocations.forEach((alloc: SharedExpenseAllocationLine) => {
    const li = expense.lineItems.find((l) => l.id === alloc.lineItemId);
    if (!li) return;
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(li.description, marginX, y, { maxWidth: 60 });
    doc.text(`€ ${Number(li.amount).toFixed(2)}`, marginX + 82, y);
    doc.text(`€ ${alloc.amountTenant.toFixed(2)}`, marginX + 122, y);
    y += 5;
    // Base di calcolo, sempre esplicita, mai solo il numero finale.
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    doc.text(alloc.calculationNote, marginX, y, { maxWidth: 165 });
    doc.setTextColor(0);
    y += 6;
    totalTenant += alloc.amountTenant;
    totalOwner += alloc.amountOwner;
  });

  y += 4;
  doc.line(marginX, y, 192, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Totale a carico dell'inquilino: € ${totalTenant.toFixed(2)}`, marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`(Quota già a carico del proprietario per questa unità: € ${totalOwner.toFixed(2)})`, marginX, y);
  y += 10;

  // Rate — solo mese e anno per l'inquilino, mai il giorno esatto di addebito
  if (expense.installments && expense.installments.length > 0) {
    const totaleRate = expense.installments.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const righeRata = expense.installments.map((r) => ({
      label: formatMeseAnno(r.dueDate),
      amount: totaleRate > 0 ? totalTenant * ((Number(r.amount) || 0) / totaleRate) : totalTenant / expense.installments!.length,
    }));
    y = disegnaRate(doc, marginX, y, righeRata, "Rateizzazione — quota dovuta per rata:");
  }

  disegnaFooter(doc, marginX, y);
  return doc;
}

/**
 * GENERALE — stessa spesa, ripartizione completa su tutte le unità
 * dell'edificio in un'unica tabella (per uso interno o invio cumulativo).
 */
export function generateRendicontoGeneralePdf(
  expense: SharedExpense,
  properties: Property[],
  tenantNamesByPropertyId: Record<string, string>,
  owner: OwnerProfile,
  buildingName: string
): jsPDF {
  const doc = new jsPDF();
  const marginX = 18;
  let y = disegnaIntestazione(doc, marginX, 20, expense, buildingName);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Proprietario: ${owner.name}`, marginX, y);
  y += 10;

  // Tabella per unità: somma di tutte le voci allocate a quell'unità
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Unità", marginX, y);
  doc.text("Inquilino", marginX + 55, y);
  doc.text("Quota Inquilino", marginX + 110, y);
  doc.text("Quota Proprietario", marginX + 150, y);
  y += 4;
  doc.setDrawColor(200);
  doc.line(marginX, y, 192, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  let grandTotalTenant = 0;
  let grandTotalOwner = 0;

  const propertyIds = Array.from(new Set(expense.allocations.map((a) => a.propertyId)));
  propertyIds.forEach((propertyId) => {
    const property = properties.find((p) => p.id === propertyId);
    const allocs = expense.allocations.filter((a) => a.propertyId === propertyId);
    const tenantTotal = allocs.reduce((s, a) => s + a.amountTenant, 0);
    const ownerTotal = allocs.reduce((s, a) => s + a.amountOwner, 0);
    grandTotalTenant += tenantTotal;
    grandTotalOwner += ownerTotal;

    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(property?.name || propertyId, marginX, y, { maxWidth: 50 });
    doc.text(tenantNamesByPropertyId[propertyId] || "—", marginX + 55, y, { maxWidth: 50 });
    doc.text(`€ ${tenantTotal.toFixed(2)}`, marginX + 110, y);
    doc.text(`€ ${ownerTotal.toFixed(2)}`, marginX + 150, y);
    y += 6;
  });

  y += 4;
  doc.line(marginX, y, 192, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Totale generale inquilini: € ${grandTotalTenant.toFixed(2)}`, marginX, y);
  y += 6;
  doc.setFontSize(9);
  doc.text(`Totale generale proprietario: € ${grandTotalOwner.toFixed(2)}`, marginX, y);
  y += 10;

  // Rate — vista generale: importo complessivo per rata (somma su tutte le unità)
  if (expense.installments && expense.installments.length > 0) {
    const totaleRate = expense.installments.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const righeRata = expense.installments.map((r) => ({
      label: formatMeseAnno(r.dueDate),
      amount: totaleRate > 0 ? grandTotalTenant * ((Number(r.amount) || 0) / totaleRate) : grandTotalTenant / expense.installments!.length,
    }));
    y = disegnaRate(doc, marginX, y, righeRata, "Rateizzazione — totale generale dovuto per rata:");
  }

  disegnaFooter(doc, marginX, y);
  return doc;
}

/**
 * BACHECA — foglio da affiggere al portone d'ingresso (03/09/2026, su richiesta di
 * Massimo): non è un rendiconto contabile, è un avviso essenziale, leggibile a colpo
 * d'occhio — solo "Unità — Inquilino — Importo dovuto", carattere grande, una spesa per
 * pagina. Nessuna tabella di dettaglio: quella resta nella Stampa Generale/Particolare.
 */
export function generateBachecaPdf(
  expense: SharedExpense,
  properties: Property[],
  tenantNamesByPropertyId: Record<string, string>,
  buildingName: string
): jsPDF {
  const doc = new jsPDF();
  const marginX = 20;
  let y = 25;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Avviso Spese Comuni", marginX, y);
  y += 10;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(buildingName, marginX, y);
  y += 8;
  doc.text(`${expense.title} — ${SHARED_EXPENSE_CATEGORY_LABELS[expense.category]}`, marginX, y);
  y += 6;
  if (expense.billingPeriodStart && expense.billingPeriodEnd) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Periodo: ${expense.billingPeriodStart} — ${expense.billingPeriodEnd}`, marginX, y);
    doc.setTextColor(0);
    y += 6;
  }
  y += 6;
  doc.setDrawColor(0);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, 192, y);
  y += 14;

  const propertyIds = Array.from(new Set(expense.allocations.map((a) => a.propertyId)));
  propertyIds.forEach((propertyId) => {
    const property = properties.find((p) => p.id === propertyId);
    const allocs = expense.allocations.filter((a) => a.propertyId === propertyId);
    const tenantTotal = allocs.reduce((s, a) => s + a.amountTenant, 0);
    if (tenantTotal <= 0) return;

    if (y > 255) { doc.addPage(); y = 25; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(property?.name || propertyId, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(tenantNamesByPropertyId[propertyId] || "Non Specificato", marginX, y + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`€ ${tenantTotal.toFixed(2)}`, 150, y + 3);
    y += 10;
    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, 192, y);
    y += 12;
  });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    "Avviso generato mediante procedura automatizzata del sistema, in nome e per conto del proprietario, con supporto dell'intelligenza artificiale.",
    marginX,
    285,
    { maxWidth: 172 }
  );
  return doc;
}

/**
 * Restituisce il rendiconto come base64 (per invio via EmailJS come allegato,
 * se supportato dal template) o comunque per il download diretto.
 */
export function rendicontoPdfToBase64(doc: jsPDF): string {
  return doc.output("datauristring");
}
