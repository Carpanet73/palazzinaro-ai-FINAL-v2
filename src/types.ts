
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
}

export interface UtilityMeter {
  meterNumber: string;
  lastReading: number;
  readingDate: string;
  activeFlag: "proprietario" | "conduttore"; // Indicatore di intestazione
}

// CORREZIONE AZ — Storico delle letture di un contatore nel tempo (non solo l'ultima), per
// poter calcolare il consumo reale in un intervallo di date quando arriva la bolletta.
export interface MeterReadingLog {
  id: string;
  userId: string;
  propertyId: string;
  meterType: "luce" | "gas" | "acqua";
  readingValue: number;
  readingDate: string; // YYYY-MM-DD
  notes?: string;
  createdAt: string;
}

// CORREZIONE AZ — Ripartizione di una bolletta comune (es. luce scale, acqua) tra più
// immobili dello stesso "Stabile", in proporzione al consumo reale nel periodo di
// competenza della bolletta (non a caso, non in parti sempre uguali).
export interface SharedUtilityBill {
  id: string;
  userId: string;
  stabile: string; // etichetta che raggruppa più immobili senza bisogno di un Condominio formale
  meterType: "luce" | "gas" | "acqua";
  totalAmount: number;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  splits: Array<{
    propertyId: string;
    propertyName: string;
    tenantId?: string;
    tenantName: string;
    startReading: number | null;
    endReading: number | null;
    consumption: number; // delta calcolato in questo periodo
    shareAmount: number; // quota di importo attribuita
  }>;
  notes?: string;
  createdAt: string;
}

export interface Property {
  id: string;
  userId: string;
  name: string;
  address: string;
  type: string; // e.g. "Appartamento", "Ufficio", "Negozio", "Villa", "Garage"
  status: "Available" | "Rented" | "Maintenance" | "Archived";
  notes?: string;
  owner?: string; // stringa libera (retrocompatibilità — per immobili creati prima di Correzione B)
  ownerId?: string; // ID del record Owner in collezione "owners" (Correzione B)
  isBareOwnership?: boolean; // if true, it's "Nuda Proprietà"
  isCondoConstituted?: boolean; // if true, "Condominio Costituito"
  condominiumId?: string; // Associated Condominium ID
  // CORREZIONE AZ — etichetta leggera per raggruppare più immobili nello stesso stabile
  // fisico, quando NON esiste un Condominio formale costituito (es. palazzo intero di un
  // solo proprietario con più inquilini) — serve per la ripartizione delle bollette comuni.
  stabile?: string;
  // CORREZIONE BM — Dati catastali e classe energetica: servono per generare i contratti di
  // locazione esattamente come nel modello reale. Restano per sempre sulla scheda
  // dell'immobile (non cambiano a ogni contratto), fotografabili una sola volta.
  cadastralData?: {
    foglio?: string;
    particella?: string;
    subalterno?: string;
    categoria?: string; // es. "A/3"
    vaniCatastali?: string;
    classe?: string;
    renditaCatastale?: string; // es. "387.34"
    piano?: string;
  };
  energyClass?: {
    classe?: string; // es. "F"
    ipeGlobale?: string; // es. "201.48 KWh/mq anno"
    expiryDate?: string; // l'APE scade ogni 10 anni — serve per il promemoria
  };
  documents?: StoredDocument[]; // documenti fotografati (visura catastale, APE) conservati agli atti
  millesimi?: number; // Quota millesimale (modificabile)
  luceMeter?: UtilityMeter;
  gasMeter?: UtilityMeter;
  acquaMeter?: UtilityMeter;
  createdAt: string;
}

