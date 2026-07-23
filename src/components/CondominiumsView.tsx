
import React, { useState, useMemo } from "react";
import { 
  Plus, Edit3, Trash2, Building, Calendar, UserCheck, 
  Sparkles, X, AlertCircle, Eye, Info, MapPin, User, 
  FileText, Upload, RefreshCw, CheckCircle2, ChevronRight,
  ShieldCheck, ShieldAlert, CreditCard, Receipt, FileUp, DollarSign
} from "lucide-react";
import { Condominium, CondoRate, Property, Tenant, FastClosingItem } from "../types";

interface CondominiumsViewProps {
  condominiums: Condominium[];
  properties: Property[];
  tenants: Tenant[];
  fastClosing: FastClosingItem[];
  onAddCondominium: (condo: Omit<Condominium, "id" | "userId" | "createdAt">) => Promise<void>;
  onEditCondominium: (id: string, condo: Partial<Condominium>) => Promise<void>;
  onDeleteCondominium: (id: string) => Promise<void>;
  onAddClosingItem: (item: Omit<FastClosingItem, "id" | "userId" | "createdAt">) => Promise<void>;
  setCurrentSection?: (section: any) => void;
  setSelectedTenantIdForLedger?: (id: string | null) => void;
}

export default function CondominiumsView({
  condominiums,
  properties,
  tenants,
  fastClosing,
  onAddCondominium,
  onEditCondominium,
  onDeleteCondominium,
  onAddClosingItem,
  setCurrentSection,
  setSelectedTenantIdForLedger
}: CondominiumsViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingCondo, setEditingCondo] = useState<Condominium | null>(null);

  // Form Fields for Condominium
  const [name, setName] = useState("");
  const [administrator, setAdministrator] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

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
  const [expenseDueDate, setExpenseDueDate] = useState("");
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
    setAdministrator("");
    setPhone("");
    setEmail("");
    setNotes("");
    setAiText("");
    setAiError("");
    setShowAiAssist(false);
    setShowModal(true);
  };

  // Handle open edit condo modal
  const handleOpenEditModal = (condo: Condominium) => {
    setEditingCondo(condo);
    setName(condo.name);
    setAdministrator(condo.administrator || "");
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

    const payload = {
      name,
      administrator,
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
      setExpenseDueDate("");
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

      {/* Main split dashboard: Left relationship list, Right active relationship details */}
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
                    <button
                      key={prop.id}
                      onClick={() => setSelectedPropertyId(prop.id)}
                      className={`w-full p-4 rounded-xl border text-left flex flex-col space-y-2.5 transition-all outline-hidden ${
                        isSelected 
                          ? "bg-indigo-50/45 border-indigo-200 ring-1 ring-indigo-200/30 shadow-xs" 
                          : "bg-slate-50/30 border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
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
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List of general administrators and basic contacts */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Censimento Condomini ({condominiums.length})</h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {condominiums.map(c => (
                  <div key={c.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100/50 flex justify-between items-center text-xs">
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
                            Data Scadenza Rata *
                          </label>
                          <input
                            type="date"
                            required
                            value={expenseDueDate}
                            onChange={(e) => setExpenseDueDate(e.target.value)}
                            className="w-full text-xs border border-slate-200 bg-white rounded-lg px-2.5 py-2 outline-hidden focus:border-indigo-500 font-mono"
                          />
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Amministratore
                  </label>
                  <input
                    type="text"
                    placeholder="Studio Amministrativo S.r.l."
                    value={administrator}
                    onChange={(e) => setAdministrator(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                  />
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

    </div>
  );
}

