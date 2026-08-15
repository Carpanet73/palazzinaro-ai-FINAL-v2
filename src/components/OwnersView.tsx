
import React, { useState, useMemo } from "react";
import AddressFields, { AddressValue } from "./AddressFields";
import GenderToggle from "./GenderToggle";
import {
  ArrowLeft,
  Building2,
  Building,
  User,
  Users,
  CheckCircle2,
  Scale,
  ArrowRight,
  Search,
  Coins,
  MapPin,
  Home,
  X,
  FileText,
  Files,
  AlertTriangle,
  Info,
  Phone,
  Mail,
  Link2,
  Pencil,
  Euro,
  Car,
  Printer,
  Briefcase,
  Landmark,
  Plus,
  Wrench,
  Settings
} from "lucide-react";
import { Property, Tenant, Contract, FastClosingItem, Reminder, LegalCase, AppSection, BankMovement, Maintenance, Owner } from "../types";
import { getTenantClassification } from "../lib/statusHelper";
import MultiSelectFilterDropdown from "./MultiSelectFilterDropdown";
import LedgerExportToolbar from "./LedgerExportToolbar";
import ManualBacklogBadge from "./ManualBacklogBadge";
import { LedgerColumn } from "../lib/ledgerExport";
import { formatMonthYear } from "../lib/ledgerLabel";

interface OwnersViewProps {
  properties: Property[];
  tenants: Tenant[];
  contracts: Contract[];
  fastClosing: FastClosingItem[];
  reminders: Reminder[];
  condominiums: any[];
  legalCases: LegalCase[];
  movements?: BankMovement[]; // Made optional for backward compatibility
  maintenance?: Maintenance[];
  setCurrentSection: (section: AppSection) => void;
  onViewTenantLedger?: (tenantId: string) => void;
  // CORREZIONE U — collega la pagina all'anagrafica REALE del proprietario (email, telefono,
  // C.F., IBAN), che prima non era né mostrata né modificabile da nessuna parte
  owners?: Owner[];
  onEditOwner?: (id: string, data: Partial<Owner>) => Promise<void>;
  onAddOwner?: (data: Omit<Owner, "id" | "userId" | "createdAt">) => Promise<string | null>;
}

interface OwnerInfo {
  name: string;
  isCompound: boolean;
  individualNames: string[];
}

