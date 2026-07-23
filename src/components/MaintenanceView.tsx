
import React, { useState, useMemo } from "react";
import { 
  Plus, Wrench, Calendar, Hammer, CheckCircle2, X, AlertCircle, 
  Trash2, ArrowRight, ArrowLeft, Coins, Percent, Users, User, 
  Building, Clock, CheckCircle, Search, TrendingUp, DollarSign
} from "lucide-react";
import { Maintenance, Property, FastClosingItem } from "../types";

interface MaintenanceViewProps {
  maintenance: Maintenance[];
  properties: Property[];
  fastClosing: FastClosingItem[];
  contracts: any[];
  tenants: any[];
  onAddMaintenance: (ticket: any) => Promise<void>;
  onUpdateMaintenanceStatus: (id: string, status: "New" | "In Progress" | "Completed" | "Cancelled") => Promise<void>;
  onDeleteMaintenance: (id: string) => Promise<void>;
}

export default function MaintenanceView({
  maintenance,
  properties,
  fastClosing,
  contracts,
  tenants,
  onAddMaintenance,
  onUpdateMaintenanceStatus,
  onDeleteMaintenance
}: MaintenanceViewProps) {
  // Wizard Modal state
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  // Property filter state for the registry sidebar/tab
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form Fields for the Wizard
  const [propertyId, setPropertyId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"New" | "In Progress" | "Completed" | "Cancelled">("New");
  const [cost, setCost] = useState<number>(0);
  const [contractor, setContractor] = useState("");
  const [date, setDate] = useState("");
  
  // Cost Splitting Fields
  const [splitType, setSplitType] = useState<"owner" | "tenant" | "custom">("owner");
  const [customSplitMode, setCustomSplitMode] = useState<"percentage" | "amount">("percentage");
  
  // Custom split values (stores raw input as strings to support decimal typing)
  const [ownerSplitVal, setOwnerSplitVal] = useState("100");
  const [tenantSplitVal, setTenantSplitVal] = useState("0");

  // Esigibilità
  const [esigibilita, setEsigibilita] = useState<"Immediata" | "Differita">("Immediata");
  const [esigibilitaData, setEsigibilitaData] = useState("");

  // Helper: Retrieve property details & active tenant for split suggestion
  const activePropertyData = useMemo(() => {
    if (!propertyId) return null;
    const prop = properties.find(p => p.id === propertyId);
    if (!prop) return null;

    // Find active contract to get the tenant name
    const activeContract = contracts.find(c => c.propertyId === prop.id && c.status === "Active");
    return {
      property: prop,
      ownerName: prop.owner || "Proprietario sconosciuto",
      tenantName: activeContract ? activeContract.tenantName : null,
      isRented: prop.status === "Rented" && !!activeContract
    };
  }, [propertyId, properties, contracts]);

  // Open the wizard modal
  const handleOpenWizard = () => {
    const defaultPropId = properties[0]?.id || "";
    setPropertyId(defaultPropId);
    setTitle("");
    setDescription("");
    setStatus("New");
    setCost(0);
    setContractor("");
    setDate(new Date().toISOString().split("T")[0]);
    setSplitType("owner");
    setCustomSplitMode("percentage");
    setOwnerSplitVal("100");
    setTenantSplitVal("0");
    setEsigibilita("Immediata");
    setEsigibilitaData("");
    setWizardStep(1);
    setShowWizard(true);
  };

  // Adjust custom splits on selection or total cost update
  const handleSplitTypeChange = (type: "owner" | "tenant" | "custom") => {
    setSplitType(type);
    if (type === "owner") {
      setOwnerSplitVal(customSplitMode === "percentage" ? "100" : String(cost));
      setTenantSplitVal("0");
    } else if (type === "tenant") {
      setOwnerSplitVal("0");
      setTenantSplitVal(customSplitMode === "percentage" ? "100" : String(cost));
    } else {
      // Custom 50/50 initial split
      if (customSplitMode === "percentage") {
        setOwnerSplitVal("50");
        setTenantSplitVal("50");
      } else {
        const half = (cost / 2).toFixed(2);
        setOwnerSplitVal(half);
        setTenantSplitVal(half);
      }
    }
  };

  const handleCustomSplitModeChange = (mode: "percentage" | "amount") => {
    setCustomSplitMode(mode);
    if (mode === "percentage") {
      // Convert current amounts to percentages
      if (cost <= 0) {
        setOwnerSplitVal("50");
        setTenantSplitVal("50");
      } else {
        const oPct = ((Number(ownerSplitVal) || 0) / cost) * 100;
        const tPct = ((Number(tenantSplitVal) || 0) / cost) * 100;
        setOwnerSplitVal(oPct.toFixed(0));
        setTenantSplitVal(tPct.toFixed(0));
      }
    } else {
      // Convert current percentages to amounts
      const oAmt = ((Number(ownerSplitVal) || 0) / 100) * cost;
      const tAmt = ((Number(tenantSplitVal) || 0) / 100) * cost;
      setOwnerSplitVal(oAmt.toFixed(2));
      setTenantSplitVal(tAmt.toFixed(2));
    }
  };

  // Calculate real-time split amounts for the UI
  const calculatedSplits = useMemo(() => {
    if (!activePropertyData) return { ownerAmt: 0, tenantAmt: 0, ownerPct: 0, tenantPct: 0 };
    
    if (splitType === "owner") {
      return { ownerAmt: cost, tenantAmt: 0, ownerPct: 100, tenantPct: 0 };
    }
    if (splitType === "tenant") {
      return { ownerAmt: 0, tenantAmt: cost, ownerPct: 0, tenantPct: 100 };
    }

    // Custom Split
    if (customSplitMode === "percentage") {
      const oPct = Number(ownerSplitVal) || 0;
      const tPct = Number(tenantSplitVal) || 0;
      const ownerAmt = (oPct / 100) * cost;
      const tenantAmt = (tPct / 100) * cost;
      return { ownerAmt, tenantAmt, ownerPct: oPct, tenantPct: tPct };
    } else {
      const ownerAmt = Number(ownerSplitVal) || 0;
      const tenantAmt = Number(tenantSplitVal) || 0;
      const sum = ownerAmt + tenantAmt;
      const ownerPct = sum > 0 ? (ownerAmt / sum) * 100 : 0;
      const tenantPct = sum > 0 ? (tenantAmt / sum) * 100 : 0;
      return { ownerAmt, tenantAmt, ownerPct, tenantPct };
    }
  }, [cost, splitType, customSplitMode, ownerSplitVal, tenantSplitVal, activePropertyData]);

  // Validation before step transit or submit
  const validateStep = (step: number) => {
    if (step === 1) {
      if (!propertyId) {
        alert("Seleziona un immobile.");
        return false;
      }
    }
    if (step === 2) {
      if (!title.trim()) {
        alert("Inserisci un titolo per l'intervento.");
        return false;
      }
    }
    if (step === 3) {
      if (cost <= 0) {
        alert("Il costo dell'intervento deve essere maggiore di zero per registrare le scadenze.");
        return false;
      }
      
      if (splitType === "custom") {
        if (customSplitMode === "percentage") {
          const sum = (Number(ownerSplitVal) || 0) + (Number(tenantSplitVal) || 0);
          if (sum !== 100) {
            alert(`La somma delle percentuali deve essere esattamente 100%. Corrente: ${sum}%`);
            return false;
          }
        } else {
          const sum = (Number(ownerSplitVal) || 0) + (Number(tenantSplitVal) || 0);
          // Allow tiny floating point deviation up to 0.1
          if (Math.abs(sum - cost) > 0.1) {
            alert(`La somma degli importi (€${sum.toFixed(2)}) deve corrispondere esattamente al costo totale (€${cost.toFixed(2)}).`);
            return false;
          }
        }
      }
    }
    if (step === 4) {
      if (esigibilita === "Differita" && !esigibilitaData) {
        alert("Seleziona una data per l'esigibilità differita.");
        return false;
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(wizardStep)) {
      setWizardStep(prev => prev + 1);
    }
  };

  const handlePrevStep = () => {
    setWizardStep(prev => Math.max(1, prev - 1));
  };

  // Submit the form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(4)) return;

    const selectedProp = properties.find(p => p.id === propertyId);
    
    // Construct splits array
    const splits: any[] = [];
    if (calculatedSplits.ownerAmt > 0) {
      const ownersList = (activePropertyData?.ownerName || "Proprietario")
        .split(",")
        .map(o => o.trim())
        .filter(Boolean);
      
      if (ownersList.length > 1) {
        const splitAmount = calculatedSplits.ownerAmt / ownersList.length;
        ownersList.forEach(owner => {
          splits.push({
            debtorName: owner,
            type: "owner",
            amount: splitAmount
          });
        });
      } else {
        splits.push({
          debtorName: activePropertyData?.ownerName || "Proprietario",
          type: "owner",
          amount: calculatedSplits.ownerAmt
        });
      }
    }
    if (calculatedSplits.tenantAmt > 0 && activePropertyData?.tenantName) {
      splits.push({
        debtorName: activePropertyData.tenantName,
        type: "tenant",
        amount: calculatedSplits.tenantAmt
      });
    }

    try {
      await onAddMaintenance({
        propertyId,
        propertyName: selectedProp?.name || "Immobile",
        title,
        description,
        status,
        cost: cost || 0,
        contractor: contractor || undefined,
        date: date || undefined,
        chargedTo: splitType === "tenant" ? "tenant" : "owner", // Legacy compatibility
        esigibilita,
        esigibilitaData: esigibilita === "Differita" ? esigibilitaData : undefined,
        splits: splits.length > 0 ? splits : undefined
      });
      setShowWizard(false);
      // Auto-focus the newly added property in the registry sidebar!
      setSelectedPropertyId(propertyId);
    } catch (err) {
      console.error("Error creating maintenance with splits:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questa manutenzione? Verranno rimosse anche tutte le relative scadenze associate nel Fast Closing.")) {
      try {
        await onDeleteMaintenance(id);
      } catch (err) {
        console.error("Error deleting maintenance:", err);
      }
    }
  };

  // --- REGISTRY AND LEDGER CALCULATIONS ---
  // List only properties that have at least one maintenance ticket
  const propertiesWithMaintenance = useMemo(() => {
    return properties.filter(prop => 
      maintenance.some(ticket => ticket.propertyId === prop.id)
    );
  }, [properties, maintenance]);

  // Do not automatically select property on mount so we stay on the Registro overview

  const activeLedgerData = useMemo(() => {
    if (!selectedPropertyId) return null;
    const prop = properties.find(p => p.id === selectedPropertyId);
    if (!prop) return null;

    // Tickets for this property
    const propTickets = maintenance.filter(t => t.propertyId === selectedPropertyId);

    // Associated FastClosing entries related to maintenance tickets of this property
    const propTicketIds = propTickets.map(t => t.id);
    const relatedClosingItems = fastClosing.filter(
      item => item.source === "maintenance" && item.sourceId && propTicketIds.includes(item.sourceId)
    );

    // Calculate balances based on actual FastClosing rows
    let totManutenzioni = 0;
    let pagate = 0;
    let nonScadute = 0;

    // For each ticket, get cost or sum of splits
    propTickets.forEach(ticket => {
      totManutenzioni += ticket.cost || 0;
    });

    relatedClosingItems.forEach(item => {
      if (item.status === "Paid") {
        pagate += item.amount;
      } else {
        nonScadute += item.amount; // Pending or Overdue
      }
    });

    // Sort tickets by date descending
    const sortedTickets = [...propTickets].sort((a, b) => {
      const dateA = a.date || a.createdAt || "";
      const dateB = b.date || b.createdAt || "";
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return {
      property: prop,
      tickets: sortedTickets,
      closingItems: relatedClosingItems,
      totManutenzioni,
      pagate,
      nonScadute
    };
  }, [selectedPropertyId, properties, maintenance, fastClosing]);

  return (
    <div className="space-y-6" id="maintenance-view-container">
      {selectedPropertyId === null ? (
        /* ================= PRIMARY PAGE: REGISTRO IMMOBILI MANUTENUTI ================= */
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Registro immobili manutenuti</h2>
              <p className="text-xs text-slate-500 mt-0.5">La raccolta completa di tutte le unità immobiliari che hanno subito interventi e manutenzioni.</p>
            </div>
            <button
              onClick={handleOpenWizard}
              id="add-maintenance-btn"
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors shadow-sm self-start sm:self-auto hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              <Plus size={16} />
              <span>Apri Wizard Ripartizione</span>
            </button>
          </div>

          {/* General Stats on Maintenance */}
          {(() => {
            const totalTickets = maintenance.length;
            const totalSpend = maintenance.reduce((sum, m) => sum + (m.cost || 0), 0);
            const openInterventions = maintenance.filter(m => m.status === "New" || m.status === "In Progress").length;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-150 p-4 rounded-xl shadow-2xs">
                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Spesa Totale Manutenzioni</span>
                  <p className="text-xl font-black text-indigo-600 mt-1">
                    €{totalSpend.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white border border-slate-150 p-4 rounded-xl shadow-2xs">
                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Interventi Totali Registrati</span>
                  <p className="text-xl font-black text-slate-800 mt-1">{totalTickets}</p>
                </div>
                <div className="bg-white border border-slate-150 p-4 rounded-xl shadow-2xs">
                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Interventi Attivi / In Corso</span>
                  <p className="text-xl font-black text-amber-600 mt-1">{openInterventions}</p>
                </div>
              </div>
            );
          })()}

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Cerca per nome immobile o indirizzo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl pl-10 pr-4 py-3 bg-white focus:border-indigo-500 outline-hidden text-slate-800 font-medium shadow-2xs"
            />
          </div>

          {/* Grid of Maintained Property Badges */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-400">
              Immobili Manutenuti ({propertiesWithMaintenance.length})
            </h3>
            
            {propertiesWithMaintenance.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-150 p-12 text-center max-w-xl mx-auto shadow-sm">
                <div className="bg-slate-50 text-indigo-500 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4">
                  <Wrench size={28} />
                </div>
                <h3 className="font-sans font-black text-slate-800 text-sm">Nessun immobile manutenuto</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Non ci sono ancora immobili con interventi di manutenzione registrati.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {propertiesWithMaintenance
                  .filter(prop => 
                    prop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    prop.address.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(prop => {
                    const tickets = maintenance.filter(t => t.propertyId === prop.id);
                    const ticketCount = tickets.length;
                    const totalSpent = tickets.reduce((sum, t) => sum + (t.cost || 0), 0);
                    const pendingAmt = fastClosing
                      .filter(item => item.source === "maintenance" && (item as any).propertyId === prop.id && item.status !== "Paid")
                      .reduce((sum, i) => sum + i.amount, 0);

                    return (
                      <button
                        key={prop.id}
                        type="button"
                        onClick={() => setSelectedPropertyId(prop.id)}
                        className="text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between h-40 group hover:scale-[1.02]"
                      >
                        <div className="w-full">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                              {prop.name}
                            </span>
                            <span className="bg-indigo-50 text-indigo-700 text-[9px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap border border-indigo-100">
                              {ticketCount} {ticketCount === 1 ? "Intervento" : "Interventi"}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 truncate">{prop.address}</p>
                          <p className="text-[10px] text-slate-500 mt-2 font-mono">Proprietario: <strong className="text-slate-700">{prop.owner}</strong></p>
                        </div>
                        
                        <div className="w-full pt-2.5 border-t border-slate-100 flex flex-col gap-1 text-[10px]">
                          <div className="flex justify-between text-slate-400">
                            <span>Totale Speso:</span>
                            <span className="font-extrabold font-mono text-slate-900">
                              €{totalSpent.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {pendingAmt > 0 && (
                            <div className="flex justify-between text-amber-600 font-bold">
                              <span>Da Saldare:</span>
                              <span className="font-extrabold font-mono">
                                €{pendingAmt.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================= SUB-PAGE: PROPERTY MAINTENANCE DETAIL & LEDGER (EXCEL STYLE) ================= */
        <div className="space-y-6">
          {/* Back button and breadcrumbs */}
          <div className="flex items-center justify-between pb-4">
            <button
              onClick={() => setSelectedPropertyId(null)}
              className="inline-flex items-center space-x-1.5 text-slate-600 hover:text-indigo-600 font-bold text-xs transition-colors cursor-pointer bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200"
            >
              <ArrowLeft size={14} />
              <span>← Torna al Registro immobili manutenuti</span>
            </button>

            <button
              onClick={handleOpenWizard}
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-colors shadow-sm"
            >
              <Plus size={14} />
              <span>Aggiungi Intervento</span>
            </button>
          </div>

          {activeLedgerData && (
            <div className="space-y-6">
              {/* Header Property Summary */}
              <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
                  <div>
                    <h3 className="font-sans font-black text-slate-900 text-lg flex items-center gap-2">
                      <Wrench size={20} className="text-indigo-600" />
                      Mastrino Manutenzioni: {activeLedgerData.property.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{activeLedgerData.property.address}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 self-start sm:self-auto">
                    Stato Immobile: <strong className="text-slate-800">{activeLedgerData.property.status}</strong>
                  </span>
                </div>

                {/* Financial Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl">
                    <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Saldato (Pagato)</p>
                    <p className="text-xl font-black text-emerald-600 mt-1">
                      €{activeLedgerData.pagate.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl">
                    <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Da Pagare / In Sospeso</p>
                    <p className="text-xl font-black text-amber-600 mt-1">
                      €{activeLedgerData.nonScadute.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-indigo-50/20 border border-indigo-100 p-4 rounded-xl">
                    <p className="text-[10px] font-mono font-bold text-indigo-500 uppercase tracking-wider">Totale Carico Spese</p>
                    <p className="text-xl font-black text-indigo-900 mt-1">
                      €{activeLedgerData.totManutenzioni.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Excel Spreadsheet style table */}
              <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-2xs p-5 space-y-3">
                <h4 className="text-[11px] font-mono font-black uppercase text-slate-400 tracking-wider">FOGLIO DI CALCOLO INTERVENTI (CELLE COMPILATE)</h4>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold text-[10px] font-mono uppercase">
                        <th className="p-2 border border-slate-300">Data Immissione</th>
                        <th className="p-2 border border-slate-300">Titolo Intervento</th>
                        <th className="p-2 border border-slate-300">Descrizione / Stato</th>
                        <th className="p-2 border border-slate-300">Ditta / Tecnico</th>
                        <th className="p-2 border border-slate-300 text-right">Costo Lordo</th>
                        <th className="p-2 border border-slate-300">Ripartizione & Quote Fast Closing</th>
                        <th className="p-2 border border-slate-300 text-center">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeLedgerData.tickets.map((ticket) => {
                        const ticketClosings = activeLedgerData.closingItems.filter(item => item.sourceId === ticket.id);
                        const displayDate = ticket.date 
                          ? new Date(ticket.date).toLocaleDateString("it-IT") 
                          : new Date(ticket.createdAt).toLocaleDateString("it-IT");

                        return (
                          <tr key={ticket.id} className="hover:bg-slate-50/50 even:bg-slate-50/20">
                            {/* Data */}
                            <td className="p-2 border border-slate-200 font-mono text-slate-800 text-xs whitespace-nowrap bg-white">
                              {displayDate}
                            </td>

                            {/* Titolo */}
                            <td className="p-2 border border-slate-200 text-xs font-semibold text-slate-900 bg-white">
                              {ticket.title}
                            </td>

                            {/* Descrizione / Stato */}
                            <td className="p-2 border border-slate-200 text-xs text-slate-600 bg-white space-y-1">
                              {ticket.description ? (
                                <p className="text-[10px] text-slate-500 max-w-xs">{ticket.description}</p>
                              ) : (
                                <p className="text-[10px] text-slate-300 italic">Nessun dettaglio</p>
                              )}
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm border uppercase font-mono ${
                                  ticket.status === "Completed"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : ticket.status === "In Progress"
                                    ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                                    : ticket.status === "Cancelled"
                                    ? "bg-slate-100 text-slate-400 border-slate-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}>
                                  {ticket.status === "New" ? "NUOVO" : ticket.status === "In Progress" ? "IN CORSO" : ticket.status === "Completed" ? "RISOLTO" : "ANNULLATO"}
                                </span>
                              </div>
                            </td>

                            {/* Ditta */}
                            <td className="p-2 border border-slate-200 text-xs text-slate-700 font-mono bg-white">
                              {ticket.contractor || "-"}
                            </td>

                            {/* Costo */}
                            <td className="p-2 border border-slate-200 font-mono text-xs text-slate-900 font-bold text-right whitespace-nowrap bg-white">
                              €{(ticket.cost || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                            </td>

                            {/* Quote */}
                            <td className="p-2 border border-slate-200 bg-white font-mono">
                              {ticketClosings.length === 0 ? (
                                <span className="text-[10px] text-slate-300 italic font-mono">Nessuna riga contabile</span>
                              ) : (
                                <div className="space-y-1 font-mono">
                                  {ticketClosings.map((fc) => (
                                    <div key={fc.id} className="flex items-center justify-between text-[10px] bg-slate-50 border border-slate-200 p-1 rounded">
                                      <span className="font-bold text-slate-600 truncate max-w-[150px]" title={fc.title}>
                                        {fc.title.split(" - ")[0]}
                                      </span>
                                      <div className="flex items-center gap-1 shrink-0 font-mono text-[9px]">
                                        <strong className="text-slate-900">€{fc.amount.toFixed(2)}</strong>
                                        <span className={`text-[8px] font-black px-1 rounded-sm ${
                                          fc.status === "Paid"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-amber-100 text-amber-800"
                                        }`}>
                                          {fc.status === "Paid" ? "PAGATO" : "ATTESA"}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>

                            {/* Azioni */}
                            <td className="p-2 border border-slate-200 text-center bg-white">
                              <button
                                onClick={() => handleDelete(ticket.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Elimina"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* INTELLIGENT STEP-BY-STEP WIZARD MODAL */}
      {showWizard && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col animate-scaleUp">
            
            {/* Wizard Header */}
            <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="text-indigo-400" size={18} />
                <div>
                  <h3 className="font-sans font-bold text-sm leading-tight">Procedura Riparazioni & Quote</h3>
                  <p className="text-[10px] text-slate-400">Step {wizardStep} di 4</p>
                </div>
              </div>
              <button 
                onClick={() => setShowWizard(false)} 
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Step Indicators */}
            <div className="bg-slate-50 px-6 py-2.5 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span className={wizardStep === 1 ? "text-indigo-600 font-black" : "text-slate-500 font-bold"}>1. Immobile</span>
              <span className="text-slate-300">/</span>
              <span className={wizardStep === 2 ? "text-indigo-600 font-black" : "text-slate-500 font-bold"}>2. Intervento</span>
              <span className="text-slate-300">/</span>
              <span className={wizardStep === 3 ? "text-indigo-600 font-black" : "text-slate-500 font-bold"}>3. Ripartizione</span>
              <span className="text-slate-300">/</span>
              <span className={wizardStep === 4 ? "text-indigo-600 font-black" : "text-slate-500 font-bold"}>4. Esigibilità</span>
            </div>

            {/* Wizard Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1 max-h-[500px] overflow-y-auto">
              
              {/* STEP 1: PROPERTY SELECTION */}
              {wizardStep === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-indigo-50/50 border border-indigo-100/60 rounded-xl p-3.5 text-[11px] text-indigo-950 leading-relaxed">
                    <strong>Come iniziare:</strong> Seleziona l'immobile in cui è avvenuto il guasto. Il sistema verificherà l'anagrafica, i proprietari registrati e l'eventuale inquilino con contratto attivo per proporti la ripartizione ottimale.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Seleziona Unità Immobiliare *
                    </label>
                    <select
                      required
                      value={propertyId}
                      onChange={(e) => setPropertyId(e.target.value)}
                      className="w-full text-xs border border-slate-250 rounded-xl px-3.5 py-3 bg-white outline-hidden focus:border-indigo-500 font-bold text-slate-800 shadow-xs"
                    >
                      {properties.length === 0 ? (
                        <option value="">-- Nessun immobile censito --</option>
                      ) : (
                        properties.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.address})</option>
                        ))
                      )}
                    </select>
                  </div>

                  {activePropertyData && (
                    <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/40 space-y-2 text-xs">
                      <p className="font-bold text-slate-700 uppercase text-[9px] tracking-wider mb-2">Anagrafica Rilevata</p>
                      
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <User size={13} className="text-slate-400" />
                          Locatore (Proprietario):
                        </span>
                        <strong className="text-slate-800">{activePropertyData.ownerName}</strong>
                      </div>

                      <div className="flex items-center justify-between text-slate-600 border-t border-slate-100 pt-2">
                        <span className="flex items-center gap-1.5">
                          <Users size={13} className="text-slate-400" />
                          Conduttore (Inquilino):
                        </span>
                        {activePropertyData.isRented ? (
                          <strong className="text-indigo-700 font-extrabold">👤 {activePropertyData.tenantName}</strong>
                        ) : (
                          <span className="text-slate-400 italic">Immobile sfitto / Non locato</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: TECHNICAL DETAILS */}
              {wizardStep === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Titolo Intervento / Guasto *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Es: Riparazione caldaia, Sostituzione serranda box..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full text-xs border border-slate-250 rounded-xl px-3.5 py-3 outline-hidden focus:border-indigo-500 font-medium text-slate-800 shadow-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Impresa / Ditta / Tecnico
                      </label>
                      <input
                        type="text"
                        placeholder="Es: Idraulica Milanese S.R.L."
                        value={contractor}
                        onChange={(e) => setContractor(e.target.value)}
                        className="w-full text-xs border border-slate-250 rounded-xl px-3.5 py-3 outline-hidden focus:border-indigo-500 font-medium text-slate-800 shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Data Esecuzione Intervento
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full text-xs border border-slate-250 rounded-xl px-3.5 py-3 outline-hidden focus:border-indigo-500 font-mono text-slate-800 shadow-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Stato Avanzamento Ticket
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full text-xs border border-slate-250 rounded-xl px-3.5 py-3 bg-white outline-hidden focus:border-indigo-500 font-bold text-slate-800 shadow-xs"
                      >
                        <option value="New">Segnalato (Nuovo)</option>
                        <option value="In Progress">In Lavorazione (In Corso)</option>
                        <option value="Completed">Risolto (Lavoro Finito)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Descrizione Note / Preventivo
                    </label>
                    <textarea
                      placeholder="Note aggiuntive per l'intervento, ricambi sostituiti..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full text-xs border border-slate-250 rounded-xl px-3.5 py-2.5 outline-hidden focus:border-indigo-500 font-medium text-slate-800 shadow-xs"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: COST SPLITTING AND COMPUTING */}
              {wizardStep === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Coins size={14} />
                      Inserisci Costo Totale (€) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={cost || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCost(val);
                        // Recalculate splits with new cost
                        if (splitType === "owner") {
                          setOwnerSplitVal(customSplitMode === "percentage" ? "100" : String(val));
                        } else if (splitType === "tenant") {
                          setTenantSplitVal(customSplitMode === "percentage" ? "100" : String(val));
                        } else {
                          // update nominal values to match half of new cost
                          if (customSplitMode === "amount") {
                            const half = (val / 2).toFixed(2);
                            setOwnerSplitVal(half);
                            setTenantSplitVal(half);
                          }
                        }
                      }}
                      className="w-full text-sm border-2 border-indigo-200 focus:border-indigo-500 rounded-xl px-3.5 py-3 outline-hidden font-black text-slate-900 shadow-sm"
                    />
                  </div>

                  {cost > 0 && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Imputazione della Spesa
                        </label>
                        
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => handleSplitTypeChange("owner")}
                            className={`px-3 py-2.5 rounded-xl border text-[10px] font-bold text-center transition-all ${
                              splitType === "owner"
                                ? "bg-indigo-600 border-indigo-700 text-white shadow-xs"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            Proprietario (100%)
                          </button>

                          <button
                            type="button"
                            disabled={!activePropertyData?.isRented}
                            onClick={() => handleSplitTypeChange("tenant")}
                            className={`px-3 py-2.5 rounded-xl border text-[10px] font-bold text-center transition-all ${
                              !activePropertyData?.isRented
                                ? "opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-100"
                                : splitType === "tenant"
                                ? "bg-indigo-600 border-indigo-700 text-white shadow-xs"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                            title={!activePropertyData?.isRented ? "Immobile non locato" : "Addebita interamente all'inquilino"}
                          >
                            Inquilino (100%)
                          </button>

                          <button
                            type="button"
                            disabled={!activePropertyData?.isRented}
                            onClick={() => handleSplitTypeChange("custom")}
                            className={`px-3 py-2.5 rounded-xl border text-[10px] font-bold text-center transition-all ${
                              !activePropertyData?.isRented
                                ? "opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-100"
                                : splitType === "custom"
                                ? "bg-indigo-600 border-indigo-700 text-white shadow-xs"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            Suddividi Spesa
                          </button>
                        </div>
                      </div>

                      {/* CUSTOM SPLITTING OPTIONS */}
                      {splitType === "custom" && (
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-150 space-y-4 animate-slideDown">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Parametro di Ripartizione:</span>
                            
                            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs">
                              <button
                                type="button"
                                onClick={() => handleCustomSplitModeChange("percentage")}
                                className={`px-2.5 py-1 rounded-md text-[9px] font-bold flex items-center gap-1 ${
                                  customSplitMode === "percentage"
                                    ? "bg-slate-900 text-white"
                                    : "text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                <Percent size={11} />
                                Percentuale (%)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCustomSplitModeChange("amount")}
                                className={`px-2.5 py-1 rounded-md text-[9px] font-bold flex items-center gap-1 ${
                                  customSplitMode === "amount"
                                    ? "bg-slate-900 text-white"
                                    : "text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                <Coins size={11} />
                                Importo (€)
                              </button>
                            </div>
                          </div>

                          {/* Quick presets helper */}
                          <div className="flex gap-1.5 items-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Presets rapidi:</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (customSplitMode === "percentage") {
                                  setOwnerSplitVal("50");
                                  setTenantSplitVal("50");
                                } else {
                                  const half = (cost / 2).toFixed(2);
                                  setOwnerSplitVal(half);
                                  setTenantSplitVal(half);
                                }
                              }}
                              className="text-[9px] bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded"
                            >
                              50 / 50
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (customSplitMode === "percentage") {
                                  setOwnerSplitVal("70");
                                  setTenantSplitVal("30");
                                } else {
                                  setOwnerSplitVal((cost * 0.7).toFixed(2));
                                  setTenantSplitVal((cost * 0.3).toFixed(2));
                                }
                              }}
                              className="text-[9px] bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded"
                            >
                              70 Proprietario / 30 Inquilino
                            </button>
                          </div>

                          {/* Split Input Lines */}
                          <div className="space-y-3 pt-2">
                            {/* OWNER INPUT */}
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <span className="text-[10px] text-slate-400 font-mono block">PROPRIETARIO</span>
                                <span className="font-extrabold text-slate-700 text-xs truncate block">
                                  💼 {activePropertyData?.ownerName}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2 shrink-0">
                                <input
                                  type="number"
                                  step="any"
                                  value={ownerSplitVal}
                                  onChange={(e) => {
                                    const rawVal = e.target.value;
                                    setOwnerSplitVal(rawVal);
                                    
                                    // Auto-calculate opposing split values
                                    const parsed = Number(rawVal) || 0;
                                    if (customSplitMode === "percentage") {
                                      const remaining = Math.max(0, 100 - parsed);
                                      setTenantSplitVal(String(remaining));
                                    } else {
                                      const remaining = Math.max(0, cost - parsed);
                                      setTenantSplitVal(remaining.toFixed(2));
                                    }
                                  }}
                                  className="w-24 text-right border border-slate-300 rounded-lg p-2 font-black text-xs"
                                />
                                <span className="text-xs font-bold text-slate-500">
                                  {customSplitMode === "percentage" ? "%" : "€"}
                                </span>
                              </div>
                            </div>

                            {/* TENANT INPUT */}
                            {activePropertyData?.isRented && (
                              <div className="flex items-center justify-between gap-4 border-t border-slate-150 pt-3">
                                <div className="min-w-0">
                                  <span className="text-[10px] text-indigo-400 font-mono block">INQUILINO</span>
                                  <span className="font-extrabold text-indigo-950 text-xs truncate block">
                                    👤 {activePropertyData.tenantName}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-2 shrink-0">
                                  <input
                                    type="number"
                                    step="any"
                                    value={tenantSplitVal}
                                    onChange={(e) => {
                                      const rawVal = e.target.value;
                                      setTenantSplitVal(rawVal);
                                      
                                      // Auto-calculate opposing split values
                                      const parsed = Number(rawVal) || 0;
                                      if (customSplitMode === "percentage") {
                                        const remaining = Math.max(0, 100 - parsed);
                                        setOwnerSplitVal(String(remaining));
                                      } else {
                                        const remaining = Math.max(0, cost - parsed);
                                        setOwnerSplitVal(remaining.toFixed(2));
                                      }
                                    }}
                                    className="w-24 text-right border border-slate-300 rounded-lg p-2 font-black text-xs"
                                  />
                                  <span className="text-xs font-bold text-slate-500">
                                    {customSplitMode === "percentage" ? "%" : "€"}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Real-time sum indicator */}
                          <div className="mt-4 pt-3 border-t border-slate-200 text-xs flex items-center justify-between">
                            <span className="font-bold text-slate-500">Verifica Ripartizione:</span>
                            
                            {customSplitMode === "percentage" ? (
                              (() => {
                                const sum = (Number(ownerSplitVal) || 0) + (Number(tenantSplitVal) || 0);
                                return sum === 100 ? (
                                  <span className="font-black text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-150">
                                    <CheckCircle size={12} />
                                    Somma: 100% (OK)
                                  </span>
                                ) : (
                                  <span className="font-black text-rose-600 flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-150 animate-pulse">
                                    <AlertCircle size={12} />
                                    Somma: {sum}% (Deve essere 100%)
                                  </span>
                                );
                              })()
                            ) : (
                              (() => {
                                const sum = (Number(ownerSplitVal) || 0) + (Number(tenantSplitVal) || 0);
                                const diff = Math.abs(sum - cost);
                                return diff <= 0.1 ? (
                                  <span className="font-black text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-150">
                                    <CheckCircle size={12} />
                                    Ripartito: €{sum.toFixed(2)} su €{cost.toFixed(2)} (OK)
                                  </span>
                                ) : (
                                  <span className="font-black text-rose-600 flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-150 animate-pulse">
                                    <AlertCircle size={12} />
                                    Mancano €{(cost - sum).toFixed(2)} (€{sum.toFixed(2)} / €{cost.toFixed(2)})
                                  </span>
                                );
                              })()
                            )}
                          </div>
                        </div>
                      )}

                      {/* SUMMARY OF CHARGES */}
                      <div className="bg-indigo-50/20 border border-indigo-100 rounded-xl p-4 text-xs space-y-1.5">
                        <p className="font-bold text-indigo-900 uppercase text-[9px] tracking-wider mb-1">Riepilogo Quote Scadenzario</p>
                        <div className="flex justify-between text-slate-600 font-medium">
                          <span>Quota Proprietario ({calculatedSplits.ownerPct.toFixed(0)}%):</span>
                          <strong className="text-slate-800">€{calculatedSplits.ownerAmt.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </div>
                        {activePropertyData?.isRented && (
                          <div className="flex justify-between text-slate-600 font-medium border-t border-slate-100/60 pt-1.5">
                            <span>Quota Inquilino ({calculatedSplits.tenantPct.toFixed(0)}%):</span>
                            <strong className="text-slate-800">€{calculatedSplits.tenantAmt.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: ESIGIBILITA & CONFIRMATION */}
              {wizardStep === 4 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-indigo-50/50 border border-indigo-100/60 rounded-xl p-4 text-[11px] text-indigo-950 leading-relaxed space-y-1">
                    <p className="font-extrabold">Configura Esigibilità Spesa:</p>
                    <p>
                      <strong>Esigibilità Immediata:</strong> Le quote di spesa andranno a popolare immediatamente il Fast Closing di questo mese (scadenziario corrente/aperto).
                    </p>
                    <p>
                      <strong>Esigibilità Differita:</strong> La spesa sarà indicata per un mese o data futura a tua scelta, popolando il relativo Fast Closing futuro. 
                      <em className="text-indigo-800 block mt-1 font-semibold">
                        Nota: Anche se differita, per l'inquilino la quota comparirà subito nel suo mastrino tra i movimenti in scadenza (non scaduti).
                      </em>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Tipo Esigibilità *
                    </label>
                    <select
                      value={esigibilita}
                      onChange={(e) => setEsigibilita(e.target.value as any)}
                      className="w-full text-xs border border-slate-250 rounded-xl px-3.5 py-3 bg-white outline-hidden focus:border-indigo-500 font-bold text-slate-800 shadow-xs"
                    >
                      <option value="Immediata">Immediata ⚡ (Mese Corrente)</option>
                      <option value="Differita">Differita 📅 (Mese Futuro / Data Specifica)</option>
                    </select>
                  </div>

                  {esigibilita === "Differita" && (
                    <div className="animate-slideDown space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Seleziona Data Scadenza Futura *
                      </label>
                      <input
                        type="date"
                        required
                        value={esigibilitaData}
                        onChange={(e) => setEsigibilitaData(e.target.value)}
                        className="w-full text-xs border border-slate-250 rounded-xl px-3.5 py-3 outline-hidden focus:border-indigo-500 font-mono text-slate-800 shadow-xs"
                      />
                    </div>
                  )}

                  {/* FINAL CONFIRMATION CARD */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <div className="bg-slate-900 text-white px-4 py-2 font-mono text-[9px] uppercase tracking-wider">
                      Resoconto Finale Registrazione
                    </div>
                    <div className="p-4 bg-slate-50 space-y-2 text-slate-600 font-medium">
                      <div className="flex justify-between">
                        <span>Intervento:</span>
                        <strong className="text-slate-800 truncate max-w-[200px]">{title || "N/A"}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Immobile:</span>
                        <strong className="text-slate-800 truncate max-w-[200px]">{activePropertyData?.property.name}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Costo Totale:</span>
                        <strong className="text-slate-900 font-black text-sm">€{cost.toFixed(2)}</strong>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-2 text-[10px]">
                        <span>Esigibilità:</span>
                        <span className="font-extrabold text-indigo-700">
                          {esigibilita === "Immediata" ? "IMMEDIATA (Mese Corrente)" : `DIFFERITA (${esigibilitaData ? new Date(esigibilitaData).toLocaleDateString("it-IT") : "N/A"})`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Wizard Footer Navigation */}
              <div className="pt-4 flex justify-between items-center border-t border-slate-100">
                {wizardStep > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="inline-flex items-center space-x-1.5 px-4 py-2.5 border border-slate-250 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    <ArrowLeft size={14} />
                    <span>Indietro</span>
                  </button>
                ) : (
                  <div></div>
                )}

                {wizardStep < 4 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                  >
                    <span>Continua</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="inline-flex items-center space-x-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    <CheckCircle2 size={14} />
                    <span>Salva e Ripartisci</span>
                  </button>
                )}
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}

