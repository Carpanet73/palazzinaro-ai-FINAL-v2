
import React, { useState, useMemo } from "react";
import { 
  ArrowLeft, 
  Building2, 
  User, 
  Users, 
  CheckCircle2, 
  Scale, 
  ArrowRight, 
  Search, 
  Coins, 
  AlertCircle, 
  MapPin, 
  Home,
  X,
  Calendar,
  FileText,
  Tag,
  Check,
  AlertTriangle,
  Info
} from "lucide-react";
import { Property, Tenant, Contract, FastClosingItem, Reminder, LegalCase, AppSection, BankMovement, Maintenance } from "../types";
import { getTenantClassification } from "../lib/statusHelper";

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
  onViewTenantLedger
}: OwnersViewProps) {
  const [selectedOwner, setSelectedOwner] = useState<OwnerInfo | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [activeLedgerTab, setActiveLedgerTab] = useState<"rent" | "condo" | "taxes" | "other" | "maintenance">("rent");
  const [searchTerm, setSearchTerm] = useState("");

  // --- SELECTED PROPERTY DETAILS LOGIC ---
  const propertyModalData = useMemo(() => {
    if (!selectedProperty) return null;
    const p = selectedProperty;
    
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
    const relatedClosingItems = fastClosing.filter(fc => {
      const matchesId = fc.sourceId === p.id || (activeContract && fc.sourceId === activeContract.id);
      const matchesTitle = (fc.title || "").toLowerCase().includes((p.name || "").toLowerCase());
      return matchesId || matchesTitle;
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
          let reconciliationType = "📑 Scadenza non saldata";
          let notes = item.description || "";

          if (item.status === "Paid") {
            if (matchedMovement) {
              paymentDate = matchedMovement.date; // Actual payment date (Cassa!)
              reconciliationType = "🏦 Bonifico Riconciliato";
              notes = `Riconciliato il ${new Date(matchedMovement.date).toLocaleDateString("it-IT")} con: ${matchedMovement.description}`;
              pairedMovementIds.add(matchedMovement.id);
            } else {
              paymentDate = item.dueDate; // Manual payment on due date
              reconciliationType = "📑 Manuale (Senza Bonifico)";
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
            notes: notes
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
            type: "🏦 Movimento Diretto",
            notes: "Pagamento registrato direttamente in cassa"
          });
        }
      });

      // Sort by Data Competenza descending
      ledger.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
      return ledger;
    };

    // 1. Canoni di Affitto (Rent)
    const rentPayments = buildUnifiedLedger(
      item => item.source === "contract" || (item.title || "").toLowerCase().includes("affitto") || (item.title || "").toLowerCase().includes("canone"),
      m => m.reconciledWith?.type === "contract" || (m.description || "").toLowerCase().includes("affitto") || (m.description || "").toLowerCase().includes("canone"),
      "Canone locazione"
    );

    // 2. Spese Condominiali (Condominium Fees)
    const condoPayments = buildUnifiedLedger(
      item => item.source === "condominium" || (item.title || "").toLowerCase().includes("condominio") || (item.title || "").toLowerCase().includes("spese cond"),
      m => m.reconciledWith?.type === "condominium" || (m.description || "").toLowerCase().includes("condominio") || (m.description || "").toLowerCase().includes("spese cond"),
      "Rata condominiale"
    );

    // 3. Tasse di Registro (Registration Taxes)
    const taxPayments = buildUnifiedLedger(
      item => (item.title || "").toLowerCase().match(/(registro|imposta|tassa|f24|erario)/) !== null,
      m => (m.description || "").toLowerCase().match(/(registro|imposta|tassa|f24|erario)/) !== null,
      "Tassa registro"
    );

    // 4. Altri Movimenti / Residui (Other/Maintenance/Manual)
    const otherPayments = buildUnifiedLedger(
      item => {
        const isRent = item.source === "contract" || (item.title || "").toLowerCase().includes("affitto") || (item.title || "").toLowerCase().includes("canone");
        const isCondo = item.source === "condominium" || (item.title || "").toLowerCase().includes("condominio") || (item.title || "").toLowerCase().includes("spese cond");
        const isTax = (item.title || "").toLowerCase().match(/(registro|imposta|tassa|f24|erario)/) !== null;
        return !isRent && !isCondo && !isTax;
      },
      m => {
        const isRent = m.reconciledWith?.type === "contract" || (m.description || "").toLowerCase().includes("affitto") || (m.description || "").toLowerCase().includes("canone");
        const isCondo = m.reconciledWith?.type === "condominium" || (m.description || "").toLowerCase().includes("condominio") || (m.description || "").toLowerCase().includes("spese cond");
        const isTax = (m.description || "").toLowerCase().match(/(registro|imposta|tassa|f24|erario)/) !== null;
        return !isRent && !isCondo && !isTax;
      },
      "Altra voce contabile"
    );

    const ownerMaintenance = maintenance.filter(m => m.propertyId === p.id).filter(ticket => {
      // If property status is not "Rented", everything charges the owner!
      if (p.status !== "Rented") {
        return true;
      }
      // If rented, only show maintenance where chargedTo is not tenant
      return ticket.chargedTo !== "tenant";
    });

    return {
      activeContract,
      tenant,
      condo,
      rentPayments,
      condoPayments,
      taxPayments,
      otherPayments,
      ownerMaintenance
    };
  }, [selectedProperty, contracts, tenants, condominiums, fastClosing, movements, maintenance]);

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

    return Array.from(ownersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [properties]);

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
        const matchesId = fc.sourceId === p.id || (activeContract && fc.sourceId === activeContract.id);
        const matchesTitle = (fc.title || "").toLowerCase().includes((p.name || "").toLowerCase());
        return matchesId || matchesTitle;
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
        const matchesId = fc.sourceId === p.id || (activeContract && fc.sourceId === activeContract.id);
        const matchesTitle = (fc.title || "").toLowerCase().includes((p.name || "").toLowerCase());
        return matchesId || matchesTitle;
      });
      
      propertyClosingItems.forEach(item => {
        if (item.status === "Paid" || item.status === "Cancelled") return;
        
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
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          owner.isCompound 
                            ? "bg-amber-100 text-amber-800" 
                            : "bg-indigo-100 text-indigo-800"
                        }`}>
                          {owner.isCompound ? "👥 Comproprietà" : "👤 Proprietario Singolo"}
                        </span>
                      </div>

                      <h3 className="font-sans font-black text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                        {owner.name}
                      </h3>
                      
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
                <span className="text-[10px] uppercase font-black text-indigo-400 tracking-wider">
                  {selectedOwner.isCompound ? "Comproprietà Selezionata" : "Proprietario Singolo"}
                </span>
                <h3 className="text-lg font-sans font-black mt-0.5">{selectedOwner.name}</h3>
                {selectedOwner.isCompound && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Composto da: {selectedOwner.individualNames.join(", ")}
                  </p>
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
              <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                ownerFinancials.totalDebit > 0 
                  ? "bg-amber-100 text-amber-800 border border-amber-200" 
                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
              }`}>
                {ownerFinancials.totalDebit > 0 ? "⚠️ Pendenze Attive" : "👍 Contabilità in Regola"}
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
                    <span className="text-rose-700 font-bold">
                      ⚠️ Sono presenti pagamenti da effettuare per un totale di €{ownerFinancials.totalDebit.toLocaleString("it-IT")}.
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold">
                      👍 Nessun debito o pendenza riscontrata sui condomini o adempimenti catastali.
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Owner Credit Info (Rents to collect) */}
            {ownerFinancials.overdueRent > 0 && (
              <div className="bg-blue-50/60 border border-blue-200 p-3.5 rounded-xl text-blue-950 text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-base">💰</span>
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
                  const matchesId = fc.sourceId === p.id || (activeContract && fc.sourceId === activeContract.id);
                  const matchesTitle = (fc.title || "").toLowerCase().includes((p.name || "").toLowerCase());
                  return matchesId || matchesTitle;
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
                    if (typeStr === "Monolocale") return "🏢";
                    if (typeStr === "Ufficio") return "🏬";
                    if (typeStr === "Garage/Box") return "🚗";
                    return "🏠";
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
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            p.status === "Available"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}>
                            {p.status === "Available" && "🔵 Libero"}
                            {p.status === "Maintenance" && "🟡 Manutenzione"}
                            {p.status === "Archived" && "⚪ Archiviato"}
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
                let statusLabel = "👍 Relazione Regolare";
                let badgeStyleClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
                let isCritical = false;

                if (associatedTenant) {
                  const cls = getTenantClassification(associatedTenant, properties, contracts, fastClosing, legalCases, reminders);
                  statusLabel = `${cls.emoji} ${cls.label}`;
                  badgeStyleClass = cls.badgeClass;
                  if (cls.status === "critical") {
                    borderClass = "border-red-600 bg-red-50 text-red-950 shadow-[0_0_15px_rgba(220,38,38,0.25)] animate-pulse";
                    isCritical = true;
                  } else if (cls.status === "red") {
                    borderClass = "border-rose-500 bg-rose-50 text-rose-950 animate-pulse";
                    isCritical = true;
                  } else if (cls.status === "orange") {
                    borderClass = "border-amber-400 bg-amber-50 text-amber-950";
                  } else {
                    borderClass = "border-emerald-400 bg-emerald-50 text-emerald-950";
                  }
                } else if (!activeContract) {
                  borderClass = "border-amber-400 bg-amber-50 text-amber-950";
                  statusLabel = "⚠️ Contratto Mancante";
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
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${badgeStyleClass}`}>
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
                    <span>{selectedProperty.isBareOwnership ? "🟠 Nuda Proprietà" : "🟢 Piena Proprietà"}</span>
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
                  <h4 className="text-sm font-black text-slate-900 mt-1 truncate">
                    {selectedProperty.isCondoConstituted ? "🏢 Condominio Costituito" : "⚠️ Condominio Assente"}
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
                  <span className="text-[10px] text-slate-400">Raggruppato per tipologia contabile</span>
                </div>

                {/* Ledger Navigation Tabs */}
                <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-50 rounded-xl">
                  <button
                    onClick={() => setActiveLedgerTab("rent")}
                    className={`flex-1 min-w-[100px] py-2 text-[10px] sm:text-xs font-black rounded-lg transition-all ${
                      activeLedgerTab === "rent"
                        ? "bg-white text-slate-950 shadow-xs border border-slate-200/50"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    💶 Canoni ({propertyModalData.rentPayments.length})
                  </button>
                  <button
                    onClick={() => setActiveLedgerTab("condo")}
                    className={`flex-1 min-w-[100px] py-2 text-[10px] sm:text-xs font-black rounded-lg transition-all ${
                      activeLedgerTab === "condo"
                        ? "bg-white text-slate-950 shadow-xs border border-slate-200/50"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    🏢 Condominio ({propertyModalData.condoPayments.length})
                  </button>
                  <button
                    onClick={() => setActiveLedgerTab("taxes")}
                    className={`flex-1 min-w-[100px] py-2 text-[10px] sm:text-xs font-black rounded-lg transition-all ${
                      activeLedgerTab === "taxes"
                        ? "bg-white text-slate-950 shadow-xs border border-slate-200/50"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    ⚖️ Registro ({propertyModalData.taxPayments.length})
                  </button>
                  <button
                    onClick={() => setActiveLedgerTab("maintenance")}
                    className={`flex-1 min-w-[100px] py-2 text-[10px] sm:text-xs font-black rounded-lg transition-all ${
                      activeLedgerTab === "maintenance"
                        ? "bg-white text-slate-950 shadow-xs border border-slate-200/50"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    🛠️ Manutenzioni ({propertyModalData.ownerMaintenance.length})
                  </button>
                  <button
                    onClick={() => setActiveLedgerTab("other")}
                    className={`flex-1 min-w-[100px] py-2 text-[10px] sm:text-xs font-black rounded-lg transition-all ${
                      activeLedgerTab === "other"
                        ? "bg-white text-slate-950 shadow-xs border border-slate-200/50"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    ⚙️ Altro ({propertyModalData.otherPayments.length})
                  </button>
                </div>

                {/* Tab Content Tables */}
                <div className="bg-white rounded-xl border border-slate-150 overflow-hidden shadow-2xs">
                  
                  {/* TAB 1: RENT PAYMENTS */}
                  {activeLedgerTab === "rent" && (
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
                                  {new Date(item.dueDate).toLocaleDateString("it-IT")}
                                </td>
                                <td className="p-3 border border-slate-300 font-mono text-slate-600">
                                  {item.paymentDate !== "-" && item.paymentDate !== "Pendente" ? (
                                    <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-150 text-[10px]">
                                      {new Date(item.paymentDate).toLocaleDateString("it-IT")}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Non Incassato</span>
                                  )}
                                </td>
                                <td className="p-3 border border-slate-300 font-semibold text-slate-800">
                                  {item.description}
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
                                  {item.type}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* TAB 2: CONDO PAYMENTS */}
                  {activeLedgerTab === "condo" && (
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
                              <span className="text-sm">⚠️</span>
                              <span><strong>Immobile sfitto:</strong> Tutte le spese condominiali qui elencate sono addebitate al 100% al proprietario <strong>{selectedProperty.owner}</strong>.</span>
                            </div>
                          ) : (
                            <div className="m-3 p-3 bg-indigo-50/60 border border-indigo-200/50 text-indigo-950 rounded-xl text-[11px] font-semibold flex items-center gap-2">
                              <span className="text-sm">👤</span>
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
                                    {item.description}
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
                                    {item.type}
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
                  {activeLedgerTab === "taxes" && (
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
                                  {item.description}
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
                                  {item.type}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* TAB 4: OTHER / RESIDUAL */}
                  {activeLedgerTab === "other" && (
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
                                  {item.description}
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
                                  {item.type}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* TAB 5: OWNER MAINTENANCE EXPENSES */}
                  {activeLedgerTab === "maintenance" && (
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
                                <th className="p-3 border border-slate-300">Importo Spesa</th>
                                <th className="p-3 border border-slate-300">Fatturato a carico di</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {propertyModalData.ownerMaintenance.map((item, idx) => (
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
                                  </td>
                                  <td className="p-3 border border-slate-300">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                      selectedProperty.status !== "Rented"
                                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                                        : "bg-indigo-100 text-indigo-800 border border-indigo-250"
                                    }`}>
                                      {selectedProperty.status !== "Rented" ? "Sfitto: Proprietario 💼" : "Proprietario 💼"}
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
    </div>
  );
}

