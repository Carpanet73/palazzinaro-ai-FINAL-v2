
import React, { useState, useMemo } from "react";
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Users, 
  Mail, 
  Phone, 
  FileDigit, 
  Landmark, 
  X, 
  Receipt, 
  CheckCircle, 
  ArrowLeft, 
  Printer, 
  Search, 
  AlertTriangle, 
  Calendar, 
  Coins, 
  Wrench, 
  FileText,
  Share2,
  Copy,
  Check
} from "lucide-react";
import { Tenant, Property, FastClosingItem, Contract, Maintenance, LegalCase, Reminder } from "../types";
import { getTenantClassification as getTenantClassificationHelper } from "../lib/statusHelper";
import Logo from "./Logo";

interface TenantsViewProps {
  tenants: Tenant[];
  properties: Property[];
  fastClosing?: FastClosingItem[];
  contracts?: Contract[];
  maintenance?: Maintenance[];
  legalCases?: LegalCase[];
  reminders?: Reminder[];
  initialSelectedTenantId?: string | null;
  onClearInitialSelectedTenantId?: () => void;
  onAddTenant: (tenant: Omit<Tenant, "id" | "userId" | "createdAt">) => Promise<void>;
  onEditTenant: (id: string, tenant: Partial<Tenant>) => Promise<void>;
  onDeleteTenant: (id: string) => Promise<void>;
}

