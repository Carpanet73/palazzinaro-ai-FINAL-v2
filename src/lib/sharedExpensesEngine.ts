/**
 * ============================================================================
 * MOTORE DI CALCOLO — Ripartizione spese condominiali senza amministratore
 * ============================================================================
 * Funzioni pure, senza dipendenze da React/Firestore, per poter essere
 * testate in isolamento. Nessuna data hardcoded: tutte le funzioni ricevono
 * le date come parametro o usano `new Date()` al momento della chiamata,
 * mai stringhe fisse (regola 13.5 di REGOLE_E_LINEE_GUIDA.md).
 * ============================================================================
 */

import type { Property } from "../types";
import type {
    MeterReading,
    SharedExpenseLineItem,
    SharedExpenseAllocationLine,
    SplitCriteria,
} from "../types-shared-expenses";

// ----------------------------------------------------------------------------
// 1. CONTATORI — congruità, consumo medio giornaliero, proiezione sui giorni
// ----------------------------------------------------------------------------

/**
 * Verifica se una nuova lettura è congrua rispetto all'ultima lettura registrata
 * per lo stesso contatore. Un contatore d'acqua non torna mai indietro.
 */
export function checkReadingCongruity(
    newValue: number,
    previousReading: MeterReading | null
  ): { isValid: boolean; anomalyNote?: string } {
    if (!previousReading) {
          return { isValid: true }; // prima lettura in assoluto (punto zero), sempre valida
    }
    if (newValue < previousReading.value) {
          return {
                  isValid: false,
                  anomalyNote: `Lettura (${newValue}) inferiore alla precedente registrata il ${previousReading.readingDate} (${previousReading.value}). Un contatore non può tornare indietro: verificare la foto/il numero inserito.`,
          };
    }
    return { isValid: true };
}

/**
 * Calcola il consumo medio giornaliero tra due letture consecutive dello stesso
 * contatore. Restituisce null se i dati non permettono un calcolo affidabile
 * (stessa data, o meno di 1 giorno di distanza).
 */
export function calculateDailyAverageConsumption(
    previousReading: MeterReading,
    currentReading: MeterReading
  ): number | null {
    const daysBetween = daysBetweenDates(previousReading.readingDate, currentReading.readingDate);
    if (daysBetween <= 0) return null;
    const consumption = currentReading.value - previousReading.value;
    if (consumption < 0) return null; // anomalia, gestita separatamente da checkReadingCongruity
  return consumption / daysBetween;
}

/**
 * Proietta il consumo medio giornaliero sui giorni ESATTI del periodo fatturato
 * dalla bolletta, indipendentemente da quando è stata fatta fisicamente la
 * lettura (che quasi mai coincide con la chiusura del periodo di fatturazione).
 */
export function projectConsumptionOnBillingPeriod(
    dailyAverageConsumption: number,
    billingPeriodStart: string,
    billingPeriodEnd: string
  ): number {
    const days = daysBetweenDates(billingPeriodStart, billingPeriodEnd) + 1; // periodo inclusivo di entrambi gli estremi
  return Number((dailyAverageConsumption * Math.max(days, 0)).toFixed(3));
}

