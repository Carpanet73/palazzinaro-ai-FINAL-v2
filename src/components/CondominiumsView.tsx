
import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  Plus, Edit3, Trash2, Building, Calendar, UserCheck, 
  Sparkles, X, AlertCircle, Eye, Info, MapPin, User, 
  FileText, Upload, RefreshCw, CheckCircle2, ChevronRight,
  ShieldCheck, ShieldAlert, CreditCard, Receipt, FileUp, DollarSign
} from "lucide-react";
import { Condominium, CondoRate, Property, Tenant, FastClosingItem, Administrator } from "../types";

interface CondominiumsViewProps {
  condominiums: Condominium[];
  properties: Property[];
  tenants: Tenant[];
  fastClosing: FastClosingItem[];
  administrators?: Administrator[]; // CORREZIONE L
  onAddAdministrator?: (data: Omit<Administrator, "id" | "userId" | "createdAt">) => Promise<string | null>;
  onEditAdministrator?: (id: string, data: Partial<Administrator>) => Promise<void>;
  onDeleteAdministrator?: (id: string) => Promise<void>;
  onAddCondominium: (condo: Omit<Condominium, "id" | "userId" | "createdAt">) => Promise<void>;
  onEditCondominium: (id: string, condo: Partial<Condominium>) => Promise<void>;
  onDeleteCondominium: (id: string) => Promise<void>;
  onEditProperty?: (id: string, data: any) => Promise<void>; // CORREZIONE Q — drag&drop Immobile→Condominio
  onAddClosingItem: (item: Omit<FastClosingItem, "id" | "userId" | "createdAt">) => Promise<void>;
  setCurrentSection?: (section: any) => void;
  setSelectedTenantIdForLedger?: (id: string | null) => void;
  // CORREZIONE E — consente al tasto flottante globale di aprire QUESTA stessa procedura
  registerAddHandler?: (fn: () => void) => void;
}

// CORREZIONE L — Avatar "silhouette professionale" per gli Amministratori, in stile
// segnaposto profilo classico ma disegnato con i colori del design system dell'app
// (indigo/slate), non nero puro. Vettoriale (SVG): sempre nitido a ogni dimensione.
function PersonAvatarIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
      <circle cx="50" cy="36" r="19" />
      <path d="M50 58c-21 0-36 14-36 34v3a2 2 0 0 0 2 2h68a2 2 0 0 0 2-2v-3c0-20-15-34-36-34z" />
    </svg>
  );
}

