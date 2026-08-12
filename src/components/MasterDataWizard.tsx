
/**
 * MasterDataWizard — Inserimento guidato unico
 *
 * Procedura 5-step per aggiungere in un colpo solo:
 *   1. Immobile (obbligatorio)
 *   2. Condominio (opzionale, solo se "è in condominio")
 *   3. Proprietario (seleziona esistente o crea nuovo — stringa)
 *   4. Inquilino (opzionale, solo se "è affittato")
 *   5. Contratto (opzionale, solo se "vuoi registrare contratto")
 *
 * Salva tutto in Firestore con link reciproci:
 *   - property.condominiumId ← condo.id
 *   - property.owner ← stringa proprietario
 *   - tenant.propertyId ← property.id
 *   - tenant.contractId ← contract.id
 *   - contract.propertyId ← property.id
 *   - contract.tenantId ← tenant.id
 *
 * Accessibile da qualsiasi sezione via bottone globale "+ Aggiungi".
 */


import React, { useState, useMemo, useEffect } from "react";
import AddressFields from "./AddressFields";
import GenderToggle from "./GenderToggle";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  Building2,
  Building,
  User,
  Users,
  FileText,
  CheckCircle2,
  Loader2,
  Home,
  Sparkles,
  Link2,
  Plus,
  AlertTriangle,
} from "lucide-react";
import {
  Property,
  Tenant,
  Contract,
  Condominium,
  Owner,
} from "../types";

// ============================================================================
// Props
// ============================================================================

