// CORREZIONE CP (13/08/2026) — Fase 2, punto 1: formato standard delle righe contabili in
// TUTTA l'applicazione, richiesto esplicitamente da Massimo. Fonte unica del formato
// "{Cognome}/{Via} {Civico} {Tipologia} {Mese} {Anno}" (es. "Rossi/Via Roma 10 Affitto
// Agosto 2026"), valido per qualunque debitore (inquilino O proprietario, stesso schema con
// il cognome del proprietario) e per qualunque tipologia di voce contabile (canoni,
// manutenzioni, spese condominiali, F24, indennità di occupazione, ecc.) — stesso principio
// di earlyTermination.ts: niente stringhe duplicate e potenzialmente disallineate in più file.
//
// IMPORTANTE: questo file genera SOLO l'etichetta per la visualizzazione (`title`). La
// logica applicativa che deve riconoscere "che tipo di voce è questa" o "a chi appartiene"
// NON deve mai fare parsing del testo di `title` — deve sempre usare i campi strutturati
// dell'oggetto (`source`, `debtorId`, `debtorType`, `propertyId`, ecc.), che esistono già su
// FastClosingItem. Se serve un marcatore leggibile da codice (es. per evitare la
// duplicazione dell'Indennità di Occupazione), va messo nel campo `description`, mai dedotto
// da `title`.

export const ITALIAN_MONTHS_FULL = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

/** Restituisce il nome del mese italiano (1-12) e l'anno a partire da una data "YYYY-MM-DD" o "YYYY-MM". */
export function getItalianMonthYearFromDate(dateStr: string): { month: string; year: number } | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const monthIndex = parseInt(match[2], 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return { month: ITALIAN_MONTHS_FULL[monthIndex], year };
}

/**
 * Estrae il "cognome" da un nominativo per l'etichetta contabile.
 * - Persona fisica: ultima parola del nome (unico precedente esistente in codice, vedi
 *   FastClosingView.tsx classificazione inquilino critico).
 * - Società (Ragione Sociale): la Ragione Sociale non ha un "cognome" — si usa il nome
 *   intero così com'è, non ha senso troncarlo.
 */
export function getDebtorSurname(fullName: string | undefined | null, isCompany?: boolean): string {
  const name = (fullName || "").trim();
  if (!name) return "Debitore";
  if (isCompany) return name;
  const lastSpaceIdx = name.lastIndexOf(" ");
  if (lastSpaceIdx === -1) return name;
  return name.substring(lastSpaceIdx + 1).trim() || name;
}

/**
 * Estrae "Via + Civico" da un indirizzo Immobile in testo libero (Property.address non ha
 * campi strutturati separati, es. "Via Roma 10, 20100 Milano (MI)"). Best-effort: se non si
 * riesce a isolare in modo affidabile un numero civico, si restituisce l'indirizzo grezzo
 * (fino alla prima virgola) senza inventare un civico che non c'è.
 */
export function parsePropertyStreetAndNumber(address: string | undefined | null): string {
  const raw = (address || "").trim();
  if (!raw) return "";
  // Tiene solo la parte prima della prima virgola (città/CAP/provincia non servono qui).
  const streetPart = raw.split(",")[0].trim();
  return streetPart;
}

export interface LedgerLabelInput {
  /** Nome completo del debitore (Tenant.name oppure Owner.name/Ragione Sociale). */
  debtorName: string | undefined | null;
  /** true se il debitore è una società (Owner.isCompany / Tenant.isCompany) — niente troncamento del nome. */
  isCompany?: boolean;
  /** Indirizzo grezzo dell'immobile (Property.address), se disponibile. */
  propertyAddress?: string | null;
  /** Tipologia della voce, es. "Affitto", "Manutenzione", "Spese Condominiali", "F24 Registrazione", "Indennità di Occupazione". */
  tipologia: string;
  /** Data di riferimento "YYYY-MM-DD" o "YYYY-MM" da cui derivare mese e anno. */
  dateForPeriod?: string;
  /** In alternativa a dateForPeriod, mese e anno già calcolati altrove. */
  month?: string;
  year?: number;
}

