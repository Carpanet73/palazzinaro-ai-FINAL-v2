/**
 * rendicontoPdf.ts
 * ============================================================================
 * Genera il PDF di rendiconto per una spesa comune, ricalcando voce per voce
 * la struttura della bolletta/fattura originale (mai un unico importo
 * aggregato), per una singola unità immobiliare/inquilino.
 *
 * Usa jsPDF, stessa libreria già in uso per la Messa in Mora (sezione 5 delle
 * linee guida) — nessuna nuova dipendenza da aggiungere al progetto.
 * ============================================================================
 */

import jsPDF from "jspdf";
import type { Property, OwnerProfile } from "../types";
import type { SharedExpense, SharedExpenseAllocationLine } from "../types-shared-expenses";

export function generateRendicontoPdf(
    expense: SharedExpense,
    property: Property,
    tenantName: string,
    owner: OwnerProfile,
    buildingName: string
  ): jsPDF {
    const doc = new jsPDF();
    const marginX = 18;
    let y = 20;

  // Intestazione — logo reale, come da regola sezione 11 (qui solo testo, il logo va aggiunto
  // lato componente con doc.addImage se disponibile in base64, coerente col resto dei PDF già in uso)
  doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Rendiconto Spese Comuni", marginX, y);
    y += 8;

  doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Edificio: ${buildingName}`, marginX, y);
    y += 6;
    doc.text(`Unità: ${property.name} — ${property.address}`, marginX, y);
    y += 6;
    doc.text(`Inquilino: ${tenantName}`, marginX, y);
    y += 6;
    doc.text(`Proprietario: ${owner.name}`, marginX, y);
    y += 10;

  doc.setFont("helvetica", "bold");
    doc.text(expense.title, marginX, y);
    y += 6;
    if (expense.billingPeriodStart && expense.billingPeriodEnd) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.text(`Periodo fatturato: ${expense.billingPeriodStart} — ${expense.billingPeriodEnd}`, marginX, y);
          y += 8;
    } else {
          y += 4;
    }

  // Tabella voce per voce, come nella bolletta originale
  doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Voce", marginX, y);
    doc.text("Criterio", marginX + 80, y);
    doc.text("Quota Inquilino", marginX + 130, y, { align: "left" });
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
        if (y > 270) {
                doc.addPage();
                y = 20;
        }
        doc.text(li.description, marginX, y, { maxWidth: 75 });
        doc.text(li.splitCriteria, marginX + 80, y, { maxWidth: 45 });
        doc.text(`€ ${alloc.amountTenant.toFixed(2)}`, marginX + 130, y);
        y += 6;
        totalTenant += alloc.amountTenant;
        totalOwner += alloc.amountOwner;
  });

  y += 4;
    doc.line(marginX, y, 192, y);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text(`Totale a carico dell'inquilino: € ${totalTenant.toFixed(2)}`, marginX, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`(Quota già assorbita dal proprietario per questa unità: € ${totalOwner.toFixed(2)})`, marginX, y);
    y += 10;

  doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
          "Rendiconto generato mediante procedura automatizzata del sistema, in nome e per conto del proprietario,\ncon supporto dell'intelligenza artificiale.",
          marginX,
          y
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