export default function CondominiumsView({
  condominiums,
  properties,
  tenants,
  fastClosing,
  administrators = [],
  onAddAdministrator,
  onEditAdministrator,
  onDeleteAdministrator,
  onAddCondominium,
  onEditCondominium,
  onDeleteCondominium,
  onEditProperty,
  onAddClosingItem,
  setCurrentSection,
  setSelectedTenantIdForLedger,
  registerAddHandler
}: CondominiumsViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingCondo, setEditingCondo] = useState<Condominium | null>(null);

  // CORREZIONE L — Fase 1.5: Amministratori come vista principale della pagina
  const [viewMode, setViewMode] = useState<"administrators" | "condominiums">("administrators");

  // Form Fields for Condominium
  const [name, setName] = useState("");
  const [condoAddress, setCondoAddress] = useState(""); // CORREZIONE P
  const [administrator, setAdministrator] = useState("");
  const [administratorId, setAdministratorId] = useState(""); // CORREZIONE L
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  // CORREZIONE L — Fase 1: gestione Amministratori come entità reale
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Administrator | null>(null);
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  // AI assistant states
  const [showAiAssist, setShowAiAssist] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Physical documents mock database
  const [condoDocs, setCondoDocs] = useState<Record<string, Array<{ id: string, name: string, date: string, size: string, uploadedBy: string }>>>(() => {
    const saved = localStorage.getItem("condo_shared_documents");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading condo documents", e);
      }
    }
    return {
      "default_shared": [
        { id: "cdoc-1", name: "Verbale_Assemblea_Riscaldamento_2026.pdf", date: "2026-03-12", size: "1.4 MB", uploadedBy: "Amministratore" },
        { id: "cdoc-2", name: "Resoconto_Consuntivo_Spese_Comuni.pdf", date: "2026-05-18", size: "2.8 MB", uploadedBy: "Amministratore" }
      ]
    };
  });

  const saveCondoDocs = (newDocs: typeof condoDocs) => {
    setCondoDocs(newDocs);
    localStorage.setItem("condo_shared_documents", JSON.stringify(newDocs));
  };

  // Upload/Add expense fields for current selected property
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  // CORREZIONE N — propone di default il mese/anno corrente, calcolato da new Date()
  // (mai un valore fisso scritto), così l'utente vede subito un mese sensato precompilato
  const getDefaultDueMonth = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}-05`;
  };
  const [expenseDueDate, setExpenseDueDate] = useState(getDefaultDueMonth());
  const [expenseSplitTenant, setExpenseSplitTenant] = useState<number>(80); // Default 80% charged to tenant
  const [splitMethod, setSplitMethod] = useState<"percentage" | "nominal" | "millesimi">("percentage");
  const [fixedTenantAmount, setFixedTenantAmount] = useState<number>(0);

  // Ledger Query Interface State
  const [activeQueryTab, setActiveQueryTab] = useState<"tenant" | "owner" | "general">("tenant");

  // Document Upload Form fields
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedFileSender, setUploadedFileSender] = useState("Amministratore");

  // 1. Filter out properties with isCondoConstituted === true
  const constitutedProperties = useMemo(() => {
    return properties.filter(p => !!p.isCondoConstituted && !!p.condominiumId);
  }, [properties]);

  // CORREZIONE Q — Drag&Drop: immobili con "Condominio Costituito" attivato ma senza
  // ancora un condominio specifico collegato. Sono le card che si trascinano.
  const unassignedConstitutedProperties = useMemo(() => {
    return properties.filter(p => !!p.isCondoConstituted && !p.condominiumId);
  }, [properties]);

  const unassignedCondominiums = useMemo(() => {
    return condominiums.filter(c => !c.administratorId);
  }, [condominiums]);

  // ── CORREZIONE Q — Drag&Drop universale ──
  // Stesso identico meccanismo per Immobile→Condominio e Condominio→Amministratore:
  // trascina, conferma, breve animazione di unione, poi si crea davvero il collegamento.
  const [draggedItem, setDraggedItem] = useState<{ type: "property" | "condo"; id: string; name: string } | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);
  const [mergingIds, setMergingIds] = useState<{ from: string; to: string } | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<{ kind: "property-condo" | "condo-admin"; id: string; name: string } | null>(null);
  const [disconnectConfirmText, setDisconnectConfirmText] = useState("");

  const handleDragStartItem = (e: React.DragEvent, type: "property" | "condo", id: string, name: string) => {
    setDraggedItem({ type, id, name });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDropOnCondo = async (e: React.DragEvent, condo: Condominium) => {
    e.preventDefault();
    setDragOverTargetId(null);
    if (!draggedItem || draggedItem.type !== "property") return;
    const propId = draggedItem.id;
    const propName = draggedItem.name;
    setDraggedItem(null);

    const confirmed = confirm(`Vuoi collegare l'immobile "${propName}" al condominio "${condo.name}"?`);
    if (!confirmed) return;

    setMergingIds({ from: propId, to: condo.id });
    await onEditProperty?.(propId, { condominiumId: condo.id });
    setTimeout(() => setMergingIds(null), 700);
  };

  const handleDropOnAdmin = async (e: React.DragEvent, admin: Administrator) => {
    e.preventDefault();
    setDragOverTargetId(null);
    if (!draggedItem || draggedItem.type !== "condo") return;
    const condoId = draggedItem.id;
    const condoName = draggedItem.name;
    setDraggedItem(null);

    const confirmed = confirm(`Vuoi affidare il condominio "${condoName}" all'amministratore "${admin.name}"?`);
    if (!confirmed) return;

    setMergingIds({ from: condoId, to: admin.id });
    setTimeout(() => setMergingIds(null), 700);
    await onEditCondominium(condoId, { administratorId: admin.id, administrator: admin.name });
  };

  // Scioglimento relazione — conferma pesante: bisogna scrivere il nome per confermare
  const handleConfirmDisconnect = async () => {
    if (!disconnectTarget) return;
    if (disconnectConfirmText.trim().toLowerCase() !== disconnectTarget.name.trim().toLowerCase()) {
      alert("Il nome scritto non corrisponde. Scioglimento annullato per sicurezza.");
      return;
    }
    if (disconnectTarget.kind === "condo-admin") {
      await onEditCondominium(disconnectTarget.id, { administratorId: null });
    } else if (disconnectTarget.kind === "property-condo") {
      await onEditProperty?.(disconnectTarget.id, { condominiumId: null, isCondoConstituted: false });
    }
    setDisconnectTarget(null);
    setDisconnectConfirmText("");
  };

  // Selected relationship ID (defaults to first constituted property if present)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");

  const activeProperty = useMemo(() => {
    if (constitutedProperties.length === 0) return null;
    return constitutedProperties.find(p => p.id === selectedPropertyId) || constitutedProperties[0];
  }, [constitutedProperties, selectedPropertyId]);

  // Sync selectedPropertyId
  React.useEffect(() => {
    if (activeProperty && !selectedPropertyId) {
      setSelectedPropertyId(activeProperty.id);
    }
  }, [activeProperty, selectedPropertyId]);

  // Calculate matching details for activeProperty
  const activeCondo = useMemo(() => {
    if (!activeProperty) return null;
    return condominiums.find(c => c.id === activeProperty.condominiumId);
  }, [activeProperty, condominiums]);

  const activeTenant = useMemo(() => {
    if (!activeProperty) return null;
    return tenants.find(t => t.propertyId === activeProperty.id);
  }, [activeProperty, tenants]);

  // Calculate balances for each constituted property in real-time
  const propertyBalances = useMemo(() => {
    const balances: Record<string, {
      isRegular: boolean;
      tenantUnpaid: number;
      tenantPaid: number;
      ownerUnpaid: number;
      ownerPaid: number;
    }> = {};

    constitutedProperties.forEach(prop => {
      // Find all condo fastClosing items containing property name
      const propCondoItems = fastClosing.filter(item => {
        const isCondo = item.source === "condominium";
        const titleLower = (item.title || "").toLowerCase();
        const propNameLower = (prop.name || "").toLowerCase();
        return isCondo && titleLower.includes(propNameLower);
      });

      let tenantUnpaid = 0;
      let tenantPaid = 0;
      let ownerUnpaid = 0;
      let ownerPaid = 0;
      let hasOverdue = false;

      propCondoItems.forEach(item => {
        const titleLower = (item.title || "").toLowerCase();
        const isTenant = titleLower.includes("inquilino") || !titleLower.includes("proprietario");

        if (isTenant) {
          if (item.status === "Paid") {
            tenantPaid += item.amount;
          } else {
            tenantUnpaid += item.amount;
            if (item.status === "Overdue" || new Date(item.dueDate) < new Date()) {
              hasOverdue = true;
            }
          }
        } else {
          if (item.status === "Paid") {
            ownerPaid += item.amount;
          } else {
            ownerUnpaid += item.amount;
            if (item.status === "Overdue" || new Date(item.dueDate) < new Date()) {
              hasOverdue = true;
            }
          }
        }
      });

      balances[prop.id] = {
        isRegular: !hasOverdue,
        tenantUnpaid,
        tenantPaid,
        ownerUnpaid,
        ownerPaid
      };
    });

    return balances;
  }, [constitutedProperties, fastClosing]);

  // Handle open add condo modal
  const handleOpenAddModal = () => {
    setEditingCondo(null);
    setName("");
    setCondoAddress("");
    setAdministrator("");
    setAdministratorId("");
    setPhone("");
    setEmail("");
    setNotes("");
    setAiText("");
    setAiError("");
    setShowAiAssist(false);
    setShowModal(true);
  };

  // CORREZIONE E — espone questa stessa funzione al tasto flottante globale
  useEffect(() => {
    registerAddHandler?.(handleOpenAddModal);
  });

  // CORREZIONE O — Migrazione automatica amministratori "vecchio stile"
  // Un condominio creato prima della CORREZIONE L ha solo il nome scritto nel campo
  // legacy `administrator`, senza nessun collegamento reale (`administratorId`). Questo
  // lo rendeva invisibile nell'elenco Amministratori (che mostra solo entità reali) — un
  // vero problema: "se c'è l'elenco degli amministratori ci devono essere tutti". Qui si
  // promuove automaticamente ogni nome trovato a un Amministratore reale, riusando un
  // record già esistente con lo stesso nome se c'è (stessa logica anti-duplicato di sempre).
  // Evita che la stessa migrazione parta due volte in corsa (race condition) prima che
  // Firestore rispedisca indietro il dato aggiornato tramite il listener in tempo reale.
  const migratingCondoIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const needsMigration = condominiums.filter(
      c => !c.administratorId && (c.administrator || "").trim().length > 0 && !migratingCondoIdsRef.current.has(c.id)
    );
    if (needsMigration.length === 0 || !onAddAdministrator) return;

    (async () => {
      for (const condo of needsMigration) {
        migratingCondoIdsRef.current.add(condo.id);
        const cleanName = (condo.administrator || "").trim();
        const existing = administrators.find(a => a.name.toLowerCase().trim() === cleanName.toLowerCase());
        const adminId = existing
          ? existing.id
          : await onAddAdministrator({
              name: cleanName,
              phone: condo.phone || "",
              email: condo.email || "",
              notes: "Creato automaticamente: era il nome scritto nel condominio prima del collegamento reale."
            });
        if (adminId) {
          await onEditCondominium(condo.id, { administratorId: adminId });
        }
      }
    })();
  }, [condominiums, administrators, onAddAdministrator, onEditCondominium]);

  // CORREZIONE L — Fase 1: CRUD Amministratori
  const handleOpenAddAdminModal = () => {
    setEditingAdmin(null);
    setAdminName("");
    setAdminPhone("");
    setAdminEmail("");
    setAdminNotes("");
    setShowAdminModal(true);
  };

  const handleOpenEditAdminModal = (admin: Administrator) => {
    setEditingAdmin(admin);
    setAdminName(admin.name);
    setAdminPhone(admin.phone || "");
    setAdminEmail(admin.email || "");
    setAdminNotes(admin.notes || "");
    setShowAdminModal(true);
  };

  const handleSubmitAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim()) {
      alert("Il nome dell'amministratore è obbligatorio.");
      return;
    }
    const payload = {
      name: adminName.trim(),
      phone: adminPhone.trim(),
      email: adminEmail.trim(),
      notes: adminNotes.trim()
    };
    if (editingAdmin) {
      await onEditAdministrator?.(editingAdmin.id, payload);
    } else {
      await onAddAdministrator?.(payload);
    }
    setShowAdminModal(false);
  };

  const handleDeleteAdminClick = async (admin: Administrator) => {
    const managedCount = condominiums.filter(c => c.administratorId === admin.id).length;
    const warning = managedCount > 0
      ? `"${admin.name}" amministra attualmente ${managedCount} condomini/o. Eliminandolo, questi condomini resteranno senza amministratore collegato (potrai riassegnarlo in seguito).\n\nSei sicuro di voler eliminare "${admin.name}"?`
      : `Sei sicuro di voler eliminare l'amministratore "${admin.name}"?`;
    if (confirm(warning)) {
      await onDeleteAdministrator?.(admin.id);
    }
  };

  // Handle open edit condo modal
  const handleOpenEditModal = (condo: Condominium) => {
    setEditingCondo(condo);
    setName(condo.name);
    setCondoAddress(condo.address || "");
    setAdministrator(condo.administrator || "");
    setAdministratorId(condo.administratorId || "");
    setPhone(condo.phone || "");
    setEmail(condo.email || "");
    setNotes(condo.notes || "");
    setAiText("");
    setAiError("");
    setShowAiAssist(false);
    setShowModal(true);
  };

  // Extraction of details with AI OCR
  const handleExtractWithAi = async () => {
    if (!aiText.trim()) {
      setAiError("Incolla un bilancio preventivo, conteggio o verbale condominiale.");
      return;
    }

    setAiLoading(true);
    setAiError("");

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: aiText,
          context: "condominiums"
        })
      });

      const result = await response.json();
      if (result.success && result.data) {
        const extracted = result.data;
        if (extracted.name) setName(extracted.name);
        if (extracted.administrator) setAdministrator(extracted.administrator);
        if (extracted.phone) setPhone(extracted.phone);
        if (extracted.email) setEmail(extracted.email);
        if (extracted.notes) setNotes(extracted.notes);
        setShowAiAssist(false);
        setAiText("");
      } else {
        setAiError(result.error || "Impossibile completare l'estrazione.");
      }
    } catch (err: any) {
      setAiError("Errore di connessione: " + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Save/submit condominium
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Il nome del condominio è obbligatorio.");
      return;
    }

    // CORREZIONE L — se è stato selezionato un Amministratore reale, il nome mostrato
    // (campo legacy "administrator") si allinea sempre al suo record, non resta un testo
    // libero scollegato: evita che il mastrino/i badge mostrino un nome diverso da quello reale.
    const linkedAdminName = administratorId
      ? (administrators.find(a => a.id === administratorId)?.name || administrator)
      : administrator;

    const payload = {
      name,
      address: condoAddress,
      administrator: linkedAdminName,
      administratorId: administratorId || null,
      phone,
      email,
      notes
    };

    try {
      if (editingCondo) {
        await onEditCondominium(editingCondo.id, payload);
      } else {
        await onAddCondominium(payload);
      }
      setShowModal(false);
    } catch (err) {
      console.error("Error saving condominium", err);
    }
  };

  // Delete condominium
  const handleDeleteCondo = async (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questo condominio? Tutti i collegamenti agli immobili verranno interrotti.")) {
      try {
        await onDeleteCondominium(id);
      } catch (err) {
        console.error("Error deleting condominium", err);
      }
    }
  };

  // Submit and sync new expense with Fast Closing
  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProperty || !activeCondo) return;
    if (!expenseTitle.trim() || expenseAmount <= 0 || !expenseDueDate) {
      alert("Inserisci titolo, importo valido e scadenza.");
      return;
    }

    // CORREZIONE N — mai permettere di inserire una spesa in un Fast Closing già chiuso
    // (un mese passato). Controllo di sicurezza anche qui, non solo sul selettore,
    // nel caso il valore arrivi comunque (es. digitato a mano nel campo).
    const currentMonthStr = getDefaultDueMonth().slice(0, 7); // "YYYY-MM"
    const selectedMonthStr = expenseDueDate.slice(0, 7);
    if (selectedMonthStr < currentMonthStr) {
      alert(
        "⚠️ Mese già passato: non è possibile inserire una spesa in un Fast Closing già chiuso.\n\nScegli il mese corrente o un mese futuro."
      );
      return;
    }

    let amountTenant = 0;
    let amountOwner = 0;
    let tenantDesc = "";
    let ownerDesc = "";

    if (splitMethod === "percentage") {
      amountTenant = Number(((expenseAmount * expenseSplitTenant) / 100).toFixed(2));
      amountOwner = Number((expenseAmount - amountTenant).toFixed(2));
      tenantDesc = `Ripartizione spese a carico dell'Inquilino (${expenseSplitTenant}% di €${expenseAmount.toFixed(2)}). Condominio: ${activeCondo.name}`;
      ownerDesc = `Ripartizione spese a carico del Proprietario (${100 - expenseSplitTenant}% di €${expenseAmount.toFixed(2)}). Condominio: ${activeCondo.name}`;
    } else if (splitMethod === "nominal") {
      amountTenant = Number(fixedTenantAmount.toFixed(2));
      amountOwner = Number((expenseAmount - amountTenant).toFixed(2));
      tenantDesc = `Contributo fisso nominale a carico dell'Inquilino di €${amountTenant.toFixed(2)} (su spesa totale di €${expenseAmount.toFixed(2)}). Condominio: ${activeCondo.name}`;
      ownerDesc = `Quota residua a carico del Proprietario di €${amountOwner.toFixed(2)} (su spesa totale di €${expenseAmount.toFixed(2)}). Condominio: ${activeCondo.name}`;
    } else {
      // splitMethod === "millesimi"
      const propMillesimi = activeProperty.millesimi !== undefined ? activeProperty.millesimi : 120;
      const calculatedPropertyShare = (expenseAmount * propMillesimi) / 1000;
      amountTenant = Number(((calculatedPropertyShare * expenseSplitTenant) / 100).toFixed(2));
      amountOwner = Number((calculatedPropertyShare - amountTenant).toFixed(2));
      tenantDesc = `Ripartizione spese Condominiali basata su Tabella Millesimale (${propMillesimi}/1000 millesimi) pari a €${calculatedPropertyShare.toFixed(2)}: quota Inquilino (${expenseSplitTenant}%)`;
      ownerDesc = `Ripartizione spese Condominiali basata su Tabella Millesimale (${propMillesimi}/1000 millesimi) pari a €${calculatedPropertyShare.toFixed(2)}: quota Proprietario (${100 - expenseSplitTenant}%)`;
    }

    try {
      // 1. Add tenant share if applicable
      if (amountTenant > 0) {
        await onAddClosingItem({
          source: "condominium",
          sourceId: activeCondo.id,
          title: `[Spese Condominiali] Rata Inquilino: ${expenseTitle} - ${activeProperty.name}`,
          description: tenantDesc,
          amount: amountTenant,
          dueDate: expenseDueDate,
          status: "Pending"
        });
      }

      // 2. Add owner share if applicable
      if (amountOwner > 0) {
        await onAddClosingItem({
          source: "condominium",
          sourceId: activeCondo.id,
          title: `[Spese Condominiali] Rata Proprietario: ${expenseTitle} - ${activeProperty.name}`,
          description: ownerDesc,
          amount: amountOwner,
          dueDate: expenseDueDate,
          status: "Pending"
        });
      }

      setExpenseTitle("");
      setExpenseAmount(0);
      setExpenseDueDate(getDefaultDueMonth());
      setFixedTenantAmount(0);
      setSplitMethod("percentage");
      setShowAddExpense(false);
      alert("Rata inserita con successo! Le scadenze sono state sincronizzate nello scadenziario Fast Closing.");
    } catch (err) {
      console.error("Error adding expense split", err);
    }
  };

  // Document upload simulation
  const handleUploadDocSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProperty || !uploadedFileName.trim()) return;

    const pid = activeProperty.id;
    const current = condoDocs[pid] || [];
    const newDoc = {
      id: `cdoc-user-${Date.now()}`,
      name: uploadedFileName.endsWith(".pdf") ? uploadedFileName : `${uploadedFileName}.pdf`,
      date: new Date().toISOString().split("T")[0],
      size: "1.8 MB",
      uploadedBy: uploadedFileSender
    };

    saveCondoDocs({
      ...condoDocs,
      [pid]: [newDoc, ...current]
    });

    setUploadedFileName("");
    setShowUploadModal(false);
    alert("Verbale di assemblea / Rendiconto spese caricato e condiviso con successo!");
  };

  // Get active documents for activeProperty
  const activePropertyDocs = useMemo(() => {
    if (!activeProperty) return [];
    return condoDocs[activeProperty.id] || condoDocs["default_shared"] || [];
  }, [activeProperty, condoDocs]);

  // Compute specific ledger movements for the selected query tab in activeProperty
  const ledgerMovementsForTab = useMemo(() => {
    if (!activeProperty) return [];

    // Find all condo items for active property
    const items = fastClosing.filter(item => {
      const isCondo = item.source === "condominium";
      const titleLower = (item.title || "").toLowerCase();
      const propNameLower = (activeProperty.name || "").toLowerCase();
      return isCondo && titleLower.includes(propNameLower);
    });

    return items.filter(item => {
      const titleLower = (item.title || "").toLowerCase();
      if (activeQueryTab === "tenant") {
        return titleLower.includes("inquilino") || !titleLower.includes("proprietario");
      } else if (activeQueryTab === "owner") {
        return titleLower.includes("proprietario");
      }
      return true; // general shows all
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [activeProperty, fastClosing, activeQueryTab]);

  const totalLedgerSum = useMemo(() => {
    return ledgerMovementsForTab.reduce((acc, curr) => {
      if (curr.status === "Paid") {
        acc.paid += curr.amount;
      } else {
        acc.unpaid += curr.amount;
      }
      return acc;
    }, { paid: 0, unpaid: 0 });
  }, [ledgerMovementsForTab]);

  // CORREZIONE L — Fase 1.5: dati aggregati per la card di ogni amministratore
  // Soglia di allerta per il semaforo: sopra questa cifra di spese condominiali non
  // pagate (sommate su tutti i condomini gestiti), la card passa da verde a giallo/rosso.
  const ADMIN_DEBT_WARNING_THRESHOLD = 500;
  const ADMIN_DEBT_CRITICAL_THRESHOLD = 1500;

  const adminCardsData = useMemo(() => {
    return administrators.map(admin => {
      const managedCondos = condominiums.filter(c => c.administratorId === admin.id);
      const managedCondoIds = new Set(managedCondos.map(c => c.id));
      const managedProperties = properties.filter(p => p.condominiumId && managedCondoIds.has(p.condominiumId));
      const managedPropertyIds = new Set(managedProperties.map(p => p.id));

      const unpaidDebt = fastClosing
        .filter(fc =>
          fc.source === "condominium" &&
          (fc.status === "Pending" || fc.status === "Overdue") &&
          fc.propertyId && managedPropertyIds.has(fc.propertyId)
        )
        .reduce((sum, fc) => sum + fc.amount, 0);

      let semaforo: "green" | "yellow" | "red" = "green";
      if (unpaidDebt >= ADMIN_DEBT_CRITICAL_THRESHOLD) semaforo = "red";
      else if (unpaidDebt >= ADMIN_DEBT_WARNING_THRESHOLD) semaforo = "yellow";

      return {
        admin,
        managedCondos,
        managedProperties,
        unpaidDebt,
        semaforo
      };
    });
  }, [administrators, condominiums, properties, fastClosing]);

  return (
    <div className="space-y-6 animate-fadeIn" id="condominiums-view-container">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Relazioni Condominiali</h2>
          <p className="text-xs text-slate-500 mt-0.5">Associa immobili ad amministratori, ripartisci le spese e interroga i mastrini delle rate.</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors shadow-xs"
          >
            <Plus size={14} />
            <span>Crea Nuovo Condominio</span>
          </button>
        </div>
      </div>

      {/* CORREZIONE L — Selettore vista: Amministratori (predefinita) / Condomini & Immobili */}
      <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-slate-100 w-fit">
        <button
          onClick={() => setViewMode("administrators")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            viewMode === "administrators" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          👤 Amministratori
        </button>
        <button
          onClick={() => setViewMode("condominiums")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            viewMode === "condominiums" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          🏢 Condomini & Immobili
        </button>
      </div>

      {/* CORREZIONE L — Vista principale: griglia Amministratori */}
      {viewMode === "administrators" && (
        <div className="space-y-4">
          {unassignedCondominiums.length > 0 && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-3">
                🏢 Condomini da Assegnare — trascina su un Amministratore
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {unassignedCondominiums.map(c => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => handleDragStartItem(e, "condo", c.id, c.name)}
                    className={`px-3.5 py-2.5 bg-white border-2 border-dashed border-amber-300 rounded-xl text-xs font-bold text-slate-700 cursor-grab active:cursor-grabbing hover:border-amber-500 hover:shadow-sm transition-all ${
                      mergingIds?.from === c.id ? "animate-pulse scale-95 opacity-50" : ""
                    }`}
                  >
                    🏢 {c.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {administrators.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-lg mx-auto">
              <div className="bg-indigo-50 text-indigo-500 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4 border border-indigo-100 overflow-hidden">
                <PersonAvatarIcon className="w-10 h-10" />
              </div>
              <h3 className="font-bold text-slate-800 mb-1.5">Nessun amministratore creato</h3>
              <p className="text-xs text-slate-500 mb-4">Crea il primo amministratore per iniziare a collegarlo ai condomini.</p>
              <button
                onClick={handleOpenAddAdminModal}
                className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors shadow-xs"
              >
                <Plus size={14} />
                <span>Crea Amministratore</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {adminCardsData.map(({ admin, managedCondos, managedProperties, unpaidDebt, semaforo }) => (
                <div
                  key={admin.id}
                  className={`bg-white rounded-2xl border p-5 space-y-3.5 hover:shadow-sm transition-all cursor-pointer ${
                    dragOverTargetId === admin.id
                      ? "border-indigo-500 ring-2 ring-indigo-200 scale-[1.02]"
                      : "border-slate-100 hover:border-indigo-200"
                  } ${mergingIds?.to === admin.id ? "animate-pulse ring-2 ring-emerald-300" : ""}`}
                  onClick={() => handleOpenEditAdminModal(admin)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverTargetId(admin.id); }}
                  onDragLeave={() => setDragOverTargetId(null)}
                  onDrop={(e) => handleDropOnAdmin(e, admin)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="relative w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 overflow-hidden">
                        <PersonAvatarIcon className="w-9 h-9" />
                      </span>
                      <div>
                        <h4 className="font-black text-sm text-slate-900 leading-tight">{admin.name}</h4>
                        <span className="text-[10px] text-slate-400">
                          {managedCondos.length} condomini/o gestiti
                        </span>
                      </div>
                    </div>
                    <span
                      className={`w-3 h-3 rounded-full shrink-0 mt-1 ${
                        semaforo === "green" ? "bg-emerald-500" : semaforo === "yellow" ? "bg-amber-400" : "bg-rose-500 animate-pulse"
                      }`}
                      title={
                        semaforo === "green"
                          ? "Regolare"
                          : semaforo === "yellow"
                          ? `Attenzione: €${unpaidDebt.toFixed(2)} di spese condominiali non pagate`
                          : `Critico: €${unpaidDebt.toFixed(2)} di spese condominiali non pagate`
                      }
                    />
                  </div>

                  <div className="space-y-1.5 text-[11px] border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="text-slate-400">📞</span>
                      <span>{admin.phone || "Nessun telefono"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 truncate">
                      <span className="text-slate-400">✉️</span>
                      <span className="truncate">{admin.email || "Nessuna email"}</span>
                    </div>
                  </div>

                  {managedCondos.length > 0 && (
                    <div className="border-t border-slate-100 pt-3 space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Condomini Gestiti</span>
                      {managedCondos.slice(0, 3).map(c => (
                        <div key={c.id} className="flex items-center justify-between text-[10px] text-slate-700 group">
                          <span className="truncate">🏢 {c.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDisconnectTarget({ kind: "condo-admin", id: c.id, name: c.name });
                              setDisconnectConfirmText("");
                            }}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 shrink-0 ml-1.5 transition-opacity"
                            title="Sciogli collegamento con questo amministratore"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                      {managedCondos.length > 3 && (
                        <div className="text-[10px] text-slate-400">+ altri {managedCondos.length - 3}</div>
                      )}
                    </div>
                  )}

                  {managedProperties.length > 0 && (
                    <div className="text-[10px] text-slate-400">
                      🏠 {managedProperties.length} immobili collegati
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main split dashboard: Left relationship list, Right active relationship details */}
      {viewMode === "condominiums" && (
      <>
      {unassignedConstitutedProperties.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 mb-4">
          <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-3">
            🏠 Immobili da Collegare — trascina su un Condominio
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {unassignedConstitutedProperties.map(p => (
              <div
                key={p.id}
                draggable
                onDragStart={(e) => handleDragStartItem(e, "property", p.id, p.name)}
                className={`px-3.5 py-2.5 bg-white border-2 border-dashed border-amber-300 rounded-xl text-xs font-bold text-slate-700 cursor-grab active:cursor-grabbing hover:border-amber-500 hover:shadow-sm transition-all ${
                  mergingIds?.from === p.id ? "animate-pulse scale-95 opacity-50" : ""
                }`}
              >
                🏠 {p.name}
              </div>
            ))}
          </div>
        </div>
      )}
      {constitutedProperties.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-lg mx-auto">
          <div className="bg-slate-50 text-indigo-500 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4 border border-indigo-50/50">
            <Building size={28} />
          </div>
          <h3 className="font-sans font-bold text-slate-800 text-base">Nessun condominio costituito</h3>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Per visualizzare relazioni condominiali qui, apri l'<b>Anagrafica Immobili</b>, modifica un immobile e spunta l'opzione <b>"Condominio Costituito"</b> associandogli un condominio con amministratore.
          </p>
          <button
            onClick={() => setCurrentSection && setCurrentSection("properties")}
            className="mt-5 inline-flex items-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-4 py-2 rounded-lg text-xs transition-colors"
          >
            <span>Vai ad Anagrafica Immobili</span>
            <ChevronRight size={14} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left panel: List of relationships represented as badges */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Immobili con Condominio Attivo ({constitutedProperties.length})</h3>
              
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {constitutedProperties.map((prop) => {
                  const condo = condominiums.find(c => c.id === prop.condominiumId);
                  const isSelected = activeProperty?.id === prop.id;
                  const balance = propertyBalances[prop.id] || { isRegular: true, tenantUnpaid: 0, ownerUnpaid: 0 };

                  return (
                    <div
                      key={prop.id}
                      onClick={() => setSelectedPropertyId(prop.id)}
                      className={`w-full p-4 rounded-xl border text-left flex flex-col space-y-2.5 transition-all outline-hidden cursor-pointer relative group ${
                        isSelected 
                          ? "bg-indigo-50/45 border-indigo-200 ring-1 ring-indigo-200/30 shadow-xs" 
                          : "bg-slate-50/30 border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDisconnectTarget({ kind: "property-condo", id: prop.id, name: prop.name });
                          setDisconnectConfirmText("");
                        }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-opacity p-1"
                        title="Sciogli collegamento con questo condominio"
                      >
                        <X size={13} />
                      </button>
                      <div className="flex justify-between items-start gap-1">
                        <div>
                          <h4 className="font-sans font-extrabold text-xs text-slate-900 truncate max-w-[180px]">
                            🏠 {prop.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 mt-0.5 block truncate max-w-[170px]">
                            📍 {prop.address}
                          </span>
                        </div>
                        
                        {balance.isRegular ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-100/50 flex items-center gap-1">
                            <ShieldCheck size={10} />
                            Regolare
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1">
                            <ShieldAlert size={10} />
                            Arretrati
                          </span>
                        )}
                      </div>

                      <div className="bg-white/90 p-2.5 rounded-lg border border-slate-100/60 text-[10px] space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Condominio:</span>
                          <span className="font-semibold text-slate-700 truncate max-w-[120px]">
                            🏢 {condo?.name || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between font-mono pt-1 border-t border-slate-50">
                          <span className="text-slate-400">Debito Inquilino:</span>
                          <span className={`font-bold ${balance.tenantUnpaid > 0 ? "text-amber-600" : "text-slate-500"}`}>
                            €{balance.tenantUnpaid.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-400">Debito Proprietario:</span>
                          <span className={`font-bold ${balance.ownerUnpaid > 0 ? "text-rose-600" : "text-slate-500"}`}>
                            €{balance.ownerUnpaid.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CORREZIONE L — Fase 1: Amministratori come entità reale, con avatar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Amministratori ({administrators.length})
                </h3>
                <button
                  onClick={handleOpenAddAdminModal}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Plus size={12} />
                  Nuovo
                </button>
              </div>

              {administrators.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">
                  Nessun amministratore creato. Aggiungine uno per collegarlo ai condomini.
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {administrators.map(admin => {
                    const managedCount = condominiums.filter(c => c.administratorId === admin.id).length;
                    const initials = admin.name
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map(w => w[0]?.toUpperCase())
                      .join("");
                    return (
                      <button
                        key={admin.id}
                        onClick={() => handleOpenEditAdminModal(admin)}
                        className="flex flex-col items-center w-20 group"
                        title={`${admin.name} — ${managedCount} condomini/o gestiti`}
                      >
                        <span className="relative w-12 h-12 rounded-full bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-sm group-hover:bg-indigo-700 transition-colors">
                          {initials || "?"}
                          {managedCount > 0 && (
                            <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[8px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
                              {managedCount}
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-700 mt-1.5 truncate w-full text-center">
                          {admin.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* List of general administrators and basic contacts */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Censimento Condomini ({condominiums.length})</h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {condominiums.map(c => (
                  <div
                    key={c.id}
                    onDragOver={(e) => { e.preventDefault(); setDragOverTargetId(c.id); }}
                    onDragLeave={() => setDragOverTargetId(null)}
                    onDrop={(e) => handleDropOnCondo(e, c)}
                    className={`p-2.5 rounded-lg border flex justify-between items-center text-xs transition-all ${
                      dragOverTargetId === c.id
                        ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200 scale-[1.02]"
                        : "bg-slate-50 border-slate-100/50"
                    } ${mergingIds?.to === c.id ? "animate-pulse ring-2 ring-emerald-300" : ""}`}
                  >
                    <div>
                      <p className="font-bold text-slate-800">{c.name}</p>
                      <p className="text-[10px] text-slate-400">Amm: {c.administrator || "N/A"}</p>
                    </div>
                    <div className="flex space-x-1">
                      <button 
                        onClick={() => handleOpenEditModal(c)}
                        className="p-1 hover:text-indigo-600 hover:bg-white rounded transition-all"
                        title="Modifica anagrafica condominio"
                      >
                        <Edit3 size={11} />
                      </button>
                      <button 
                        onClick={() => handleDeleteCondo(c.id)}
                        className="p-1 hover:text-rose-600 hover:bg-white rounded transition-all"
                        title="Elimina"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel: Active Relationship Details */}
          <div className="lg:col-span-8 space-y-6">
            {activeProperty && activeCondo ? (
              <div className="space-y-6">
                
                {/* 1. RELATIONSHIP CARD / BADGE DETAILS */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-50 pb-3.5">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Fascicolo Condominiale Unico
                      </span>
                      <h3 className="text-base font-black text-slate-900 mt-1.5">Relazione Giuridica Attiva</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-mono text-slate-400 uppercase">Stato Relazione</p>
                      <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 mt-1 inline-block">
                        CONSTITUITO 🏢
                      </span>
                    </div>
                  </div>

                  {/* Badges pointing to different sectors */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Property Badge */}
                    <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 flex flex-col justify-between space-y-3 hover:border-slate-200 transition-all">
                      <div>
                        <div className="flex items-center space-x-1.5 text-indigo-600">
                          <Building size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Immobile Collegato</span>
                        </div>
                        <h4 className="font-extrabold text-xs text-slate-800 mt-2">{activeProperty.name}</h4>
                        <p className="text-[10px] text-slate-400 mt-1 truncate">{activeProperty.address}</p>
                      </div>
                      <button
                        onClick={() => setCurrentSection && setCurrentSection("properties")}
                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 text-left flex items-center space-x-1 mt-2"
                      >
                        <span>🏠 Dettagli Immobile</span>
                        <ChevronRight size={10} />
                      </button>
                    </div>

                    {/* Tenant / Condomino Badge */}
                    <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 flex flex-col justify-between space-y-3 hover:border-slate-200 transition-all">
                      <div>
                        <div className="flex items-center space-x-1.5 text-amber-600">
                          <User size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Condomino Inquilino</span>
                        </div>
                        {activeTenant ? (
                          <>
                            <h4 className="font-extrabold text-xs text-slate-800 mt-2">{activeTenant.name}</h4>
                            <p className="text-[10px] text-slate-400 mt-1 truncate">{activeTenant.email}</p>
                          </>
                        ) : (
                          <>
                            <h4 className="font-bold text-xs text-slate-400 mt-2">Nessun locatario attivo</h4>
                            <p className="text-[10px] text-slate-400 mt-1">Immobile attualmente libero.</p>
                          </>
                        )}
                      </div>
                      {activeTenant && (
                        <button
                          onClick={() => {
                            if (setSelectedTenantIdForLedger && setCurrentSection) {
                              setSelectedTenantIdForLedger(activeTenant.id);
                              setCurrentSection("tenants");
                            }
                          }}
                          className="text-[10px] font-black text-amber-600 hover:text-amber-800 text-left flex items-center space-x-1 mt-2"
                        >
                          <span>👤 Mastrino Inquilino</span>
                          <ChevronRight size={10} />
                        </button>
                      )}
                    </div>

                    {/* Admin Profile Badge */}
                    <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 flex flex-col justify-between space-y-3 hover:border-slate-200 transition-all">
                      <div>
                        <div className="flex items-center space-x-1.5 text-emerald-600">
                          <UserCheck size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Amministratore</span>
                        </div>
                        <h4 className="font-extrabold text-xs text-slate-800 mt-2 truncate">{activeCondo.administrator || "Non specificato"}</h4>
                        <p className="text-[10px] text-slate-400 mt-1 truncate">{activeCondo.email || "Email non presente"}</p>
                        {activeCondo.phone && <p className="text-[10px] text-slate-400">{activeCondo.phone}</p>}
                      </div>
                      <div className="text-[9px] text-slate-400 font-semibold italic mt-2">
                        Studio: {activeCondo.name}
                      </div>
                    </div>

                  </div>
                </div>

                {/* 2. PHYSICAL DOCUMENTATION / REPORTS */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-50 pb-2.5">
                    <div className="flex items-center space-x-2">
                      <FileText className="text-slate-500" size={18} />
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Fascicolo Documentale & Resoconti Spese</h4>
                    </div>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="inline-flex items-center space-x-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md text-[10px] font-bold text-slate-600 cursor-pointer"
                    >
                      <Upload size={12} />
                      <span>Condividi File</span>
                    </button>
                  </div>

                  {activePropertyDocs.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4 italic">Nessun documento inserito nel fascicolo condominiale.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activePropertyDocs.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="p-2 bg-white rounded-lg text-red-500 shadow-3xs shrink-0 font-bold font-mono text-[10px]">
                              PDF
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 truncate" title={doc.name}>{doc.name}</p>
                              <p className="text-[9px] text-slate-400 flex items-center space-x-1 mt-0.5">
                                <span>📅 {doc.date}</span>
                                <span>•</span>
                                <span>💾 {doc.size}</span>
                              </p>
                            </div>
                          </div>
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm bg-indigo-50 text-indigo-700">
                            {doc.uploadedBy || "Utente"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. CORE ACTIVITY: EXPENSE & RATE MANAGEMENT (AMMINISTRATORE ATTIVITÀ) */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-50 pb-2.5">
                    <div className="flex items-center space-x-2">
                      <Receipt className="text-slate-500" size={18} />
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Gestione Spese & Ripartizione Rata</h4>
                    </div>
                    <button
                      onClick={() => setShowAddExpense(!showAddExpense)}
                      className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer"
                    >
                      {showAddExpense ? "Nascondi Form" : "Ripartisci Nuova Spesa"}
                    </button>
                  </div>

                  {showAddExpense && (
                    <form onSubmit={handleAddExpenseSubmit} className="bg-slate-50/50 p-4 rounded-xl border border-indigo-100/30 space-y-4 animate-fadeIn">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                            Titolo Spesa / Rata *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Es: Riscaldamento Centralizzato 1° Rata"
                            value={expenseTitle}
                            onChange={(e) => setExpenseTitle(e.target.value)}
                            className="w-full text-xs border border-slate-200 bg-white rounded-lg px-2.5 py-2 outline-hidden focus:border-indigo-500 font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                            Importo Complessivo (€) *
                          </label>
                          <input
                            type="number"
                            required
                            step="0.01"
                            placeholder="200.00"
                            value={expenseAmount || ""}
                            onChange={(e) => setExpenseAmount(Number(e.target.value))}
                            className="w-full text-xs border border-slate-200 bg-white rounded-lg px-2.5 py-2 outline-hidden focus:border-indigo-500 font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                            Mese di Competenza (Fast Closing) *
                          </label>
                          <input
                            type="month"
                            required
                            min={getDefaultDueMonth().slice(0, 7)}
                            value={expenseDueDate ? expenseDueDate.slice(0, 7) : ""}
                            onChange={(e) => setExpenseDueDate(e.target.value ? `${e.target.value}-05` : "")}
                            className="w-full text-xs border border-slate-200 bg-white rounded-lg px-2.5 py-2 outline-hidden focus:border-indigo-500 font-mono"
                          />
                          <p className="text-[9px] text-slate-400 mt-1">
                            Solo Fast Closing correnti o futuri: un mese già passato non è selezionabile.
                          </p>
                        </div>
                        <div>
                          {/* Metodo di Ripartizione Toggles */}
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                            Metodo Ripartizione Spesa
                          </label>
                          <div className="flex space-x-1.5 p-1 bg-slate-100 border border-slate-250 rounded-lg">
                            <button
                              type="button"
                              onClick={() => setSplitMethod("percentage")}
                              className={`flex-1 py-1 rounded-md text-[10px] font-bold transition-all ${
                                splitMethod === "percentage"
                                  ? "bg-white text-slate-900 shadow-3xs border border-slate-200"
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              Percentuale (%)
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod("nominal")}
                              className={`flex-1 py-1 rounded-md text-[10px] font-bold transition-all ${
                                splitMethod === "nominal"
                                  ? "bg-white text-slate-900 shadow-3xs border border-slate-200"
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              Fisso Nominale (€)
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod("millesimi")}
                              className={`flex-1 py-1 rounded-md text-[10px] font-bold transition-all ${
                                splitMethod === "millesimi"
                                  ? "bg-white text-slate-900 shadow-3xs border border-slate-200"
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              Tabella Millesimale (Millesimi)
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-3xs space-y-3">
                        {splitMethod === "millesimi" && activeProperty && (
                          <div className="bg-indigo-50/50 p-2.5 rounded-lg text-[11px] text-indigo-950 border border-indigo-100">
                            <p className="font-black">Calcolo della quota millesimale reale:</p>
                            <p className="mt-1">
                              Importo Spesa Condominio Totale: <strong className="text-indigo-800">€{expenseAmount.toFixed(2)}</strong>
                            </p>
                            <p>
                              Millesimi Immobile: <strong className="text-indigo-800">{activeProperty.millesimi !== undefined ? activeProperty.millesimi : 120} / 1000</strong>
                            </p>
                            <p className="border-t border-indigo-100/65 mt-1.5 pt-1 font-bold">
                              Quota di Spesa di Spettanza Immobile (millesimi reali): <span className="text-indigo-700 text-xs">€{(expenseAmount * (activeProperty.millesimi !== undefined ? activeProperty.millesimi : 120) / 1000).toFixed(2)}</span>
                            </p>
                          </div>
                        )}

                        {splitMethod !== "nominal" ? (
                          <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex justify-between">
                              <span>Ripartizione Quota (%)</span>
                              <span className="font-extrabold text-indigo-600">{expenseSplitTenant}% Inquilino / {100 - expenseSplitTenant}% Proprietario</span>
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={expenseSplitTenant}
                              onChange={(e) => setExpenseSplitTenant(Number(e.target.value))}
                              className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex justify-between">
                              <span>Quota Fissa Inquilino (€) *</span>
                              <span className="font-extrabold text-indigo-600">Residuo Proprietario: €{Math.max(0, expenseAmount - fixedTenantAmount).toFixed(2)}</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              max={expenseAmount}
                              min="0"
                              value={fixedTenantAmount || ""}
                              onChange={(e) => setFixedTenantAmount(Math.min(expenseAmount, Number(e.target.value)))}
                              placeholder="Inserisci quota fissa in Euro..."
                              className="w-full text-xs border border-slate-200 bg-white rounded-lg px-2.5 py-2 outline-hidden focus:border-indigo-500 font-bold"
                            />
                          </div>
                        )}
                      </div>

                      {expenseAmount > 0 && activeProperty && (
                        <div className="grid grid-cols-2 gap-4 bg-white p-3 rounded-lg border border-slate-100 text-xs font-mono">
                          <div className="border-r border-slate-50">
                            <p className="text-[10px] text-slate-400 uppercase">Quota a carico INQUILINO</p>
                            <p className="text-sm font-extrabold text-amber-600 mt-1">
                              €{splitMethod === "percentage"
                                ? ((expenseAmount * expenseSplitTenant) / 100).toFixed(2)
                                : splitMethod === "nominal"
                                ? fixedTenantAmount.toFixed(2)
                                : (((expenseAmount * (activeProperty.millesimi !== undefined ? activeProperty.millesimi : 120)) / 1000) * expenseSplitTenant / 100).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase">Quota a carico PROPRIETARIO</p>
                            <p className="text-sm font-extrabold text-rose-600 mt-1">
                              €{splitMethod === "percentage"
                                ? (expenseAmount - (expenseAmount * expenseSplitTenant) / 100).toFixed(2)
                                : splitMethod === "nominal"
                                ? (expenseAmount - fixedTenantAmount).toFixed(2)
                                : (((expenseAmount * (activeProperty.millesimi !== undefined ? activeProperty.millesimi : 120)) / 1000) * (100 - expenseSplitTenant) / 100).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center space-x-1.5 shadow-xs cursor-pointer"
                        >
                          <CheckCircle2 size={13} />
                          <span>Ripartisci & Sincronizza Fast Closing</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Informative message about expense logic */}
                  <div className="p-3 bg-amber-50/55 border border-amber-100 rounded-xl flex items-start space-x-2.5 text-[11px] text-amber-800 leading-relaxed">
                    <Info size={14} className="shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-bold">Automazione Scadenziario Integrato</p>
                      <p className="mt-0.5">Le scadenze aggiunte ripartiscono il debito. Quando il <b>Fast Closing</b> viene riconciliato o saldato (Ricezione Bonifico), il mastrino aggiornerà istantaneamente i crediti/debiti.</p>
                    </div>
                  </div>
                </div>

                {/* 4. LEDGER QUERY INTERFACE (INTERROGATION INTERFACCIA MASTRINI) */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-3">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Interrogazione Mastrino Contabile</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Vedi ed esporta le singole posizioni contabili condominiali.</p>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-lg space-x-1 shrink-0">
                      {[
                        { id: "tenant", label: "Inquilino 👤" },
                        { id: "owner", label: "Proprietario 💼" },
                        { id: "general", label: "Generale 📂" }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveQueryTab(tab.id as any)}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                            activeQueryTab === tab.id 
                              ? "bg-white text-slate-900 shadow-3xs" 
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ledger Movements List */}
                  {ledgerMovementsForTab.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 italic text-xs">
                      Nessuna rata o quota registrata in questo mastrino.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse border border-slate-300 text-[11px] font-mono">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-extrabold text-[8.5px] uppercase border border-slate-300 font-mono tracking-wider">
                              <th className="py-1 px-2 border border-slate-300">Scadenza</th>
                              <th className="py-1 px-2 border border-slate-300">Causale Rata</th>
                              <th className="py-1 px-2 border border-slate-300 text-right">Quota</th>
                              <th className="py-1 px-2 border border-slate-300 text-right">Stato</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {ledgerMovementsForTab.map(move => {
                              const isPaid = move.status === "Paid";
                              return (
                                <tr key={move.id} className="text-slate-700 hover:bg-slate-50 transition-colors">
                                  <td className="py-1 px-2 border border-slate-300 font-mono text-[9.5px] text-slate-500">
                                    {new Date(move.dueDate).toLocaleDateString("it-IT")}
                                  </td>
                                  <td className="py-1 px-2 border border-slate-300 font-semibold text-slate-800">
                                    {move.title}
                                  </td>
                                  <td className="py-1 px-2 border border-slate-300 text-right font-black font-mono text-slate-900">
                                    €{move.amount.toFixed(2)}
                                  </td>
                                  <td className="py-1 px-2 border border-slate-300 text-right font-semibold">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] uppercase font-bold tracking-wide ${
                                      isPaid 
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                        : "bg-amber-50 text-amber-700 border border-amber-150"
                                    }`}>
                                      {isPaid ? "Saldato" : "In Sospeso"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Cumulative position card */}
                      <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                        <div className="space-y-1">
                          <p className="text-slate-400 uppercase text-[9px] font-mono">Riepilogo Totali</p>
                          <div className="flex space-x-4">
                            <span className="text-slate-600 font-semibold">Saldato: <strong className="text-emerald-600">€{totalLedgerSum.paid.toFixed(2)}</strong></span>
                            <span className="text-slate-600 font-semibold">In Sospeso: <strong className="text-rose-600">€{totalLedgerSum.unpaid.toFixed(2)}</strong></span>
                          </div>
                        </div>
                        <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-100 font-bold font-mono text-slate-900">
                          Bilancio: €{totalLedgerSum.paid.toFixed(2)} / €{(totalLedgerSum.paid + totalLedgerSum.unpaid).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-500">
                <Building size={32} className="mx-auto text-slate-300 mb-3" />
                <p className="text-xs font-semibold">Seleziona un immobile con condominio attivo dal pannello sinistro per visualizzare il relativo fascicolo.</p>
              </div>
            )}
          </div>

        </div>
      )}
      </>
      )}

      {/* Condominium Creation/Editing Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-sans font-bold text-base flex items-center space-x-2">
                <Building size={18} />
                <span>{editingCondo ? "Modifica Condominio" : "Nuovo Condominio"}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* AI Assistant Drawer inside modal */}
            {!editingCondo && (
              <div className="bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Sparkles className="text-amber-500 animate-pulse" size={14} />
                    <span>Importatore AI Bilancio & Rate</span>
                  </span>
                  <button 
                    type="button"
                    onClick={() => setShowAiAssist(!showAiAssist)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    {showAiAssist ? "Nascondi Assistente" : "Incolla bilancio o avviso di pagamento"}
                  </button>
                </div>

                {showAiAssist && (
                  <div className="mt-3 space-y-3">
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Incolla le rate previste dal preventivo, i riparti delle spese o il testo di un avviso di pagamento. L'AI estrarrà i contatti dell'amministratore e compilerà la griglia delle rate con le scadenze corrette.
                    </p>
                    <textarea
                      placeholder="Incolla il testo del bilancio preventivo o della convocazione..."
                      value={aiText}
                      onChange={(e) => setAiText(e.target.value)}
                      rows={4}
                      className="w-full text-xs border border-slate-200 bg-white rounded-xl p-2.5 outline-hidden focus:border-indigo-500"
                    />
                    {aiError && (
                      <div className="flex items-center space-x-1.5 text-rose-600 text-xs">
                        <AlertCircle size={14} />
                        <span>{aiError}</span>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={aiLoading}
                        onClick={handleExtractWithAi}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                      >
                        {aiLoading ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <Sparkles size={13} />
                        )}
                        <span>{aiLoading ? "Analisi preventivo..." : "Estrai Amministratore"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nome Condominio *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Esempio: Condominio Primavera, Milano"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Indirizzo Edificio
                </label>
                <input
                  type="text"
                  placeholder="Deve coincidere con l'indirizzo degli immobili che vi appartengono"
                  value={condoAddress}
                  onChange={(e) => setCondoAddress(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Un condominio corrisponde a un edificio fisico: l'indirizzo deve essere lo stesso di tutti gli immobili collegati.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Amministratore
                  </label>
                  <select
                    value={administratorId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__new__") {
                        setShowAdminModal(true);
                        setEditingAdmin(null);
                        setAdminName("");
                        setAdminPhone("");
                        setAdminEmail("");
                        setAdminNotes("");
                        return;
                      }
                      setAdministratorId(val);
                      const found = administrators.find(a => a.id === val);
                      if (found) setAdministrator(found.name);
                    }}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 bg-white"
                  >
                    <option value="">
                      {administrator ? `${administrator} (non collegato)` : "-- Nessuno --"}
                    </option>
                    {administrators.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                    <option value="__new__">➕ Crea nuovo amministratore…</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Telefono Amm.
                  </label>
                  <input
                    type="tel"
                    placeholder="02 123456"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Amm.
                  </label>
                  <input
                    type="email"
                    placeholder="info@studioamministrativo.it"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Note Condominio
                </label>
                <textarea
                  placeholder="Dettagli scale, orari riscaldamento centralizzato, codici di accesso, ditta pulizie..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  {editingCondo ? "Salva Modifiche" : "Crea Condominio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-sans font-bold text-sm">Carica File nel Fascicolo Condominiale</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadDocSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nome File o Verbale *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Esempio: Verbale_Assemblea_Riscaldamento"
                  value={uploadedFileName}
                  onChange={(e) => setUploadedFileName(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2outline-hidden focus:border-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mittente / Chi carica
                </label>
                <select
                  value={uploadedFileSender}
                  onChange={(e) => setUploadedFileSender(e.target.value)}
                  className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2 outline-hidden focus:border-indigo-500 font-bold text-slate-700"
                >
                  <option value="Amministratore">🏢 Amministratore</option>
                  <option value="Inquilino">👤 Inquilino</option>
                  <option value="Proprietario">💼 Proprietario</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-xs cursor-pointer"
                >
                  Salva Documento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CORREZIONE L — Fase 1: Modulo Nuovo/Modifica Amministratore */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-100">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-sans font-bold text-base">
                {editingAdmin ? "Modifica Amministratore" : "Nuovo Amministratore"}
              </h3>
              <button onClick={() => setShowAdminModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitAdmin} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nome e Cognome / Studio *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Studio Amministrativo Rossi"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Telefono
                  </label>
                  <input
                    type="tel"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Note
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                {editingAdmin ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteAdminClick(editingAdmin)}
                    className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-1"
                  >
                    <Trash2 size={13} />
                    Elimina
                  </button>
                ) : <span />}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    Salva
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CORREZIONE Q — Conferma pesante per sciogliere una relazione (scrivere il nome) */}
      {disconnectTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border border-rose-100">
            <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
              <h3 className="font-sans font-bold text-base">Sciogliere la relazione?</h3>
              <button onClick={() => setDisconnectTarget(null)} className="text-rose-100 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Questa relazione era stata creata deliberatamente e dovrebbe restare stabile. Per confermare che vuoi davvero scioglierla, scrivi qui sotto il nome esatto:
              </p>
              <p className="text-sm font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                {disconnectTarget.name}
              </p>
              <input
                type="text"
                autoFocus
                value={disconnectConfirmText}
                onChange={(e) => setDisconnectConfirmText(e.target.value)}
                placeholder="Scrivi qui il nome per confermare"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-rose-500"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setDisconnectTarget(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleConfirmDisconnect}
                  disabled={disconnectConfirmText.trim().toLowerCase() !== disconnectTarget.name.trim().toLowerCase()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow-sm"
                >
                  Sciogli Definitivamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