/**
 * CORREZIONE (14/08/2026, punto 2 di "DA FARE PROSSIMO GIRO") — regola generale di Massimo
 * sulla granularità delle date nelle righe contabili: le voci INTERNE al rapporto
 * locatore/conduttore (in primis i canoni d'affitto) non devono mostrare il giorno — solo
 * mese e anno, coerente con l'etichetta standard (`formatLedgerLabel`, che incorpora già
 * "{Mese} {Anno}"). Eccezioni esplicite dove la data completa resta (o è preferibile): le
 * rate condominiali (scadenze specifiche reali) e ogni scadenza verso un rapporto ESTERNO —
 * registrazione contratto/F24, Solleciti di pagamento, Messa in Mora — cioè ogni volta che si
 * esce dalla sola gestione interna inquilino/proprietario.
 *
 * Classificazione "voce di canone" basata sui campi strutturati dell'oggetto (`source`,
 * `title`/`description` come fallback per voci storiche), MAI dedotta a occhio — stesso
 * principio di isRentItem/isRentItemForReconcile già in uso altrove nel codice.
 */
export function isInternalRentItem(item?: { source?: string; title?: string | null; description?: string | null } | null): boolean {
  if (!item) return false;
  const t = (item.title || "").toLowerCase();
  const d = (item.description || "").toLowerCase();
  return item.source === "contract" || t.includes("canone") || t.includes("affitto") || d.includes("canone") || d.includes("affitto");
}

/**
 * Formatta una data di scadenza per una riga contabile secondo la regola di granularità
 * sopra: "Agosto 2026" per i canoni d'affitto (voce interna), data completa "13/08/2026" per
 * tutto il resto (rate condominiali, F24/registrazione, manutenzioni, e ogni voce priva di
 * un `item` di contesto — comportamento invariato, mai un default "silenzioso" verso il
 * formato ridotto quando la classificazione non è certa).
 */
export function formatLedgerDate(dateStr: string | undefined | null, item?: { source?: string; title?: string | null; description?: string | null } | null): string {
  if (!dateStr) return "";
  if (isInternalRentItem(item)) {
    const parsed = getItalianMonthYearFromDate(dateStr);
    if (parsed) return `${parsed.month} ${parsed.year}`;
  }
  return new Date(dateStr).toLocaleDateString("it-IT");
}

/**
 * Formatta direttamente in "Mese Anno" (es. "Agosto 2026"), senza bisogno di un `item` da
 * classificare — per i punti dell'interfaccia dove il contesto è GIÀ certamente un canone
 * d'affitto (es. una tabella/scheda dedicata esclusivamente ai canoni, come la scheda
 * Proprietario). Fallback sulla data completa se la stringa non è nel formato atteso.
 */
export function formatMonthYear(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  const parsed = getItalianMonthYearFromDate(dateStr);
  if (parsed) return `${parsed.month} ${parsed.year}`;
  return new Date(dateStr).toLocaleDateString("it-IT");
}

/**
 * Genera l'etichetta standard di una riga contabile: "{Cognome}/{Via} {Civico} {Tipologia} {Mese} {Anno}".
 * Tollerante ai dati mancanti (immobile non ancora associato, data non disponibile): omette
 * solo il pezzo mancante, non inventa mai un dato non presente.
 */
export function formatLedgerLabel(input: LedgerLabelInput): string {
  const surname = getDebtorSurname(input.debtorName, input.isCompany);
  const street = parsePropertyStreetAndNumber(input.propertyAddress);

  let month = input.month;
  let year = input.year;
  if ((!month || !year) && input.dateForPeriod) {
    const parsed = getItalianMonthYearFromDate(input.dateForPeriod);
    if (parsed) {
      month = month || parsed.month;
      year = year || parsed.year;
    }
  }

  const parts: string[] = [];
  const firstSegment = street ? `${surname}/${street}` : surname;
  parts.push(firstSegment);
  if (input.tipologia) parts.push(input.tipologia);
  if (month) parts.push(month);
  if (year) parts.push(String(year));

  return parts.join(" ");
}