export default function TenantsView({
  tenants,
  properties,
  fastClosing = [],
  contracts = [],
  maintenance = [],
  legalCases = [],
  reminders = [],
  initialSelectedTenantId,
  onClearInitialSelectedTenantId,
  onAddTenant,
  onEditTenant,
  onDeleteTenant
}: TenantsViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  
  // State for the separate Mastrino page
  const [selectedTenantLedger, setSelectedTenantLedger] = useState<Tenant | null>(null);
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState("");
  const [activeLedgerCategory, setActiveLedgerCategory] = useState<"all" | "rent" | "condo" | "registration" | "maintenance">("all");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [ledgerScale, setLedgerScale] = useState<number>(0.80);

  // React to deep linking from Owners section
  React.useEffect(() => {
    if (initialSelectedTenantId) {
      const matched = tenants.find(t => t.id === initialSelectedTenantId);
      if (matched) {
        setSelectedTenantLedger(matched);
      }
      if (onClearInitialSelectedTenantId) {
        onClearInitialSelectedTenantId();
      }
    }
  }, [initialSelectedTenantId, tenants, onClearInitialSelectedTenantId]);

  // Helper to compute a tenant's dynamic classification
  const getTenantClassification = (tenant: Tenant) => {
    return getTenantClassificationHelper(tenant, properties, contracts, fastClosing, legalCases, reminders);
  };

  // Form fields
  const [isCompany, setIsCompany] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyFiscalCode, setCompanyFiscalCode] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [pec, setPec] = useState("");
  const [registeredOffice, setRegisteredOffice] = useState("");
  const [legalRepresentativeName, setLegalRepresentativeName] = useState("");
  const [legalRepresentativeFiscalCode, setLegalRepresentativeFiscalCode] = useState("");
  const [visuraCameraleFileName, setVisuraCameraleFileName] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fiscalCode, setFiscalCode] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [notes, setNotes] = useState("");

  const handleOpenAddModal = () => {
    setEditingTenant(null);
    setIsCompany(false);
    setCompanyName("");
    setCompanyFiscalCode("");
    setVatNumber("");
    setPec("");
    setRegisteredOffice("");
    setLegalRepresentativeName("");
    setLegalRepresentativeFiscalCode("");
    setVisuraCameraleFileName("");
    setName("");
    setEmail("");
    setPhone("");
    setFiscalCode("");
    setPropertyId(properties[0]?.id || "");
    setNotes("");
    setShowModal(true);
  };

  const handleOpenEditModal = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setIsCompany(!!tenant.isCompany);
    setCompanyName(tenant.companyName || "");
    setCompanyFiscalCode(tenant.companyFiscalCode || "");
    setVatNumber(tenant.vatNumber || "");
    setPec(tenant.pec || "");
    setRegisteredOffice(tenant.registeredOffice || "");
    setLegalRepresentativeName(tenant.legalRepresentativeName || "");
    setLegalRepresentativeFiscalCode(tenant.legalRepresentativeFiscalCode || "");
    setVisuraCameraleFileName(tenant.visuraCameraleFileName || "");
    setName(tenant.name);
    setEmail(tenant.email);
    setPhone(tenant.phone || "");
    setFiscalCode(tenant.fiscalCode || "");
    setPropertyId(tenant.propertyId || "");
    setNotes(tenant.notes || "");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = isCompany ? companyName : name;
    if (!finalName.trim() || !email.trim()) {
      alert("Nome/Ragione Sociale e Email sono obbligatori.");
      return;
    }

    const payload = {
      name: finalName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      fiscalCode: isCompany ? companyFiscalCode.trim().toUpperCase() : fiscalCode.trim().toUpperCase(),
      propertyId: propertyId || null,
      notes,
      isCompany,
      companyName: isCompany ? companyName.trim() : "",
      companyFiscalCode: isCompany ? companyFiscalCode.trim().toUpperCase() : "",
      vatNumber: isCompany ? vatNumber.trim() : "",
      pec: isCompany ? pec.trim() : "",
      registeredOffice: isCompany ? registeredOffice.trim() : "",
      legalRepresentativeName: isCompany ? legalRepresentativeName.trim() : "",
      legalRepresentativeFiscalCode: isCompany ? legalRepresentativeFiscalCode.trim().toUpperCase() : "",
      visuraCameraleFileName: isCompany ? visuraCameraleFileName : ""
    } as any;

    try {
      if (editingTenant) {
        await onEditTenant(editingTenant.id, payload);
      } else {
        await onAddTenant(payload);
      }
      setShowModal(false);
    } catch (err) {
      console.error("Error saving tenant", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questo inquilino? I contratti collegati rimarranno attivi.")) {
      try {
        await onDeleteTenant(id);
      } catch (err) {
        console.error("Error deleting tenant", err);
      }
    }
  };

  // --- LOGIC FOR UNIFIED LEDGER (MASTRINO SEPARATO) ---
  const tenantLedgerData = useMemo(() => {
    if (!selectedTenantLedger) return null;
    const t = selectedTenantLedger;

    // 1. Associated Property & Condo Constitution Status
    const property = properties.find(p => p.id === t.propertyId);
    const isCondoConstituted = property ? !!property.isCondoConstituted : false;

    // 2. Associated active contract
    const activeContract = contracts.find(
      c => (c.tenantId === t.id || t.contractId === c.id) && c.status === "Active"
    );

    const movementsList: any[] = [];
    const tenantNameClean = (t.name || "").replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase().trim();

    // -- CATEGORY A: CANONI AFFITTO (Rents) --
    // Find fast closing contract items related to this tenant or contract
    const rentItems = fastClosing.filter(item => {
      if (item.propertyId !== t.propertyId) return false;
      const isContractSource = item.source === "contract";
      const matchesTenant = (item.title || "").toLowerCase().includes(tenantNameClean) ||
                            (item.description && (item.description || "").toLowerCase().includes(tenantNameClean));
      const matchesContract = activeContract && item.sourceId === activeContract.id;
      const isRentWord = (item.title || "").toLowerCase().includes("canone") || (item.title || "").toLowerCase().includes("affitto");
      return (isContractSource && (matchesTenant || matchesContract)) || (isRentWord && (matchesTenant || matchesContract));
    });

    rentItems.forEach(item => {
      movementsList.push({
        id: item.id,
        date: item.dueDate,
        dueDate: item.dueDate,
        paymentDate: item.status === "Paid" ? item.dueDate : "-",
        category: "rent",
        categoryLabel: "💶 Canone Locazione",
        title: item.title,
        description: item.description || "Rata canone d'affitto pattuito",
        amount: item.amount,
        status: item.status, // Paid, Pending, Overdue
        source: "fastClosing"
      });
    });

    // -- CATEGORY B: SPESE CONDOMINIALI (Condo Expenses) --
    // Show only if condominium is established. If it's true, we list condominial fees related to this property.
    if (isCondoConstituted && property) {
      const condoItems = fastClosing.filter(item => {
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

      condoItems.forEach(item => {
        movementsList.push({
          id: item.id,
          date: item.dueDate,
          dueDate: item.dueDate,
          paymentDate: item.status === "Paid" ? item.dueDate : "-",
          category: "condo",
          categoryLabel: "🏢 Spese Condominiali",
          title: item.title,
          description: item.description || "Oneri accessori di condominio",
          amount: item.amount,
          status: item.status,
          source: "fastClosing"
        });
      });
    }

    // -- CATEGORY C: REGISTRAZIONE CONTRATTO (Annual Contract Registration) --
    // "che ha un movimento all'anno annualmente"
    if (activeContract) {
      const start = new Date(activeContract.startDate);
      // Generate up to 5 annual registration payments or until contract end date
      const end = activeContract.endDate 
        ? new Date(activeContract.endDate) 
        : new Date(start.getTime() + 5 * 365 * 24 * 3600 * 1000);

      let currentYearDate = new Date(start);
      let yearNum = 1;
      
      while (currentYearDate <= end && yearNum <= 8) {
        const dateStr = currentYearDate.toISOString().split("T")[0];
        const isPast = new Date(dateStr) <= new Date();

        movementsList.push({
          id: `dyn-reg-tax-${activeContract.id}-${yearNum}`,
          date: dateStr,
          dueDate: dateStr,
          paymentDate: isPast ? dateStr : "-",
          category: "registration",
          categoryLabel: "📄 Registrazione Contratto",
          title: `Imposta di Registro Annuale - Anno ${yearNum}`,
          description: `Versamento F24 per proroga/registrazione annuale del contratto di locazione di ${t.name}`,
          amount: 67.00, // standard minimum registration tax in Italy
          status: isPast ? "Paid" : "Pending",
          source: "generated"
        });

        // Add 1 year
        currentYearDate.setFullYear(currentYearDate.getFullYear() + 1);
        yearNum++;
      }
    }

    // -- CATEGORY D: MANUTENZIONI (Maintenance Charged to Tenant) --
    // 1) Legacy maintenance tickets charged to the tenant that do not have splits
    const legacyTenantMaintenance = maintenance.filter(
      ticket => ticket.propertyId === t.propertyId && ticket.chargedTo === "tenant" && (!ticket.splits || ticket.splits.length === 0)
    );

    legacyTenantMaintenance.forEach(ticket => {
      movementsList.push({
        id: ticket.id,
        date: ticket.date || ticket.createdAt?.slice(0, 10) || new Date().toISOString().split("T")[0],
        dueDate: ticket.date || "-",
        paymentDate: ticket.status === "Completed" ? (ticket.date || "Risolto") : "-",
        category: "maintenance",
        categoryLabel: "🛠️ Manutenzione Inquilino",
        title: ticket.title,
        description: ticket.description || "Intervento di manutenzione ordinaria a carico dell'inquilino",
        amount: ticket.cost || 0,
        status: ticket.status === "Completed" ? "Paid" : "Pending",
        source: "maintenance"
      });
    });

    // 2) New splits from fastClosing for maintenance that belong to this tenant
    const splitMaintenanceClosing = fastClosing.filter(item => {
      if (item.propertyId !== t.propertyId) return false;
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

    splitMaintenanceClosing.forEach(item => {
      movementsList.push({
        id: item.id,
        date: item.dueDate,
        dueDate: item.dueDate,
        paymentDate: item.status === "Paid" ? item.dueDate : "-",
        category: "maintenance",
        categoryLabel: "🛠️ Manutenzione Inquilino (Quota)",
        title: item.title,
        description: item.description || "Quota manutenzione ripartita a carico inquilino",
        amount: item.amount,
        status: item.status,
        source: "fastClosing"
      });
    });

    // Sort all movements by Date ascending (chronological order)
    movementsList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      property,
      isCondoConstituted,
      activeContract,
      movementsList
    };
  }, [selectedTenantLedger, properties, fastClosing, contracts, maintenance]);

  // Filter movements based on Category and Search Query
  const filteredMovements = useMemo(() => {
    if (!tenantLedgerData) return [];
    
    let list = tenantLedgerData.movementsList;

    // Filter by Category Tab
    if (activeLedgerCategory !== "all") {
      list = list.filter(m => m.category === activeLedgerCategory);
    }

    // Filter by search query
    if (ledgerSearchQuery.trim()) {
      const q = ledgerSearchQuery.toLowerCase().trim();
      list = list.filter(m => 
        (m.title || "").toLowerCase().includes(q) ||
        (m.description || "").toLowerCase().includes(q) ||
        (m.date || "").includes(q) ||
        (m.categoryLabel || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [tenantLedgerData, activeLedgerCategory, ledgerSearchQuery]);

  // Pre-calculate progressive balances for the movements being displayed
  const movementsWithBalances = useMemo(() => {
    let runningOwed = 0;
    let runningPaid = 0;
    return filteredMovements.map((m) => {
      runningOwed += m.amount || 0;
      const isPaid = m.status === "Paid";
      if (isPaid) {
        runningPaid += m.amount || 0;
      }
      const balance = runningPaid - runningOwed;
      return {
        ...m,
        cumulativeOwed: runningOwed,
        cumulativePaid: runningPaid,
        balance: balance
      };
    });
  }, [filteredMovements]);

  // Print function
  const handlePrintLedger = () => {
    window.print();
  };

  // --- RENDERING SEPARATE LEDGER PAGE ---
  if (selectedTenantLedger && tenantLedgerData) {
    const t = selectedTenantLedger;
    const { property, isCondoConstituted, activeContract, movementsList } = tenantLedgerData;

    const totalOutstanding = movementsList
      ? movementsList
          .filter(m => m.status === "Pending" || m.status === "Overdue")
          .reduce((sum, m) => sum + (m.amount || 0), 0)
      : 0;

    const totalDovuto = movementsWithBalances.reduce((sum, m) => sum + (m.amount || 0), 0);
    const totalPagato = movementsWithBalances.reduce((sum, m) => sum + (m.status === "Paid" ? (m.amount || 0) : 0), 0);
    const currentBalance = totalPagato - totalDovuto;
    const isInPari = Math.abs(currentBalance) < 0.01;
    const cls = getTenantClassification(t);

    const getTenantShareText = () => {
      const addressStr = property ? `situato in ${property.address}` : "";
      const contractStr = activeContract ? `con canone mensile di €${activeContract.rentAmount.toLocaleString("it-IT")}` : "";
      const outstandingStr = totalOutstanding > 0 
        ? `Al momento risultano pendenze per un importo totale di €${totalOutstanding.toLocaleString("it-IT", { minimumFractionDigits: 2 })}.`
        : `Al momento la situazione contabile risulta in regola (nessun insoluto o pendenza registrata).`;

      return `Gentile ${t.name},
Le inviamo il riepilogo contabile del Suo mastrino relativo all'immobile ${property?.name || ""} ${addressStr}.

Estremi Contratto: ${contractStr}
Stato Condominio: ${isCondoConstituted ? "Condominio Regolarmente Istituito" : "Condominio non costituito (nessun onere accessorio addebitato)"}

Riepilogo Scadenze:
- Totale scadenze caricate: ${movementsList.length}
- Saldati: ${movementsList.filter(m => m.status === "Paid").length}
- In attesa/Scaduti: ${movementsList.filter(m => m.status === "Pending" || m.status === "Overdue").length}

${outstandingStr}

La preghiamo di verificare i dettagli allegati o di contattarci per qualsiasi chiarimento.
Cordiali saluti.`;
    };

    const getOwnerShareText = (ownerName: string) => {
      const addressStr = property ? `situato in ${property.address}` : "";
      const tenantStr = `Inquilino: ${t.name}`;
      const outstandingStr = totalOutstanding > 0 
        ? `In attesa di incasso o scaduti dall'inquilino per un totale di €${totalOutstanding.toLocaleString("it-IT", { minimumFractionDigits: 2 })}.`
        : `L'inquilino risulta in regola con tutti i pagamenti ad oggi.`;

      return `Gentile Proprietario ${ownerName},
Le inviamo l'aggiornamento e il resoconto contabile relativo al Suo immobile ${property?.name || ""} ${addressStr}.

Riepilogo Gestione:
- ${tenantStr}
- Condominio: ${isCondoConstituted ? "Attivo / Oneri sincronizzati" : "Non Costituito"}
- Scadenze registrate nel mastrino dell'inquilino: ${movementsList.length} (Saldati: ${movementsList.filter(m => m.status === "Paid").length}, Pendenti: ${movementsList.filter(m => m.status === "Pending" || m.status === "Overdue").length})

Situazione Pagamenti Inquilino:
${outstandingStr}

Restiamo a disposizione per qualsiasi necessità.
Cordiali saluti.`;
    };

    const rawOwnerName = property?.owner || "";
    const individualOwners = rawOwnerName
      ? rawOwnerName
          .split(/,|\be\b|\band\b|&|-/i)
          .map(name => name.trim())
          .filter(name => name.length > 0)
      : [];

    return (
      <div className="space-y-6 animate-fadeIn" id="tenant-ledger-page">
        {/* Style scoped specifically for printing the ledger sheet */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #mastrino-print-area, #mastrino-print-area * {
              visibility: visible;
            }
            #mastrino-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: white !important;
              color: black !important;
              box-shadow: none !important;
              border: none !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>

        {/* Navigation header (no-print) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 no-print">
          <button
            onClick={() => {
              setSelectedTenantLedger(null);
              setLedgerSearchQuery("");
              setActiveLedgerCategory("all");
            }}
            className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl active:transition-all self-start"
          >
            <ArrowLeft size={14} />
            <span>Torna all'Anagrafica</span>
          </button>

          <button
            onClick={handlePrintLedger}
            className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4.5 py-2.5 rounded-xl active:transition-all shadow-sm"
          >
            <Printer size={14} />
            <span>Stampa Mastrino Contabile</span>
          </button>
        </div>

        {/* Pannello di Condivisione Rapida (no-print) */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 no-print shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg shrink-0">
                <Share2 size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Condivisione & Invio Rapido Mastrino</h3>
                <p className="text-[11px] text-slate-500">Invia o condividi il resoconto contabile direttamente ai conduttori o ai proprietari dell'immobile.</p>
              </div>
            </div>
            {copiedText && (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[10px] px-2.5 py-1 rounded-lg self-start sm:self-auto animate-pulse shrink-0">
                ✓ Copiato con successo!
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. SEZIONE INQUILINO */}
            <div className="bg-white border border-slate-150 rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Destinatario: Inquilino</span>
                  {t.phone && <span className="text-[10px] font-mono text-slate-400">{t.phone}</span>}
                </div>
                <h4 className="font-extrabold text-slate-800 text-sm mt-2">{t.name}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Genera o invia il riepilogo del canone e delle rate all'inquilino.</p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50">
                <button
                  onClick={() => {
                    const text = getTenantShareText();
                    const cleanPhone = t.phone ? t.phone.replace(/[^0-9]/g, "") : "";
                    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
                    window.open(waUrl, "_blank");
                  }}
                  className="flex-1 min-w-[110px] inline-flex items-center justify-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2 px-3 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <span>Invia WhatsApp 💬</span>
                </button>

                <button
                  onClick={() => {
                    const text = getTenantShareText();
                    const mailUrl = `mailto:${t.email}?subject=${encodeURIComponent(`Mastrino Contabile - ${property?.name || ""}`)}&body=${encodeURIComponent(text)}`;
                    window.open(mailUrl, "_blank");
                  }}
                  className="flex-1 min-w-[110px] inline-flex items-center justify-center space-x-1 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs py-2 px-3 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <span>Invia Email ✉️</span>
                </button>

                <button
                  onClick={() => {
                    const text = getTenantShareText();
                    navigator.clipboard.writeText(text);
                    setCopiedText("inquilino");
                    setTimeout(() => setCopiedText(null), 3000);
                  }}
                  className="inline-flex items-center justify-center p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200"
                  title="Copia negli appunti"
                >
                  {copiedText === "inquilino" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* 2. SEZIONE PROPRIETARIO / PROPRIETARI */}
            <div className="bg-white border border-slate-150 rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Destinatario: Proprietà</span>
                  <span className="text-[10px] text-slate-400 font-bold">{individualOwners.length > 0 ? `${individualOwners.length} proprietari rilevati` : "Nessun proprietario salvato"}</span>
                </div>
                <h4 className="font-extrabold text-slate-800 text-sm mt-2 truncate max-w-[300px]">{property?.owner || "Nessun proprietario indicato"}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Invia il resoconto del mastrino contabile e lo stato dei pagamenti ai proprietari.</p>
              </div>

              <div className="flex flex-col space-y-2 pt-2 border-t border-slate-100">
                {individualOwners.map((ownerName, idx) => (
                  <div key={idx} className="flex flex-col gap-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-150">
                    <span className="text-[10px] font-bold text-slate-600 block truncate">Proprietario: <strong>{ownerName}</strong></span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          const text = getOwnerShareText(ownerName);
                          const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
                          window.open(waUrl, "_blank");
                        }}
                        className="flex-1 inline-flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-250 font-bold text-[10px] py-1.5 px-2 rounded-md transition-all cursor-pointer"
                      >
                        <span>WhatsApp 💬</span>
                      </button>

                      <button
                        onClick={() => {
                          const text = getOwnerShareText(ownerName);
                          const mailUrl = `mailto:?subject=${encodeURIComponent(`Aggiornamento Mastrino Immobile - ${property?.name || ""}`)}&body=${encodeURIComponent(text)}`;
                          window.open(mailUrl, "_blank");
                        }}
                        className="flex-1 inline-flex items-center justify-center bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold text-[10px] py-1.5 px-2 rounded-md transition-all cursor-pointer"
                      >
                        <span>Email ✉️</span>
                      </button>

                      <button
                        onClick={() => {
                          const text = getOwnerShareText(ownerName);
                          navigator.clipboard.writeText(text);
                          setCopiedText(`owner-${idx}`);
                          setTimeout(() => setCopiedText(null), 3000);
                        }}
                        className="inline-flex items-center justify-center p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-md transition-all cursor-pointer"
                        title="Copia negli appunti"
                      >
                        {copiedText === `owner-${idx}` ? <Check size={12} className="text-emerald-600 font-black" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                ))}

                {/* If multiple owners, offer a button to both owners at once */}
                {individualOwners.length > 1 && (
                  <button
                    onClick={() => {
                      const textBoth = `Gentili Proprietari ${individualOwners.join(" e ")},
Le inviamo l'aggiornamento relativo al Suo immobile situato in ${property?.address || ""}.

L'inquilino ${t.name} ha scadenze caricate per un totale di ${movementsList.length} rate/oneri.
${totalOutstanding > 0 ? `L'importo residuo o in pendenza dell'inquilino ammonta complessivamente a €${totalOutstanding.toLocaleString("it-IT", { minimumFractionDigits: 2 })}.` : "L'inquilino è perfettamente in regola con tutti i pagamenti registrati."}

Restiamo a disposizione per qualsiasi chiarimento.`;
                      navigator.clipboard.writeText(textBoth);
                      setCopiedText("both");
                      setTimeout(() => setCopiedText(null), 3000);
                    }}
                    className="w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] py-2 rounded-lg transition-colors cursor-pointer mt-1"
                  >
                    {copiedText === "both" ? "✓ Riepilogo Copiato per Entrambi!" : "📋 Copia Riepilogo per Entrambi i Proprietari"}
                  </button>
                )}

                {individualOwners.length === 0 && (
                  <div className="p-2 text-center text-slate-400 text-[10px] italic">
                    Nessun proprietario indicato per questo immobile. Compila il campo proprietario nell'immobile per abilitare la condivisione.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PRINTABLE AREA */}
        <div className="space-y-6" id="mastrino-print-area">
          {/* Header of the printed sheet */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm border border-slate-800 flex flex-col md:flex-row justify-between gap-6">
            <div>
              <span className="inline-flex items-center space-x-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider mb-3">
                <Logo size={12} className="shrink-0" />
                <span>Mastrino Contabile Esteso</span>
              </span>
              <div className="flex flex-wrap items-center gap-3.5 mb-2">
                <h2 className="text-2xl font-extrabold tracking-tight font-sans text-white leading-none">{t.name}</h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider shadow-xs ${cls.colorClass}`}>
                  <span>{cls.emoji}</span>
                  <span>{cls.label}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Anagrafica contabile completa dei flussi finanziari registrati, scadenze contrattuali e oneri ordinari.
              </p>
              
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-4 pt-4 border-t border-slate-800 text-xs text-slate-300">
                <div className="flex items-center space-x-2">
                  <Mail size={13} className="text-slate-500 shrink-0" />
                  <span className="break-all">{t.email}</span>
                </div>
                {t.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone size={13} className="text-slate-500 shrink-0" />
                    <span>{t.phone}</span>
                  </div>
                )}
                {t.fiscalCode && (
                  <div className="flex items-center space-x-2">
                    <FileDigit size={13} className="text-slate-500 shrink-0" />
                    <span>Cod. Fiscale: <strong className="font-mono text-slate-100 uppercase">{t.fiscalCode}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Financial summary snapshot */}
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between md:min-w-[200px] shrink-0 text-right">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Canone Mensile</span>
                <p className="text-xl font-black text-emerald-400 mt-1">
                  {activeContract ? `€${activeContract.rentAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "N/D"}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-850">
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Immobile Collegato</span>
                <p className="text-xs font-bold text-slate-200 mt-0.5 truncate max-w-[180px]">
                  {property ? property.name : "Nessun Immobile"}
                </p>
              </div>
            </div>
          </div>

          {/* PROPERTY AND CONDOMINIUM CONSTITUTION BLOCKS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Property details */}
            <div className="bg-white rounded-2xl border border-slate-150 p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Landmark size={14} className="text-indigo-600" />
                  <span>Dettagli Immobile Locato</span>
                </h3>
                {property ? (
                  <div className="mt-3.5 space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400">Nome:</span>
                      <strong className="text-slate-800 ml-1.5">{property.name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Indirizzo:</span>
                      <span className="text-slate-700 ml-1.5">{property.address}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Tipologia:</span>
                      <strong className="text-slate-800 ml-1.5 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{property.type}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Proprietario:</span>
                      <strong className="text-slate-800 ml-1.5">{property.owner || "Nessuno (Verificare)"}</strong>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs italic mt-4">Nessun immobile attualmente locato o assegnato.</p>
                )}
              </div>

              {activeContract && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Inizio: {new Date(activeContract.startDate).toLocaleDateString("it-IT")}</span>
                  <span>Fine: {new Date(activeContract.endDate).toLocaleDateString("it-IT")}</span>
                </div>
              )}
            </div>

            {/* Condominium status checks - USER REQUEST: "If there is no condominium established, it should state that the condominium is not established and that the condominium dates are zero." */}
            <div className="bg-white rounded-2xl border border-slate-150 p-5">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Receipt size={14} className="text-indigo-600" />
                <span>Stato Amministrazione Condominiale</span>
              </h3>
              
              {!property || !isCondoConstituted ? (
                <div className="mt-4 p-4 bg-rose-50/70 border border-rose-150 rounded-xl text-xs text-rose-900">
                  <div className="flex items-start space-x-2.5">
                    <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-rose-950">Condominio Non Costituito / Assente</h4>
                      <p className="text-[11px] text-rose-800 mt-1 leading-relaxed">
                        Per questa unità immobiliare non è stabilita alcuna gestione condominiale. Pertanto, 
                        <strong> le scadenze del condominio sono pari a zero (nessun addebito generato)</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-4 bg-emerald-50/70 border border-emerald-150 rounded-xl text-xs text-emerald-900">
                  <div className="flex items-start space-x-2.5">
                    <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-emerald-950">Condominio Costituito</h4>
                      <p className="text-[11px] text-emerald-800 mt-1 leading-relaxed">
                        Il condominio è regolarmente istituito. Tutte le scadenze degli oneri accessori (spese condominiali ordinarie) a carico di questo conduttore sono sincronizzate e caricate nello specchietto sottostante.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SINTESI DEI SALDI CONTABILI (Visualizzata sia a schermo sia in stampa) */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4 shadow-xs" id="sintesi-saldi-box">
            <div className="bg-white p-4 rounded-2xl border border-slate-150">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Totale Dovuto (Doveva Dare)</span>
              <p className="text-xl font-black text-slate-800 mt-1">
                €{totalDovuto.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Somma delle scadenze e degli oneri generati ad oggi.</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-150">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Totale Pagato (Ha Dato)</span>
              <p className="text-xl font-black text-emerald-600 mt-1">
                €{totalPagato.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Totale dei pagamenti effettivamente riscossi e saldati.</p>
            </div>

            <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
              isInPari 
                ? "bg-emerald-500/10 border-emerald-300 text-emerald-950" 
                : currentBalance < 0 
                  ? "bg-rose-500/10 border-rose-300 text-rose-950 animate-pulse" 
                  : "bg-indigo-500/10 border-indigo-300 text-indigo-950"
            }`}>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider opacity-85">Situazione Contabile (Saldo)</span>
                <p className="text-xl font-black mt-1">
                  {isInPari 
                    ? "In Pari ✓" 
                    : `In ritardo di €${Math.abs(currentBalance).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`
                  }
                </p>
              </div>
              <div className="mt-2 text-[10px] font-extrabold uppercase tracking-wide">
                {isInPari ? (
                  <span className="text-emerald-700 bg-emerald-100/85 px-2 py-0.5 rounded-md inline-block border border-emerald-200">
                    👍 È in pari e tutto ok!
                  </span>
                ) : currentBalance < 0 ? (
                  <span className="text-rose-700 bg-rose-100/85 px-2 py-0.5 rounded-md inline-block border border-rose-200">
                    ⚠️ Risultano insoluti o pendenze
                  </span>
                ) : (
                  <span className="text-indigo-700 bg-indigo-150 px-2 py-0.5 rounded-md inline-block">
                    ✨ Eccedenza / Credito
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* SEARCH AND FILTER BAR (no-print) */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            {/* Category tabs */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "all", label: "Tutti i Movimenti 📋" },
                { id: "rent", label: "Affitti 💶" },
                { id: "condo", label: "Condominio 🏢" },
                { id: "registration", label: "Registrazione Contratto 📄" },
                { id: "maintenance", label: "Manutenzioni 🛠️" }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveLedgerCategory(tab.id as any)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeLedgerCategory === tab.id
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Query Search */}
            <div className="relative md:max-w-xs w-full">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Cerca scadenze o voci..."
                value={ledgerSearchQuery}
                onChange={e => setLedgerSearchQuery(e.target.value)}
                className="w-full text-xs border border-slate-200 bg-white rounded-xl pl-9 pr-4 py-2.5 outline-hidden focus:border-slate-400"
              />
            </div>
          </div>

          {/* CONTROL BAR FOR LEDGER SCALE & PRINT PREVIEW (no-print) */}
          <div className="bg-slate-50/50 p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
            <div className="flex items-center space-x-2.5">
              <span className="text-sm shrink-0">🎚️</span>
              <div>
                <span className="text-xs font-extrabold text-slate-800 block leading-none">Scala Caratteri Mastrino (Anteprima di Stampa)</span>
                <span className="text-[10px] text-slate-500 mt-1 block">Adatta e ridimensiona i testi del mastrino per una visualizzazione ottimizzata senza sprechi.</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-slate-150 shadow-2xs">
              <span className="text-[9px] font-bold text-slate-400">Dimensione:</span>
              <input
                type="range"
                min="0.55"
                max="1.15"
                step="0.05"
                value={ledgerScale}
                onChange={e => setLedgerScale(parseFloat(e.target.value))}
                className="w-24 sm:w-32 accent-indigo-600 h-1 bg-slate-150 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] font-black text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{(ledgerScale * 100).toFixed(0)}%</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setLedgerScale(0.65)}
                  className={`text-[9px] font-black px-2 py-0.5 rounded border transition-colors ${ledgerScale === 0.65 ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}
                >
                  Super-Compatta (65%)
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerScale(0.80)}
                  className={`text-[9px] font-black px-2 py-0.5 rounded border transition-colors ${ledgerScale === 0.80 ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}
                >
                  Anteprima (80%)
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerScale(1.00)}
                  className={`text-[9px] font-black px-2 py-0.5 rounded border transition-colors ${ledgerScale === 1.00 ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}
                >
                  Normale (100%)
                </button>
              </div>
            </div>
          </div>

          {/* MOVEMENTS LEDGER TABLE */}
          <div className="bg-white rounded-3xl border border-slate-150 overflow-hidden shadow-xs">
            {movementsWithBalances.length === 0 ? (
               <div className="p-12 text-center text-slate-400 text-xs">
                <FileText size={32} className="mx-auto text-slate-300 mb-2.5" />
                <span>Nessun movimento o scadenza contabile corrisponde ai criteri impostati.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-300 font-mono" style={{ fontSize: `${ledgerScale * 13}px`, lineHeight: 1.25 }}>
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 uppercase tracking-wider font-extrabold border border-slate-300" style={{ fontSize: `${ledgerScale * 9.5}px` }}>
                      <th className="border border-slate-300" style={{ padding: `${ledgerScale * 12}px` }}>Scadenza</th>
                      <th className="border border-slate-300" style={{ padding: `${ledgerScale * 12}px` }}>Stato</th>
                      <th className="border border-slate-300" style={{ padding: `${ledgerScale * 12}px` }}>Voce / Descrizione</th>
                      <th className="border border-slate-300 text-right" style={{ padding: `${ledgerScale * 12}px` }}>Dovuto (Doveva Dare)</th>
                      <th className="border border-slate-300 text-right" style={{ padding: `${ledgerScale * 12}px` }}>Pagato (Ha Dato)</th>
                      <th className="border border-slate-300 text-right" style={{ padding: `${ledgerScale * 12}px` }}>Saldo Progressivo</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {movementsWithBalances.map((m, idx) => {
                      let statusBadge = "";
                      if (m.status === "Paid") {
                        statusBadge = "bg-emerald-50 text-emerald-700 border border-emerald-150 font-black";
                      } else if (m.status === "Overdue") {
                        statusBadge = "bg-rose-50 text-rose-700 border border-rose-150 font-black animate-pulse";
                      } else {
                        statusBadge = "bg-amber-50 text-amber-700 border border-amber-150 font-bold";
                      }

                      const mPaidAmount = m.status === "Paid" ? m.amount : 0;
                      const isRowInPari = Math.abs(m.balance) < 0.01;

                      return (
                        <tr key={`${m.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                          <td className="border border-slate-300 font-mono font-bold text-slate-700 whitespace-nowrap" style={{ padding: `${ledgerScale * 11}px` }}>
                            {new Date(m.date).toLocaleDateString("it-IT")}
                          </td>
                          <td className="border border-slate-300 whitespace-nowrap" style={{ padding: `${ledgerScale * 11}px` }}>
                            <span style={{ padding: `${ledgerScale * 3}px ${ledgerScale * 7}px`, fontSize: `${ledgerScale * 8.5}px`, border: "1px solid currentColor" }} className={`rounded font-bold uppercase tracking-wider ${statusBadge}`}>
                              {m.status === "Paid" ? "✓ Saldato" : m.status === "Overdue" ? "⚠ Insoluto" : "⏳ Pendente"}
                            </span>
                          </td>
                          <td className="border border-slate-300 font-sans" style={{ padding: `${ledgerScale * 11}px` }}>
                            <div className="flex items-center space-x-1.5 mb-1" style={{ marginBottom: `${ledgerScale * 4}px` }}>
                              <span className="bg-slate-100 text-slate-800 border border-slate-200 px-1.5 py-0.5 rounded font-semibold" style={{ fontSize: `${ledgerScale * 8.5}px` }}>
                                {m.categoryLabel}
                              </span>
                            </div>
                            <span className="font-extrabold text-slate-900 block leading-tight" style={{ fontSize: `${ledgerScale * 13}px` }}>{m.title}</span>
                            <span className="text-slate-500 block font-normal leading-normal" style={{ fontSize: `${ledgerScale * 10}px`, marginTop: `${ledgerScale * 2}px` }}>{m.description}</span>
                          </td>
                          {/* DOVUTO (Doveva Dare) */}
                          <td className="border border-slate-300 font-bold text-slate-700 text-right whitespace-nowrap" style={{ padding: `${ledgerScale * 11}px`, fontSize: `${ledgerScale * 13}px` }}>
                            €{m.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                          </td>
                          {/* PAGATO (Ha Dato) */}
                          <td className="border border-slate-300 font-bold text-emerald-600 text-right whitespace-nowrap" style={{ padding: `${ledgerScale * 11}px`, fontSize: `${ledgerScale * 13}px` }}>
                            €{mPaidAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                          </td>
                          {/* SALDO PROGRESSIVO */}
                          <td style={{ padding: `${ledgerScale * 11}px` }} className={`border border-slate-300 font-black text-right whitespace-nowrap ${
                            isRowInPari 
                              ? "text-slate-500" 
                              : m.balance < 0 
                                ? "text-rose-600" 
                                : "text-emerald-600"
                          }`}>
                            <div className="leading-tight">
                              <span style={{ fontSize: `${ledgerScale * 13.5}px` }}>€{m.balance.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                              <span className="block font-bold uppercase" style={{ fontSize: `${ledgerScale * 8}px`, marginTop: `${ledgerScale * 2}px` }}>
                                {isRowInPari ? "In pari ✓" : m.balance < 0 ? "In debito" : "In credito"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERING MASTER LIST OF TENANTS ---
  return (
    <div className="space-y-6" id="tenants-view-container">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Anagrafica Inquilini & Mastrini</h2>
          <p className="text-xs text-slate-500 mt-0.5">Gestisci i conduttori, consulta i mastrini dei pagamenti e gli estremi delle riconciliazioni.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          id="add-tenant-btn"
          className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Nuovo Inquilino</span>
        </button>
      </div>

      {/* Tenants list */}
      {tenants.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-lg mx-auto mt-8">
          <div className="bg-slate-50 text-slate-400 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <Users size={28} />
          </div>
          <h3 className="font-sans font-bold text-slate-800 text-base">Nessun inquilino registrato</h3>
          <p className="text-xs text-slate-500 mt-2">
            Non ci sono conduttori salvati. Aggiungi il primo inquilino per collegarlo ai contratti e tenere traccia dei canoni ricevuti.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-5 inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs transition-colors"
          >
            <Plus size={14} />
            <span>Aggiungi inquilino</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tenants.map((tenant) => {
              const occupiedProp = properties.find(p => p.id === tenant.propertyId);
              const cls = getTenantClassification(tenant);

              return (
                <div 
                  key={tenant.id} 
                  className={`bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:shadow-md hover:border-indigo-150 transition-all duration-300 flex flex-col justify-between ${cls.cardBorder}`}
                  id={`tenant-card-${tenant.id}`}
                >
                  <div className="p-5 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 ${tenant.isCompany ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"} rounded-full flex items-center justify-center font-bold`}>
                          {tenant.isCompany ? "🏢" : (tenant.name.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase() || "I")}
                        </div>
                        <div>
                          <h3 className={`font-sans font-extrabold text-base leading-snug transition-colors duration-300 ${
                            cls.status === "critical" 
                              ? "text-rose-600 font-black flex items-center gap-1.5" 
                              : cls.status === "red"
                              ? "text-rose-500 font-bold flex items-center gap-1.5"
                              : "text-slate-900"
                          }`}>
                            {cls.status === "critical" && <span className="text-sm shrink-0" title="Contenzioso Legale Attivo">⚖️</span>}
                            <span>{tenant.name}</span>
                            {tenant.isCompany && (
                              <span className="ml-1.5 inline-block text-[9px] font-extrabold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-sm uppercase tracking-wide shrink-0">Società</span>
                            )}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {tenant.id.slice(0, 8)}</span>
                        </div>
                      </div>
                      
                      {/* Button to open the SEPARATE Ledger page as requested! */}
                      <button
                        onClick={() => setSelectedTenantLedger(tenant)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md hover:transition-all cursor-pointer"
                        title="Analizza Mastrino Contabile Completo"
                      >
                        <Receipt size={13} />
                        <span>Analizza 🔍</span>
                      </button>
                    </div>

                    {/* Dynamic Classification Indicator */}
                    <div className={`mt-3.5 px-3 py-2 border rounded-xl flex items-center justify-between gap-2 shadow-2xs ${cls.colorClass}`}>
                      <div className="flex items-center space-x-2">
                        <span className="text-base">{cls.emoji}</span>
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-wider leading-none">Rapporto Inquilino</p>
                          <span className="text-[10px] font-black block mt-0.5 leading-tight">{cls.label}</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-black opacity-90 px-1.5 py-0.5 rounded-md bg-white/45 uppercase tracking-wider leading-none shrink-0">
                        {cls.status === "green" ? "OK ✓" : cls.status === "orange" ? "ATTESA" : cls.status === "red" ? "RITARDO" : "LEGALE"}
                      </span>
                    </div>

                    <div className="space-y-2 mt-5 text-xs text-slate-500 border-t border-slate-50 pt-4">
                      <div className="flex items-center space-x-2">
                        <Mail size={14} className="text-slate-400 shrink-0" />
                        <a href={`mailto:${tenant.email}`} className="text-slate-600 hover:underline">{tenant.email}</a>
                      </div>
                      {tenant.phone && (
                        <div className="flex items-center space-x-2">
                          <Phone size={14} className="text-slate-400 shrink-0" />
                          <a href={`tel:${tenant.phone}`} className="text-slate-600 hover:underline">{tenant.phone}</a>
                        </div>
                      )}
                      {tenant.isCompany ? (
                        <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-2">
                          <p className="text-[9px] font-black text-amber-800 uppercase tracking-wider leading-none">Dati Societari</p>
                          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 mt-1">
                            <div>
                              <span className="font-semibold text-slate-400 block">P.IVA</span>
                              <strong className="font-mono text-slate-700">{tenant.vatNumber || "-"}</strong>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-400 block">C.F. Soc</span>
                              <strong className="font-mono text-slate-700 uppercase">{tenant.fiscalCode || "-"}</strong>
                            </div>
                          </div>
                          {tenant.pec && (
                            <div className="text-[10px] text-slate-600 truncate" title={tenant.pec}>
                              <span className="font-semibold text-slate-400">PEC:</span> <span className="text-slate-700">{tenant.pec}</span>
                            </div>
                          )}
                          {tenant.registeredOffice && (
                            <div className="text-[10px] text-slate-600" title={tenant.registeredOffice}>
                              <span className="font-semibold text-slate-400">Sede Legale:</span> <span className="text-slate-700">{tenant.registeredOffice}</span>
                            </div>
                          )}
                          {(tenant.legalRepresentativeName || tenant.legalRepresentativeFiscalCode) && (
                            <div className="text-[10px] text-slate-600 pt-1 border-t border-slate-200/50 mt-1">
                              <span className="font-black text-slate-500 block text-[8px] uppercase tracking-wide">Rappr. Legale</span>
                              {tenant.legalRepresentativeName && <span className="block text-slate-700 font-semibold">{tenant.legalRepresentativeName}</span>}
                              {tenant.legalRepresentativeFiscalCode && <span className="block font-mono text-slate-500 text-[9px] uppercase">{tenant.legalRepresentativeFiscalCode}</span>}
                            </div>
                          )}
                          {tenant.visuraCameraleFileName && (
                            <div className="text-[9px] bg-emerald-50 text-emerald-800 p-1.5 rounded-md flex items-center justify-between mt-1 border border-emerald-100">
                              <span className="truncate max-w-[140px]" title={tenant.visuraCameraleFileName}>📄 {tenant.visuraCameraleFileName}</span>
                              <span className="font-bold text-[7px] uppercase bg-emerald-200 px-1 py-0.5 rounded-sm">Visura</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        tenant.fiscalCode && (
                          <div className="flex items-center space-x-2">
                            <FileDigit size={14} className="text-slate-400 shrink-0" />
                            <span>C.F.: <strong className="font-mono text-slate-700 uppercase">{tenant.fiscalCode}</strong></span>
                          </div>
                        )
                      )}
                      {occupiedProp && (
                        <div className="flex items-start space-x-2 bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100/30 mt-3">
                          <Landmark size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                          <div className="w-full">
                            <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider leading-none">Dettagli Immobile Locato</p>
                            <span className="text-xs text-slate-700 font-semibold block mt-1">{occupiedProp.name}</span>
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              Proprietario: <strong className="text-slate-700">{occupiedProp.owner || "Nessuno (Verificare)"}</strong>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {tenant.notes && (
                      <div className="mt-4 bg-slate-50 p-2.5 rounded-xl text-xs text-slate-600 border border-slate-100/30">
                        <p className="font-semibold text-slate-700 text-[10px] uppercase tracking-wide mb-1">Annotazioni</p>
                        <p className="line-clamp-2">{tenant.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="px-5 py-3 bg-slate-50/40 border-t border-slate-50 flex justify-end space-x-2">
                    <button
                      onClick={() => handleOpenEditModal(tenant)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(tenant.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tenant modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-sans font-bold text-base">
                {editingTenant ? "Modifica Inquilino" : "Nuovo Inquilino"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Type selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tipologia Inquilino *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCompany(false)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer ${
                      !isCompany
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    👤 Persona Fisica
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCompany(true)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer ${
                      isCompany
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    🏢 Società
                  </button>
                </div>
              </div>

              {!isCompany ? (
                /* Individual Tenant Fields */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Nome e Cognome *
                    </label>
                    <input
                      type="text"
                      required={!isCompany}
                      placeholder="Mario Rossi"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Codice Fiscale
                    </label>
                    <input
                      type="text"
                      placeholder="RSSMRA80A01H501Y"
                      value={fiscalCode}
                      onChange={(e) => setFiscalCode(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 uppercase font-mono"
                    />
                  </div>
                </div>
              ) : (
                /* Company Tenant Fields */
                <div className="space-y-4 border-l-2 border-amber-300 pl-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Ragione Sociale *
                    </label>
                    <input
                      type="text"
                      required={isCompany}
                      placeholder="Esempio: Rossi S.r.l."
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Codice Fiscale Società
                      </label>
                      <input
                        type="text"
                        placeholder="Esempio: 12345678901"
                        value={companyFiscalCode}
                        onChange={(e) => setCompanyFiscalCode(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 font-mono uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Partita IVA
                      </label>
                      <input
                        type="text"
                        placeholder="Esempio: 12345678901"
                        value={vatNumber}
                        onChange={(e) => setVatNumber(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        PEC
                      </label>
                      <input
                        type="email"
                        placeholder="azienda@legalmail.it"
                        value={pec}
                        onChange={(e) => setPec(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Sede Legale
                      </label>
                      <input
                        type="text"
                        placeholder="Via Roma 45, Milano"
                        value={registeredOffice}
                        onChange={(e) => setRegisteredOffice(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100/60 space-y-3">
                    <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">Rappresentante Legale</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Nome e Cognome
                        </label>
                        <input
                          type="text"
                          placeholder="Mario Rossi"
                          value={legalRepresentativeName}
                          onChange={(e) => setLegalRepresentativeName(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 outline-hidden focus:border-indigo-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Codice Fiscale
                        </label>
                        <input
                          type="text"
                          placeholder="RSSMRA80A01H501Y"
                          value={legalRepresentativeFiscalCode}
                          onChange={(e) => setLegalRepresentativeFiscalCode(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 outline-hidden focus:border-indigo-500 font-mono uppercase bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Visura Camerale
                    </label>
                    <div className="border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 text-center hover:bg-slate-100/50 transition-colors cursor-pointer relative min-h-[48px] flex items-center justify-center">
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setVisuraCameraleFileName(file.name);
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-700">
                          {visuraCameraleFileName ? `📄 ${visuraCameraleFileName}` : "Seleziona o trascina la Visura Camerale"}
                        </p>
                        <p className="text-[10px] text-slate-400">PDF, PNG, JPG fino a 10MB</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Shared Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Indirizzo Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="mario.rossi@email.it"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Numero di Telefono
                  </label>
                  <input
                    type="tel"
                    placeholder="+39 333 1234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Collega a Immobile
                </label>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-hidden focus:border-indigo-500"
                >
                  <option value="">Nessuno (Libero)</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Note Co-inquilini / Garanti
                </label>
                <textarea
                  placeholder="Garante: papà Rossi Giuseppe, referenziato, contrattualizzato a tempo indeterminato..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Salva Inquilino
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

