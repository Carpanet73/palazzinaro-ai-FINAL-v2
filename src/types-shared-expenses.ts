/**
 * ============================================================================
 * Ripartizione spese condominiali senza amministratore — tipi dedicati
 * ============================================================================
 * File separato per non dover modificare in profondità src/types.ts (che
 * resta la fonte di verità per Property/Tenant/OwnerProfile/FastClosingItem).
 * Le voci di Fast Closing generate da questa sezione riusano
 * source: "condominium" (valore già esistente nell'unione), per comparire
 * automaticamente e correttamente etichettate in tutti i mastrini esistenti
 * senza toccarli.
 * ============================================================================
 */

// ── Edificio Autogestito (entità separata da Condominium, come deciso il 29/08/2026) ──
export interface SelfManagedBuilding {
    id: string;
    userId: string;
    name: string;
    address?: string;
    notes?: string;
    propertyIds: string[];
    createdAt: string;
    updatedAt?: string;
}

// ── Storico letture contatori (una riga per ogni lettura) ──
export type MeterType = "acqua" | "luce" | "gas";

export interface MeterReading {
    id: string;
    userId: string;
    buildingId: string;
    propertyId: string;
    meterType: MeterType;
    meterNumber?: string;
    value: number;
    readingDate: string; // YYYY-MM-DD
  isZeroPoint: boolean;
    source: "ocr" | "manual";
    photoUrl?: string;
    flaggedAnomaly?: boolean;
    anomalyNote?: string;
    createdAt: string;
}

// ── Spesa comune, con voci multiple come nel documento originale ──
export type SharedExpenseCategory =
    | "acqua_condivisa"
  | "manutenzione_scale_ascensore"
  | "pulizie_parti_comuni"
  | "giardinaggio"
  | "illuminazione_parti_comuni"
  | "spurgo_pozzi_neri"
  | "disinfestazione_derattizzazione"
  | "manutenzione_impianti_comuni"
  | "assicurazione_fabbricato"
  | "manutenzione_straordinaria"
  | "altro";

export const SHARED_EXPENSE_CATEGORY_LABELS: Record<SharedExpenseCategory, string> = {
    acqua_condivisa: "💧 Acqua Condivisa",
    manutenzione_scale_ascensore: "🪜 Manutenzione Scale/Ascensore",
    pulizie_parti_comuni: "🧹 Pulizie Parti Comuni",
    giardinaggio: "🌳 Giardinaggio",
    illuminazione_parti_comuni: "💡 Illuminazione Parti Comuni",
    spurgo_pozzi_neri: "🚰 Spurgo Pozzi Neri/Fosse Biologiche",
    disinfestazione_derattizzazione: "🐜 Disinfestazione/Derattizzazione",
    manutenzione_impianti_comuni: "🔧 Manutenzione Impianti Comuni",
    assicurazione_fabbricato: "🛡️ Assicurazione Fabbricato",
    manutenzione_straordinaria: "🏗️ Manutenzione Straordinaria",
    altro: "📋 Altro",
};

export type SplitCriteria = "millesimi" | "equal" | "residents" | "consumption";

export const SPLIT_CRITERIA_LABELS: Record<SplitCriteria, string> = {
    millesimi: "A Millesimi",
    equal: "In Parti Uguali tra le Unità",
    residents: "Per Numero di Abitanti",
    consumption: "Per Consumo a Contatore",
};

export interface SharedExpenseLineItem {
    id: string;
    description: string;
    amount: number;
    splitCriteria: SplitCriteria;
}

export interface SharedExpenseAllocationLine {
    propertyId: string;
    propertyName: string;
    lineItemId: string;
    amountTotal: number;
    amountTenant: number;
    amountOwner: number;
    calculationNote: string;
}

export interface SharedExpense {
    id: string;
    userId: string;
    buildingId: string;
    title: string;
    category: SharedExpenseCategory;
    isExtraordinary: boolean;
    chargedToTenantPct: number;
    billingPeriodStart?: string;
    billingPeriodEnd?: string;
    lineItems: SharedExpenseLineItem[];
    allocations: SharedExpenseAllocationLine[];
    // Scadenza unica (alternativa alle rate — mai valorizzati entrambi insieme).
    dueDate?: string;
    installments?: { dueDate: string; amount: number; fastClosingItemIds?: string[] }[];
    sourceDocumentUrl?: string;
    sourceDocumentText?: string;
    status: "Draft" | "Confirmed";
    rendicontoSentAt?: string;
    rendicontoSentTo?: string[];
    createdAt: string;
    updatedAt?: string;
}