// CORREZIONE BV — Documento conservato "agli atti": il file vero sta su Firebase Storage (mai
// nel database), qui si tiene solo il riferimento. Si può agganciare a Inquilino, Immobile,
// Contratto, Proprietario e Pratica Legale — la stessa identica struttura ovunque, così un
// documento fotografato una volta si ritrova coerentemente in tutte le aree collegate.
export interface StoredDocument {
  id: string;
  fileName: string;
  category: string; // es. "Documento d'Identità", "Permesso di Soggiorno", "Visura Catastale", "APE"
  storageLink: string; // URL di download diretto (Firebase Storage)
  storagePath: string; // percorso interno nel bucket, usato per eventuale cancellazione
  uploadedAt: string;
}

export interface Tenant {
  id: string;
  userId: string;
  // Numero di registro progressivo, assegnato automaticamente e mai più modificato alla
  // creazione dell'Inquilino (indipendentemente da quale dei flussi di creazione viene usato:
  // pagina Inquilini, Wizard Immobile, Wizard Contratto). Progressivo per singolo utente.
  registryNumber?: number;
  name: string;
  email: string;
  phone?: string;
  fiscalCode?: string;
  propertyId?: string; // current linked property
  contractId?: string; // current contract
  notes?: string;
  createdAt: string;
  // CORREZIONE AA — anagrafica più completa: data di nascita e indirizzo strutturato
  // (mai più un campo unico "indirizzo": via, civico, interno, città, provincia, CAP
  // separati), servono per le comunicazioni formali (Messa in Mora, lettere) e per
  // funzioni come il promemoria di compleanno.
  birthDate?: string; // YYYY-MM-DD
  birthPlace?: string; // "nato/a a ___" — serve per la generazione contratti
  address?: {
    via?: string;
    civico?: string;
    interno?: string;
    citta?: string;
    provincia?: string; // sigla, es. "MI" — proposta automaticamente dalla città quando nota
    cap?: string;
  };
  // CORREZIONE BM — Documento d'identità (sempre) e permesso di soggiorno (solo se
  // straniero): servono per generare i contratti di locazione esattamente come nel modello
  // reale fornito dall'utente. isForeign è una scelta esplicita, non dedotta automaticamente.
  isForeign?: boolean;
  identityDocument?: {
    type?: "Carta d'Identità" | "Passaporto";
    number?: string;
    issuedDate?: string;
    expiryDate?: string;
  };
  residencePermit?: {
    number?: string;
    issuedDate?: string; // "rilasciato il ___"
    validity?: string; // es. "illimitata" oppure una data di scadenza YYYY-MM-DD
    expiryDate?: string; // se non a validità illimitata — serve per il promemoria di scadenza
  };
  documents?: StoredDocument[]; // documenti fotografati conservati agli atti
  // Company optional fields
  isCompany?: boolean;
  // CORREZIONE CC — genere persistente (M/F), serve al generatore contratti per le
  // forme corrette (nato/a, conduttore/conduttrice) senza doverlo riselezionare ogni
  // volta. Solo per persone fisiche (nullo/non mostrato se isCompany).
  gender?: "M" | "F";
  companyName?: string;
  companyFiscalCode?: string;
  vatNumber?: string;
  pec?: string;
  registeredOffice?: string;
  legalRepresentativeName?: string;
  legalRepresentativeFiscalCode?: string;
  visuraCameraleFileName?: string;
  // Altri cointestatari dello stesso contratto (obbligazione solidale):
  // NON generano un secondo conto/debitore — il conto e i Solleciti restano unici su
  // questo Tenant. Servono però dati fiscali e di contatto reali, perché i messaggi
  // WhatsApp/Email dei Solleciti devono raggiungere anche loro, non solo l'intestatario principale.
  coTenants?: Array<{
    name: string;
    fiscalCode?: string;
    phone?: string; // per includerlo nell'invio WhatsApp del sollecito
    email?: string; // per includerlo nell'invio Email del sollecito
  }>;
  // ── CORREZIONE G — Garante strutturato ──
  // Prima era solo un campo di testo libero dentro le note. Ora ha dati fiscali e di
  // contatto reali (per essere raggiunto da solleciti/messa in mora) e un elenco di
  // documenti allegati (es. buste paga, dichiarazione dei redditi) usati per costituire
  // il fascicolo in caso di passaggio all'Area Legale.
  guarantor?: {
    name: string;
    fiscalCode?: string;
    phone?: string;
    email?: string;
    notes?: string;
    documents?: Array<{
      id: string;
      name: string;
      type: string; // es. "Busta Paga", "Dichiarazione dei Redditi", "Altro"
      uploadedAt: string; // YYYY-MM-DD
    }>;
  };
}

