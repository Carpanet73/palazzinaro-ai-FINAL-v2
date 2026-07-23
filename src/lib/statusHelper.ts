
import { Tenant, Property, Contract, FastClosingItem, LegalCase, Reminder } from "../types";

export interface TenantClassification {
  status: "green" | "orange" | "red" | "critical";
  label: string;
  emoji: string;
  colorClass: string;
  badgeClass: string;
  textClass: string;
  cardBorder: string;
  description: string;
  reason: "ok" | "disdetta_mancante" | "legal_case" | "messa_in_mora" | "multiple_anomalies" | "single_anomaly" | "pending_payments";
  countdownDays?: number;
}

/**
 * Computes a standardized, consistent classification for a tenant.
 */
export function getTenantClassification(
  tenant: Tenant,
  properties: Property[],
  contracts: Contract[],
  fastClosing: FastClosingItem[],
  legalCases: LegalCase[],
  reminders: Reminder[]
): TenantClassification {
  const property = properties.find(p => p.id === tenant.propertyId);
  const activeContract = contracts.find(
    c => (c.tenantId === tenant.id || tenant.contractId === c.id) && c.status === "Active"
  );

  // 1. Check for Mandatory Disdetta warning (7 months before contract end)
  if (activeContract && activeContract.status === "Active") {
    const now = new Date();
    const end = new Date(activeContract.endDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const sevenMonthsDays = 7 * 30.4375; // ~213 days
    const sixMonthsDays = 6 * 30.4375;  // ~183 days

    // If we are within 7 months of contract end and disdetta receipt is missing
    if (diffDays <= sevenMonthsDays && !activeContract.disdettaReceiptUploaded) {
      const countdownDays = Math.max(0, Math.ceil(diffDays - sixMonthsDays));
      const isPastHardDeadline = diffDays < sixMonthsDays;

      return {
        status: "critical",
        label: isPastHardDeadline 
          ? "CRITICO: Termine Disdetta Legge Scaduto!" 
          : "Fase Disdetta Legge (Manca Raccomandata)",
        emoji: "👎 ⚖️",
        colorClass: "bg-red-950 text-red-100 border-red-800 animate-pulse",
        badgeClass: "bg-red-900/40 text-red-200 border-red-700/50",
        textClass: "text-red-300 font-extrabold",
        cardBorder: "border-l-4 border-l-red-600 border-red-200 shadow-md animate-pulse",
        description: isPastHardDeadline
          ? `Blocco Rapporto: Termine legale dei 6 mesi scaduto da ${Math.abs(Math.ceil(diffDays - sixMonthsDays))} giorni senza ricevuta di ritorno!`
          : `Procedura bloccante: Spedire raccomandata disdetta e caricare ricevuta di ritorno entro ${countdownDays} giorni!`,
        reason: "disdetta_mancante",
        countdownDays: Math.ceil(diffDays - sixMonthsDays)
      };
    }
  }

  // 2. Active Legal Case check (Must have an actual legal case in legalCases with status != Closed)
  const hasLegalCase = legalCases.some(lc => {
    if (lc.status === "Closed") return false;
    const tName = (tenant.name || "").toLowerCase().trim();
    const lcTenant = (lc.tenantName || "").toLowerCase().trim();
    if (!lcTenant) return false;
    return lcTenant.includes(tName) || tName.includes(lcTenant);
  });

  if (hasLegalCase) {
    return {
      status: "critical",
      label: "Stato Critico (Area Legale)",
      emoji: "👎 ⚖️",
      colorClass: "bg-red-950 text-red-100 border-red-800",
      badgeClass: "bg-red-900/30 text-red-200 border-red-700/50",
      textClass: "text-red-300 font-extrabold",
      cardBorder: "border-l-4 border-l-red-600 border-red-200 shadow-md",
      description: "Pratica passata ufficialmente all'ufficio legale per procedure di sfratto o contenzioso.",
      reason: "legal_case"
    };
  }

  // 3. Messa in Mora check (Has active reminder with status "MessaInMora")
  const hasMessaInMora = reminders.some(r => r.tenantId === tenant.id && r.status === "MessaInMora");
  if (hasMessaInMora) {
    return {
      status: "red",
      label: "Relazione Critica (Messa in Mora)",
      emoji: "👎",
      colorClass: "bg-rose-50 text-rose-700 border-rose-200",
      badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
      textClass: "text-rose-600 font-extrabold",
      cardBorder: "border-t-4 border-t-rose-500",
      description: "Diffida e Messa in Mora formale attiva. Pendenze economiche gravi.",
      reason: "messa_in_mora"
    };
  }

  // 4. Financial Situation Calculation
  const isCondoConstituted = property ? !!property.isCondoConstituted : false;
  const tenantNameClean = (tenant.name || "").replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase().trim();

  // Rents specific to this tenant
  const rentItems = fastClosing.filter(item => {
    if (item.propertyId !== tenant.propertyId) return false;
    const isContractSource = item.source === "contract";
    const matchesTenant = (item.title || "").toLowerCase().includes(tenantNameClean) ||
                          (item.description && (item.description || "").toLowerCase().includes(tenantNameClean));
    const matchesContract = activeContract && item.sourceId === activeContract.id;
    const isRentWord = (item.title || "").toLowerCase().includes("canone") || (item.title || "").toLowerCase().includes("affitto");
    return (isContractSource && (matchesTenant || matchesContract)) || (isRentWord && (matchesTenant || matchesContract));
  });

  // Condos specific to this property
  let condoItems: FastClosingItem[] = [];
  if (isCondoConstituted && property) {
    condoItems = fastClosing.filter(item => {
      if (item.propertyId !== property.id) return false;
      const isCondoSource = item.source === "condominium";
      const isCondoWord = (item.title || "").toLowerCase().includes("condominio") || 
                          (item.title || "").toLowerCase().includes("spese cond") ||
                          (item.description && (item.description || "").toLowerCase().includes("condominio"));
      const matchesTenant = (item.title || "").toLowerCase().includes(tenantNameClean) ||
                            (item.description && (item.description || "").toLowerCase().includes(tenantNameClean)) ||
                            (item.title || "").toLowerCase().includes("(inquilino)");
      return (isCondoSource || isCondoWord) && matchesTenant;
    });
  }

  // Maintenance splits specific to this tenant
  const splitMaintenanceClosing = fastClosing.filter(item => {
    if (item.propertyId !== tenant.propertyId) return false;
    if (item.source !== "maintenance") return false;
    
    const titleLower = (item.title || "").toLowerCase();
    const descLower = (item.description || "").toLowerCase();
    
    // Explicitly exclude owner splits
    if (titleLower.includes("proprietari") || titleLower.includes("proprietario") || titleLower.includes("locatore")) {
      return false;
    }
    
    const matchesTenant = titleLower.includes(tenantNameClean) || descLower.includes(tenantNameClean) || titleLower.includes("(inquilino)");
    return matchesTenant;
  });

  const relevantMovements = [...rentItems, ...condoItems, ...splitMaintenanceClosing];
  
  const overdueCount = relevantMovements.filter(m => m.status === "Overdue").length;
  const pendingCount = relevantMovements.filter(m => m.status === "Pending").length;
  const totalOverdueAmount = relevantMovements.filter(m => m.status === "Overdue").reduce((sum, m) => sum + m.amount, 0);

  // Check for other alerts (e.g. Sent reminders)
  const hasSentReminder = reminders.some(r => r.tenantId === tenant.id && r.status === "Sent");

  // Determine anomalies count:
  // - Each overdue payment is 1 anomaly.
  // - A sent reminder is 1 anomaly.
  let anomalyCount = overdueCount;
  if (hasSentReminder) anomalyCount += 1;

  if (anomalyCount > 1) {
    return {
      status: "red",
      label: "Relazione Critica (Insoluti Multipli)",
      emoji: "👎",
      colorClass: "bg-rose-50 text-rose-700 border-rose-200",
      badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
      textClass: "text-rose-600 font-extrabold",
      cardBorder: "border-t-4 border-t-rose-500",
      description: `Rapporto non ottimale: ${overdueCount} rate scadute insolute (€${totalOverdueAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}) con solleciti attivi.`,
      reason: "multiple_anomalies"
    };
  }

  if (anomalyCount === 1) {
    return {
      status: "orange",
      label: "Relazione con Anomalia (Verifica Pendenze)",
      emoji: "😐",
      colorClass: "bg-amber-50 text-amber-700 border-amber-200",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
      textClass: "text-amber-600 font-extrabold",
      cardBorder: "border-t-4 border-t-amber-400",
      description: `Presenza di 1 anomalia amministrativa o canone scaduto da verificare.`,
      reason: "single_anomaly"
    };
  }

  if (pendingCount > 0) {
    return {
      status: "orange",
      label: "In Attesa di Scadenza",
      emoji: "😐",
      colorClass: "bg-amber-50 text-amber-700 border-amber-200",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
      textClass: "text-amber-600 font-extrabold",
      cardBorder: "border-t-4 border-t-amber-400",
      description: `${pendingCount} scadenze amministrative regolari in attesa di pagamento.`,
      reason: "pending_payments"
    };
  }

  return {
    status: "green",
    label: "Relazione Regolare",
    emoji: "👍",
    colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    textClass: "text-emerald-600 font-extrabold",
    cardBorder: "border-t-4 border-t-emerald-500",
    description: "Nessun insoluto registrato, contabilità in pari, condotta esemplare!",
    reason: "ok"
  };
}