export default function OwnersView({
  properties,
  tenants,
  contracts,
  fastClosing,
  reminders,
  condominiums,
  legalCases,
  movements = [],
  maintenance = [],
  setCurrentSection,
  onViewTenantLedger,
  owners = [],
  onEditOwner,
  onAddOwner
}: OwnersViewProps) {
  const [selectedOwner, setSelectedOwner] = useState<OwnerInfo | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // CORREZIONE U — modulo di modifica dei dati anagrafici reali del proprietario
  const [showOwnerEditModal, setShowOwnerEditModal] = useState(false);
  const [editingRealOwnerName, setEditingRealOwnerName] = useState<string>("");
  const [ownerFormName, setOwnerFormName] = useState("");
  const [ownerFormFiscalCode, setOwnerFormFiscalCode] = useState("");
  const [ownerFormEmail, setOwnerFormEmail] = useState("");
  const [ownerFormPhone, setOwnerFormPhone] = useState("");
  const [ownerFormAddress, setOwnerFormAddress] = useState("");
  const [ownerFormBirthDate, setOwnerFormBirthDate] = useState(""); // CORREZIONE AA
  const [ownerFormBirthPlace, setOwnerFormBirthPlace] = useState(""); // CORREZIONE BS
  // CORREZIONE CC — genere persistente, serve al generatore contratti per le forme
  // corrette (nato/a, locatore/locatrice) senza doverlo riselezionare ogni volta.
  const [ownerFormGender, setOwnerFormGender] = useState<"M" | "F" | undefined>(undefined);
  const [ownerFormStructuredAddress, setOwnerFormStructuredAddress] = useState<AddressValue>({});
  // CORREZIONE AJ — Comproprietari: stesso conto unico, con selezione smart tra i
  // proprietari già a sistema per evitare di ridigitare/duplicare dati
  const [ownerFormCoOwners, setOwnerFormCoOwners] = useState<Array<{ name: string; fiscalCode?: string; phone?: string; email?: string; linkedOwnerId?: string }>>([]);
  const [sendingCountToCoOwner, setSendingCountToCoOwner] = useState<string | null>(null); // CORREZIONE AY
  const [showAddCoOwnerPicker, setShowAddCoOwnerPicker] = useState(false);
  const [coOwnerSearchTerm, setCoOwnerSearchTerm] = useState("");
  const [ownerFormIban, setOwnerFormIban] = useState("");
  const [existingRealOwnerId, setExistingRealOwnerId] = useState<string | null>(null);

  const handleOpenOwnerEdit = (name: string) => {
    const cleanName = name.trim();
    const match = owners.find(o => (o.name || "").toLowerCase().trim() === cleanName.toLowerCase());
    setEditingRealOwnerName(cleanName);
    setExistingRealOwnerId(match?.id || null);
    setOwnerFormName(match?.name || cleanName);
    setOwnerFormFiscalCode(match?.fiscalCode || "");
    setOwnerFormEmail(match?.email || "");
    setOwnerFormPhone(match?.phone || "");
    setOwnerFormAddress(match?.address || "");
    setOwnerFormBirthDate(match?.birthDate || "");
    setOwnerFormBirthPlace(match?.birthPlace || "");
    setOwnerFormGender(match?.gender);
    setOwnerFormStructuredAddress(match?.structuredAddress || {});
    setOwnerFormCoOwners(match?.coOwners || []);
    setShowAddCoOwnerPicker(false);
    setCoOwnerSearchTerm("");
    setOwnerFormIban(match?.iban || "");
    setShowOwnerEditModal(true);
  };

  const handleSaveOwnerEdit = async () => {
    if (!ownerFormName.trim() || !ownerFormFiscalCode.trim() || !ownerFormEmail.trim() || !ownerFormPhone.trim()) {
      alert("Nome, Codice Fiscale/P.IVA, Email e Telefono sono obbligatori.");
      return;
    }
    const payload = {
      name: ownerFormName.trim(),
      fiscalCode: ownerFormFiscalCode.trim().toUpperCase(),
      email: ownerFormEmail.trim(),
      phone: ownerFormPhone.trim(),
      address: ownerFormAddress.trim(),
      birthDate: ownerFormBirthDate || "",
      birthPlace: ownerFormBirthPlace.trim() || "",
      gender: ownerFormGender,
      structuredAddress: ownerFormStructuredAddress,
      coOwners: ownerFormCoOwners,
      iban: ownerFormIban.trim()
    };
    if (existingRealOwnerId) {
      await onEditOwner?.(existingRealOwnerId, payload);
    } else {
      await onAddOwner?.(payload as any);
    }
    setShowOwnerEditModal(false);
  };
  // CORREZIONE CP (13/08/2026) — Fase 2 punto 2: da tab a scelta singola a multi-selezione
  // stile Excel. Qui le 5 tabelle sono strutturalmente diverse (colonne diverse), quindi
  // l'adattamento è "unione delle sezioni selezionate" (mostra ciascuna tabella se il suo
  // valore è incluso), non un filtro riga-per-riga su un'unica tabella. Default = tutte
  // selezionate (equivalente al vecchio comportamento di visualizzare la prima tab attiva,
  // ma qui reso esplicito mostrando tutte le sezioni finché l'utente non restringe la vista).
  const [activeLedgerTabs, setActiveLedgerTabs] = useState<string[]>(["rent", "condo", "taxes", "maintenance", "other"]);
  const [searchTerm, setSearchTerm] = useState("");

  // --- SELECTED PROPERTY DETAILS LOGIC ---
  const propertyModalData = useMemo(() => {
    if (!selectedProperty) return null;
    const p = selectedProperty;
    // CORREZIONE (14/08/2026 notte) — stessa distorsione già corretta nel mastrino inquilino
    // (TenantsView.tsx): alla creazione di un contratto/condominio, TUTTE le rate future
    // vengono scritte subito in Fast Closing con status "Pending" fino alla rispettiva
    // scadenza. Qui il saldo/"Totale da Incassare" sommava anche quelle non ancora scadute,
    // gonfiando il dovuto reale (segnalato da Massimo: "il bilancio tiene ancora conto di
    // tutti i canoni di affitto, ci deve essere il saldo dovuto al momento, live"). `oggiStr`
    // calcolato da `new Date()` al momento dell'esecuzione (mai una data fissa, regola 5).
    const oggiStr = new Date().toISOString().split("T")[0];

    // Find contract
    const activeContract = contracts.find(c => c.propertyId === p.id && c.status === "Active");
    
    // Find tenant
    const tenant = tenants.find(t => t.propertyId === p.id || (activeContract && t.id === activeContract.tenantId));
    
    // Find condo
    const condo = condominiums.find(c => 
      (p.address || "").toLowerCase().includes((c.name || "").toLowerCase()) || 
      (c.name || "").toLowerCase().includes((p.name || "").toLowerCase()) ||
      (c.notes && (c.notes || "").toLowerCase().includes((p.name || "").toLowerCase()))
    );

    // Get all fastClosing items
    // CORREZIONE (13/08/2026) — priorità al collegamento diretto propertyId (sempre popolato
    // sulle voci reali di condominio/manutenzione/canone), mai solo sourceId (che per le
    // manutenzioni/condominio punta all'id del ticket/condominio, non dell'immobile) o sul
    // testo del titolo (che dalla Fase 2 punto 1 non contiene più il nome dell'immobile).
    // Senza questo fix, le quote di manutenzione/condominio a carico del proprietario
    // risultavano invisibili in quest'area. sourceId/titolo restano come fallback per le
    // voci storiche prive di propertyId.
    const relatedClosingItems = fastClosing.filter(fc => {
      const matchesPropertyId = (fc as any).propertyId === p.id;
      const matchesId = fc.sourceId === p.id || (activeContract && fc.sourceId === activeContract.id);
      const matchesTitle = (fc.title || "").toLowerCase().includes((p.name || "").toLowerCase());
      return matchesPropertyId || matchesId || matchesTitle;
    });

    // Get all reconciled bank movements
    const relatedMovements = movements.filter(m => {
      if (!m.reconciled) return false;
      const matchesId = m.reconciledWith?.id === p.id || (activeContract && m.reconciledWith?.id === activeContract.id);
      const matchesDesc = (m.description || "").toLowerCase().includes((p.name || "").toLowerCase()) || (m.description || "").toLowerCase().includes((p.address || "").toLowerCase());
      return matchesId || matchesDesc;
    });

    // Subdivide payments by type with accrual (competenza) and cash (cassa) support:
    
    // Helper function to build unified accounting entries with separate Cassa and Competenza dates
    const buildUnifiedLedger = (
      closingFilter: (fc: FastClosingItem) => boolean,
      movementFilter: (m: BankMovement) => boolean,
      defaultNotes: string
    ) => {
      const ledger: any[] = [];
      const pairedMovementIds = new Set<string>();

      // 1. Process all Competenza items from Fast Closing (both paid and pending)
      relatedClosingItems.forEach(item => {
        if (closingFilter(item)) {
          // Find if there is a bank movement reconciled with this Fast Closing item
          const matchedMovement = relatedMovements.find(m => m.reconciledWith?.id === item.id);
          
          let paymentDate = "-";
          let reconciliationType = "Scadenza non saldata";
          let notes = item.description || "";

          if (item.status === "Paid") {
            if (matchedMovement) {
              paymentDate = matchedMovement.date; // Actual payment date (Cassa!)
              reconciliationType = "Bonifico Riconciliato";
              notes = `Riconciliato il ${new Date(matchedMovement.date).toLocaleDateString("it-IT")} con: ${matchedMovement.description}`;
              pairedMovementIds.add(matchedMovement.id);
            } else {
              paymentDate = item.dueDate; // Manual payment on due date
              reconciliationType = "Manuale (Senza Bonifico)";
              notes = item.description || "Pagato manualmente";
            }
          } else {
            paymentDate = "Pendente";
          }

          ledger.push({
            dueDate: item.dueDate, // Data Competenza
            paymentDate: paymentDate, // Data Cassa
            description: item.title,
            amount: item.amount,
            status: item.status, // Paid, Pending, Overdue, Cancelled
            type: reconciliationType,
            notes: notes,
            isManualBacklogEntry: item.isManualBacklogEntry
          });
        }
      });

      // 2. Process remaining bank movements (direct cash/cassa transactions that weren't matched to a Fast Closing item)
      relatedMovements.forEach(m => {
        if (movementFilter(m) && !pairedMovementIds.has(m.id)) {
          // Since it's direct cash, competence and cash flow coincide
          ledger.push({
            dueDate: m.date, // Data Competenza (same as cash date for direct movements)
            paymentDate: m.date, // Data Cassa
            description: m.description,
            amount: Math.abs(m.amount),
            status: "Paid",
            type: "Movimento Diretto",
            notes: "Pagamento registrato direttamente in cassa"
          });
        }
      });

      // Sort by Data Competenza descending
      ledger.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
      // CORREZIONE (14/08/2026 notte) — separa le voci con scadenza futura (Pending non ancora
      // scaduto) da quelle di competenza corrente/passata o già saldate: solo le seconde
      // (`main`) alimentano tabella principale e saldo; le prime (`future`) restano
      // consultabili in una sezione informativa a parte, mai sommate al dovuto attuale.
      const main = ledger.filter(l => l.dueDate <= oggiStr || l.status === "Paid");
      const future = ledger.filter(l => l.dueDate > oggiStr && l.status !== "Paid");
      return { main, future };
    };

    // 1. Canoni di Affitto (Rent)
    const rentLedger = buildUnifiedLedger(
      item => item.source === "contract" || (item.title || "").toLowerCase().includes("affitto") || (item.title || "").toLowerCase().includes("canone"),
      m => m.reconciledWith?.type === "contract" || (m.description || "").toLowerCase().includes("affitto") || (m.description || "").toLowerCase().includes("canone"),
      "Canone locazione"
    );
    const rentPayments = rentLedger.main;
    const rentFuture = rentLedger.future;

    // 2. Spese Condominiali (Condominium Fees)
    // CORREZIONE (13/08/2026) — le spese condominiali possono generare due righe distinte
    // (una a carico dell'Inquilino, una a carico del Proprietario, campo debtorType). L'Area
    // Proprietari deve mostrare SOLO la quota del proprietario, mai quella dell'inquilino
    // (altrimenti il debito del proprietario risulterebbe gonfiato dalla quota altrui).
    const condoLedger = buildUnifiedLedger(
      item => (item.source === "condominium" || (item.title || "").toLowerCase().includes("condominio") || (item.title || "").toLowerCase().includes("spese cond")) && item.debtorType !== "tenant",
      m => m.reconciledWith?.type === "condominium" || (m.description || "").toLowerCase().includes("condominio") || (m.description || "").toLowerCase().includes("spese cond"),
      "Rata condominiale"
    );
    const condoPayments = condoLedger.main;
    const condoFuture = condoLedger.future;

    // 3. Tasse di Registro (Registration Taxes)
    const taxLedger = buildUnifiedLedger(
      item => (item.title || "").toLowerCase().match(/(registro|imposta|tassa|f24|erario)/) !== null,
      m => (m.description || "").toLowerCase().match(/(registro|imposta|tassa|f24|erario)/) !== null,
      "Tassa registro"
    );
    const taxPayments = taxLedger.main;
    const taxFuture = taxLedger.future;

    // 4. Altri Movimenti / Residui (Other/Manual) — esclude esplicitamente le manutenzioni
    // (che ora, dopo il fix del matching su propertyId, sarebbero altrimenti richiamate qui
    // in duplicato: hanno già una tabella dedicata, vedi ownerMaintenance più sotto) e le
    // quote a carico dell'inquilino (stesso principio del punto 2 qui sopra).
    const otherLedger = buildUnifiedLedger(
      item => {
        const isRent = item.source === "contract" || (item.title || "").toLowerCase().includes("affitto") || (item.title || "").toLowerCase().includes("canone");
        const isCondo = item.source === "condominium" || (item.title || "").toLowerCase().includes("condominio") || (item.title || "").toLowerCase().includes("spese cond");
        const isTax = (item.title || "").toLowerCase().match(/(registro|imposta|tassa|f24|erario)/) !== null;
        const isMaint = item.source === "maintenance";
        return !isRent && !isCondo && !isTax && !isMaint && item.debtorType !== "tenant";
      },
      m => {
        const isRent = m.reconciledWith?.type === "contract" || (m.description || "").toLowerCase().includes("affitto") || (m.description || "").toLowerCase().includes("canone");
        const isCondo = m.reconciledWith?.type === "condominium" || (m.description || "").toLowerCase().includes("condominio") || (m.description || "").toLowerCase().includes("spese cond");
        const isTax = (m.description || "").toLowerCase().match(/(registro|imposta|tassa|f24|erario)/) !== null;
        return !isRent && !isCondo && !isTax;
      },
      "Altra voce contabile"
    );
    const otherPayments = otherLedger.main;
    const otherFuture = otherLedger.future;
    const totalFutureCount = rentFuture.length + condoFuture.length + taxFuture.length + otherFuture.length;
    const totalFutureAmount = [...rentFuture, ...condoFuture, ...taxFuture, ...otherFuture].reduce((s, l) => s + l.amount, 0);

    // CORREZIONE (13/08/2026) — ricostruita da zero: prima leggeva il ticket di manutenzione
    // grezzo (`maintenance` collection) e ne mostrava il costo TOTALE lordo, indipendentemente
    // da come l'utente aveva ripartito la spesa tra proprietario e inquilino (mai il 50/50
    // configurato). Ora legge invece — esattamente come fa già correttamente il mastrino
    // dell'inquilino in TenantsView.tsx per la sua quota — le righe contabili reali generate
    // alla creazione della manutenzione (una per debitore), filtrate per questo immobile e per
    // quota NON a carico dell'inquilino: l'importo mostrato è quindi sempre la vera quota del
    // proprietario (es. 500€ su un totale di 1000€), mai il costo lordo dell'intervento.
    const ownerMaintenanceClosingItems = relatedClosingItems.filter(
      fc => fc.source === "maintenance" && fc.debtorType !== "tenant"
    );
    const ownerMaintenance = ownerMaintenanceClosingItems.map(fc => {
      const ticket = maintenance.find(m => m.id === fc.sourceId);
      const totalCost = ticket?.cost ?? fc.amount;
      const ownerPct = totalCost > 0 ? Math.round((fc.amount / totalCost) * 100) : 100;
      return {
        id: fc.id,
        date: ticket?.date || ticket?.createdAt,
        createdAt: ticket?.createdAt,
        title: ticket?.title || fc.groupLabel || "Manutenzione",
        description: ticket?.description || "",
        contractor: ticket?.contractor,
        status: ticket?.status || "Pending", // stato del TICKET (In Corso/Risolto/Annullato)
        paymentStatus: fc.status, // stato del PAGAMENTO della quota (Pending/Paid/Overdue)
        cost: fc.amount, // quota REALE del proprietario, mai il costo lordo del ticket
        totalCost,
        ownerPct
      };
    });

    // CORREZIONE AX — Totali: quanto c'è ancora da incassare (Pendente + Insoluto) e quanto
    // già incassato, per categoria e nel complesso. Il canone è per definizione a carico
    // dell'inquilino: il totale pendente di quella voce È "quanto deve l'inquilino".
    const sumLedger = (ledger: any[]) => ({
      pending: ledger.filter(l => l.status === "Pending" || l.status === "Overdue").reduce((s, l) => s + l.amount, 0),
      paid: ledger.filter(l => l.status === "Paid").reduce((s, l) => s + l.amount, 0)
    });
    const totals = {
      rent: sumLedger(rentPayments),
      condo: sumLedger(condoPayments),
      taxes: sumLedger(taxPayments),
      other: sumLedger(otherPayments)
    };
    const grandTotalPending = totals.rent.pending + totals.condo.pending + totals.taxes.pending + totals.other.pending;
    const grandTotalPaid = totals.rent.paid + totals.condo.paid + totals.taxes.paid + totals.other.paid;

    return {
      activeContract,
      tenant,
      condo,
      rentPayments,
      condoPayments,
      taxPayments,
      otherPayments,
      rentFuture,
      condoFuture,
      taxFuture,
      otherFuture,
      totalFutureCount,
      totalFutureAmount,
      ownerMaintenance,
      totals,
      grandTotalPending,
      grandTotalPaid
    };
  }, [selectedProperty, contracts, tenants, condominiums, fastClosing, movements, maintenance]);

  // CORREZIONE CP (13/08/2026) — Fase 2 punto 3: righe unificate per stampa/esportazione
  // universale del mastrino proprietario, tramite LedgerExportToolbar. Le 5 sezioni hanno
  // forme diverse (le 4 "buildUnifiedLedger" condividono la stessa forma, le manutenzioni no):
  // qui vengono normalizzate in un'unica forma con etichetta di categoria, includendo SOLO le
  // sezioni attualmente selezionate in `activeLedgerTabs` — l'esportazione rispecchia sempre
  // esattamente ciò che è visibile a schermo.
  const ownerLedgerExportRows = useMemo(() => {
    const rows: any[] = [];
    if (!propertyModalData) return rows;
    if (activeLedgerTabs.includes("rent")) {
      propertyModalData.rentPayments.forEach((r: any) => rows.push({ ...r, category: "Canoni" }));
    }
    if (activeLedgerTabs.includes("condo")) {
      propertyModalData.condoPayments.forEach((r: any) => rows.push({ ...r, category: "Condominio" }));
    }
    if (activeLedgerTabs.includes("taxes")) {
      propertyModalData.taxPayments.forEach((r: any) => rows.push({ ...r, category: "Registro" }));
    }
    if (activeLedgerTabs.includes("other")) {
      propertyModalData.otherPayments.forEach((r: any) => rows.push({ ...r, category: "Altro" }));
    }
    if (activeLedgerTabs.includes("maintenance")) {
      propertyModalData.ownerMaintenance.forEach((m: any) => rows.push({
        category: "Manutenzioni",
        dueDate: m.date || m.createdAt,
        paymentDate: "-",
        description: m.title,
        amount: m.cost || 0,
        status: m.status === "Completed" ? "Paid" : m.status === "Cancelled" ? "Cancelled" : "Pending",
        type: m.contractor || "",
        notes: m.description || ""
      }));
    }
    return rows;
  }, [propertyModalData, activeLedgerTabs]);

  // CORREZIONE (14/08/2026, punto 2 di "DA FARE PROSSIMO GIRO") — le date dei canoni (voce
  // interna al rapporto locatore/conduttore) mostrano solo mese e anno; le altre categorie
  // (condominio, registro/F24, manutenzioni, altro) mantengono la data completa — eccezioni
  // esplicite della regola generale di Massimo.
  const ownerLedgerExportColumns: LedgerColumn[] = [
    { key: "category", label: "Categoria" },
    { key: "dueDate", label: "Data Competenza", format: (r: any) => r.dueDate && r.dueDate !== "-" ? (r.category === "Canoni" ? formatMonthYear(r.dueDate) : new Date(r.dueDate).toLocaleDateString("it-IT")) : "-" },
    { key: "paymentDate", label: "Data Cassa", format: (r: any) => r.paymentDate && r.paymentDate !== "-" && r.paymentDate !== "Pendente" ? (r.category === "Canoni" ? formatMonthYear(r.paymentDate) : new Date(r.paymentDate).toLocaleDateString("it-IT")) : r.paymentDate },
    { key: "description", label: "Descrizione" },
    { key: "type", label: "Tipo / Impresa" },
    { key: "status", label: "Stato", format: (r: any) => r.status === "Paid" ? "Saldato" : r.status === "Overdue" ? "Scaduto" : r.status === "Cancelled" ? "Annullato" : "In Sospeso" },
    { key: "amount", label: "Importo", align: "right", format: (r: any) => `€${(r.amount || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` }
  ];

  // CORREZIONE AY — Invia il conteggio (totali del mastrino) a un comproprietario, via
  // Resend (allegati/formattazione affidabili, mai EmailJS che resta riservato ai Solleciti).
  const handleSendCountToCoOwner = async (
    coOwner: { name: string; email?: string; phone?: string },
    primaryOwner: Owner
  ) => {
    if (!coOwner.email || !coOwner.email.includes("@")) {
      alert(`"${coOwner.name}" non ha un'email valida in anagrafica. Aggiungila prima di inviare il conteggio.`);
      return;
    }
    if (!propertyModalData || !selectedProperty) return;

    const confirmed = confirm(`Vuoi inviare il conteggio di "${selectedProperty.name}" a ${coOwner.name} (${coOwner.email})?`);
    if (!confirmed) return;

    setSendingCountToCoOwner(coOwner.name);
    try {
      const html = `
        <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; margin: 0 auto; color: #0f172a;">
          <p>Gentile ${coOwner.name},</p>
          <p>Le inviamo, in qualità di comproprietario, il conteggio aggiornato relativo all'immobile "<strong>${selectedProperty.name}</strong>" (${selectedProperty.address || ""}).</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #fef2f2;">
              <td style="padding: 10px; border: 1px solid #fecaca;">Totale da Incassare</td>
              <td style="padding: 10px; border: 1px solid #fecaca; text-align: right; font-weight: bold;">€${propertyModalData.grandTotalPending.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr style="background: #f0fdf4;">
              <td style="padding: 10px; border: 1px solid #bbf7d0;">Totale Già Incassato</td>
              <td style="padding: 10px; border: 1px solid #bbf7d0; text-align: right; font-weight: bold;">€${propertyModalData.grandTotalPaid.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr style="background: #eef2ff;">
              <td style="padding: 10px; border: 1px solid #c7d2fe;">Di cui, quota Canone (dovuta dall'inquilino)</td>
              <td style="padding: 10px; border: 1px solid #c7d2fe; text-align: right; font-weight: bold;">€${propertyModalData.totals.rent.pending.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
            </tr>
          </table>
          <p>Restiamo a disposizione per qualunque chiarimento.</p>
          <p>Cordiali saluti,<br/>${primaryOwner.name}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 10px; color: #94a3b8;">Questa comunicazione è stata generata dall'intelligenza artificiale del sistema di gestione immobiliare Palazzinaro AI®. La firma del proprietario è raccolta digitalmente.</p>
        </div>
      `;

      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: coOwner.email,
          subject: `Conteggio Immobile — ${selectedProperty.name}`,
          html
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Errore sconosciuto durante l'invio.");
      }
      alert(`Conteggio inviato con successo a ${coOwner.name}.`);
    } catch (err: any) {
      alert(`Errore durante l'invio: ${err?.message || err}\n\nVerifica che RESEND_API_KEY sia configurata su Vercel.`);
    } finally {
      setSendingCountToCoOwner(null);
    }
  };

  // Helper to extract unique owners (both individual and compound) from all properties
  const ownersList = useMemo(() => {
    const ownersMap = new Map<string, OwnerInfo>();

    properties.forEach(p => {
      if (!p.owner || !p.owner.trim()) return;

      const rawOwner = p.owner.trim();

      // Split rawOwner into individual names by separators (comma, ' e ', ' and ', '&', '-')
      // Also clean up double spaces and normalize casing for parsing
      const individuals = rawOwner
        .split(/,|\be\b|\band\b|&|-/i)
        .map(name => name.trim())
        .filter(name => name.length > 0);

      // 1. If multiple owners are detected, add the full compound owner
      if (individuals.length > 1) {
        // We use the raw owner string as the display name
        const compoundKey = rawOwner;
        if (!ownersMap.has(compoundKey)) {
          ownersMap.set(compoundKey, {
            name: compoundKey,
            isCompound: true,
            individualNames: individuals
          });
        }
      }

      // 2. Add each individual owner as a separate row
      individuals.forEach(ind => {
        const key = ind;
        if (!ownersMap.has(key)) {
          ownersMap.set(key, {
            name: ind,
            isCompound: false,
            individualNames: [ind]
          });
        }
      });
    });

    // CORREZIONE (15/08/2026) — segnalato da Massimo: un Proprietario appena creato dal
    // Wizard (anagrafica REALE, salvata in Firestore da handleAddOwner) compariva subito nel
    // menù a tendina "Seleziona esistente" del wizard stesso (che legge `owners` reale), ma
    // NON otteneva alcun badge/card né una propria "area" (scheda di dettaglio) in questa
    // pagina — perché l'elenco qui sopra viene costruito SOLO scandendo `properties[].owner`
    // (testo libero), mai la collezione reale `owners`. Un proprietario creato in modo
    // standalone, senza ancora nessun immobile assegnato, non produceva quindi alcuna voce.
    // Corretto senza toccare l'architettura esistente (nessun secondo flusso parallelo): ogni
    // Owner reale privo di un immobile già abbinato (cioè non già presente come nome/individuo
    // nell'elenco costruito sopra) viene aggiunto qui come card a sé, con zero immobili — la
    // card e l'area di dettaglio funzionano già correttamente anche a "0 proprietà" (stesso
    // stato che avrebbe comunque un proprietario reale i cui immobili fossero stati rimossi).
    owners.forEach(realOwner => {
      const cleanName = (realOwner.name || "").trim();
      if (!cleanName) return;
      const alreadyPresent = Array.from(ownersMap.values()).some(o =>
        o.name.toLowerCase().trim() === cleanName.toLowerCase() ||
        o.individualNames.some(n => n.toLowerCase().trim() === cleanName.toLowerCase())
      );
      if (!alreadyPresent) {
        ownersMap.set(cleanName, {
          name: cleanName,
          isCompound: false,
          individualNames: [cleanName]
        });
      }
    });

    return Array.from(ownersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [properties, owners]);

  // Filter owners by search term
  const filteredOwners = useMemo(() => {
    if (!searchTerm.trim()) return ownersList;
    return ownersList.filter(o => 
      (o.name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [ownersList, searchTerm]);

  // Match properties for a given owner
  const getPropertiesForOwner = (owner: OwnerInfo): Property[] => {
    const list = properties.filter(p => {
      if (!p.owner) return false;
      const pOwnerNormalized = (p.owner || "").toLowerCase();
      
      if (owner.isCompound) {
        // Exact match of the compound name or containing all individual names
        const matchExact = pOwnerNormalized === (owner.name || "").toLowerCase();
        const matchAll = owner.individualNames.every(name => 
          pOwnerNormalized.includes((name || "").toLowerCase())
        );
        return matchExact || matchAll;
      } else {
        // Individual name is in the property owner list
        return owner.individualNames.some(name => 
          pOwnerNormalized.includes((name || "").toLowerCase())
        );
      }
    });

    // Deduplicate properties to avoid showing identical apartments
    const seen = new Set<string>();
    const deduplicated: Property[] = [];
    list.forEach(p => {
      const cleanName = (p.name || "").trim().toLowerCase().replace(/\s+/g, "");
      const cleanAddress = p.address ? p.address.trim().toLowerCase().replace(/\s+/g, "") : "";
      const key = `${cleanName}_${cleanAddress}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(p);
      }
    });
    return deduplicated;
  };

  // CORREZIONE V — Contatti reali (email/telefono) e semaforo di adempimento per ogni
  // proprietario: stesso identico meccanismo già usato per gli Amministratori (soglie di
  // spesa non pagata), applicato qui alle quote di manutenzione a carico del proprietario.
  const OWNER_DEBT_WARNING_THRESHOLD = 500;
  const OWNER_DEBT_CRITICAL_THRESHOLD = 1500;

  const getOwnerContactAndStatus = (owner: OwnerInfo) => {
    // Per una comproprietà, prova a risolvere i contatti del primo nominativo con
    // un'anagrafica reale trovata (spesso i co-proprietari condividono la gestione).
    const namesToCheck = owner.isCompound ? owner.individualNames : [owner.name];
    let realOwner: Owner | undefined;
    for (const n of namesToCheck) {
      realOwner = owners.find(o => (o.name || "").toLowerCase().trim() === n.toLowerCase().trim());
      if (realOwner) break;
    }

    const ownerProps = getPropertiesForOwner(owner);
    const ownerPropIds = new Set(ownerProps.map(p => p.id));
    const unpaidDebt = fastClosing
      .filter(fc =>
        fc.source === "maintenance" &&
        fc.debtorType === "owner" &&
        (fc.status === "Pending" || fc.status === "Overdue") &&
        fc.propertyId && ownerPropIds.has(fc.propertyId)
      )
      .reduce((sum, fc) => sum + fc.amount, 0);

    let semaforo: "green" | "yellow" | "red" = "green";
    if (unpaidDebt >= OWNER_DEBT_CRITICAL_THRESHOLD) semaforo = "red";
    else if (unpaidDebt >= OWNER_DEBT_WARNING_THRESHOLD) semaforo = "yellow";

    return {
      email: realOwner?.email || null,
      phone: realOwner?.phone || null,
      hasRealRecord: !!realOwner,
      unpaidDebt,
      semaforo
    };
  };

  // Properties belonging to the currently selected owner
  const ownerProperties = useMemo(() => {
    if (!selectedOwner) return [];
    return getPropertiesForOwner(selectedOwner);
  }, [selectedOwner, properties]);

  // Calculate metrics for selected owner
  const ownerMetrics = useMemo(() => {
    if (!selectedOwner) return { total: 0, rented: 0, income: 0, warningCount: 0 };
    
    const props = getPropertiesForOwner(selectedOwner);
    const total = props.length;
    const rented = props.filter(p => p.status === "Rented").length;
    
    // Sum rent amount of active contracts on these properties
    let income = 0;
    props.forEach(p => {
      const activeContract = contracts.find(c => c.propertyId === p.id && c.status === "Active");
      if (activeContract) {
        income += activeContract.rentAmount;
      }
    });

    // Count overdue items
    let warningCount = 0;
    props.forEach(p => {
      const activeContract = contracts.find(c => c.propertyId === p.id && c.status === "Active");
      const propertyClosingItems = fastClosing.filter(fc => {
        if (fc.status === "Paid" || fc.status === "Cancelled") return false;
        if (fc.debtorType === "tenant") return false; // solo scadenze a carico del proprietario
        const matchesPropertyId = (fc as any).propertyId === p.id;
        const matchesId = fc.sourceId === p.id || (activeContract && fc.sourceId === activeContract.id);
        const matchesTitle = (fc.title || "").toLowerCase().includes((p.name || "").toLowerCase());
        return matchesPropertyId || matchesId || matchesTitle;
      });
      const hasOverdue = propertyClosingItems.some(item =>
        item.status === "Overdue" || new Date(item.dueDate) < new Date()
      );
      if (hasOverdue) warningCount++;
    });

    return { total, rented, income, warningCount };
  }, [selectedOwner, properties, contracts, fastClosing]);

  // Consolidated financial positions for the selected owner (liabilities/credits)
  const ownerFinancials = useMemo(() => {
    if (!selectedOwner) return { condoDebit: 0, taxesDebit: 0, maintenanceDebit: 0, totalDebit: 0, overdueRent: 0 };
    
    let condoDebit = 0;
    let taxesDebit = 0;
    let maintenanceDebit = 0;
    let overdueRent = 0; // Rent that tenants owe to this owner
    
    const props = getPropertiesForOwner(selectedOwner);
    
    props.forEach(p => {
      const activeContract = contracts.find(c => c.propertyId === p.id && c.status === "Active");
      
      const propertyClosingItems = fastClosing.filter(fc => {
        const matchesPropertyId = (fc as any).propertyId === p.id;
        const matchesId = fc.sourceId === p.id || (activeContract && fc.sourceId === activeContract.id);
        const matchesTitle = (fc.title || "").toLowerCase().includes((p.name || "").toLowerCase());
        return matchesPropertyId || matchesId || matchesTitle;
      });

      propertyClosingItems.forEach(item => {
        if (item.status === "Paid" || item.status === "Cancelled") return;

        // CORREZIONE I — Un ticket di manutenzione può generare più righe (una per
        // debitore, quando diviso tra proprietario e inquilino). Prima di questa
        // correzione, il mastrino Proprietari sommava TUTTE le righe che citavano
        // l'immobile nel titolo, incluse quelle esplicitamente a carico dell'inquilino:
        // il debito del proprietario risultava gonfiato. Ora la quota a carico
        // dell'inquilino viene sempre esclusa dal conteggio del proprietario.
        if (item.debtorType === "tenant") return;

        const titleLower = (item.title || "").toLowerCase();
        
        const isRent = item.source === "contract" || titleLower.includes("affitto") || titleLower.includes("canone");
        const isCondo = item.source === "condominium" || titleLower.includes("condominio") || titleLower.includes("spese cond");
        const isTax = titleLower.match(/(registro|imposta|tassa|f24|erario)/) !== null;
        const isMaint = titleLower.includes("manutenzione") || titleLower.includes("fattura") || titleLower.includes("idraulico");
        
        if (isRent) {
          overdueRent += item.amount;
        } else if (isCondo) {
          condoDebit += item.amount;
        } else if (isTax) {
          taxesDebit += item.amount;
        } else if (isMaint) {
          maintenanceDebit += item.amount;
        } else {
          // Default other dues to condoDebit (condominium & general liabilities)
          condoDebit += item.amount;
        }
      });
    });
    
    return {
      condoDebit,
      taxesDebit,
      maintenanceDebit,
      totalDebit: condoDebit + taxesDebit + maintenanceDebit,
      overdueRent
    };
  }, [selectedOwner, properties, contracts, fastClosing]);

  // Icona coerente col tipo di tracciamento contabile (bonifico riconciliato/movimento
  // diretto vs. scadenza/registrazione manuale), usata nelle colonne "Tracciamento / Nota".
  const renderLedgerTypeLabel = (typeLabel: string) => {
    const isBankMovement = typeLabel.includes("Bonifico") || typeLabel.includes("Movimento Diretto");
    const TypeIcon = isBankMovement ? Landmark : Files;
    return (
      <span className="inline-flex items-center gap-1">
        <TypeIcon size={11} className="text-indigo-700 shrink-0" />
        {typeLabel}
      </span>
    );
  };

  return (
    <div className="space-y-6" id="owners-view-container">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Area Proprietari</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {selectedOwner 
              ? `Visualizzazione immobili e stato finanziario per il proprietario selezionato.`
              : `Lista completa dei proprietari singoli e comproprietà con i relativi immobili in gestione.`
            }
          </p>
        </div>

        {selectedOwner && (
          <button
            onClick={() => setSelectedOwner(null)}
            className="self-start md:self-auto inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl active:transition-all"
          >
            <ArrowLeft size={14} />
            <span>Torna alla Lista</span>
          </button>
        )}
      </div>

      {/* VIEW 1: OWNER LIST VIEW (TOP LEVEL) */}
      {!selectedOwner ? (
        <div className="space-y-5">
          {/* Search bar */}
          <div className="relative max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Cerca proprietario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-hidden focus:border-indigo-500 shadow-2xs"
            />
          </div>

          {filteredOwners.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-lg mx-auto">
              <div className="bg-slate-50 text-slate-400 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4">
                <User size={28} />
              </div>
              <h3 className="font-sans font-bold text-slate-800 text-base">Nessun proprietario trovato</h3>
              <p className="text-xs text-slate-500 mt-2">
                Non ci sono proprietari registrati negli immobili, oppure nessun elemento corrisponde alla ricerca.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredOwners.map((owner, idx) => {
                const ownerProps = getPropertiesForOwner(owner);
                const rentedCount = ownerProps.filter(p => p.status === "Rented").length;
                const contactStatus = getOwnerContactAndStatus(owner);
                
                // Calculate total owner monthly income
                let ownerMonthlyIncome = 0;
                ownerProps.forEach(p => {
                  const activeContract = contracts.find(c => c.propertyId === p.id && c.status === "Active");
                  if (activeContract) {
                    ownerMonthlyIncome += activeContract.rentAmount;
                  }
                });

                return (
                  <div
                    key={owner.name}
                    onClick={() => setSelectedOwner(owner)}
                    className="p-5 bg-white border border-slate-150 hover:border-indigo-400 rounded-2xl shadow-2xs hover:shadow-xs transition-all duration-200 cursor-pointer flex flex-col justify-between group animate-fade-in"
                    id={`owner-card-${idx}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-2.5 rounded-xl ${
                          owner.isCompound 
                            ? "bg-amber-50 text-amber-600 border border-amber-100" 
                            : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                        }`}>
                          {owner.isCompound ? <Users size={20} /> : <User size={20} />}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            owner.isCompound
                              ? "bg-amber-100 text-amber-800"
                              : "bg-indigo-100 text-indigo-800"
                          }`}>
                            {owner.isCompound ? (
                              <><Users size={10} className="shrink-0" /> Comproprietà</>
                            ) : (
                              <><User size={10} className="shrink-0" /> Proprietario Singolo</>
                            )}
                          </span>
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              contactStatus.semaforo === "green" ? "bg-emerald-500" : contactStatus.semaforo === "yellow" ? "bg-amber-400" : "bg-rose-500 animate-pulse"
                            }`}
                            title={
                              contactStatus.semaforo === "green"
                                ? "Regolare con le spese a suo carico"
                                : contactStatus.semaforo === "yellow"
                                ? `Attenzione: €${contactStatus.unpaidDebt.toFixed(2)} di spese non pagate`
                                : `Critico: €${contactStatus.unpaidDebt.toFixed(2)} di spese non pagate`
                            }
                          />
                        </div>
                      </div>

                      <h3 className="font-sans font-black text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                        {owner.name}
                      </h3>

                      <div className="mt-1.5 space-y-0.5 text-[10px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <Phone size={11} className="text-indigo-700 shrink-0" />
                          <span>{contactStatus.phone || "Nessun telefono in anagrafica"}</span>
                        </div>
                        <div className="flex items-center gap-1 truncate">
                          <Mail size={11} className="text-indigo-700 shrink-0" />
                          <span className="truncate">{contactStatus.email || "Nessuna email in anagrafica"}</span>
                        </div>
                      </div>
                      
                      <div className="mt-4 space-y-2 text-xs">
                        <div className="flex justify-between text-slate-500">
                          <span>Immobili Totali:</span>
                          <span className="font-bold text-slate-800">{ownerProps.length}</span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>Immobili Affittati:</span>
                          <span className="font-bold text-slate-800">{rentedCount} su {ownerProps.length}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 mt-5 pt-3 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Rendita Mensile</span>
                        <span className="text-xs font-black text-slate-900">
                          €{ownerMonthlyIncome.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <span className="text-indigo-600 group-hover:translate-x-1 transition-transform">
                        <ArrowRight size={16} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: DETAILED SUBPAGE FOR SELECTED OWNER */
        <div className="space-y-6">
          {/* Owner Info & Quick Metrics Banner */}
          <div className="bg-slate-950 text-white rounded-2xl p-6 border border-slate-900 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 shadow-md animate-fade-in">
            <div className="flex items-center space-x-4">
              <div className={`p-4 rounded-2xl ${
                selectedOwner.isCompound ? "bg-amber-500 text-slate-950" : "bg-indigo-600 text-white"
              }`}>
                {selectedOwner.isCompound ? <Users size={28} /> : <User size={28} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-black text-indigo-400 tracking-wider">
                    {selectedOwner.isCompound ? "Comproprietà Selezionata" : "Proprietario Singolo"}
                  </span>
                  {(() => {
                    const cs = getOwnerContactAndStatus(selectedOwner);
                    return (
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          cs.semaforo === "green" ? "bg-emerald-500" : cs.semaforo === "yellow" ? "bg-amber-400" : "bg-rose-500 animate-pulse"
                        }`}
                        title={
                          cs.semaforo === "green"
                            ? "Regolare con le spese a suo carico"
                            : cs.semaforo === "yellow"
                            ? `Attenzione: €${cs.unpaidDebt.toFixed(2)} di spese non pagate`
                            : `Critico: €${cs.unpaidDebt.toFixed(2)} di spese non pagate`
                        }
                      />
                    );
                  })()}
                </div>
                <h3 className="text-lg font-sans font-black mt-0.5">{selectedOwner.name}</h3>
                {(() => {
                  const cs = getOwnerContactAndStatus(selectedOwner);
                  return (
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-slate-400 mt-1">
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} className="shrink-0" /> {cs.phone || "Nessun telefono"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Mail size={11} className="shrink-0" /> {cs.email || "Nessuna email"}
                      </span>
                    </div>
                  );
                })()}
                {selectedOwner.isCompound && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Composto da: {selectedOwner.individualNames.join(", ")}
                  </p>
                )}
                {/* CORREZIONE AV — "Vedi anche": se questo proprietario fa parte di una o più
                    comproprietà (come comproprietario collegato in un altro Owner reale), lo
                    segnala qui con un rimando diretto al conto unico — senza duplicare nulla,
                    il conto/mastrino resta unico su quell'altra anagrafica. */}
                {!selectedOwner.isCompound && (() => {
                  const jointAccounts = owners.filter(o =>
                    (o.coOwners || []).some(co =>
                      (co.linkedOwnerId && owners.find(x => x.name === selectedOwner.name)?.id === co.linkedOwnerId) ||
                      co.name.toLowerCase().trim() === selectedOwner.name.toLowerCase().trim()
                    )
                  );
                  if (jointAccounts.length === 0) return null;
                  return (
                    <div className="mt-2 space-y-1">
                      {jointAccounts.map(joint => (
                        <button
                          key={joint.id}
                          onClick={() => {
                            // CORREZIONE AV — porta al conto REALE del proprietario principale
                            // (dove l'immobile in comproprietà è davvero registrato), non a una
                            // vista sintetica che rischierebbe di risultare vuota.
                            setSelectedOwner({ name: joint.name, isCompound: false, individualNames: [joint.name] });
                          }}
                          className="w-full text-left text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Link2 size={12} className="shrink-0" />
                          <span>Vedi anche: comproprietà con {joint.name} — conto unico, registrato lì</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
                {/* CORREZIONE U — Modifica dati anagrafici reali (email, telefono, C.F., IBAN) */}
                {selectedOwner.isCompound ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedOwner.individualNames.map(n => (
                      <button
                        key={n}
                        onClick={() => handleOpenOwnerEdit(n)}
                        className="text-[9px] font-bold bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-md transition-colors inline-flex items-center gap-1"
                      >
                        <Pencil size={10} className="shrink-0" />
                        Modifica dati di {n}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => handleOpenOwnerEdit(selectedOwner.name)}
                    className="mt-2 text-[9px] font-bold bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-md transition-colors inline-flex items-center gap-1"
                  >
                    <Pencil size={10} className="shrink-0" />
                    Modifica Dati Proprietario
                  </button>
                )}
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-8 border-t lg:border-t-0 lg:border-l border-slate-800 pt-4 lg:pt-0 lg:pl-8">
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-bold">Immobili Totali</span>
                <span className="text-base font-black font-mono text-white">{ownerMetrics.total}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-bold">In Affitto</span>
                <span className="text-base font-black font-mono text-emerald-400">{ownerMetrics.rented}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-bold">Canoni Attivi</span>
                <span className="text-base font-black font-mono text-indigo-300">
                  €{ownerMetrics.income.toLocaleString("it-IT", { minimumFractionDigits: 0 })}/m
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-bold">Insoluti/Pendenze</span>
                <span className={`text-base font-black font-mono ${ownerMetrics.warningCount > 0 ? "text-amber-400 animate-pulse" : "text-slate-400"}`}>
                  {ownerMetrics.warningCount}
                </span>
              </div>
            </div>
          </div>

          {/* SEZIONE DEBITO CONDOMINIALE & PASSIVITÀ PROPRIETARIO */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4 animate-fade-in" id="owner-liabilities-section">
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                  <Coins size={18} />
                </div>
                <div>
                  <h4 className="font-sans font-black text-slate-900 text-sm">
                    Riepilogo Posizione Debitoria & Adempimenti Proprietario
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Calcolo aggregato delle pendenze finanziarie nei condomini e adempimenti fiscali per tutti gli immobili del proprietario.
                  </p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                ownerFinancials.totalDebit > 0
                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
              }`}>
                {ownerFinancials.totalDebit > 0 ? (
                  <><AlertTriangle size={11} className="shrink-0" /> Pendenze Attive</>
                ) : (
                  <><CheckCircle2 size={11} className="shrink-0" /> Contabilità in Regola</>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Card 1: Condominio */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Spese Condominiali</span>
                  <span className="text-lg font-mono font-black text-slate-900 mt-1 block">
                    €{ownerFinancials.condoDebit.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">
                  Rate ed oneri di gestione condominiali insoluti o in attesa di scadenza.
                </p>
              </div>

              {/* Card 2: Tasse Registro */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Imposte & F24</span>
                  <span className="text-lg font-mono font-black text-slate-900 mt-1 block">
                    €{ownerFinancials.taxesDebit.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">
                  Imposte di registro, bolli o tributi erariali a carico della proprietà.
                </p>
              </div>

              {/* Card 3: Manutenzioni */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Fatture Manutenzione</span>
                  <span className="text-lg font-mono font-black text-slate-900 mt-1 block">
                    €{ownerFinancials.maintenanceDebit.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">
                  Costi degli interventi straordinari o riparazioni non addebitabili all'inquilino.
                </p>
              </div>

              {/* Card 4: Passività Totali */}
              <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                ownerFinancials.totalDebit > 0 
                  ? "bg-rose-50/50 border-rose-200 text-rose-950" 
                  : "bg-emerald-50/50 border-emerald-200 text-emerald-950"
              }`}>
                <div>
                  <span className="text-[9px] uppercase font-black tracking-wider block opacity-70">Passività Totali Proprietario</span>
                  <span className="text-xl font-mono font-black mt-1 block">
                    €{ownerFinancials.totalDebit.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-2 text-[9px] leading-snug">
                  {ownerFinancials.totalDebit > 0 ? (
                    <span className="text-rose-700 font-bold inline-flex items-center gap-1">
                      <AlertTriangle size={11} className="shrink-0" />
                      <span>Sono presenti pagamenti da effettuare per un totale di €{ownerFinancials.totalDebit.toLocaleString("it-IT")}.</span>
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                      <CheckCircle2 size={11} className="shrink-0" />
                      <span>Nessun debito o pendenza riscontrata sui condomini o adempimenti catastali.</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Owner Credit Info (Rents to collect) */}
            {ownerFinancials.overdueRent > 0 && (
              <div className="bg-blue-50/60 border border-blue-200 p-3.5 rounded-xl text-blue-950 text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Euro size={16} className="text-emerald-700 shrink-0" />
                  <div>
                    <span className="font-extrabold block">Canoni di Affitto Arrearati da Incassare (Credito Proprietario)</span>
                    <span className="text-[10px] text-blue-700 leading-tight block">I conduttori hanno pendenze attive nei confronti di questo proprietario per un totale di €{ownerFinancials.overdueRent.toLocaleString("it-IT")}.</span>
                  </div>
                </div>
                <span className="text-sm font-mono font-black text-blue-950">
                  +€{ownerFinancials.overdueRent.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* PORTFOLIO TITLE */}
          <div className="pb-3">
            <h3 className="font-sans font-extrabold text-slate-900 text-sm">
              Portafoglio Immobiliare ({ownerProperties.length})
            </h3>
          </div>

          {ownerProperties.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-500">Nessun immobile assegnato direttamente a questo proprietario.</p>
            </div>
          ) : (
            /* PROPERTIES BENTO GRID - FULLY REPRODUCING DASHBOARD BADGES AND COMPOSITES */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {ownerProperties.map((p) => {
                // 1. Detect if Rented (compound activity)
                const isRented = p.status === "Rented";
                
                // 2. Active contract search
                const activeContract = contracts.find(c => c.propertyId === p.id && c.status === "Active");
                
                // 3. Associated tenant search
                const associatedTenant = tenants.find(t => t.propertyId === p.id || (activeContract && t.id === activeContract.tenantId));
                
                // 4. Overdue/Pending fast closing items for this property/contract
                const propertyClosingItems = fastClosing.filter(fc => {
                  if (fc.status === "Paid" || fc.status === "Cancelled") return false;
                  const matchesPropertyId = (fc as any).propertyId === p.id;
                  const matchesId = fc.sourceId === p.id || (activeContract && fc.sourceId === activeContract.id);
                  const matchesTitle = (fc.title || "").toLowerCase().includes((p.name || "").toLowerCase());
                  return matchesPropertyId || matchesId || matchesTitle;
                });

                const hasOverdueRent = propertyClosingItems.some(item => 
                  (item.status === "Overdue" || new Date(item.dueDate) < new Date()) && 
                  (item.source === "contract" || (item.title || "").toLowerCase().includes("affitto") || (item.title || "").toLowerCase().includes("canone"))
                );

                const hasPendingOverdue = propertyClosingItems.some(item => 
                  item.status === "Overdue" || new Date(item.dueDate) < new Date()
                );

                // 5. Reminders
                const associatedReminders = reminders.filter(r => 
                  associatedTenant && r.tenantId === associatedTenant.id
                );

                const isMessaInMora = associatedReminders.some(r => r.status === "MessaInMora");
                const hasSentReminder = associatedReminders.some(r => r.status === "Sent");

                // 6. Active legal cases
                const activeLegal = legalCases.find(lc => 
                  lc.propertyId === p.id && lc.status === "Active"
                );

                // 7. Condominium lookup
                const condoConstituted = condominiums.find(c => 
                  (p.address || "").toLowerCase().includes((c.name || "").toLowerCase()) || 
                  (c.name || "").toLowerCase().includes((p.name || "").toLowerCase()) ||
                  (c.notes && (c.notes || "").toLowerCase().includes((p.name || "").toLowerCase()))
                );

                // ----------------------------------------------------
                // A. SHAPE 1: HOUSE SHAPE (NOT RENTED / SINGLE PROPERTY)
                // ----------------------------------------------------
                if (!isRented) {
                  const getIcon = (typeStr: string) => {
                    if (typeStr === "Monolocale") return <Building2 size={18} className="text-indigo-700" />;
                    if (typeStr === "Ufficio") return <Building size={18} className="text-indigo-700" />;
                    if (typeStr === "Garage/Box") return <Car size={18} className="text-indigo-700" />;
                    return <Home size={18} className="text-indigo-700" />;
                  };

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProperty(p)}
                      className="relative overflow-hidden bg-slate-50 hover:bg-slate-100/60 border-2 border-slate-200 rounded-b-2xl rounded-t-[2.5rem] p-5 shadow-xs cursor-pointer hover:scale-[1.02] hover:-translate-y-1 hover:shadow-md hover:border-indigo-400 group flex flex-col justify-between h-[250px] transition-all duration-300 animate-fade-in"
                      id={`owner-property-house-${p.id}`}
                    >
                      {/* Visual roof cap */}
                      <div className="absolute top-0 inset-x-0 h-2 bg-indigo-500/80"></div>
                      
                      <div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="bg-white p-2 rounded-full border border-slate-200 text-lg shadow-2xs">
                            {getIcon(p.type)}
                          </div>
                          <span className={`inline-flex items-center gap-1.5 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            p.status === "Available"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}>
                            {p.status === "Available" && (
                              <><span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" /> Libero</>
                            )}
                            {p.status === "Maintenance" && (
                              <><span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" /> Manutenzione</>
                            )}
                            {p.status === "Archived" && (
                              <><span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" /> Archiviato</>
                            )}
                          </span>
                        </div>
                        
                        <h4 className="font-extrabold text-xs text-slate-900 mt-3.5 group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {p.name}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-1 truncate">{p.address}</p>
                      </div>

                      <div className="border-t border-slate-200/60 pt-3 flex flex-col space-y-1.5 mt-auto">
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span>Categoria:</span>
                          <span className="font-semibold text-slate-700">{p.type}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span>Regime:</span>
                          <span className={`font-semibold text-[9px] px-1.5 py-0.5 rounded ${p.isBareOwnership ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                            {p.isBareOwnership ? "Nuda Proprietà" : "Piena Proprietà"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span>Condominio:</span>
                          <span className={`font-semibold text-[9px] px-1.5 py-0.5 rounded truncate max-w-[110px] ${p.isCondoConstituted ? "bg-indigo-100 text-indigo-800" : "bg-rose-100 text-rose-800"}`}>
                            {p.isCondoConstituted ? "Costituito" : "Non Costituito / Assente"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // ----------------------------------------------------
                // B. SHAPE 2: SQUARE ACTIVE COMPOSITE BADGE (RENTED / RELATIONSHIP)
                // ----------------------------------------------------
                let borderClass = "border-emerald-400 bg-emerald-50/15 text-emerald-950";
                let statusLabel = "Relazione Regolare";
                let statusIcon: React.ReactNode = <CheckCircle2 size={11} className="shrink-0" />;
                let badgeStyleClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
                let isCritical = false;

                if (associatedTenant) {
                  const cls = getTenantClassification(associatedTenant, properties, contracts, fastClosing, legalCases, reminders);
                  statusLabel = cls.label;
                  badgeStyleClass = cls.badgeClass;
                  if (cls.status === "critical") {
                    borderClass = "border-red-600 bg-red-50 text-red-950 shadow-[0_0_15px_rgba(220,38,38,0.25)] animate-pulse";
                    statusIcon = <AlertTriangle size={11} className="shrink-0" />;
                    isCritical = true;
                  } else if (cls.status === "red") {
                    borderClass = "border-rose-500 bg-rose-50 text-rose-950 animate-pulse";
                    statusIcon = <AlertTriangle size={11} className="shrink-0" />;
                    isCritical = true;
                  } else if (cls.status === "orange") {
                    borderClass = "border-amber-400 bg-amber-50 text-amber-950";
                    statusIcon = <AlertTriangle size={11} className="shrink-0" />;
                  } else {
                    borderClass = "border-emerald-400 bg-emerald-50 text-emerald-950";
                    statusIcon = <CheckCircle2 size={11} className="shrink-0" />;
                  }
                } else if (!activeContract) {
                  borderClass = "border-amber-400 bg-amber-50 text-amber-950";
                  statusLabel = "Contratto Mancante";
                  statusIcon = <AlertTriangle size={11} className="shrink-0" />;
                  badgeStyleClass = "bg-amber-150 text-amber-900 border-amber-300";
                }

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProperty(p)}
                    className={`p-5 rounded-2xl border-2 transition-all duration-300 flex flex-col justify-between hover:scale-[1.02] hover:-translate-y-1 hover:shadow-md cursor-pointer relative h-[280px] animate-fade-in ${borderClass}`}
                    id={`owner-property-relation-${p.id}`}
                  >
                    {isCritical && (
                      <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${badgeStyleClass}`}>
                          {statusIcon}
                          {statusLabel}
                        </span>
                        {activeLegal && (
                          <div className="bg-violet-100 text-violet-800 p-1.5 rounded-lg border border-violet-200 shadow-2xs animate-pulse">
                            <Scale size={13} />
                          </div>
                        )}
                      </div>

                      <h4 className="font-black text-xs text-slate-900 mt-3 line-clamp-1">
                        {p.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-1 truncate">{p.address}</p>

                      <div className="mt-3.5 space-y-1.5 bg-white/60 p-2.5 rounded-xl border border-slate-200/40 text-[10px]">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-medium">Inquilino:</span>
                          {associatedTenant ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onViewTenantLedger) onViewTenantLedger(associatedTenant.id);
                              }}
                              className="font-extrabold text-indigo-600 hover:text-indigo-800 underline truncate max-w-[120px] text-right cursor-pointer"
                              title="Visualizza estratto conto inquilino"
                            >
                              {associatedTenant.name}
                            </button>
                          ) : (
                            <span className="font-extrabold text-slate-400">Associazione mancante</span>
                          )}
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-medium">Contratto:</span>
                          {activeContract ? (
                            <span className="font-extrabold text-emerald-600 bg-emerald-100/50 px-1.5 py-0.5 rounded text-[9px]">
                              Attivo
                            </span>
                          ) : (
                            <span className="font-extrabold text-red-600 bg-red-100/50 px-1.5 py-0.5 rounded text-[9px]">
                              Nessuno
                            </span>
                          )}
                        </div>

                        <div className="flex justify-between items-center pt-1 border-t border-slate-200/30">
                          <span className="text-slate-400 font-medium">Regime:</span>
                          <span className={`font-semibold text-[9px] px-1.5 py-0.5 rounded ${p.isBareOwnership ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                            {p.isBareOwnership ? "Nuda Proprietà" : "Piena Proprietà"}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-medium">Condominio:</span>
                          <span className={`font-semibold text-[9px] px-1.5 py-0.5 rounded truncate max-w-[90px] ${p.isCondoConstituted ? "bg-indigo-100 text-indigo-800" : "bg-rose-100 text-rose-800"}`}>
                            {p.isCondoConstituted ? "Costituito" : "Non Costituito / Assente"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/40 pt-3 flex items-center justify-between mt-auto">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Canone Mensile</span>
                        <span className="text-xs font-black text-slate-950">
                          {activeContract ? `€${activeContract.rentAmount.toLocaleString("it-IT")}` : "N/D"}
                        </span>
                      </div>
                      <span className="text-[8px] font-bold bg-white px-2 py-1 rounded-md border border-slate-200 text-slate-500 uppercase">
                        {p.type}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- SELECTED PROPERTY DETAIL MODAL (LANDLORD & PAYMENTS DASHBOARD) --- */}
      {selectedProperty && propertyModalData && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-5 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-150">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="font-sans font-black text-slate-900 text-base leading-tight">
                    {selectedProperty.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center">
                    <MapPin size={12} className="mr-1 text-slate-400 shrink-0" />
                    <span>{selectedProperty.address}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedProperty(null)}
                className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
              
              {/* PROPERTY & REGIME SUMMARY SECTION */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Proprietà Box */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center">
                    <User size={10} className="mr-1" /> Proprietario Catastale
                  </span>
                  <h4 className="text-sm font-black text-slate-900 mt-1 truncate">
                    {selectedProperty.owner || "Non Specificato"}
                  </h4>
                  {selectedOwner?.isCompound && (
                    <p className="text-[10px] text-slate-500 mt-1 italic">
                      Comproprietà attiva con altri proprietari.
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500 mt-1">
                    Tipologia: <strong className="text-slate-700">{selectedProperty.type}</strong>
                  </p>
                </div>

                {/* Regime Box */}
                <div className={`p-4 rounded-xl border ${
                  selectedProperty.isBareOwnership
                    ? "bg-amber-50/60 border-amber-200/50"
                    : "bg-emerald-50/60 border-emerald-200/50"
                }`}>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center">
                    <Coins size={10} className="mr-1" /> Regime di Possesso
                  </span>
                  <h4 className="text-sm font-black text-slate-900 mt-1 flex items-center space-x-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${selectedProperty.isBareOwnership ? "bg-amber-600" : "bg-emerald-600"}`} />
                    <span>{selectedProperty.isBareOwnership ? "Nuda Proprietà" : "Piena Proprietà"}</span>
                  </h4>
                  <p className="text-[10px] text-slate-600 mt-1.5 leading-snug">
                    {selectedProperty.isBareOwnership
                      ? "In questo regime, l'amministrazione ordinaria o usufruttuario gestisce le canoniche spese. Imposte di registro ordinarie escluse."
                      : "Regime ordinario in Piena Proprietà. Spese ordinarie e imposte di registro interamente a carico dell'amministratore/proprietario."
                    }
                  </p>
                </div>

                {/* Condominio Box */}
                <div className={`p-4 rounded-xl border ${
                  selectedProperty.isCondoConstituted
                    ? "bg-indigo-50/60 border-indigo-200/50"
                    : "bg-rose-50/60 border-rose-200/50"
                }`}>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center">
                    <Home size={10} className="mr-1" /> Regime Condominiale
                  </span>
                  <h4 className="text-sm font-black text-slate-900 mt-1 truncate flex items-center gap-1.5">
                    {selectedProperty.isCondoConstituted ? (
                      <><Building2 size={14} className="text-indigo-700 shrink-0" /> Condominio Costituito</>
                    ) : (
                      <><AlertTriangle size={14} className="text-rose-600 shrink-0" /> Condominio Assente</>
                    )}
                  </h4>
                  <p className="text-[10px] text-slate-600 mt-1.5 leading-snug">
                    {selectedProperty.isCondoConstituted && propertyModalData.condo ? (
                      <span>
                        Gestito da: <strong>{propertyModalData.condo.administrator || "N/A"}</strong>
                        {propertyModalData.condo.phone && ` (Tel: ${propertyModalData.condo.phone})`}
                      </span>
                    ) : selectedProperty.isCondoConstituted ? (
                      <span>Condominio costituito ma nessun amministratore registrato nel sistema.</span>
                    ) : (
                      <span>Condominio assente. Se locato, si fa riferimento al solo condominio (Sole Condominium) o gestione diretta.</span>
                    )}
                  </p>
                </div>

              </div>

              {/* TENANT & CONTRACT ACTIVE BLOCK (if rented) */}
              <div className="bg-indigo-50/30 rounded-xl p-4 border border-indigo-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-indigo-600 text-white p-2 rounded-lg text-xs font-black shrink-0">
                    {selectedProperty.status === "Rented" ? "LOCATO" : "LIBERO"}
                  </div>
                  <div>
                    {selectedProperty.status === "Rented" && propertyModalData.tenant ? (
                      <>
                        <h5 className="text-xs font-bold text-slate-900">
                          Inquilino Attivo: <span className="text-indigo-600 font-black">{propertyModalData.tenant.name}</span>
                        </h5>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          E-mail: {propertyModalData.tenant.email} {propertyModalData.tenant.phone && `• Tel: ${propertyModalData.tenant.phone}`}
                        </p>
                      </>
                    ) : (
                      <>
                        <h5 className="text-xs font-bold text-slate-900">Nessun Inquilino Attivo</h5>
                        <p className="text-[10px] text-slate-500 mt-0.5">L'immobile è attualmente disponibile per la locazione o in manutenzione.</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  {selectedProperty.status === "Rented" && propertyModalData.tenant ? (
                    onViewTenantLedger && (
                      <button
                        onClick={() => {
                          onViewTenantLedger(propertyModalData.tenant!.id);
                          setSelectedProperty(null);
                        }}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold rounded-lg shadow-2xs hover:shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                        id="btn-view-tenant-position"
                      >
                        <Search size={12} />
                        <span>Vedi posizione inquilino</span>
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => {
                        setCurrentSection("contracts");
                        setSelectedProperty(null);
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold rounded-lg shadow-2xs hover:shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                      id="btn-rent-property"
                    >
                      <Coins size={12} />
                      <span>Loca Immobile</span>
                    </button>
                  )}

                  {propertyModalData.activeContract && (
                    <div className="bg-white px-3.5 py-2 rounded-lg border border-slate-200 text-right">
                      <span className="text-[8px] uppercase tracking-wider font-bold text-slate-400 block">Canone Locazione</span>
                      <span className="text-sm font-black text-slate-900">
                        €{propertyModalData.activeContract.rentAmount.toLocaleString("it-IT")}/mese
                      </span>
                      <span className="text-[9px] text-slate-400 block font-mono">
                        Scad. {new Date(propertyModalData.activeContract.endDate).toLocaleDateString("it-IT")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* PAYMENTS LEDGER WORKBENCH */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2">
                  <h4 className="font-sans font-black text-slate-900 text-sm flex items-center space-x-1">
                    <Coins size={16} className="text-indigo-600" />
                    <span>Mastrino dei Pagamenti Perfezionati & Scadenze Contabili</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">Raggruppato per tipologia contabile</span>
                    <LedgerExportToolbar
                      title={`Mastrino Proprietario — ${selectedProperty.name}`}
                      subtitle={`${selectedProperty.address} — Proprietario: ${selectedProperty.owner || "N/D"}`}
                      columns={ownerLedgerExportColumns}
                      rows={ownerLedgerExportRows}
                      totalsRow={{
                        category: "TOTALE",
                        amount: `€${(propertyModalData.grandTotalPending + propertyModalData.grandTotalPaid).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`
                      }}
                      filenameBase={`mastrino-proprietario-${selectedProperty.name}`}
                    />
                  </div>
                </div>

                  {/* CORREZIONE AY — Invio del conteggio ai Comproprietari, via Resend (con
                    allegato/formattazione reale, mai EmailJS che è riservato ai Solleciti) */}
                {(() => {
                  const realOwnerRecord = owners.find(o => o.name === selectedProperty?.owner);
                  const coOwnersToNotify = realOwnerRecord?.coOwners || [];
                  if (coOwnersToNotify.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {coOwnersToNotify.map((co, idx) => (
                        <button
                          key={idx}
                          disabled={sendingCountToCoOwner === co.name}
                          onClick={() => handleSendCountToCoOwner(co, realOwnerRecord!)}
                          className="text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-2.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5"
                        >
                          <span className="w-[14px] h-[14px] rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <Mail size={9} className="text-white" />
                          </span>
                          {sendingCountToCoOwner === co.name ? "Invio in corso..." : `Invia Conteggio a ${co.name}`}
                        </button>
                      ))}
                    </div>
                  );
                })()}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
                    <span className="text-[9px] uppercase font-black text-rose-500 tracking-wider block">Totale da Incassare</span>
                    <span className="text-lg font-black text-rose-700 font-mono">
                      €{propertyModalData.grandTotalPending.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <span className="text-[9px] uppercase font-black text-emerald-600 tracking-wider block">Totale Già Incassato</span>
                    <span className="text-lg font-black text-emerald-700 font-mono">
                      €{propertyModalData.grandTotalPaid.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                    <span className="text-[9px] uppercase font-black text-indigo-600 tracking-wider block">
                      Di cui, Canone — quanto deve l'Inquilino
                    </span>
                    <span className="text-lg font-black text-indigo-700 font-mono">
                      €{propertyModalData.totals.rent.pending.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Ledger sections — Fase 2 punto 2: menu a tendina multi-selezione stile Excel */}
                <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-50 rounded-xl">
                  <MultiSelectFilterDropdown
                    label="Sezioni"
                    options={[
                      { value: "rent", label: "Canoni", count: propertyModalData.rentPayments.length },
                      { value: "condo", label: "Condominio", count: propertyModalData.condoPayments.length },
                      { value: "taxes", label: "Registro", count: propertyModalData.taxPayments.length },
                      { value: "maintenance", label: "Manutenzioni", count: propertyModalData.ownerMaintenance.length },
                      { value: "other", label: "Altro", count: propertyModalData.otherPayments.length }
                    ]}
                    selected={activeLedgerTabs}
                    onChange={setActiveLedgerTabs}
                  />
                </div>

                {/* Tab Content Tables */}
                <div className="bg-white rounded-xl border border-slate-150 overflow-hidden shadow-2xs">
                  
                  {/* TAB 1: RENT PAYMENTS */}
                  {activeLedgerTabs.includes("rent") && (
                    <div className="overflow-x-auto">
                      {propertyModalData.rentPayments.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          <Coins size={24} className="mx-auto text-slate-300 mb-2" />
                          Nessun pagamento o scadenza di canone affitto registrata per questo immobile.
                        </div>
                      ) : (
                        <table className="w-full text-left border-collapse border border-slate-300 text-xs font-mono">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 uppercase tracking-wider font-extrabold text-[9px] border border-slate-300">
                              <th className="p-3 border border-slate-300">Data Competenza</th>
                              <th className="p-3 border border-slate-300">Data Cassa</th>
                              <th className="p-3 border border-slate-300">Descrizione Voce</th>
                              <th className="p-3 border border-slate-300">Importo</th>
                              <th className="p-3 border border-slate-300">Stato</th>
                              <th className="p-3 border border-slate-300">Tracciamento / Nota</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {propertyModalData.rentPayments.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3 border border-slate-300 font-mono font-bold text-slate-700">
                                  {formatMonthYear(item.dueDate)}
                                </td>
                                <td className="p-3 border border-slate-300 font-mono text-slate-600">
                                  {item.paymentDate !== "-" && item.paymentDate !== "Pendente" ? (
                                    <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-150 text-[10px]">
                                      {formatMonthYear(item.paymentDate)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Non Incassato</span>
                                  )}
                                </td>
                                <td className="p-3 border border-slate-300 font-semibold text-slate-800">
                                  {item.description} {item.isManualBacklogEntry && <ManualBacklogBadge className="ml-1 align-middle" />}
                                  {item.notes && <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{item.notes}</span>}
                                </td>
                                <td className="p-3 border border-slate-300 font-black text-slate-900">
                                  €{item.amount.toLocaleString("it-IT")}
                                </td>
                                <td className="p-3 border border-slate-300">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                                    item.status === "Paid"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-150"
                                      : item.status === "Overdue"
                                      ? "bg-rose-50 text-rose-700 border border-rose-150 animate-pulse"
                                      : "bg-amber-50 text-amber-700 border border-amber-150"
                                  }`}>
                                    {item.status === "Paid" ? "Saldato" : item.status === "Overdue" ? "Insoluto" : "Pendente"}
                                  </span>
                                </td>
                                <td className="p-3 border border-slate-300 font-semibold text-slate-500">
                                  {renderLedgerTypeLabel(item.type)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* TAB 2: CONDO PAYMENTS */}
                  {activeLedgerTabs.includes("condo") && (
                    <div className="overflow-x-auto">
                      {!selectedProperty.isCondoConstituted ? (
                        <div className="p-8 text-center bg-rose-50/10 text-rose-800 text-xs border border-dashed border-rose-100 rounded-xl m-4">
                          <AlertTriangle size={24} className="mx-auto text-rose-400 mb-2" />
                          <strong>Condominio Assente / Non Costituito:</strong> Questo immobile non è vincolato ad un condominio formale.
                          <p className="text-[10px] text-slate-500 mt-1">
                            Se l'immobile è locato, le spese condominiali ordinarie non vengono riscosse o sono incluse direttamente nel canone.
                          </p>
                        </div>
                      ) : propertyModalData.condoPayments.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          <Home size={24} className="mx-auto text-slate-300 mb-2" />
                          Nessun pagamento di rate condominiali registrato per questo immobile.
                        </div>
                      ) : (
                        <div>
                          {selectedProperty.status !== "Rented" ? (
                            <div className="m-3 p-3 bg-amber-50/60 border border-amber-200/50 text-amber-950 rounded-xl text-[11px] font-semibold flex items-center gap-2">
                              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                              <span><strong>Immobile sfitto:</strong> Tutte le spese condominiali qui elencate sono addebitate al 100% al proprietario <strong>{selectedProperty.owner}</strong>.</span>
                            </div>
                          ) : (
                            <div className="m-3 p-3 bg-indigo-50/60 border border-indigo-200/50 text-indigo-950 rounded-xl text-[11px] font-semibold flex items-center gap-2">
                              <User size={14} className="text-indigo-700 shrink-0" />
                              <span><strong>Immobile locato:</strong> Il condominio è a carico della proprietà (competenza principale), salvo parziale rivalsa oneri accessori concordata con l'inquilino.</span>
                            </div>
                          )}
                          <table className="w-full text-left border-collapse border border-slate-300 text-xs font-mono">
                            <thead>
                              <tr className="bg-slate-100 text-slate-700 uppercase tracking-wider font-extrabold text-[9px] border border-slate-300">
                                <th className="p-3 border border-slate-300">Data Competenza</th>
                                <th className="p-3 border border-slate-300">Data Cassa</th>
                                <th className="p-3 border border-slate-300">Descrizione Voce</th>
                                <th className="p-3 border border-slate-300">Importo</th>
                                <th className="p-3 border border-slate-300">Stato</th>
                                <th className="p-3 border border-slate-300">Tracciamento / Nota</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {propertyModalData.condoPayments.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-3 border border-slate-300 font-mono font-bold text-slate-700">
                                    {new Date(item.dueDate).toLocaleDateString("it-IT")}
                                  </td>
                                  <td className="p-3 border border-slate-300 font-mono text-slate-600">
                                    {item.paymentDate !== "-" && item.paymentDate !== "Pendente" ? (
                                      <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-150 text-[10px]">
                                        {new Date(item.paymentDate).toLocaleDateString("it-IT")}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 italic text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Non Pagato</span>
                                    )}
                                  </td>
                                  <td className="p-3 border border-slate-300 font-semibold text-slate-800">
                                    {item.description} {item.isManualBacklogEntry && <ManualBacklogBadge className="ml-1 align-middle" />}
                                    {item.notes && <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{item.notes}</span>}
                                  </td>
                                  <td className="p-3 border border-slate-300 font-black text-slate-900">
                                    €{item.amount.toLocaleString("it-IT")}
                                  </td>
                                  <td className="p-3 border border-slate-300">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                                      item.status === "Paid"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-150"
                                        : item.status === "Overdue"
                                        ? "bg-rose-50 text-rose-700 border border-rose-150 animate-pulse"
                                        : "bg-amber-50 text-amber-700 border border-amber-150"
                                    }`}>
                                      {item.status === "Paid" ? "Saldato" : item.status === "Overdue" ? "Insoluto" : "Pendente"}
                                    </span>
                                  </td>
                                  <td className="p-3 border border-slate-300 font-semibold text-slate-500">
                                    {renderLedgerTypeLabel(item.type)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: REGISTRY TAXES */}
                  {activeLedgerTabs.includes("taxes") && (
                    <div className="overflow-x-auto">
                      {selectedProperty.isBareOwnership ? (
                        <div className="p-8 text-center bg-amber-50/20 text-amber-900 text-xs border border-dashed border-amber-200 rounded-xl m-4">
                          <Info size={24} className="mx-auto text-amber-500 mb-2" />
                          <strong>Regime Nuda Proprietà:</strong> Le imposte di registro ordinarie, l'F24 e i contratti ordinari non sono di competenza del nudo proprietario.
                          <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
                            Ai sensi del Codice Civile, i tributi inerenti il godimento dell'immobile (ordinaria amministrazione) spettano esclusivamente all'usufruttuario, sollevando la nuda proprietà da imposte ordinarie catastali e di locazione di questo tipo.
                          </p>
                        </div>
                      ) : propertyModalData.taxPayments.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          <FileText size={24} className="mx-auto text-slate-300 mb-2" />
                          Nessun versamento di Imposte di Registro o F24 censito per questa unità.
                        </div>
                      ) : (
                        <table className="w-full text-left border-collapse border border-slate-300 text-xs font-mono">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 uppercase tracking-wider font-extrabold text-[9px] border border-slate-300">
                              <th className="p-3 border border-slate-300">Data Competenza</th>
                              <th className="p-3 border border-slate-300">Data Cassa</th>
                              <th className="p-3 border border-slate-300">Descrizione Voce</th>
                              <th className="p-3 border border-slate-300">Importo</th>
                              <th className="p-3 border border-slate-300">Stato</th>
                              <th className="p-3 border border-slate-300">Tracciamento / Nota</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {propertyModalData.taxPayments.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3 border border-slate-300 font-mono font-bold text-slate-700">
                                  {new Date(item.dueDate).toLocaleDateString("it-IT")}
                                </td>
                                <td className="p-3 border border-slate-300 font-mono text-slate-600">
                                  {item.paymentDate !== "-" && item.paymentDate !== "Pendente" ? (
                                    <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-150 text-[10px]">
                                      {new Date(item.paymentDate).toLocaleDateString("it-IT")}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Non Versato</span>
                                  )}
                                </td>
                                <td className="p-3 border border-slate-300 font-semibold text-slate-800">
                                  {item.description} {item.isManualBacklogEntry && <ManualBacklogBadge className="ml-1 align-middle" />}
                                  {item.notes && <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{item.notes}</span>}
                                </td>
                                <td className="p-3 border border-slate-300 font-black text-slate-900">
                                  €{item.amount.toLocaleString("it-IT")}
                                </td>
                                <td className="p-3 border border-slate-300">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                                    item.status === "Paid"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-150"
                                      : "bg-amber-50 text-amber-700 border border-amber-150"
                                  }`}>
                                    {item.status === "Paid" ? "Versato" : "In attesa"}
                                  </span>
                                </td>
                                <td className="p-3 border border-slate-300 font-semibold text-slate-500">
                                  {renderLedgerTypeLabel(item.type)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* TAB 4: OTHER / RESIDUAL */}
                  {activeLedgerTabs.includes("other") && (
                    <div className="overflow-x-auto">
                      {propertyModalData.otherPayments.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          <CheckCircle2 size={24} className="mx-auto text-slate-300 mb-2" />
                          Nessun altro movimento straordinario o residui di pagamento parziale registrati.
                        </div>
                      ) : (
                        <table className="w-full text-left border-collapse border border-slate-300 text-xs font-mono">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 uppercase tracking-wider font-extrabold text-[9px] border border-slate-300">
                              <th className="p-3 border border-slate-300">Data Competenza</th>
                              <th className="p-3 border border-slate-300">Data Cassa</th>
                              <th className="p-3 border border-slate-300">Descrizione Voce</th>
                              <th className="p-3 border border-slate-300">Importo</th>
                              <th className="p-3 border border-slate-300">Stato</th>
                              <th className="p-3 border border-slate-300">Tracciamento / Nota</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {propertyModalData.otherPayments.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3 border border-slate-300 font-mono font-bold text-slate-700">
                                  {new Date(item.dueDate).toLocaleDateString("it-IT")}
                                </td>
                                <td className="p-3 border border-slate-300 font-mono text-slate-600">
                                  {item.paymentDate !== "-" && item.paymentDate !== "Pendente" ? (
                                    <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-150 text-[10px]">
                                      {new Date(item.paymentDate).toLocaleDateString("it-IT")}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Non Saldato</span>
                                  )}
                                </td>
                                <td className="p-3 border border-slate-300 font-semibold text-slate-800">
                                  {item.description} {item.isManualBacklogEntry && <ManualBacklogBadge className="ml-1 align-middle" />}
                                  {item.notes && <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{item.notes}</span>}
                                </td>
                                <td className="p-3 border border-slate-300 font-black text-slate-900">
                                  €{item.amount.toLocaleString("it-IT")}
                                </td>
                                <td className="p-3 border border-slate-300">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                                    item.status === "Paid"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-150"
                                      : "bg-rose-50 text-rose-700 border border-rose-150 animate-pulse"
                                  }`}>
                                    {item.status === "Paid" ? "Riconciliato" : "Pendente (Residuo Parziale)"}
                                  </span>
                                </td>
                                <td className="p-3 border border-slate-300 font-semibold text-slate-500">
                                  {renderLedgerTypeLabel(item.type)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* TAB 5: OWNER MAINTENANCE EXPENSES */}
                  {activeLedgerTabs.includes("maintenance") && (
                    <div className="overflow-x-auto">
                      {propertyModalData.ownerMaintenance.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          <CheckCircle2 size={24} className="mx-auto text-slate-300 mb-2" />
                          Nessuna spesa di manutenzione registrata a carico della proprietà per questo immobile.
                        </div>
                      ) : (
                        <div>
                          {selectedProperty.status !== "Rented" && (
                            <div className="m-3 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px] font-semibold">
                              <strong>L'immobile è sfitto:</strong> Di conseguenza, tutti gli interventi di manutenzione registrati sono caricati a totale carico della proprietà <strong>{selectedProperty.owner}</strong>.
                            </div>
                          )}
                          <table className="w-full text-left border-collapse border border-slate-300 text-xs font-mono">
                            <thead>
                              <tr className="bg-slate-100 text-slate-700 uppercase tracking-wider font-extrabold text-[9px] border border-slate-300">
                                <th className="p-3 border border-slate-300">Data Intervento</th>
                                <th className="p-3 border border-slate-300">Stato Ticket</th>
                                <th className="p-3 border border-slate-300">Dettagli Guasto</th>
                                <th className="p-3 border border-slate-300">Impresa / Tecnico</th>
                                <th className="p-3 border border-slate-300">Quota Proprietario</th>
                                <th className="p-3 border border-slate-300">Ripartizione</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {propertyModalData.ownerMaintenance.map((item: any, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-3 border border-slate-300 font-mono font-bold text-slate-700">
                                    {item.date ? new Date(item.date).toLocaleDateString("it-IT") : new Date(item.createdAt).toLocaleDateString("it-IT")}
                                  </td>
                                  <td className="p-3 border border-slate-300">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                                      item.status === "Completed"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-150"
                                        : item.status === "Cancelled"
                                        ? "bg-slate-50 text-slate-500 border border-slate-150"
                                        : "bg-amber-50 text-amber-700 border border-amber-150"
                                    }`}>
                                      {item.status === "Completed" ? "Risolto" : item.status === "Cancelled" ? "Annullato" : "In Corso"}
                                    </span>
                                  </td>
                                  <td className="p-3 border border-slate-300 font-semibold text-slate-800">
                                    <span className="font-extrabold">{item.title}</span>
                                    {item.description && <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{item.description}</span>}
                                  </td>
                                  <td className="p-3 border border-slate-300 font-semibold text-slate-600">
                                    {item.contractor || "N/A"}
                                  </td>
                                  <td className="p-3 border border-slate-300 font-black text-rose-600">
                                    €{(item.cost || 0).toLocaleString("it-IT")}
                                    {item.ownerPct < 100 && (
                                      <span className="block text-[9px] text-slate-400 font-normal normal-case mt-0.5">
                                        di €{item.totalCost.toLocaleString("it-IT")} totali
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 border border-slate-300">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                      selectedProperty.status !== "Rented"
                                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                                        : "bg-indigo-100 text-indigo-800 border border-indigo-250"
                                    }`}>
                                      <Briefcase size={9} className="shrink-0" />
                                      {selectedProperty.status !== "Rented" ? `Sfitto: ${item.ownerPct}% Proprietario` : `${item.ownerPct}% Proprietario`}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* CORREZIONE (14/08/2026 notte) — sezione informativa per le rate con
                    scadenza futura (canoni, condominio, registro, altro) escluse dal saldo
                    "Totale da Incassare" sopra ma comunque consultabili, stesso pattern già
                    applicato al mastrino inquilino in TenantsView.tsx. */}
                {propertyModalData.totalFutureCount > 0 && (
                  <div className="mt-3 border border-dashed border-slate-300 rounded-xl bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Rate Future non ancora Scadute (informativo — escluse dal saldo)
                      </span>
                      <span className="text-xs font-mono font-black text-slate-500">
                        €{propertyModalData.totalFutureAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse border border-slate-200 text-[11px] font-mono">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 uppercase tracking-wider font-extrabold text-[9px] border border-slate-200">
                            <th className="p-2 border border-slate-200">Scadenza</th>
                            <th className="p-2 border border-slate-200">Categoria</th>
                            <th className="p-2 border border-slate-200">Voce</th>
                            <th className="p-2 border border-slate-200">Importo</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {[
                            ...propertyModalData.rentFuture.map((r: any) => ({ ...r, category: "Canoni" })),
                            ...propertyModalData.condoFuture.map((r: any) => ({ ...r, category: "Condominio" })),
                            ...propertyModalData.taxFuture.map((r: any) => ({ ...r, category: "Registro" })),
                            ...propertyModalData.otherFuture.map((r: any) => ({ ...r, category: "Altro" }))
                          ]
                            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                            .map((item: any, idx: number) => (
                              <tr key={idx} className="text-slate-500">
                                <td className="p-2 border border-slate-200 font-bold">
                                  {item.category === "Canoni" ? formatMonthYear(item.dueDate) : new Date(item.dueDate).toLocaleDateString("it-IT")}
                                </td>
                                <td className="p-2 border border-slate-200">{item.category}</td>
                                <td className="p-2 border border-slate-200">{item.description} {item.isManualBacklogEntry && <ManualBacklogBadge className="ml-1" />}</td>
                                <td className="p-2 border border-slate-200 font-bold">
                                  €{item.amount.toLocaleString("it-IT")}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => setSelectedProperty(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-5 py-2.5 rounded-xl active:transition-all"
              >
                Chiudi Scheda Immobile
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CORREZIONE U — Modulo Modifica/Crea Dati Anagrafici Reali del Proprietario */}
      {showOwnerEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-sans font-bold text-base">
                {existingRealOwnerId ? "Modifica Dati Proprietario" : "Completa Anagrafica Proprietario"}
              </h3>
              <button onClick={() => setShowOwnerEditModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {!existingRealOwnerId && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>"{editingRealOwnerName}" esiste finora solo come nome scritto sull'immobile, senza un'anagrafica reale collegata. Compilando e salvando qui, creerai il suo record reale (email, telefono, ecc.).</span>
                </p>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nome / Ragione Sociale *
                </label>
                <input
                  type="text"
                  value={ownerFormName}
                  onChange={(e) => setOwnerFormName(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Codice Fiscale / P.IVA *
                  </label>
                  <input
                    type="text"
                    value={ownerFormFiscalCode}
                    onChange={(e) => setOwnerFormFiscalCode(e.target.value.toUpperCase())}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Telefono *
                  </label>
                  <input
                    type="tel"
                    value={ownerFormPhone}
                    onChange={(e) => setOwnerFormPhone(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  value={ownerFormEmail}
                  onChange={(e) => setOwnerFormEmail(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Data di Nascita
                </label>
                <input
                  type="date"
                  value={ownerFormBirthDate}
                  onChange={(e) => setOwnerFormBirthDate(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Luogo di Nascita
                </label>
                <input
                  type="text"
                  placeholder="es. Prato (PO)"
                  value={ownerFormBirthPlace}
                  onChange={(e) => setOwnerFormBirthPlace(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Serve per la formula "nato/a a ___" nei contratti di locazione generati.</p>
              </div>
              <GenderToggle value={ownerFormGender} onChange={setOwnerFormGender} className="-mt-1" />
              <AddressFields value={ownerFormStructuredAddress} onChange={setOwnerFormStructuredAddress} />

              {/* CORREZIONE AJ — Comproprietari: stesso conto unico, ricerca smart tra i
                  proprietari già a sistema per evitare di ridigitare/duplicare i dati */}
              <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Comproprietari (facoltativo)
                </label>
                <p className="text-[10px] text-slate-400">
                  Il conto resta unico (obbligazione solidale): questi nominativi non creano un secondo proprietario, ma vengono raggiunti anche loro dalle comunicazioni.
                </p>

                {ownerFormCoOwners.map((co, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs">
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800">{co.name}</span>
                      {co.linkedOwnerId && (
                        <span className="ml-1.5 text-[9px] text-emerald-600 font-bold inline-flex items-center gap-1">
                          <Link2 size={10} className="shrink-0" />
                          collegato ad anagrafica esistente
                        </span>
                      )}
                      <div className="text-[10px] text-slate-400 truncate">
                        {[co.fiscalCode, co.phone, co.email].filter(Boolean).join(" · ") || "Nessun dato aggiuntivo"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOwnerFormCoOwners(prev => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-500 shrink-0 ml-2"
                      title="Rimuovi comproprietario"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                {!showAddCoOwnerPicker ? (
                  <button
                    type="button"
                    onClick={() => setShowAddCoOwnerPicker(true)}
                    className="w-full text-xs font-semibold text-indigo-600 hover:text-indigo-700 border border-dashed border-indigo-300 rounded-lg py-2"
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
                        {owners
                          .filter(o =>
                            o.id !== existingRealOwnerId /* non se stesso */ &&
                            o.name.toLowerCase().includes(coOwnerSearchTerm.toLowerCase().trim()) &&
                            !ownerFormCoOwners.some(co => co.linkedOwnerId === o.id)
                          )
                          .slice(0, 5)
                          .map(o => (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => {
                                setOwnerFormCoOwners(prev => [...prev, {
                                  name: o.name,
                                  fiscalCode: o.fiscalCode,
                                  phone: o.phone,
                                  email: o.email,
                                  linkedOwnerId: o.id
                                }]);
                                setShowAddCoOwnerPicker(false);
                                setCoOwnerSearchTerm("");
                              }}
                              className="w-full text-left text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg px-2.5 py-2 flex items-center gap-1.5"
                            >
                              <Link2 size={12} className="shrink-0" />
                              <strong>{o.name}</strong> <span className="text-[10px] text-emerald-600">— usa questa anagrafica già esistente</span>
                            </button>
                          ))
                        }
                        <button
                          type="button"
                          onClick={() => {
                            setOwnerFormCoOwners(prev => [...prev, { name: coOwnerSearchTerm.trim() }]);
                            setShowAddCoOwnerPicker(false);
                            setCoOwnerSearchTerm("");
                          }}
                          className="w-full text-left text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg px-2.5 py-2 flex items-center gap-1.5"
                        >
                          <Plus size={12} className="shrink-0" />
                          Crea nuovo nominativo "{coOwnerSearchTerm.trim()}" (non ancora a sistema)
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  IBAN (facoltativo)
                </label>
                <input
                  type="text"
                  value={ownerFormIban}
                  onChange={(e) => setOwnerFormIban(e.target.value.toUpperCase())}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 font-mono uppercase"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowOwnerEditModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSaveOwnerEdit}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm"
                >
                  Salva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