export interface MasterDataWizardProps {
  // CORREZIONE AR — dati precompilati dall'estrazione AI: il Wizard si apre già riempito,
  // ma resta sempre possibile correggere/completare ogni campo prima di salvare davvero.
  prefillData?: {
    property?: { name?: string; address?: string; type?: string };
    tenant?: { name?: string; email?: string; phone?: string; fiscalCode?: string };
    owner?: { name?: string };
    contract?: { startDate?: string; endDate?: string; rentAmount?: number; frequency?: string };
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onPersist: (data: MasterDataPayload) => Promise<void>;
  existingOwners: Owner[]; // CORREZIONE B: record reali, non più stringhe
  existingCondominiums: Condominium[];
  existingTenants: Tenant[];
  onCreateOwner?: (data: Omit<Owner, "id" | "userId" | "createdAt">) => Promise<string | null>; // ritorna id del proprietario creato/riusato
  // CORREZIONE E — inserimento isolato: quando valorizzato, il wizard mostra SOLO il passo
  // di questa entità (senza forzare la creazione di un Immobile), per rispettare la regola
  // "un solo flusso di creazione per ciascuna entità" anche per gli inserimenti da pagina dedicata.
  standaloneEntity?: "owner" | "tenant" | "condominium";
}

export interface MasterDataPayload {
  // CORREZIONE E — quando valorizzato, App.tsx deve SOLO creare questa entità
  // (nessun immobile, nessun contratto): usato dagli inserimenti isolati da pagina dedicata.
  standaloneOnly?: "owner" | "tenant" | "condominium";
  // CORREZIONE CH — quando l'inquilino scelto è già esistente (non nuovo), il suo id va
  // passato qui per collegarlo all'immobile appena creato (App.tsx lo usa per updateDoc
  // sul tenant e come tenantId per l'eventuale contratto).
  selectedTenantId?: string;
  property?: {
    name: string;
    address: string;
    type: string;
    status: "Available" | "Rented" | "Maintenance" | "Archived";
    notes?: string;
    owner?: string;       // stringa libera (retrocompatibilità)
    ownerId?: string;     // CORREZIONE B: id record Owner in Firestore
    isBareOwnership?: boolean;
    isCondoConstituted?: boolean;
    condominiumId?: string;
    millesimi?: number;
  };
  owner?: {
    // CORREZIONE B — nuovo oggetto Owner da creare in Firestore
    name: string;
    fiscalCode: string;
    email: string;
    phone: string;
    address?: string;
    // CORREZIONE BS — questi campi erano già usati nel codice più sotto ma mancavano
    // qui nel tipo: birthDate/birthPlace servono al generatore di contratti.
    birthDate?: string;
    birthPlace?: string;
    structuredAddress?: { via?: string; civico?: string; interno?: string; citta?: string; provincia?: string; cap?: string };
    coOwners?: Array<{ name: string; fiscalCode?: string; phone?: string; email?: string; linkedOwnerId?: string }>;
    iban?: string;
    isCompany?: boolean;
    // CORREZIONE CC — genere persistente, serve al generatore contratti
    gender?: "M" | "F";
    notes?: string;
  };
  condominium?: {
    name: string;
    administrator?: string;
    phone?: string;
    email?: string;
    notes?: string;
  };
  tenant?: {
    name: string;
    email?: string;
    phone?: string;
    fiscalCode?: string;
    notes?: string;
    isCompany?: boolean;
    companyName?: string;
    vatNumber?: string;
    // CORREZIONE CC — TASK 2: parità con la pagina dedicata Inquilini (Regola 4)
    gender?: "M" | "F";
    birthDate?: string;
    birthPlace?: string;
    address?: { via?: string; civico?: string; interno?: string; citta?: string; provincia?: string; cap?: string };
    isForeign?: boolean;
    identityDocument?: { number?: string; expiryDate?: string };
    residencePermit?: { number?: string; validity?: string };
  };
  contract?: {
    startDate: string;
    endDate: string;
    rentAmount: number;
    frequency: "Mensile" | "Trimestrale" | "Semestrale" | "Annuale";
    status: "Active" | "Draft";
    notes?: string;
  };
}

// ============================================================================
// Step definitions
// ============================================================================

const STEPS = [
  { id: 1, label: "Immobile", icon: Building2, optional: false },
  { id: 2, label: "Condominio", icon: Building, optional: true },
  { id: 3, label: "Proprietario", icon: User, optional: true },
  { id: 4, label: "Inquilino", icon: Users, optional: true },
  { id: 5, label: "Contratto", icon: FileText, optional: true },
] as const;

const PROPERTY_TYPES = [
  "Appartamento",
  "Bilocale",
  "Monolocale",
  "Trilocale",
  "Villa",
  "Villa a schiera",
  "Ufficio",
  "Negozio",
  "Magazzino",
  "Box",
  "Garage",
  "Terreno",
  "Rustico",
  "Altro",
];

const FREQUENCIES = ["Mensile", "Trimestrale", "Semestrale", "Annuale"] as const;

// ============================================================================
// Component
// ============================================================================

export default function MasterDataWizard({
  isOpen,
  onClose,
  onPersist,
  prefillData,
  existingOwners,
  existingCondominiums,
  existingTenants,
  onCreateOwner,
  standaloneEntity,
}: MasterDataWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Step 1: Immobile ───────────────────────────────────────────────────
  const [propName, setPropName] = useState("");
  const [propAddress, setPropAddress] = useState("");
  const [propType, setPropType] = useState("Appartamento");
  const [propStatus, setPropStatus] = useState<"Available" | "Rented" | "Maintenance" | "Archived">("Available");
  const [propNotes, setPropNotes] = useState("");
  const [isBareOwnership, setIsBareOwnership] = useState(false);

  // ── Step 2: Condominio ─────────────────────────────────────────────────
  const [isCondominium, setIsCondominium] = useState(false);
  const [condoMode, setCondoMode] = useState<"existing" | "new">("new");
  const [existingCondoId, setExistingCondoId] = useState("");
  const [condoName, setCondoName] = useState("");
  const [condoAdmin, setCondoAdmin] = useState("");
  const [condoPhone, setCondoPhone] = useState("");
  const [condoEmail, setCondoEmail] = useState("");
  const [condoNotes, setCondoNotes] = useState("");
  const [condoMillesimi, setCondoMillesimi] = useState<number>(0);

  // ── Step 3: Proprietario (CORREZIONE B — anagrafica reale) ─────────────
  const [ownerMode, setOwnerMode] = useState<"select" | "new">(
    existingOwners.length > 0 ? "select" : "new"
  );
  const [selectedOwnerId, setSelectedOwnerId] = useState(""); // id record Owner selezionato
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerFiscalCode, setNewOwnerFiscalCode] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerPhone, setNewOwnerPhone] = useState("");
  const [newOwnerAddress, setNewOwnerAddress] = useState("");
  // CORREZIONE BS — mancavano qui (esistevano solo nel modulo di modifica in OwnersView):
  // stesso flusso, stessi campi, per non lasciare mai un proprietario creato dal wizard
  // senza i dati anagrafici che servono al generatore di contratti.
  const [newOwnerBirthDate, setNewOwnerBirthDate] = useState("");
  const [newOwnerBirthPlace, setNewOwnerBirthPlace] = useState("");
  // CORREZIONE CC — genere persistente proprietario
  const [newOwnerGender, setNewOwnerGender] = useState<"M" | "F" | undefined>(undefined);
  const [newOwnerIban, setNewOwnerIban] = useState("");
  const [newOwnerIsCompany, setNewOwnerIsCompany] = useState(false);
  // CORREZIONE AJ — indirizzo strutturato e comproprietari, disponibili subito in fase di
  // creazione (non solo dopo, dalla pagina Proprietari)
  const [newOwnerStructuredAddress, setNewOwnerStructuredAddress] = useState<{ via?: string; civico?: string; interno?: string; citta?: string; provincia?: string; cap?: string }>({});
  const [ownershipType, setOwnershipType] = useState<"single" | "multiple">("single");
  const [newOwnerCoOwners, setNewOwnerCoOwners] = useState<Array<{ name: string; fiscalCode?: string; phone?: string; email?: string; linkedOwnerId?: string }>>([]);
  const [showAddCoOwnerPicker, setShowAddCoOwnerPicker] = useState(false);
  const [coOwnerSearchTerm, setCoOwnerSearchTerm] = useState("");

  // ── Step 4: Inquilino ──────────────────────────────────────────────────
  const [isRented, setIsRented] = useState(false);
  const [tenantMode, setTenantMode] = useState<"select" | "new">("new");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [tName, setTName] = useState("");
  const [tEmail, setTEmail] = useState("");
  const [tPhone, setTPhone] = useState("");
  const [tFiscalCode, setTFiscalCode] = useState("");
  const [tNotes, setTNotes] = useState("");
  const [tIsCompany, setTIsCompany] = useState(false);
  const [tCompanyName, setTCompanyName] = useState("");
  const [tVatNumber, setTVatNumber] = useState("");
  // CORREZIONE CC — TASK 2: portare l'inquilino embedded alla parità con la pagina
  // dedicata Inquilini (Regola 4 — un solo flusso, stessi campi obbligatori/disponibili)
  const [tGender, setTGender] = useState<"M" | "F" | undefined>(undefined);
  const [tBirthDate, setTBirthDate] = useState("");
  const [tBirthPlace, setTBirthPlace] = useState("");
  const [tAddress, setTAddress] = useState<{ via?: string; civico?: string; interno?: string; citta?: string; provincia?: string; cap?: string; }>({});
  const [tIsForeign, setTIsForeign] = useState(false);
  const [tIdentityDocNumber, setTIdentityDocNumber] = useState("");
  const [tIdentityDocExpiry, setTIdentityDocExpiry] = useState("");
  const [tPermitNumber, setTPermitNumber] = useState("");
  const [tPermitValidity, setTPermitValidity] = useState("");

  // ── Step 5: Contratto ──────────────────────────────────────────────────
  const [hasContract, setHasContract] = useState(false);
  const [cStartDate, setCStartDate] = useState("");
  const [cEndDate, setCEndDate] = useState("");
  const [cRentAmount, setCRentAmount] = useState<number>(0);
  const [cFrequency, setCFrequency] = useState<"Mensile" | "Trimestrale" | "Semestrale" | "Annuale">("Mensile");
  const [cNotes, setCNotes] = useState("");

  // ============================================================================
  // Reset
  // ============================================================================
  const resetAll = () => {
    setCurrentStep(1);
    setMaxStepReached(1);
    setError(null);
    setPropName("");
    setPropAddress("");
    setPropType("Appartamento");
    setPropStatus("Available");
    setPropNotes("");
    setIsBareOwnership(false);
    setIsCondominium(false);
    setCondoMode("new");
    setExistingCondoId("");
    setCondoName("");
    setCondoAdmin("");
    setCondoPhone("");
    setCondoEmail("");
    setCondoNotes("");
    setCondoMillesimi(0);
    setOwnerMode(existingOwners.length > 0 ? "select" : "new");
    setSelectedOwnerId("");
    setNewOwnerName("");
    setNewOwnerFiscalCode("");
    setNewOwnerEmail("");
    setNewOwnerPhone("");
    setNewOwnerAddress("");
    setNewOwnerIban("");
    setNewOwnerIsCompany(false);
    setNewOwnerGender(undefined);
    setIsRented(false);
    setTenantMode("new");
    setSelectedTenantId("");
    setTName("");
    setTEmail("");
    setTPhone("");
    setTFiscalCode("");
    setTNotes("");
    setTIsCompany(false);
    setTCompanyName("");
    setTVatNumber("");
    setTGender(undefined);
    setTBirthDate("");
    setTBirthPlace("");
    setTAddress({});
    setTIsForeign(false);
    setTIdentityDocNumber("");
    setTIdentityDocExpiry("");
    setTPermitNumber("");
    setTPermitValidity("");
    setHasContract(false);
    setCStartDate("");
    setCEndDate("");
    setCRentAmount(0);
    setCFrequency("Mensile");
    setCNotes("");
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  // ============================================================================
  // CORREZIONE E — Modalità inserimento isolato (standaloneEntity)
  // ============================================================================
  // Quando il wizard viene aperto per aggiungere SOLO un Proprietario, un Inquilino
  // o un Condominio (dal tasto flottante di quella pagina dedicata), si salta
  // direttamente al passo giusto senza obbligare la creazione di un Immobile.
  useEffect(() => {
    if (isOpen && standaloneEntity) {
      if (standaloneEntity === "condominium") {
        setCurrentStep(2);
        setIsCondominium(true);
        setCondoMode("new");
      } else if (standaloneEntity === "owner") {
        setCurrentStep(3);
        setOwnerMode("new");
      } else if (standaloneEntity === "tenant") {
        setCurrentStep(4);
        setIsRented(true);
        setTenantMode("new");
      }
    }
  }, [isOpen, standaloneEntity]);

  // ============================================================================
  // CORREZIONE AR — Precompilazione da estrazione AI (Area AI)
  // ============================================================================
  // Quando l'AI estrae dei dati (es. da un PDF di contratto), il Wizard si apre già
  // riempito con quei valori, partendo dal primo passo — così restano sempre
  // controllabili, correggibili e completabili con dati che il documento non aveva,
  // prima di salvare davvero. Non salva mai nulla in automatico.
  useEffect(() => {
    if (isOpen && prefillData) {
      setCurrentStep(1);
      setMaxStepReached(5);

      if (prefillData.property) {
        setPropName(prefillData.property.name || "");
        setPropAddress(prefillData.property.address || "");
        if (prefillData.property.type) setPropType(prefillData.property.type);
      }
      if (prefillData.owner?.name) {
        setOwnerMode("new");
        setNewOwnerName(prefillData.owner.name);
      }
      if (prefillData.tenant) {
        setIsRented(true);
        setTenantMode("new");
        setTName(prefillData.tenant.name || "");
        setTEmail(prefillData.tenant.email || "");
        setTPhone(prefillData.tenant.phone || "");
        setTFiscalCode(prefillData.tenant.fiscalCode || "");
      }
      if (prefillData.contract) {
        setHasContract(true);
        setCStartDate(prefillData.contract.startDate || "");
        setCEndDate(prefillData.contract.endDate || "");
        setCRentAmount(prefillData.contract.rentAmount || 0);
        if (prefillData.contract.frequency) setCFrequency(prefillData.contract.frequency as any);
      }
    }
  }, [isOpen, prefillData]);

  const handleStandaloneSubmit = async () => {
    if (!standaloneEntity || !isStepValid(currentStep)) {
      setError("Completa i campi obbligatori prima di salvare.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: MasterDataPayload = { standaloneOnly: standaloneEntity };

      if (standaloneEntity === "condominium" && condoMode === "new") {
        payload.condominium = {
          name: condoName.trim(),
          administrator: condoAdmin.trim() || undefined,
          phone: condoPhone.trim() || undefined,
          email: condoEmail.trim() || undefined,
          notes: condoNotes.trim() || undefined,
        };
      } else if (standaloneEntity === "owner" && ownerMode === "new") {
        payload.owner = {
          name: newOwnerName.trim(),
          fiscalCode: newOwnerFiscalCode.trim(),
          email: newOwnerEmail.trim(),
          phone: newOwnerPhone.trim(),
          address: newOwnerAddress.trim() || undefined,
          birthDate: newOwnerBirthDate || undefined,
          birthPlace: newOwnerBirthPlace.trim() || undefined,
          structuredAddress: newOwnerStructuredAddress,
          coOwners: ownershipType === "multiple" ? newOwnerCoOwners : undefined,
          iban: newOwnerIban.trim() || undefined,
          isCompany: newOwnerIsCompany,
          gender: newOwnerIsCompany ? undefined : newOwnerGender,
          notes: undefined,
        };
      } else if (standaloneEntity === "tenant" && tenantMode === "new") {
        payload.tenant = cleanDeep({
          name: tName.trim(),
          email: tEmail.trim() || undefined,
          phone: tPhone.trim() || undefined,
          fiscalCode: tFiscalCode.trim() || undefined,
          notes: tNotes.trim() || undefined,
          isCompany: tIsCompany,
          companyName: tIsCompany ? tCompanyName.trim() : undefined,
          vatNumber: tIsCompany ? tVatNumber.trim() : undefined,
          gender: tIsCompany ? undefined : tGender,
          birthDate: tBirthDate || undefined,
          birthPlace: tBirthPlace.trim() || undefined,
          address: tAddress,
          isForeign: tIsForeign || undefined,
          identityDocument: tIdentityDocNumber
            ? { number: tIdentityDocNumber.trim(), expiryDate: tIdentityDocExpiry || undefined }
            : undefined,
          residencePermit: tIsForeign && tPermitNumber
            ? { number: tPermitNumber.trim(), validity: tPermitValidity.trim() || undefined }
            : undefined,
        });
      }

      await onPersist(payload);
      resetAll();
      onClose();
    } catch (err: any) {
      console.error("Wizard standalone save error:", err);
      setError(err?.message || "Errore durante il salvataggio. Riprova o controlla la console.");
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // Validation per step
  // ============================================================================
  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return propName.trim().length > 0 && propAddress.trim().length > 0;
      case 2:
        if (!isCondominium) return true;
        if (condoMode === "existing") return !!existingCondoId;
        return condoName.trim().length > 0;
      case 3:
        // CORREZIONE B: validazione con campi obbligatori (nome, CF/PIVA, email, telefono)
        if (ownerMode === "select") return !!selectedOwnerId;
        return (
          newOwnerName.trim().length > 0 &&
          newOwnerFiscalCode.trim().length > 0 &&
          newOwnerEmail.trim().length > 0 &&
          newOwnerPhone.trim().length > 0
        );
      case 4:
        if (!isRented) return true;
        if (tenantMode === "select") return !!selectedTenantId;
        return tName.trim().length > 0;
      case 5:
        if (!hasContract) return true;
        if (!isRented) return false; // contract requires tenant
        return cStartDate.length > 0 && cEndDate.length > 0 && cRentAmount > 0;
      default:
        return true;
    }
  };

  // ============================================================================
  // Navigation
  // ============================================================================
  const goNext = () => {
    if (!isStepValid(currentStep)) {
      setError("Completa i campi obbligatori prima di procedere.");
      return;
    }
    setError(null);
    if (currentStep < 5) {
      const next = currentStep + 1;
      setCurrentStep(next);
      setMaxStepReached((m) => Math.max(m, next));
    }
  };

  const goBack = () => {
    setError(null);
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const goToStep = (step: number) => {
    if (step <= maxStepReached) {
      setCurrentStep(step);
      setError(null);
    }
  };

  // ============================================================================
  // Build payload & submit
  // ============================================================================
  const buildPayload = (): MasterDataPayload => {
    // CORREZIONE B: gestisce sia il caso "select" (ownerId noto) sia "new" (dati da creare)
    let finalOwnerString: string | undefined;
    let finalOwnerId: string | undefined;
    let newOwnerData: MasterDataPayload["owner"] | undefined;

    if (ownerMode === "select") {
      const selectedOwner = existingOwners.find((o) => o.id === selectedOwnerId);
      if (selectedOwner) {
        finalOwnerString = selectedOwner.name;
        finalOwnerId = selectedOwner.id;
      }
    } else {
      // Nuovo proprietario: i dati vengono passati al payload.owner
      // che App.tsx salverà in Firestore tramite handleAddOwner prima di
      // collegare l'immobile. Anti-duplicato gestito lato App.tsx.
      finalOwnerString = newOwnerName.trim();
      newOwnerData = {
        name: newOwnerName.trim(),
        fiscalCode: newOwnerFiscalCode.trim(),
        email: newOwnerEmail.trim(),
        phone: newOwnerPhone.trim(),
        address: newOwnerAddress.trim() || undefined,
        birthDate: newOwnerBirthDate || undefined,
        birthPlace: newOwnerBirthPlace.trim() || undefined,
        structuredAddress: newOwnerStructuredAddress,
        coOwners: ownershipType === "multiple" ? newOwnerCoOwners : undefined,
        iban: newOwnerIban.trim() || undefined,
        isCompany: newOwnerIsCompany,
        gender: newOwnerIsCompany ? undefined : newOwnerGender,
        notes: undefined,
      };
    }

    const payload: MasterDataPayload = {
      property: {
        name: propName.trim(),
        address: propAddress.trim(),
        type: propType,
        status: isRented ? "Rented" : propStatus,
        notes: propNotes.trim() || undefined,
        owner: finalOwnerString,
        ownerId: finalOwnerId,
        isBareOwnership,
        isCondoConstituted: isCondominium,
        condominiumId: isCondominium
          ? condoMode === "existing"
            ? existingCondoId
            : undefined // will be set after condo creation
          : "",
        millesimi: isCondominium ? Number(condoMillesimi) || 0 : 0,
      },
    };

    // CORREZIONE B — passa i dati del nuovo Owner al payload
    if (newOwnerData) {
      payload.owner = newOwnerData;
    }

    if (isCondominium && condoMode === "new") {
      payload.condominium = {
        name: condoName.trim(),
        address: propAddress.trim(), // CORREZIONE P — sempre uguale all'indirizzo dell'immobile
        administrator: condoAdmin.trim() || undefined,
        phone: condoPhone.trim() || undefined,
        email: condoEmail.trim() || undefined,
        notes: condoNotes.trim() || undefined,
      };
    }

    if (isRented) {
      if (tenantMode === "new") {
        payload.tenant = cleanDeep({
          name: tName.trim(),
          email: tEmail.trim() || undefined,
          phone: tPhone.trim() || undefined,
          fiscalCode: tFiscalCode.trim() || undefined,
          notes: tNotes.trim() || undefined,
          isCompany: tIsCompany,
          companyName: tIsCompany ? tCompanyName.trim() : undefined,
          vatNumber: tIsCompany ? tVatNumber.trim() : undefined,
          gender: tIsCompany ? undefined : tGender,
          birthDate: tBirthDate || undefined,
          birthPlace: tBirthPlace.trim() || undefined,
          address: tAddress,
          isForeign: tIsForeign || undefined,
          identityDocument: tIdentityDocNumber
            ? { number: tIdentityDocNumber.trim(), expiryDate: tIdentityDocExpiry || undefined }
            : undefined,
          residencePermit: tIsForeign && tPermitNumber
            ? { number: tPermitNumber.trim(), validity: tPermitValidity.trim() || undefined }
            : undefined,
        });
      } else if (tenantMode === "select") {
        // CORREZIONE CH — BUG REALE: questa riga non c'era mai stata scritta, nonostante
        // il commento sotto dicesse il contrario. Senza questo, App.tsx non sapeva MAI
        // quale inquilino esistente era stato scelto: l'immobile non si collegava
        // all'inquilino, e il contratto non veniva creato affatto (dipende dallo stesso
        // tenantId, derivato in App.tsx proprio da questo campo).
        payload.selectedTenantId = selectedTenantId;
      }
    }

    if (hasContract && isRented) {
      payload.contract = {
        startDate: cStartDate,
        endDate: cEndDate,
        rentAmount: Number(cRentAmount) || 0,
        frequency: cFrequency,
        status: "Active",
        notes: cNotes.trim() || undefined,
      };
    }

    return payload;
  };

  const handleSubmit = async () => {
    if (!isStepValid(5)) {
      setError("Completa i campi del contratto o salta questo step.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      await onPersist(payload);
      resetAll();
      onClose();
    } catch (err: any) {
      console.error("Wizard save error:", err);
      setError(
        err?.message ||
          "Errore durante il salvataggio. Riprova o controlla la console."
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // Auto-skip logic: if user said "no condo" / "not rented" / "no contract",
  // the next optional step is shown but pre-checked off
  // ============================================================================

  // ============================================================================
  // Render
  // ============================================================================
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Sparkles size={18} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight">
                {standaloneEntity === "owner" && "Nuovo Proprietario"}
                {standaloneEntity === "tenant" && "Nuovo Inquilino"}
                {standaloneEntity === "condominium" && "Nuovo Condominio"}
                {!standaloneEntity && "Nuovo Inserimento Guidato"}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {standaloneEntity
                  ? "Inserimento isolato, senza creare un immobile"
                  : "Aggiungi immobili, condomini, proprietari, inquilini e contratti in un'unica procedura"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Progress Stepper (nascosto negli inserimenti isolati) ──── */}
        {!standaloneEntity && (
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isCurrent = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              const isReachable = step.id <= maxStepReached;
              return (
                <React.Fragment key={step.id}>
                  <button
                    type="button"
                    onClick={() => goToStep(step.id)}
                    disabled={!isReachable}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${
                      isCurrent
                        ? "bg-slate-900 text-white shadow-sm"
                        : isCompleted
                        ? "text-emerald-700 hover:bg-emerald-50"
                        : isReachable
                        ? "text-slate-600 hover:bg-slate-100"
                        : "text-slate-300 cursor-not-allowed"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        isCurrent
                          ? "bg-amber-500 text-white"
                          : isCompleted
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {isCompleted ? <Check size={13} /> : <Icon size={13} />}
                    </div>
                    <span className="text-[12px] font-medium hidden sm:inline">
                      {step.label}
                      {step.optional && (
                        <span className="text-[9px] text-slate-400 ml-1 uppercase">
                          opt
                        </span>
                      )}
                    </span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-[2px] mx-1 rounded ${
                        currentStep > step.id ? "bg-emerald-400" : "bg-slate-200"
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
        )}

        {/* ── Body (scrollable) ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[12px] flex items-center gap-2">
              <X size={14} />
              {error}
            </div>
          )}

          {/* ─── STEP 1: IMMOBILE ─── */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <SectionTitle
                icon={Building2}
                title="Dati Immobile"
                subtitle="Le informazioni base dell'immobile che stai registrando"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nome / Descrizione" required>
                  <input
                    type="text"
                    value={propName}
                    onChange={(e) => setPropName(e.target.value)}
                    placeholder="es. Bilocale Via Roma 12"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    autoFocus
                  />
                </Field>
                <Field label="Indirizzo" required>
                  <input
                    type="text"
                    value={propAddress}
                    onChange={(e) => setPropAddress(e.target.value)}
                    placeholder="es. Via Roma 12, Milano (MI)"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </Field>
                <Field label="Tipologia">
                  <select
                    value={propType}
                    onChange={(e) => setPropType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
                  >
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Stato iniziale">
                  <select
                    value={propStatus}
                    onChange={(e) =>
                      setPropStatus(
                        e.target.value as "Available" | "Rented" | "Maintenance" | "Archived"
                      )
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
                  >
                    <option value="Available">Disponibile</option>
                    <option value="Rented">Affittato</option>
                    <option value="Maintenance">In manutenzione</option>
                    <option value="Archived">Archiviato</option>
                  </select>
                </Field>
              </div>

              <Field label="Note (opzionale)">
                <textarea
                  value={propNotes}
                  onChange={(e) => setPropNotes(e.target.value)}
                  placeholder="Annotazioni libere sull'immobile..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                />
              </Field>

              <label className="flex items-center gap-2 text-[12px] text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBareOwnership}
                  onChange={(e) => setIsBareOwnership(e.target.checked)}
                  className="w-4 h-4 accent-slate-900"
                />
                È in <strong>nuda proprietà</strong> (l'usufrutto appartiene a terzi)
              </label>
            </div>
          )}

          {/* ─── STEP 2: CONDOMINIO ─── */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <SectionTitle
                icon={Building}
                title="Condominio"
                subtitle="Se l'immobile fa parte di un condominio, registralo qui"
              />

              <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer p-3 rounded-lg bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  checked={isCondominium}
                  onChange={(e) => setIsCondominium(e.target.checked)}
                  className="w-4 h-4 accent-slate-900"
                />
                <span>
                  Questo immobile <strong>fa parte di un condominio</strong>
                </span>
              </label>

              {isCondominium && (
                <>
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setCondoMode("existing")}
                      className={`flex-1 py-2 text-[12px] font-medium rounded-md transition-colors ${
                        condoMode === "existing"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500"
                      }`}
                    >
                      Condominio esistente
                    </button>
                    <button
                      type="button"
                      onClick={() => setCondoMode("new")}
                      className={`flex-1 py-2 text-[12px] font-medium rounded-md transition-colors ${
                        condoMode === "new"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500"
                      }`}
                    >
                      Nuovo condominio
                    </button>
                  </div>

                  {condoMode === "existing" ? (
                    <Field label="Seleziona condominio" required>
                      <select
                        value={existingCondoId}
                        onChange={(e) => setExistingCondoId(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                      >
                        <option value="">— Scegli —</option>
                        {existingCondominiums.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.administrator ? ` · Amm. ${c.administrator}` : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <div className="space-y-3">
                      <Field label="Nome condominio" required>
                        <input
                          type="text"
                          value={condoName}
                          onChange={(e) => setCondoName(e.target.value)}
                          placeholder="es. Condominio Primavera"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </Field>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Amministratore">
                          <input
                            type="text"
                            value={condoAdmin}
                            onChange={(e) => setCondoAdmin(e.target.value)}
                            placeholder="Nome o studio"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                          />
                        </Field>
                        <Field label="Telefono amministratore">
                          <input
                            type="text"
                            value={condoPhone}
                            onChange={(e) => setCondoPhone(e.target.value)}
                            placeholder="es. 02 1234567"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                          />
                        </Field>
                      </div>
                      <Field label="Email amministratore">
                        <input
                          type="email"
                          value={condoEmail}
                          onChange={(e) => setCondoEmail(e.target.value)}
                          placeholder="es. admin@condominioprimavera.it"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </Field>
                    </div>
                  )}

                  <Field label="Quota millesimale dell'immobile">
                    <input
                      type="number"
                      value={condoMillesimi || ""}
                      onChange={(e) => setCondoMillesimi(Number(e.target.value) || 0)}
                      placeholder="es. 125 (millesimi)"
                      step="0.5"
                      className="w-full sm:w-48 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </Field>
                </>
              )}

              {!isCondominium && (
                <InfoBox>
                  L'immobile verrà registrato senza associazione condominiale. Potrai
                  sempre aggiungere il condominio in seguito dalla sezione "Condomini".
                </InfoBox>
              )}
            </div>
          )}

          {/* ─── STEP 3: PROPRIETARIO (CORREZIONE B — anagrafica reale) ─── */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <SectionTitle
                icon={User}
                title="Proprietario"
                subtitle="Chi è il proprietario dell'immobile? Seleziona un proprietario già censito o creane uno nuovo con anagrafica completa."
              />

              {existingOwners.length > 0 && (
                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setOwnerMode("select")}
                    className={`flex-1 py-2 text-[12px] font-medium rounded-md transition-colors ${
                      ownerMode === "select"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500"
                    }`}
                  >
                    Seleziona esistente ({existingOwners.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOwnerMode("new")}
                    className={`flex-1 py-2 text-[12px] font-medium rounded-md transition-colors ${
                      ownerMode === "new"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500"
                    }`}
                  >
                    Nuovo proprietario
                  </button>
                </div>
              )}

              {ownerMode === "select" && existingOwners.length > 0 ? (
                <Field label="Seleziona proprietario" required>
                  <select
                    value={selectedOwnerId}
                    onChange={(e) => setSelectedOwnerId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  >
                    <option value="">— Scegli —</option>
                    {existingOwners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                        {o.fiscalCode ? ` · CF/PIVA: ${o.fiscalCode}` : ""}
                        {o.email ? ` · ${o.email}` : ""}
                      </option>
                    ))}
                  </select>
                  {selectedOwnerId && (() => {
                    const sel = existingOwners.find((o) => o.id === selectedOwnerId);
                    if (!sel) return null;
                    return (
                      <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Nome:</span>
                          <strong className="text-slate-900">{sel.name}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">CF/PIVA:</span>
                          <span className="font-mono text-slate-800">{sel.fiscalCode || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Email:</span>
                          <span className="text-slate-800">{sel.email || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Telefono:</span>
                          <span className="text-slate-800">{sel.phone || "—"}</span>
                        </div>
                        {sel.iban && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">IBAN:</span>
                            <span className="font-mono text-slate-800">{sel.iban}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </Field>
              ) : (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[12px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newOwnerIsCompany}
                      onChange={(e) => { setNewOwnerIsCompany(e.target.checked); if (e.target.checked) setNewOwnerGender(undefined); }}
                      className="w-4 h-4 accent-slate-900"
                    />
                    È una <strong>società</strong> (persona giuridica)
                  </label>

                  {/* CORREZIONE AJ — prima domanda: proprietario singolo o comproprietà */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                      È un proprietario singolo o una comproprietà?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setOwnershipType("single")}
                        className={`flex-1 text-xs font-bold py-2 rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
                          ownershipType === "single" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
                        }`}
                      >
                        <User size={12} />
                        Singolo
                      </button>
                      <button
                        type="button"
                        onClick={() => setOwnershipType("multiple")}
                        className={`flex-1 text-xs font-bold py-2 rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
                          ownershipType === "multiple" ? "bg-amber-500 text-slate-950 border-amber-500" : "bg-white text-slate-600 border-slate-200"
                        }`}
                      >
                        <Users size={12} />
                        Comproprietà
                      </button>
                    </div>
                  </div>

                  {ownershipType === "multiple" && (
                    <div className="space-y-2 border border-amber-200 rounded-xl p-3 bg-amber-50/40">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Comproprietari
                      </label>
                      <p className="text-[10px] text-slate-500">
                        Il conto resta unico (obbligazione solidale). Cerca tra i proprietari già a sistema, o creane uno nuovo al volo.
                      </p>

                      {newOwnerCoOwners.map((co, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800">{co.name}</span>
                            {co.linkedOwnerId && (
                              <span className="ml-1.5 text-[9px] text-emerald-600 font-bold inline-flex items-center gap-0.5">
                                <Link2 size={9} />
                                già a sistema
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewOwnerCoOwners(prev => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-rose-500 shrink-0 ml-2"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}

                      {!showAddCoOwnerPicker ? (
                        <button
                          type="button"
                          onClick={() => setShowAddCoOwnerPicker(true)}
                          className="w-full text-xs font-semibold text-indigo-600 hover:text-indigo-700 border border-dashed border-indigo-300 rounded-lg py-2 bg-white"
                        >
                          + Aggiungi Comproprietario
                        </button>
                      ) : (
                        <div className="bg-white border border-indigo-200 rounded-lg p-2.5 space-y-2">
                          <input
                            type="text"
                            autoFocus
                            placeholder="Cerca tra i proprietari già a sistema..."
                            value={coOwnerSearchTerm}
                            onChange={(e) => setCoOwnerSearchTerm(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 outline-hidden focus:border-indigo-500"
                          />
                          {coOwnerSearchTerm.trim().length > 0 && (
                            <div className="max-h-32 overflow-y-auto space-y-1">
                              {existingOwners
                                .filter(o =>
                                  o.name.toLowerCase().includes(coOwnerSearchTerm.toLowerCase().trim()) &&
                                  !newOwnerCoOwners.some(co => co.linkedOwnerId === o.id)
                                )
                                .slice(0, 5)
                                .map(o => (
                                  <button
                                    key={o.id}
                                    type="button"
                                    onClick={() => {
                                      setNewOwnerCoOwners(prev => [...prev, {
                                        name: o.name, fiscalCode: o.fiscalCode, phone: o.phone, email: o.email, linkedOwnerId: o.id
                                      }]);
                                      setShowAddCoOwnerPicker(false);
                                      setCoOwnerSearchTerm("");
                                    }}
                                    className="w-full text-left text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg px-2.5 py-2 flex items-center gap-1.5"
                                  >
                                    <Link2 size={12} className="text-emerald-700 shrink-0" />
                                    <span><strong>{o.name}</strong> <span className="text-[10px] text-emerald-600">— usa anagrafica esistente</span></span>
                                  </button>
                                ))}
                              <button
                                type="button"
                                onClick={() => {
                                  setNewOwnerCoOwners(prev => [...prev, { name: coOwnerSearchTerm.trim() }]);
                                  setShowAddCoOwnerPicker(false);
                                  setCoOwnerSearchTerm("");
                                }}
                                className="w-full text-left text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg px-2.5 py-2 flex items-center gap-1.5"
                              >
                                <Plus size={12} className="text-indigo-700 shrink-0" />
                                Crea nuovo nominativo "{coOwnerSearchTerm.trim()}"
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => { setShowAddCoOwnerPicker(false); setCoOwnerSearchTerm(""); }}
                            className="text-[10px] text-slate-400 hover:text-slate-600"
                          >
                            Annulla
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <Field
                    label={newOwnerIsCompany ? "Ragione sociale" : "Nome e cognome"}
                    required
                  >
                    <input
                      type="text"
                      value={newOwnerName}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                      placeholder={newOwnerIsCompany ? "es. Mario Rossi S.r.l." : "es. Mario Rossi"}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      autoFocus
                    />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field
                      label={newOwnerIsCompany ? "Partita IVA" : "Codice Fiscale"}
                      required
                    >
                      <input
                        type="text"
                        value={newOwnerFiscalCode}
                        onChange={(e) => setNewOwnerFiscalCode(e.target.value)}
                        placeholder={newOwnerIsCompany ? "es. 01234567890" : "es. RSSMRA80A01H501Z"}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </Field>
                    <Field label="Email" required>
                      <input
                        type="email"
                        value={newOwnerEmail}
                        onChange={(e) => setNewOwnerEmail(e.target.value)}
                        placeholder="es. mario.rossi@email.com"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </Field>
                  </div>

                  <Field label="Telefono" required>
                    <input
                      type="text"
                      value={newOwnerPhone}
                      onChange={(e) => setNewOwnerPhone(e.target.value)}
                      placeholder="es. 333 1234567"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Data di Nascita (facoltativo)">
                      <input
                        type="date"
                        value={newOwnerBirthDate}
                        onChange={(e) => setNewOwnerBirthDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </Field>
                    <Field label="Luogo di Nascita (facoltativo)">
                      <input
                        type="text"
                        value={newOwnerBirthPlace}
                        onChange={(e) => setNewOwnerBirthPlace(e.target.value)}
                        placeholder="es. Prato (PO)"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </Field>
                  </div>
                  <p className="text-[10px] text-slate-400 -mt-2">Servono per la formula "nato/a a ___" nei contratti di locazione generati.</p>

                  <GenderToggle value={newOwnerGender} onChange={setNewOwnerGender} isCompany={newOwnerIsCompany} />

                  <AddressFields value={newOwnerStructuredAddress} onChange={setNewOwnerStructuredAddress} />

                  <Field label="IBAN per accrediti (facoltativo)">
                    <input
                      type="text"
                      value={newOwnerIban}
                      onChange={(e) => setNewOwnerIban(e.target.value)}
                      placeholder="es. IT60X0123456789012345678901"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </Field>

                  <InfoBox>
                    Il proprietario verrà salvato nell'anagrafica dedicata
                    ("owners") e riusato per immobili futuri. Se esiste già un
                    proprietario con lo stesso nome, verrà riusato
                    automaticamente invece di crearne uno duplicato.
                  </InfoBox>
                </div>
              )}
            </div>
          )}

          {/* ─── STEP 4: INQUILINO ─── */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <SectionTitle
                icon={Users}
                title="Inquilino"
                subtitle="Se l'immobile è affittato, registra l'inquilino"
              />

              {standaloneEntity === "tenant" && (
                <InfoBox type="warning">
                  <span className="flex items-start gap-1.5">
                    <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Stai creando l'inquilino senza collegarlo a un immobile — è consentito
                      (puoi assegnarlo in seguito), ma finché non lo colleghi comparirà come
                      "Immobile da assegnare" nell'elenco Inquilini e nella bacheca della Dashboard.
                    </span>
                  </span>
                </InfoBox>
              )}

              <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer p-3 rounded-lg bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  checked={isRented}
                  onChange={(e) => setIsRented(e.target.checked)}
                  className="w-4 h-4 accent-slate-900"
                />
                <span>
                  L'immobile <strong>è affittato</strong> a un inquilino
                </span>
              </label>

              {isRented && (
                <>
                  {existingTenants.length > 0 && (
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setTenantMode("select")}
                        className={`flex-1 py-2 text-[12px] font-medium rounded-md transition-colors ${
                          tenantMode === "select"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500"
                        }`}
                      >
                        Seleziona esistente
                      </button>
                      <button
                        type="button"
                        onClick={() => setTenantMode("new")}
                        className={`flex-1 py-2 text-[12px] font-medium rounded-md transition-colors ${
                          tenantMode === "new"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500"
                        }`}
                      >
                        Nuovo inquilino
                      </button>
                    </div>
                  )}

                  {tenantMode === "select" && existingTenants.length > 0 ? (
                    <Field label="Seleziona inquilino" required>
                      <select
                        value={selectedTenantId}
                        onChange={(e) => setSelectedTenantId(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                      >
                        <option value="">— Scegli —</option>
                        {existingTenants.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                            {t.email ? ` · ${t.email}` : ""}
                            {!t.propertyId ? " (immobile da assegnare)" : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-[12px] text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tIsCompany}
                          onChange={(e) => { setTIsCompany(e.target.checked); if (e.target.checked) setTGender(undefined); }}
                          className="w-4 h-4 accent-slate-900"
                        />
                        È un'<strong>azienda</strong> (persona giuridica)
                      </label>

                      {tIsCompany ? (
                        <>
                          <Field label="Ragione sociale" required>
                            <input
                              type="text"
                              value={tCompanyName}
                              onChange={(e) => setTCompanyName(e.target.value)}
                              placeholder="es. Mario Rossi S.r.l."
                              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                              autoFocus
                            />
                          </Field>
                          <Field label="Partita IVA">
                            <input
                              type="text"
                              value={tVatNumber}
                              onChange={(e) => setTVatNumber(e.target.value)}
                              placeholder="es. 01234567890"
                              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                            />
                          </Field>
                        </>
                      ) : (
                        <Field label="Nome e cognome" required>
                          <input
                            type="text"
                            value={tName}
                            onChange={(e) => setTName(e.target.value)}
                            placeholder="es. Giuseppe Verdi"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                            autoFocus
                          />
                        </Field>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Email">
                          <input
                            type="email"
                            value={tEmail}
                            onChange={(e) => setTEmail(e.target.value)}
                            placeholder="es. giuseppe.verdi@email.com"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                          />
                        </Field>
                        <Field label="Telefono">
                          <input
                            type="text"
                            value={tPhone}
                            onChange={(e) => setTPhone(e.target.value)}
                            placeholder="es. 333 1234567"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                          />
                        </Field>
                      </div>

                      <Field label="Codice Fiscale">
                        <input
                          type="text"
                          value={tFiscalCode}
                          onChange={(e) => setTFiscalCode(e.target.value)}
                          placeholder="es. VRDGPP80A01F205X"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </Field>

                      {/* CORREZIONE CC — TASK 2: parità con TenantsView.tsx (Regola 4) */}
                      <div className="space-y-3">
                        <GenderToggle value={tGender} onChange={setTGender} isCompany={tIsCompany} />

                        {!tIsCompany && (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Data di Nascita (facoltativo)">
                                <input
                                  type="date"
                                  value={tBirthDate}
                                  onChange={(e) => setTBirthDate(e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                                />
                              </Field>
                              <Field label="Luogo di Nascita (facoltativo)">
                                <input
                                  type="text"
                                  value={tBirthPlace}
                                  onChange={(e) => setTBirthPlace(e.target.value)}
                                  placeholder="es. Prato (PO)"
                                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                                />
                              </Field>
                            </div>

                            <AddressFields value={tAddress} onChange={setTAddress} />

                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input type="checkbox" checked={tIsForeign} onChange={(e) => setTIsForeign(e.target.checked)} />
                              È cittadino/a straniero/a
                            </label>

                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Documento (n°) — facoltativo">
                                <input
                                  type="text"
                                  value={tIdentityDocNumber}
                                  onChange={(e) => setTIdentityDocNumber(e.target.value)}
                                  placeholder="es. CA12345AA"
                                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                                />
                              </Field>
                              <Field label="Documento — scadenza (facoltativo)">
                                <input
                                  type="date"
                                  value={tIdentityDocExpiry}
                                  onChange={(e) => setTIdentityDocExpiry(e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                                />
                              </Field>
                            </div>

                            {tIsForeign && (
                              <div className="grid grid-cols-2 gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <Field label="Permesso di soggiorno (n°)">
                                  <input
                                    type="text"
                                    value={tPermitNumber}
                                    onChange={(e) => setTPermitNumber(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                                  />
                                </Field>
                                <Field label="Validità permesso">
                                  <input
                                    type="text"
                                    value={tPermitValidity}
                                    onChange={(e) => setTPermitValidity(e.target.value)}
                                    placeholder="es. illimitata oppure 31/12/2027"
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                                  />
                                </Field>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <Field label="Note">
                        <textarea
                          value={tNotes}
                          onChange={(e) => setTNotes(e.target.value)}
                          placeholder="Garante, occupazione, referenze..."
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                        />
                      </Field>
                    </div>
                  )}
                </>
              )}

              {!isRented && (
                <InfoBox>
                  Nessun inquilino verrà registrato. Lo stato dell'immobile resterà
                  "{propStatus === 'Rented' ? 'Available' : propStatus}". Potrai
                  aggiungere l'inquilino in seguito.
                </InfoBox>
              )}
            </div>
          )}

          {/* ─── STEP 5: CONTRATTO ─── */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <SectionTitle
                icon={FileText}
                title="Contratto di Locazione"
                subtitle="Vuoi registrare subito il contratto di locazione?"
              />

              {!isRented && (
                <InfoBox type="warning">
                  Per registrare un contratto serve prima un inquilino. Torna
                  allo step precedente e spunta "è affittato".
                </InfoBox>
              )}

              {isRented && (
                <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <input
                    type="checkbox"
                    checked={hasContract}
                    onChange={(e) => setHasContract(e.target.checked)}
                    className="w-4 h-4 accent-slate-900"
                  />
                  <span>
                    Voglio registrare <strong>subito il contratto</strong> di locazione
                  </span>
                </label>
              )}

              {isRented && hasContract && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Data inizio" required>
                      <input
                        type="date"
                        value={cStartDate}
                        onChange={(e) => setCStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </Field>
                    <Field label="Data fine" required>
                      <input
                        type="date"
                        value={cEndDate}
                        onChange={(e) => setCEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Canone mensile (€)" required>
                      <input
                        type="number"
                        value={cRentAmount || ""}
                        onChange={(e) => setCRentAmount(Number(e.target.value) || 0)}
                        placeholder="es. 800"
                        step="0.01"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </Field>
                    <Field label="Frequenza pagamento">
                      <select
                        value={cFrequency}
                        onChange={(e) =>
                          setCFrequency(e.target.value as typeof cFrequency)
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                      >
                        {FREQUENCIES.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Note contratto">
                    <textarea
                      value={cNotes}
                      onChange={(e) => setCNotes(e.target.value)}
                      placeholder="Deposit cauzionale, spese incluse, cedolare secca..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                    />
                  </Field>

                  <InfoBox>
                    Il contratto verrà <strong>collegato automaticamente</strong> a
                    immobile, proprietario e inquilino. Le rate mensili verranno
                    generate nella sezione "Fast Closing" al salvataggio.
                  </InfoBox>
                </div>
              )}

              {isRented && !hasContract && (
                <InfoBox>
                  Nessun contratto verrà registrato. Potrai aggiungerlo in
                  seguito dalla sezione "Contratti".
                </InfoBox>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {standaloneEntity ? (
              <span>Inserimento isolato — nessun immobile verrà creato</span>
            ) : (
              <>
                Step <strong className="text-slate-700">{currentStep}</strong> di 5
                {currentStep === 5 && !isStepValid(5) && (
                  <span className="ml-2 text-amber-600">
                    · Passi opzionali possono essere saltati
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {standaloneEntity ? (
              <button
                type="button"
                onClick={handleStandaloneSubmit}
                disabled={!isStepValid(currentStep) || saving}
                className="px-5 py-2 text-[12px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Salvataggio…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    Salva
                  </>
                )}
              </button>
            ) : (
              <>
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={saving}
                    className="px-4 py-2 text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <ChevronLeft size={14} />
                    Indietro
                  </button>
                )}

                {currentStep < 5 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!isStepValid(currentStep) || saving}
                    className="px-5 py-2 text-[12px] font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    Avanti
                    <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving}
                    className="px-5 py-2 text-[12px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Salvataggio…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        Salva tutto
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
      <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-white" />
      </div>
      <div>
        <h3 className="text-[14px] font-semibold text-slate-900 leading-tight">
          {title}
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

// CORREZIONE CC — cleanDeep ricorsiva: Firestore rifiuta i campi undefined anche
// quando sono ANNIDATI dentro un oggetto (es. address.civico === undefined), non
// solo al primo livello. La pulizia "cleanData" usata altrove nel progetto opera
// solo al primo livello e non basterebbe per campi come address/identityDocument/
// residencePermit dell'inquilino, introdotti in questa correzione.
function cleanDeep(obj: any): any {
  if (Array.isArray(obj)) return obj.map(cleanDeep).filter((x) => x !== undefined);
  if (obj && typeof obj === "object" && !(obj instanceof Date)) {
    const out: any = {};
    Object.keys(obj).forEach((k) => {
      const v = cleanDeep(obj[k]);
      if (v !== undefined) out[k] = v;
    });
    return Object.keys(out).length ? out : undefined;
  }
  return obj === "" ? undefined : obj;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function InfoBox({
  children,
  type = "info",
}: {
  children: React.ReactNode;
  type?: "info" | "warning";
}) {
  const colors =
    type === "warning"
      ? "bg-amber-50 border-amber-200 text-amber-800"
      : "bg-slate-50 border-slate-200 text-slate-600";
  return (
    <div
      className={`text-[11.5px] px-3 py-2.5 rounded-lg border ${colors} leading-relaxed`}
    >
      {children}
    </div>
  );
}