export interface OwnerProfile {
  id: string; // same as user.uid
  userId: string;
  name: string;
  fiscalCode: string;
  address: string; // legacy: testo libero, mantenuto per compatibilità
  // CORREZIONE AB — indirizzo strutturato: serve anche per la formula "Città, lì [data]"
  // nelle lettere formali (Messa in Mora), coerente con lo stile di una vera lettera legale.
  structuredAddress?: {
    via?: string;
    civico?: string;
    interno?: string;
    citta?: string;
    provincia?: string;
    cap?: string;
  };
  birthDate?: string;
  birthPlace?: string; // "nato a ___" — per la formula di autoidentificazione nella Messa in Mora
  email: string;
  phone: string;
  iban: string;
  defaultQuota: number;
  createdAt: string;
  updatedAt?: string;
  notificationDays?: string[];
  notificationHoursStart?: string;
  notificationHoursEnd?: string;
  pauseStartDate?: string;
  pauseEndDate?: string;
  pauseEnabled?: boolean;
  emailServiceId?: string;
  emailTemplateId?: string;
  emailPublicKey?: string;
}

// ── CORREZIONE B — Anagrafica Proprietari reale ──
// Record di un proprietario (persona fisica o giuridica) collegato a uno o più immobili.
// Sostituisce la pratica precedente di salvare solo la stringa p.owner.
// La stringa p.owner resta per retrocompatibilità, ma viene affiancata da p.ownerId.
export interface Owner {
  id: string;
  userId: string;
  name: string;            // Nome e cognome (persona fisica) o Ragione Sociale (società)
  fiscalCode: string;      // Codice Fiscale (persona) o P.IVA (società)
  email: string;
  phone: string;
  address?: string;        // legacy: testo libero, mantenuto per compatibilità con record vecchi
  // CORREZIONE AA — indirizzo strutturato reale, e data di nascita: servono per le
  // comunicazioni formali (Messa in Mora con il proprietario come mittente/firmatario).
  birthDate?: string; // YYYY-MM-DD
  // CORREZIONE BS — mancava completamente: senza questo campo il generatore di contratti
  // non ha MAI potuto scrivere "nato/a a ___" per il locatore, lasciando sempre il
  // segnaposto vuoto nel documento generato.
  birthPlace?: string; // "nato/a a ___" — per la formula anagrafica nel contratto di locazione
  structuredAddress?: {
    via?: string;
    civico?: string;
    interno?: string;
    citta?: string;
    provincia?: string;
    cap?: string;
  };
  // CORREZIONE AJ — Comproprietari: stessa logica dei Cointestatari dell'Inquilino.
  // NON creano un secondo conto/debitore — il conto/mastrino resta UNICO su questo Owner
  // (obbligazione solidale: se non paga uno, paga l'altro). Se il comproprietario esiste
  // già come Owner reale, si collega con `linkedOwnerId` invece di duplicare i dati.
  coOwners?: Array<{
    name: string;
    fiscalCode?: string;
    phone?: string;
    email?: string;
    linkedOwnerId?: string; // se collegato a un Owner già esistente, per evitare doppioni
  }>;
  iban?: string;           // IBAN del proprietario per accrediti (facoltativo)
  isCompany?: boolean;     // true se persona giuridica
  // CORREZIONE CC — genere persistente (M/F), stesso scopo del campo su Tenant.
  gender?: "M" | "F";
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Contract {
  id: string;
  userId: string;
  propertyId: string;
  propertyName?: string;
  tenantId: string;
  tenantName?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  rentAmount: number;
  frequency: "Mensile" | "Trimestrale" | "Semestrale" | "Annuale";
  status: "Active" | "Draft" | "Expired" | "Terminated";
  notes?: string;
  ownerName?: string;
  disdettaReceiptUploaded?: boolean;
  disdettaReceiptDate?: string;
  // CORREZIONE BM/BN — Regime fiscale (per le registrazioni F24, quando verranno
  // costruite) e documenti agli atti (il contratto generato stesso, e i documenti raccolti
  // per generarlo: identità, permesso di soggiorno, visura, APE).
  taxRegime?: "CedolareSecca" | "Ordinaria";
  // CORREZIONE CK (05/08/2026) — ripartizione dell'imposta di registro F24 tra Locatore e
  // Conduttore quando il regime è Ordinaria (per legge di regola in parti uguali, ma libera
  // e modificabile — solo % Locatore salvata, il resto è sempre 100 - questo valore).
  f24OwnerSplitPct?: number;
  documents?: StoredDocument[];
  // Testo completo del contratto generato (per poterlo rivedere/rigenerare senza dover
  // rifare tutta la procedura guidata da capo)
  generatedContractText?: string;
  disdettaReceiptFile?: string;
  isBareOwnership?: boolean;
  createdAt: string;
  splitMethod?: "Percentage" | "Fixed" | "percentage" | "fixed";
  fixedTenantAmount?: number;
  // CORREZIONE BY — Disdetta Anticipata (chiarito da Massimo il 29/07/2026): quando il
  // contratto viene chiuso anticipatamente (non per scadenza naturale), queste righe
  // registrano causale/data/note. Attiva lo stesso meccanismo "Indennità di Occupazione"
  // già esistente per la scadenza naturale (vedi FastClosingView.tsx) — le righe contabili
  // NON si fermano di colpo, cambiano solo nome/natura, fino al Verbale di Riconsegna.
  earlyTerminationDate?: string; // YYYY-MM-DD
  earlyTerminationParty?: "Locatore" | "Conduttore";
  earlyTerminationReason?:
    | "MorositaSfratto"
    | "GraveInadempimento"
    | "RecessoLavoro"
    | "RecessoSalute"
    | "RecessoImmobileInabitabile"
    | "DisdettaUsoPersonaleFamiliare"
    | "DisdettaVendita"
    | "DisdettaRistrutturazione"
    | "DisdettaAltroAlloggioDisponibile"
    | "DisdettaMancataOccupazione"
    | "DecessoConduttore"
    | "RisoluzioneConsensuale"
    | "Altro";
  earlyTerminationNotes?: string;
  // CORREZIONE CL (05/08/2026) — testo libero quando earlyTerminationReason === "Altro"
  // (motivo non tipico, richiesto esplicitamente da Massimo per la procedura guidata).
  earlyTerminationReasonFreeText?: string;
  // Bozza/testo finale della comunicazione di disdetta, modificabile nel wizard prima di
  // generare il PDF reale — salvato per poterlo rivedere o rigenerare senza riscriverlo,
  // stesso principio di generatedContractText.
  earlyTerminationLetterText?: string;
  // Timestamp di verifica del codice OTP inviato via email al momento della conferma
  // definitiva (solo traccia/audit, non un dato bloccante).
  earlyTerminationOtpVerifiedAt?: string;
  // Timestamp dell'ultimo invio email della comunicazione di disdetta al Conduttore.
  earlyTerminationLetterSentAt?: string;
  // CORREZIONE BY — Deposito Cauzionale, versato alla creazione del contratto in un certo
  // numero di mensilità anticipate. Alla riconsegna finale supporta la restituzione con
  // eventuale compensazione rispetto ai danni contestati (calcolo, non negoziazione).
  securityDepositAmount?: number;
  securityDepositMonths?: number;
  // CORREZIONE CA — TASK 1 (verbale di consegna tracciato, non bloccante): true finché
  // il Verbale di Consegna non viene compilato dopo la creazione del contratto.
  deliveryReportPending?: boolean;
}

export interface CondoRate {
  title: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  notes?: string;
  splitPercentageTenant?: number; // percentage charged to tenant, e.g. 80
  amountTenant?: number; // calculated tenant share
  amountOwner?: number; // calculated owner share
}

export interface Administrator {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  email?: string;
  // CORREZIONE AB — indirizzo strutturato, stessa struttura usata ovunque nell'app
  structuredAddress?: {
    via?: string;
    civico?: string;
    interno?: string;
    citta?: string;
    provincia?: string;
    cap?: string;
  };
  notes?: string;
  createdAt: string;
}

export interface Condominium {
  id: string;
  userId: string;
  name: string;
  // CORREZIONE P — un condominio è un'entità giuridica legata a un edificio fisico:
  // il suo indirizzo deve coincidere con quello degli immobili che vi appartengono,
  // non essere un dato scollegato inserito a mano.
  address?: string;
  administrator?: string; // legacy: testo libero, mantenuto per i condomini creati prima della CORREZIONE L
  administratorId?: string; // CORREZIONE L — collegamento reale all'entità Administrator
  phone?: string;
  email?: string;
  notes?: string;
  rates?: CondoRate[]; // list of rates extracted by AI or entered manually
  createdAt: string;
}

export interface CreditInstitution {
  id: string;
  userId: string;
  name: string;
  branch?: string; // filiale opzionale
  notes?: string;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  userId: string;
  institutionId: string; // collegato a un istituto
  iban: string;
  holder: string; // intestatario
  currency: string; // valuta (es: EUR)
  isActive: boolean; // stato attivo/inattivo
  createdAt: string;
}

export interface BankMovement {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // positive for revenue, negative for expense
  reconciled: boolean;
  reconciledWith?: {
    type: "contract" | "condominium" | "manual" | "reminder" | "maintenance";
    id: string;
    title: string;
  };
  bankAccountId?: string; // collegato a un conto corrente specifico
  createdAt: string;
}

export interface FastClosingItem {
  id: string;
  userId: string;
  propertyId?: string;
  source: "contract" | "condominium" | "manual" | "reminder" | "maintenance";
  sourceId?: string;
  title: string;
  description?: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  status: "Pending" | "Paid" | "Overdue" | "Cancelled";
  reconciledWithMovementId?: string; // linked bank movement ID when cleared
  createdAt: string;
  // ── CORREZIONE D — identificazione robusta del debitore ──
  // Collegamento diretto e sicuro (ID reale) alla persona a cui è imputata la voce.
  // Sostituisce il riconoscimento "a indovinare" dal testo del titolo, che restava
  // come unico metodo prima di questa correzione (fragile e rischioso con nomi comuni).
  debtorId?: string;   // Tenant.id oppure Owner.id
  debtorType?: "owner" | "tenant";
  // CORREZIONE CL (05/08/2026) — quando una riga viene annullata per una disdetta
  // anticipata (o in futuro per altri annullamenti motivati), qui resta traccia del
  // perché — prima uno stato "Cancelled" non spiegava mai la causale nel mastrino.
  cancellationReason?: string;
  // CORREZIONE CP (13/08/2026) — Fase 2 punto 1: da quando `title` è diventato l'etichetta
  // standard "{Cognome}/{Via} {Civico} {Tipologia} {Mese} {Anno}" (src/lib/ledgerLabel.ts),
  // non contiene più il testo libero della spesa/voce originale (es. descrizione della spesa
  // condominiale inserita da Massimo) né un identificativo per accoppiare le due righe
  // (Inquilino/Proprietario) della STESSA spesa condominiale — prima questo veniva dedotto
  // facendo parsing del testo del titolo, fragile e ora impossibile col nuovo formato.
  // Questi due campi sostituiscono quel parsing con dati strutturati:
  groupLabel?: string;      // testo libero della voce originale (es. "Rata Ordinaria Ottobre"), per la UI
  expenseGroupKey?: string; // stesso valore su tutte le righe che fanno parte della stessa spesa/evento
}

export interface Reminder {
  id: string;
  userId: string;
  tenantId: string;
  tenantName: string;
  contractId?: string;
  propertyId?: string;
  amount: number;
  reason: string;
  dueDate: string; // YYYY-MM-DD
  status: "Pending" | "Sent" | "Paid" | "Cancelled" | "MessaInMora" | "Closed";
  sentDate?: string;
  suggestedLetterBody?: string; // AI generated letter
  followUpNotes?: string;
  registeredLetterReceiptName?: string;
  registeredLetterReceiptUrl?: string;
  createdAt: string;
  // Sequence fields for multi-step payment requests
  isSequence?: boolean;
  step?: number; // 1: First Request, 2: Second Request, 3: Messa in Mora, 4: Transferred
  firstRequestDate?: string;
  secondRequestDate?: string;
  thirdRequestDate?: string;
  receiptDownloaded?: boolean;
  associatedItemsIds?: string[];
  // Link alla scadenza in Fast Closing che ha originato questo sollecito
  // (es. affitto non esitato → sollecito automatico)
  fastClosingItemId?: string;
  notes?: string;
  // CORREZIONE D — il debitore non è sempre un inquilino: può essere anche un
  // comproprietario (es. quota manutenzione non versata all'altro proprietario).
  // tenantId/tenantName restano valorizzati in entrambi i casi per compatibilità.
  debtorType?: "owner" | "tenant";
}

export interface Maintenance {
  id: string;
  userId: string;
  propertyId: string;
  propertyName: string;
  title: string;
  description?: string;
  status: "New" | "In Progress" | "Completed" | "Cancelled";
  cost?: number;
  contractor?: string;
  date?: string; // YYYY-MM-DD
  chargedTo?: "owner" | "tenant";
  esigibilita?: "Immediata" | "Differita"; // Immediate or Deferred payment eligibility
  esigibilitaData?: string; // Future Fast Closing target date
  createdAt: string;
  splits?: Array<{
    debtorName: string;
    type: "owner" | "tenant";
    amount: number;
    debtorId?: string; // CORREZIONE D — Owner.id o Tenant.id reale, quando risolvibile
  }>;
}

export interface LegalCase {
  id: string;
  userId: string;
  propertyId?: string;
  propertyName?: string;
  contractId?: string;
  tenantName?: string;
  title: string;
  description?: string;
  status: "Active" | "Pending" | "Closed";
  notes?: string;
  createdAt: string;
  // Expanded fields for lawyer assignment and sequence
  assignedLawyerId?: string;
  assignedLawyerName?: string;
  lawyerAccepted?: boolean;
  zipFileName?: string;
  unpaidBalance?: number;
  filesToAssign?: boolean;
  contractDetails?: any;
  pastRequests?: any[];
  // CORREZIONE CA — TASK 2d: collega il fascicolo ai verbali (consegna + riconsegna)
  // usati come prova del danno contestato.
  relatedDeliveryReportIds?: string[];
  futureExpirations?: any[];
  // CORREZIONE AU — traccia quando e a quale email è stato inviato il fascicolo allo studio legale
  dossierSentAt?: string;
  dossierSentToEmail?: string;
  // CORREZIONE AU — voci insolute nate DOPO che la pratica è già in Area Legale: bypassano i
  // Solleciti e vengono inviate direttamente all'avvocato assegnato, una alla volta. Restano
  // tracciate qui in modo che il fascicolo "ufficiale" sia sempre completo — se si cambia
  // avvocato, il nuovo riceve tutto, non solo il lotto originale.
  additionalSentItems?: Array<{
    itemId: string;
    title: string;
    amount: number;
    sentAt: string;
    sentToLawyerId: string;
    sentToLawyerName: string;
  }>;
  // CORREZIONE BM — i documenti fotografati (identità, contratto, ecc.) collegati a questo
  // inquilino/immobile restano visibili anche qui, nel fascicolo legale, quando la pratica
  // viene passata all'avvocato — mai duplicati, solo lo stesso riferimento Firebase Storage.
  documents?: StoredDocument[];
}

export interface Communication {
  id: string;
  userId: string;
  tenantId: string;
  tenantName: string;
  type: "WhatsApp" | "Email";
  title: string;
  body: string;
  sentAt: string;
  step: number;
}

export interface Lawyer {
  id: string;
  userId: string;
  name: string;
  studioName: string;
  email: string;
  phone: string;
  address: string; // legacy: testo libero, mantenuto per compatibilità
  // CORREZIONE AB — indirizzo strutturato, stessa struttura usata per Inquilini/Proprietari
  structuredAddress?: {
    via?: string;
    civico?: string;
    interno?: string;
    citta?: string;
    provincia?: string;
    cap?: string;
  };
  specialization?: string;
  createdAt: string;
}

export type AppSection =
  | "dashboard"
  | "properties"
  | "contracts"
  | "tenants"
  | "condominiums"
  | "banks"
  | "fast_closing"
  | "reminders"
  | "maintenance"
  | "legal"
  | "ai_area"
  | "owners"
  | "settings";

export interface InsurancePolicy {
  id: string;
  userId: string;
  propertyId?: string; // Associated with a property
  ownerId?: string; // Or associated with a owner/proprietario
  company: string; // Compagnia di assicurazione
  policyNumber: string; // Numero polizza
  coverageType: string; // Tipo di copertura (es: incendio, r.c., globale fabbricati)
  expiryDate: string; // Data di scadenza (YYYY-MM-DD)
  attachmentName?: string; // Allegato documento (nome file)
  premiumAmount?: number; // annual premium amount
  docName?: string; // alternative alias
  createdAt: string;
}

export interface DeliveryReportItem {
  id: string;
  item: string; // e.g. "Stato pareti", "Elettrodomestici", "Chiavi consegnate", "Letture contatori"
  status: string; // e.g. "Ottimo", "Buono", "Da riparare" / value
  notes?: string;
  photos?: string[]; // list of attached photo names or simulation URLs
}

export interface DeliveryReport {
  id: string;
  userId: string;
  propertyId: string; // Associated with a property
  contractId?: string; // Associated with a contract
  tenantId?: string; // Associated with a tenant
  type: "consegna" | "riconsegna"; // Tipo di verbale
  date: string; // Data verbale
  checklist: DeliveryReportItem[];
  signatures: {
    ownerSigned: boolean;
    ownerSignatureData?: string; // Simulated base64 or drawn text/name
    ownerSignedAt?: string;
    tenantSigned: boolean;
    tenantSignatureData?: string;
    tenantSignedAt?: string;
  };
  documentName?: string; // Completed PDF/report name
  createdAt: string;
  // CORREZIONE BY — per la procedura guidata di Verbale di Riconsegna (29/07/2026): se
  // vengono riscontrati danni rispetto al Verbale di Consegna iniziale, origina un
  // fascicolo per l'Area Legale (collegato qui tramite legalCaseId); in ogni caso il
  // fascicolo va salvato su Drive (driveBackupUrl, quando l'integrazione sarà pronta).
  hasDamages?: boolean;
  damagesDescription?: string;
  legalCaseId?: string;
  // CORREZIONE CA — TASK 3b: stima € danni inserita nella riconsegna, usata per il
  // calcolo informativo di restituzione/compensazione del deposito cauzionale.
  estimatedDamagesAmount?: number;
  driveBackupUrl?: string;
}