function daysBetweenDates(fromDateStr: string, toDateStr: string): number {
    const from = new Date(fromDateStr + "T00:00:00");
    const to = new Date(toDateStr + "T00:00:00");
    const diffMs = to.getTime() - from.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Indice di plausibilità (facoltativo, MAI bloccante): confronta il consumo
 * misurato in un periodo con il numero di abitanti dell'unità, per dare
 * un'indicazione di coerenza a Massimo, non un blocco automatico.
 */
export function estimatePlausibilityIndex(
    consumptionInPeriod: number,
    residentsCount: number | undefined,
    periodDays: number
  ): { litersPerPersonPerDay: number | null; note: string } {
    if (!residentsCount || residentsCount <= 0 || periodDays <= 0) {
          return { litersPerPersonPerDay: null, note: "Numero abitanti non disponibile: nessun indice calcolabile." };
    }
    // consumptionInPeriod è in m³ → converto in litri (1 m³ = 1000 L)
  const litersPerPersonPerDay = (consumptionInPeriod * 1000) / residentsCount / periodDays;
    // Riferimento indicativo (non normativo): consumo domestico medio italiano ~150-200 L/persona/giorno
  let note = "Consumo nella norma indicativa (~150-200 L/persona/giorno).";
    if (litersPerPersonPerDay < 50) note = "Consumo insolitamente basso rispetto agli abitanti dichiarati: verificare eventuali disabitazioni.";
    if (litersPerPersonPerDay > 350) note = "Consumo insolitamente alto rispetto agli abitanti dichiarati: verificare possibili perdite.";
    return { litersPerPersonPerDay: Number(litersPerPersonPerDay.toFixed(1)), note };
}

// ----------------------------------------------------------------------------
// 2. RIPARTIZIONE — calcolo delle quote per ciascuna voce di spesa
// ----------------------------------------------------------------------------

export interface PropertyConsumptionInput {
    propertyId: string;
    consumptionInPeriod: number; // m³ stimati per questo immobile nel periodo fatturato (dalla proiezione sopra)
}

/**
 * Calcola, per UNA voce della bolletta (SharedExpenseLineItem), quanto tocca
 * a ciascuna proprietà dell'edificio secondo il criterio scelto per quella
 * voce specifica.
 */
export function allocateLineItem(
    lineItem: SharedExpenseLineItem,
    properties: Property[],
    chargedToTenantPct: number,
    options: {
          consumptionByProperty?: PropertyConsumptionInput[]; // richiesto solo se splitCriteria === "consumption"
    } = {}
  ): SharedExpenseAllocationLine[] {
    const { amount, splitCriteria } = lineItem;
    const shares = computeShares(properties, splitCriteria, options.consumptionByProperty);

  const totalShareUnits = shares.reduce((sum, s) => sum + s.shareUnits, 0);
    if (totalShareUnits <= 0) return [];

  return shares.map((s) => {
        const propAmount = Number(((amount * s.shareUnits) / totalShareUnits).toFixed(2));
        const amountTenant = Number(((propAmount * chargedToTenantPct) / 100).toFixed(2));
        const amountOwner = Number((propAmount - amountTenant).toFixed(2));
        return {
                propertyId: s.propertyId,
                propertyName: s.propertyName,
                lineItemId: lineItem.id,
                amountTotal: propAmount,
                amountTenant,
                amountOwner,
                calculationNote: buildCalculationNote(splitCriteria, s, chargedToTenantPct),
        };
  });
}

interface PropertyShare {
    propertyId: string;
    propertyName: string;
    shareUnits: number; // "peso" relativo usato per la proporzione (millesimi, 1 per unità, abitanti, o m³)
  shareLabel: string; // per la nota leggibile
}

function computeShares(
    properties: Property[],
    criteria: SplitCriteria,
    consumptionByProperty?: PropertyConsumptionInput[]
  ): PropertyShare[] {
    switch (criteria) {
      case "millesimi":
              return properties.map((p) => ({
                        propertyId: p.id,
                        propertyName: p.name,
                        shareUnits: p.millesimi ?? 0,
                        shareLabel: `${p.millesimi ?? 0}/1000 millesimi`,
              }));
      case "equal":
              return properties.map((p) => ({
                        propertyId: p.id,
                        propertyName: p.name,
                        shareUnits: 1,
                        shareLabel: `1 quota su ${properties.length} unità`,
              }));
      case "residents":
              return properties.map((p) => ({
                        propertyId: p.id,
                        propertyName: p.name,
                        shareUnits: p.residentsCount ?? 0,
                        shareLabel: `${p.residentsCount ?? 0} abitanti`,
              }));
      case "consumption": {
              const map = new Map((consumptionByProperty ?? []).map((c) => [c.propertyId, c.consumptionInPeriod]));
              return properties.map((p) => ({
                        propertyId: p.id,
                        propertyName: p.name,
                        shareUnits: map.get(p.id) ?? 0,
                        shareLabel: `${(map.get(p.id) ?? 0).toFixed(2)} m³ consumati nel periodo`,
              }));
      }
      default:
              return [];
    }
}

function buildCalculationNote(criteria: SplitCriteria, share: PropertyShare, chargedToTenantPct: number): string {
    const criteriaLabel =
          criteria === "millesimi" ? "a millesimi" : criteria === "equal" ? "in parti uguali" : criteria === "residents" ? "per numero di abitanti" : "per consumo a contatore";
    const tenantPart = chargedToTenantPct > 0 ? `di cui ${chargedToTenantPct}% a carico dell'inquilino` : "interamente a carico del proprietario";
    return `Ripartizione ${criteriaLabel} (${share.shareLabel}), ${tenantPart}.`;
}

/**
 * Calcola l'allocazione completa di una spesa (tutte le voci) per tutte le
 * proprietà dell'edificio. Da chiamare quando si conferma il wizard.
 */
export function allocateFullExpense(
    lineItems: SharedExpenseLineItem[],
    properties: Property[],
    chargedToTenantPct: number,
    consumptionByProperty?: PropertyConsumptionInput[]
  ): SharedExpenseAllocationLine[] {
    return lineItems.flatMap((li) => allocateLineItem(li, properties, chargedToTenantPct, { consumptionByProperty }));
}
