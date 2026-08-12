// CORREZIONE CL (05/08/2026) — Modulo Risoluzione/Disdetta Anticipata Contratto.
// Fonte unica delle etichette, dei riferimenti normativi indicativi e del testo di default
// della comunicazione, così ContractsView (form + PDF) e App.tsx (Fast Closing, causale di
// annullamento righe) usano sempre lo stesso identico contenuto — niente stringhe duplicate
// e potenzialmente disallineate in più file.

export const EARLY_TERMINATION_REASON_LABELS: Record<string, string> = {
  MorositaSfratto: "Morosità / Sfratto",
  GraveInadempimento: "Grave inadempimento contrattuale",
  RecessoLavoro: "Recesso per gravi motivi — lavoro (trasferimento/perdita impiego)",
  RecessoSalute: "Recesso per gravi motivi — salute",
  RecessoImmobileInabitabile: "Recesso per gravi motivi — immobile con gravi difetti non risolti",
  DisdettaUsoPersonaleFamiliare: "Disdetta — uso personale/familiare",
  DisdettaVendita: "Disdetta — vendita immobile",
  DisdettaRistrutturazione: "Disdetta — ristrutturazione/demolizione",
  DisdettaAltroAlloggioDisponibile: "Disdetta — altro alloggio disponibile per l'inquilino",
  DisdettaMancataOccupazione: "Disdetta — mancata occupazione da parte dell'inquilino",
  DecessoConduttore: "Decesso del conduttore",
  RisoluzioneConsensuale: "Risoluzione consensuale / disdetta comunicata",
  Altro: "Altro (motivo non tipico)"
};

// Riferimenti normativi indicativi per motivo — informazione di orientamento generale,
// NON sostituisce una consulenza legale (coerente con la regola del progetto di non fornire
// automatismi su questioni giuridiche non confermate direttamente da Massimo).
export const EARLY_TERMINATION_LEGAL_REFS: Record<string, string> = {
  MorositaSfratto: "art. 5 Legge 392/1978 e art. 658 c.p.c. (sfratto per morosità)",
  GraveInadempimento: "artt. 1453 e 1455 Codice Civile (risoluzione per inadempimento)",
  RecessoLavoro: "art. 4, comma 3, Legge 431/1998 (recesso del conduttore per gravi motivi)",
  RecessoSalute: "art. 4, comma 3, Legge 431/1998 (recesso del conduttore per gravi motivi)",
  RecessoImmobileInabitabile: "art. 4, comma 3, Legge 431/1998 e art. 1578 Codice Civile",
  DisdettaUsoPersonaleFamiliare: "art. 3, comma 1, lett. a), Legge 431/1998",
  DisdettaVendita: "art. 3, comma 1, lett. g), Legge 431/1998",
  DisdettaRistrutturazione: "art. 3, comma 1, lett. d), Legge 431/1998",
  DisdettaAltroAlloggioDisponibile: "art. 3, comma 1, lett. f), Legge 431/1998",
  DisdettaMancataOccupazione: "art. 3, comma 1, lett. e), Legge 431/1998",
  DecessoConduttore: "art. 6 Legge 392/1978 (successione nel contratto)",
  RisoluzioneConsensuale: "art. 1372 Codice Civile (mutuo dissenso)",
  Altro: ""
};

export function earlyTerminationReasonLabel(reason?: string, freeText?: string): string {
  if (!reason) return "";
  const base = EARLY_TERMINATION_REASON_LABELS[reason] || reason;
  if (reason === "Altro" && freeText && freeText.trim()) return `${base}: ${freeText.trim()}`;
  return base;
}

export function earlyTerminationLegalRef(reason?: string): string {
  if (!reason) return "";
  return EARLY_TERMINATION_LEGAL_REFS[reason] || "";
}

interface DisdettaLetterInput {
  ownerName: string;
  tenantName: string;
  propertyAddress?: string;
  party: "Locatore" | "Conduttore";
  reasonLabel: string;
  legalRef?: string;
  effectiveDateFormatted: string;
}

// Testo di default della comunicazione — precompilato nella bozza modificabile del wizard,
// poi eventualmente corretto a mano da Massimo prima di generare il PDF definitivo.
export function buildDisdettaLetterBody(input: DisdettaLetterInput): string {
  const { ownerName, tenantName, propertyAddress, party, reasonLabel, legalRef, effectiveDateFormatted } = input;
  const indirizzo = propertyAddress || "___________";

  const apertura = party === "Locatore"
    ? `Con la presente, il sottoscritto ${ownerName}, in qualità di Locatore, comunica formalmente al Conduttore ${tenantName} la disdetta anticipata del contratto di locazione relativo all'immobile sito in ${indirizzo}, con effetto dal ${effectiveDateFormatted}.`
    : `Con la presente si dà atto e si conferma il recesso anticipato comunicato dal Conduttore ${tenantName} in relazione al contratto di locazione dell'immobile sito in ${indirizzo}, con effetto dal ${effectiveDateFormatted}.`;

  const motivazione = `Motivazione: ${reasonLabel}.${legalRef ? ` Riferimento normativo indicativo: ${legalRef}.` : ""}`;

  const riconsegna =
    `Si invita la controparte a organizzarsi per le operazioni di riconsegna dell'immobile (Verbale di Riconsegna e restituzione delle chiavi) entro la data sopra indicata.`;

  const indennita =
    `Resta inteso che, qualora alla data indicata l'immobile non risultasse riconsegnato tramite apposito Verbale di Riconsegna sottoscritto da entrambe le parti, le somme dovute continueranno a maturare — nella stessa misura del canone in essere — a titolo di Indennità di Occupazione, fino all'avvenuta riconsegna.`;

  return [apertura, motivazione, riconsegna, indennita, "Distinti saluti."].join("\n\n");
}
