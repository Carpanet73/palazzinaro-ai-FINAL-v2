
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
  millesimi?: number; // Quota millesimale (modificabile)
  luceMeter?: UtilityMeter;
  gasMeter?: UtilityMeter;
  acquaMeter?: UtilityMeter;
  createdAt: string;
}

export interface Tenant {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  fiscalCode?: string;
  propertyId?: string; // current linked property
  contractId?: string; // current contract
  notes?: string;
  createdAt: string;
  // Company optional fields
  isCompany?: boolean;
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
  address: string;
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
  address?: string;        // Residenza / Sede legale (facoltativo)
  iban?: string;           // IBAN del proprietario per accrediti (facoltativo)
  isCompany?: boolean;     // true se persona giuridica
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
  disdettaReceiptFile?: string;
  isBareOwnership?: boolean;
  createdAt: string;
  splitMethod?: "Percentage" | "Fixed" | "percentage" | "fixed";
  fixedTenantAmount?: number;
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
  futureExpirations?: any[];
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
  address: string;
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
}


