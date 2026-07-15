import React, { useState } from "react";
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Home, 
  MapPin, 
  Tag, 
  Info, 
  X, 
  ArrowLeft, 
  Receipt, 
  Landmark, 
  CheckCircle, 
  Scale, 
  Send, 
  FileText, 
  Upload, 
  Download, 
  Users, 
  Phone, 
  Mail, 
  FileCheck
} from "lucide-react";
import { Property, Tenant, Contract, FastClosingItem, Reminder, LegalCase, Condominium, Maintenance, InsurancePolicy, DeliveryReport } from "../types";
import { getTenantClassification as getTenantClassificationHelper } from "../lib/statusHelper";

interface PropertiesViewProps {
  properties: Property[];
  tenants?: Tenant[];
  contracts?: Contract[];
  fastClosing?: FastClosingItem[];
  reminders?: Reminder[];
  legalCases?: LegalCase[];
  condominiums?: Condominium[];
  insurancePolicies?: InsurancePolicy[];
  deliveryReports?: DeliveryReport[];
  onAddInsurancePolicy?: (data: any) => Promise<void>;
  onEditInsurancePolicy?: (id: string, data: any) => Promise<void>;
  onDeleteInsurancePolicy?: (id: string) => Promise<void>;
  onAddDeliveryReport?: (data: any) => Promise<void>;
  onEditDeliveryReport?: (id: string, data: any) => Promise<void>;
  onDeleteDeliveryReport?: (id: string) => Promise<void>;
  setCurrentSection?: (section: string) => void;
  setSelectedTenantIdForLedger?: (id: string | null) => void;
  onAddProperty: (property: Omit<Property, "id" | "userId" | "createdAt">) => Promise<void>;
  onEditProperty: (id: string, property: Partial<Property>) => Promise<void>;
  onDeleteProperty: (id: string) => Promise<void>;
  maintenance?: Maintenance[];
}

export default function PropertiesView({
  properties,
  tenants = [],
  contracts = [],
  fastClosing = [],
  reminders = [],
  legalCases = [],
  condominiums = [],
  insurancePolicies = [],
  deliveryReports = [],
  onAddInsurancePolicy,
  onEditInsurancePolicy,
  onDeleteInsurancePolicy,
  onAddDeliveryReport,
  onEditDeliveryReport,
  onDeleteDeliveryReport,
  setCurrentSection,
  setSelectedTenantIdForLedger,
  onAddProperty,
  onEditProperty,
  onDeleteProperty,
  maintenance = []
}: PropertiesViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedPropertyDetails, setSelectedPropertyDetails] = useState<Property | null>(null);

  // Property documents (simulated storage for planimetry, APE, contracts, etc. - synced with Contracts)
  const [propertyDocs, setPropertyDocs] = useState<Record<string, Array<{ id: string, name: string, type: string, date: string, size?: string }>>>(() => {
    const saved = localStorage.getItem("property_documents_contracts");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error reading shared documents inside PropertiesView", e);
      }
    }
    return {
      "WreR2hT4O8w3Yp02gS1k": [
        { id: "doc-1", name: "Planimetria_Via_Torino_15.pdf", type: "Planimetria Catastale", date: "2026-01-12", size: "2.4 MB" },
        { id: "doc-2", name: "APE_Via_Torino_Classe_A.pdf", type: "APE (Classe Energetica)", date: "2026-01-15", size: "1.8 MB" },
        { id: "doc-3", name: "Contratto_Mario_Rossi.pdf", type: "Contratto", date: "2026-01-18", size: "3.2 MB" }
      ],
      "q9Yp8t1K5R3v4w02fX9z": [
        { id: "doc-4", name: "Planimetria_Via_Roma_8.pdf", type: "Planimetria/Visura", date: "2026-02-05", size: "2.1 MB" },
        { id: "doc-5", name: "Certificato_Energetico_APE.pdf", type: "APE (Classe Energetica)", date: "2026-02-08", size: "1.9 MB" }
      ],
      "m6v4W2K1z8p9R03fQ7x2": [
        { id: "doc-6", name: "Piantina_Via_Milano.pdf", type: "Planimetria Catastale", date: "2026-02-10", size: "1.5 MB" }
      ]
    };
  });

  // Keep documents synced to the same shared localStorage key
  React.useEffect(() => {
    localStorage.setItem("property_documents_contracts", JSON.stringify(propertyDocs));
  }, [propertyDocs]);

  // Upload document dialog
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocName, setUploadDocName] = useState("");
  const [uploadDocType, setUploadDocType] = useState("Planimetria");

  // Qualified Dispatch Dialog window
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchDoc, setDispatchDoc] = useState<{ id: string, name: string, type: string } | null>(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState("");

  // Form states
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [type, setType] = useState("Appartamento");
  const [status, setStatus] = useState<"Available" | "Rented" | "Maintenance" | "Archived">("Available");
  const [notes, setNotes] = useState("");
  const [owner, setOwner] = useState("");
  const [isBareOwnership, setIsBareOwnership] = useState(false);
  const [isCondoConstituted, setIsCondoConstituted] = useState(false);
  const [condominiumId, setCondominiumId] = useState("");

  // Millesimi and utility meters state
  const [millesimi, setMillesimi] = useState<number>(120);
  
  // Luce meter
  const [luceMeterNo, setLuceMeterNo] = useState("");
  const [luceLastReading, setLuceLastReading] = useState<number>(0);
  const [luceReadingDate, setLuceReadingDate] = useState("");
  const [luceActiveFlag, setLuceActiveFlag] = useState<"proprietario" | "conduttore">("proprietario");

  // Gas meter
  const [gasMeterNo, setGasMeterNo] = useState("");
  const [gasLastReading, setGasLastReading] = useState<number>(0);
  const [gasReadingDate, setGasReadingDate] = useState("");
  const [gasActiveFlag, setGasActiveFlag] = useState<"proprietario" | "conduttore">("proprietario");

  // Acqua meter
  const [acquaMeterNo, setAcquaMeterNo] = useState("");
  const [acquaLastReading, setAcquaLastReading] = useState<number>(0);
  const [acquaReadingDate, setAcquaReadingDate] = useState("");
  const [acquaActiveFlag, setAcquaActiveFlag] = useState<"proprietario" | "conduttore">("proprietario");

  // Insurance Policy modal & form states
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [editingInsurancePolicy, setEditingInsurancePolicy] = useState<any | null>(null);
  const [insCompany, setInsCompany] = useState("");
  const [insPolicyNumber, setInsPolicyNumber] = useState("");
  const [insCoverageType, setInsCoverageType] = useState("Incendio e Scoppio");
  const [insExpiryDate, setInsExpiryDate] = useState("");
  const [insPremiumAmount, setInsPremiumAmount] = useState("");
  const [insDocName, setInsDocName] = useState("");

  // Owner Wizard States
  const [ownerMode, setOwnerMode] = useState<"select" | "guided">("select");
  const [selectedExistingOwner, setSelectedExistingOwner] = useState("");
  const [guidedOwnerType, setGuidedOwnerType] = useState<"individual" | "company" | "multiple">("individual");
  const [indFirstName, setIndFirstName] = useState("");
  const [indLastName, setIndLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [multipleOwnersList, setMultipleOwnersList] = useState<string[]>(["", ""]);

  const getUniqueOwners = () => {
    return Array.from(
      new Set(
        properties
          .map((p) => p.owner)
          .filter((o): o is string => !!o && typeof o === "string" && o.trim() !== "")
      )
    ).sort((a, b) => a.localeCompare(b));
  };

  const getConstructedOwnerName = () => {
    if (ownerMode === "select" && selectedExistingOwner) {
      return selectedExistingOwner;
    }
    
    // Check if guided inputs are actually filled and use them as a smart fallback
    if (guidedOwnerType === "individual" && (indFirstName.trim() || indLastName.trim())) {
      return `${indFirstName.trim()} ${indLastName.trim()}`.trim();
    } else if (guidedOwnerType === "company" && companyName.trim()) {
      return companyName.trim();
    } else if (guidedOwnerType === "multiple") {
      const filtered = multipleOwnersList
        .map(o => o.trim())
        .filter(o => o.length > 0);
      if (filtered.length > 0) {
        return filtered.join(", ");
      }
    }

    // Default fallback
    if (ownerMode === "select") {
      return selectedExistingOwner;
    }
    return "";
  };

  const openAddModal = () => {
    setEditingProperty(null);
    setName("");
    setAddress("");
    setType("Appartamento");
    setStatus("Available");
    setNotes("");
    setOwner("");
    setIsBareOwnership(false);
    setIsCondoConstituted(false);
    setCondominiumId("");

    // Reset millesimi and utility meters
    setMillesimi(120);
    setLuceMeterNo("");
    setLuceLastReading(0);
    setLuceReadingDate("");
    setLuceActiveFlag("proprietario");
    setGasMeterNo("");
    setGasLastReading(0);
    setGasReadingDate("");
    setGasActiveFlag("proprietario");
    setAcquaMeterNo("");
    setAcquaLastReading(0);
    setAcquaReadingDate("");
    setAcquaActiveFlag("proprietario");

    // Reset wizard states
    const uniqueOwnersList = getUniqueOwners();
    setOwnerMode(uniqueOwnersList.length > 0 ? "select" : "guided");
    setSelectedExistingOwner("");
    setGuidedOwnerType("individual");
    setIndFirstName("");
    setIndLastName("");
    setCompanyName("");
    setMultipleOwnersList(["", ""]);

    setShowModal(true);
  };

  const openEditModal = (property: Property) => {
    setEditingProperty(property);
    setName(property.name);
    setAddress(property.address);
    setType(property.type);
    setStatus(property.status);
    setNotes(property.notes || "");
    setOwner(property.owner || "");
    setIsBareOwnership(!!property.isBareOwnership);
    setIsCondoConstituted(!!property.isCondoConstituted);
    setCondominiumId(property.condominiumId || "");

    // Populate millesimi and utility meters
    setMillesimi(property.millesimi !== undefined ? property.millesimi : 120);
    
    setLuceMeterNo(property.luceMeter?.meterNumber || "");
    setLuceLastReading(property.luceMeter?.lastReading || 0);
    setLuceReadingDate(property.luceMeter?.readingDate || "");
    setLuceActiveFlag(property.luceMeter?.activeFlag === "conduttore" ? "conduttore" : "proprietario");

    setGasMeterNo(property.gasMeter?.meterNumber || "");
    setGasLastReading(property.gasMeter?.lastReading || 0);
    setGasReadingDate(property.gasMeter?.readingDate || "");
    setGasActiveFlag(property.gasMeter?.activeFlag === "conduttore" ? "conduttore" : "proprietario");

    setAcquaMeterNo(property.acquaMeter?.meterNumber || "");
    setAcquaLastReading(property.acquaMeter?.lastReading || 0);
    setAcquaReadingDate(property.acquaMeter?.readingDate || "");
    setAcquaActiveFlag(property.acquaMeter?.activeFlag === "conduttore" ? "conduttore" : "proprietario");

    // Setup wizard states for editing
    const currentOwner = property.owner || "";
    const uOwners = getUniqueOwners();
    if (currentOwner && uOwners.includes(currentOwner)) {
      setOwnerMode("select");
      setSelectedExistingOwner(currentOwner);
    } else if (currentOwner) {
      setOwnerMode("guided");
      if (currentOwner.includes(",") || currentOwner.includes(" e ")) {
        setGuidedOwnerType("multiple");
        const parsed = currentOwner.split(/,|\be\b|\band\b|&|-/i).map(s => s.trim()).filter(s => s.length > 0);
        setMultipleOwnersList(parsed.length >= 2 ? parsed : ["", ""]);
      } else {
        const isComp = currentOwner.match(/(srl|s\.r\.l\.|spa|s\.p\.a\.|coop|snc|s\.n\.c\.)/i);
        if (isComp) {
          setGuidedOwnerType("company");
          setCompanyName(currentOwner);
        } else {
          setGuidedOwnerType("individual");
          const parts = currentOwner.split(" ");
          if (parts.length >= 2) {
            setIndFirstName(parts[0]);
            setIndLastName(parts.slice(1).join(" "));
          } else {
            setIndFirstName("");
            setIndLastName(currentOwner);
          }
        }
      }
    } else {
      setOwnerMode(uOwners.length > 0 ? "select" : "guided");
      setSelectedExistingOwner("");
    }

    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      alert("Nome e Indirizzo sono obbligatori.");
      return;
    }

    const finalOwner = getConstructedOwnerName();
    if (!finalOwner) {
      alert("La specificazione o selezione del Proprietario è obbligatoria. Il proprietario esiste sempre.");
      return;
    }

    // Build meters structure
    const luceMeter = {
      meterNumber: luceMeterNo,
      lastReading: Number(luceLastReading) || 0,
      readingDate: luceReadingDate,
      activeFlag: luceActiveFlag
    };

    const gasMeter = {
      meterNumber: gasMeterNo,
      lastReading: Number(gasLastReading) || 0,
      readingDate: gasReadingDate,
      activeFlag: gasActiveFlag
    };

    const acquaMeter = {
      meterNumber: acquaMeterNo,
      lastReading: Number(acquaLastReading) || 0,
      readingDate: acquaReadingDate,
      activeFlag: acquaActiveFlag
    };

    try {
      if (editingProperty) {
        await onEditProperty(editingProperty.id, {
          name,
          address,
          type,
          status,
          notes,
          owner: finalOwner,
          isBareOwnership,
          isCondoConstituted,
          condominiumId: isCondoConstituted ? condominiumId : "",
          millesimi: Number(millesimi) || 0,
          luceMeter,
          gasMeter,
          acquaMeter
        });
      } else {
        await onAddProperty({
          name,
          address,
          type,
          status,
          notes,
          owner: finalOwner,
          isBareOwnership,
          isCondoConstituted,
          condominiumId: isCondoConstituted ? condominiumId : "",
          millesimi: Number(millesimi) || 0,
          luceMeter,
          gasMeter,
          acquaMeter
        });
      }
      setShowModal(false);
    } catch (err) {
      console.error("Error saving property", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questo immobile? L'operazione è irreversibile.")) {
      try {
        await onDeleteProperty(id);
      } catch (err) {
        console.error("Error deleting property", err);
      }
    }
  };

  if (selectedPropertyDetails) {
    const prop = selectedPropertyDetails;
    
    const ownerName = prop.owner || "Non Specificato";
    const associatedTenant = tenants.find(t => t.propertyId === prop.id);
    const tenantClassification = associatedTenant 
      ? getTenantClassificationHelper(associatedTenant, properties, contracts, fastClosing, legalCases, reminders)
      : null;

    // Condominium debts/payments related to this property
    const condoDebts = fastClosing.filter(fc => {
      const isCondo = fc.source === "condominium";
      const matchesName = (fc.title || "").toLowerCase().includes((prop.name || "").toLowerCase()) || 
                          (fc.description && (fc.description || "").toLowerCase().includes((prop.name || "").toLowerCase()));
      return isCondo && matchesName;
    });

    // Registration costs related to this property/tenant
    const regCosts = fastClosing.filter(fc => {
      const isReg = (fc.title || "").toLowerCase().includes("registr") || 
                    (fc.title || "").toLowerCase().includes("imposta di reg") || 
                    (fc.title || "").toLowerCase().includes("registro") ||
                    (fc.description && (fc.description || "").toLowerCase().includes("registr"));
      const matchesProp = (fc.title || "").toLowerCase().includes((prop.name || "").toLowerCase()) || 
                          (fc.description && (fc.description || "").toLowerCase().includes((prop.name || "").toLowerCase()));
      const matchesTenant = associatedTenant && (
        (fc.title || "").toLowerCase().includes((associatedTenant.name || "").toLowerCase()) || 
        (fc.description && (fc.description || "").toLowerCase().includes((associatedTenant.name || "").toLowerCase()))
      );
      return isReg && (matchesProp || matchesTenant);
    });

    const docs = propertyDocs[prop.id] || [];

    const handleSaveInsurancePolicyLocal = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!insCompany.trim() || !insPolicyNumber.trim() || !insExpiryDate) {
        alert("Compagnia, Numero Polizza e Data Scadenza sono obbligatori.");
        return;
      }

      const payload = {
        propertyId: prop.id,
        company: insCompany,
        policyNumber: insPolicyNumber,
        coverageType: insCoverageType,
        expiryDate: insExpiryDate,
        premiumAmount: Number(insPremiumAmount) || 0,
        docName: insDocName || ""
      };

      try {
        if (editingInsurancePolicy) {
          if (onEditInsurancePolicy) {
            await onEditInsurancePolicy(editingInsurancePolicy.id, payload);
          }
        } else {
          if (onAddInsurancePolicy) {
            await onAddInsurancePolicy(payload);
          }
        }
        setShowInsuranceModal(false);
        setEditingInsurancePolicy(null);
        setInsCompany("");
        setInsPolicyNumber("");
        setInsCoverageType("Incendio e Scoppio");
        setInsExpiryDate("");
        setInsPremiumAmount("");
        setInsDocName("");
      } catch (err) {
        console.error("Error saving insurance policy", err);
      }
    };

    const handleOpenAddInsuranceModal = () => {
      setEditingInsurancePolicy(null);
      setInsCompany("");
      setInsPolicyNumber("");
      setInsCoverageType("Incendio e Scoppio");
      setInsExpiryDate("");
      setInsPremiumAmount("");
      setInsDocName("");
      setShowInsuranceModal(true);
    };

    const handleOpenEditInsuranceModal = (policy: any) => {
      setEditingInsurancePolicy(policy);
      setInsCompany(policy.company || "");
      setInsPolicyNumber(policy.policyNumber || "");
      setInsCoverageType(policy.coverageType || "Incendio e Scoppio");
      setInsExpiryDate(policy.expiryDate || "");
      setInsPremiumAmount(policy.premiumAmount?.toString() || "");
      setInsDocName(policy.docName || "");
      setShowInsuranceModal(true);
    };

    const handleDeleteInsurancePolicyLocal = async (policyId: string) => {
      if (confirm("Sei sicuro di voler eliminare questa polizza assicurativa?")) {
        try {
          if (onDeleteInsurancePolicy) {
            await onDeleteInsurancePolicy(policyId);
          }
        } catch (err) {
          console.error("Error deleting insurance policy", err);
        }
      }
    };

    const handleUploadDocSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!uploadDocName.trim()) return;
      const newDoc = {
        id: "doc-manual-" + Date.now(),
        name: uploadDocName.endsWith(".pdf") ? uploadDocName : uploadDocName + ".pdf",
        type: uploadDocType,
        date: new Date().toLocaleDateString("it-IT")
      };
      setPropertyDocs(prev => ({
        ...prev,
        [prop.id]: [...(prev[prop.id] || []), newDoc]
      }));
      setUploadDocName("");
      setShowUploadModal(false);
    };

    const handleOpenDispatch = (docItem: { id: string, name: string, type: string }) => {
      setDispatchDoc(docItem);
      setSelectedRecipientId("");
      setDispatchSuccessMsg("");
      setShowDispatchModal(true);
    };

    const handleConfirmDispatch = () => {
      if (!selectedRecipientId || !dispatchDoc) return;
      
      let recipientName = "";
      let recipientRole = "";
      if (selectedRecipientId === "tenant" && associatedTenant) {
        recipientName = associatedTenant.name;
        recipientRole = "Inquilino / Conduttore";
      } else if (selectedRecipientId === "owner") {
        recipientName = ownerName;
        recipientRole = "Proprietario / Locatore";
      } else if (selectedRecipientId === "lawyer") {
        recipientName = "Avv. Studio Legale Associato (Studio Convenzionato)";
        recipientRole = "Ufficio Legale";
      } else if (selectedRecipientId === "admin") {
        recipientName = "Amministratore Stabile (Ing. Neri)";
        recipientRole = "Amministratore Condominio";
      }

      setDispatchSuccessMsg(`✅ Documento "${dispatchDoc.name}" inviato con successo a ${recipientName} (${recipientRole}) via email e WhatsApp!`);
      setTimeout(() => {
        setShowDispatchModal(false);
        setDispatchDoc(null);
        setSelectedRecipientId("");
        setDispatchSuccessMsg("");
      }, 3500);
    };

    const handleRemoveDoc = (docId: string) => {
      setPropertyDocs(prev => ({
        ...prev,
        [prop.id]: (prev[prop.id] || []).filter(d => d.id !== docId)
      }));
    };

    const handleNavigateToTenantLedger = () => {
      if (associatedTenant && setSelectedTenantIdForLedger && setCurrentSection) {
        setSelectedTenantIdForLedger(associatedTenant.id);
        setCurrentSection("tenants");
      }
    };

    return (
      <div className="space-y-6 animate-fade-in" id="property-detail-subpage-container">
        {/* Back and Action bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            onClick={() => setSelectedPropertyDetails(null)}
            className="inline-flex items-center space-x-2 bg-white hover:bg-slate-50 text-slate-800 font-extrabold px-4 py-2.5 rounded-xl text-xs transition-colors border-2 border-slate-100 shadow-sm cursor-pointer self-start"
          >
            <ArrowLeft size={14} />
            <span>Torna agli Immobili</span>
          </button>
          
          <div className="flex gap-2 self-start sm:self-auto">
            <button
              onClick={() => openEditModal(prop)}
              className="inline-flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer"
            >
              <Edit3 size={13} />
              <span>Modifica Anagrafica</span>
            </button>
          </div>
        </div>

        {/* Master Identity Card Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Info Card */}
          <div className="lg:col-span-7 bg-white rounded-2xl border-2 border-slate-100 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                  🏠 {prop.type}
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                  prop.status === "Available" 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100/50" 
                    : prop.status === "Rented" 
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100/50" 
                    : prop.status === "Maintenance"
                    ? "bg-amber-50 text-amber-700 border border-amber-100/50"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}>
                  {prop.status === "Available" && "Libero"}
                  {prop.status === "Rented" && "Locato"}
                  {prop.status === "Maintenance" && "Manutenzione"}
                  {prop.status === "Archived" && "Archiviato"}
                </span>
              </div>
              
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-3">{prop.name}</h1>
              <p className="text-xs text-slate-500 font-medium flex items-center space-x-1 mt-1">
                <MapPin size={13} className="text-slate-400 shrink-0" />
                <span>{prop.address}</span>
              </p>

              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-slate-100">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${
                  prop.isBareOwnership 
                    ? "bg-amber-50 text-amber-700 border border-amber-200/50" 
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                }`}>
                  {prop.isBareOwnership ? "🟠 Nuda Proprietà" : "🟢 Piena Proprietà (Ammin. Ordinaria)"}
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${
                  prop.isCondoConstituted 
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200/50" 
                    : "bg-rose-50 text-rose-700 border border-rose-200/50"
                }`}>
                  {prop.isCondoConstituted ? "🏢 Condominio Costituito" : "⚠️ Condominio Assente / Non Costituito"}
                </span>
              </div>
            </div>

            {prop.notes && (
              <div className="mt-5 p-4 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100 flex items-start space-x-2">
                <Info size={15} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">Note di Gestione</p>
                  <p className="mt-1 leading-relaxed">{prop.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Master Owner Info Card */}
          <div className="lg:col-span-5 bg-white rounded-2xl border-2 border-slate-100 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-slate-400">
                <Tag size={16} />
                <h3 className="text-xs font-mono font-black uppercase tracking-wider">Anagrafica Proprietari</h3>
              </div>
              
              <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Locatore di Riferimento</p>
                <p className="text-base font-black text-slate-900 mt-1">{ownerName}</p>
                <div className="flex items-center space-x-1.5 mt-2.5 text-xs text-slate-500">
                  <span className="bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded text-[9px]">ATTIVO</span>
                  <span>• Registro Tributario Nazionale</span>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-500 pl-1">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400 w-4">📋</span>
                  <span>Registrazione contrattuale: <strong className="text-slate-700">In regola</strong></span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400 w-4">💸</span>
                  <span>Imposta di registro: <strong className="text-slate-700">Ripartita al 50%</strong></span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (setCurrentSection) setCurrentSection("dashboard");
              }}
              className="w-full mt-6 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-black py-2.5 rounded-xl transition-all flex items-center justify-center space-x-1 cursor-pointer"
            >
              <span>Vedi Bilancio Complessivo Owners</span>
            </button>
          </div>
        </div>

        {/* Quota Millesimale e Contatori Utenze Section */}
        <div className="bg-white rounded-2xl border-2 border-slate-100 p-6 shadow-sm">
          <div className="flex items-center space-x-2 text-slate-800 pb-3 mb-4">
            <span className="text-lg">⚡</span>
            <h3 className="text-sm font-mono font-black uppercase tracking-wider text-slate-900">
              Quota Millesimale & Contatori Utenze reali
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Quota Millesimale */}
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-wider block">
                  Ripartizione Spese
                </span>
                <span className="text-xs text-slate-500 mt-1 block">Quota condominiale reale dell'unità</span>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-indigo-900">{prop.millesimi !== undefined ? prop.millesimi : 120}</span>
                <span className="text-xs font-mono font-bold text-indigo-600 ml-1">/ 1000 millesimi</span>
              </div>
            </div>

            {/* Luce Meter Info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider flex items-center space-x-1">
                    <span>💡</span> <span>Utenza Luce</span>
                  </span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    prop.luceMeter?.activeFlag === "conduttore" 
                      ? "bg-amber-100 text-amber-800 border border-amber-200" 
                      : "bg-slate-200 text-slate-700"
                  }`}>
                    {prop.luceMeter?.activeFlag === "conduttore" ? "Conduttore (ON)" : "Proprietario (OFF)"}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <p><span className="text-slate-400">Contatore:</span> <strong className="text-slate-800 font-mono">{prop.luceMeter?.meterNumber || "N/A"}</strong></p>
                  <p><span className="text-slate-400">Lettura:</span> <strong className="text-slate-800">{prop.luceMeter?.lastReading || 0} kWh</strong></p>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200/50 text-[10px] text-slate-400 font-medium">
                Data lettura: {prop.luceMeter?.readingDate || "Non registrata"}
              </div>
            </div>

            {/* Gas Meter Info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-orange-600 uppercase tracking-wider flex items-center space-x-1">
                    <span>🔥</span> <span>Utenza Gas</span>
                  </span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    prop.gasMeter?.activeFlag === "conduttore" 
                      ? "bg-amber-100 text-amber-800 border border-amber-200" 
                      : "bg-slate-200 text-slate-700"
                  }`}>
                    {prop.gasMeter?.activeFlag === "conduttore" ? "Conduttore (ON)" : "Proprietario (OFF)"}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <p><span className="text-slate-400">Contatore:</span> <strong className="text-slate-800 font-mono">{prop.gasMeter?.meterNumber || "N/A"}</strong></p>
                  <p><span className="text-slate-400">Lettura:</span> <strong className="text-slate-800">{prop.gasMeter?.lastReading || 0} smc</strong></p>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200/50 text-[10px] text-slate-400 font-medium">
                Data lettura: {prop.gasMeter?.readingDate || "Non registrata"}
              </div>
            </div>

            {/* Acqua Meter Info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-wider flex items-center space-x-1">
                    <span>💧</span> <span>Utenza Acqua</span>
                  </span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    prop.acquaMeter?.activeFlag === "conduttore" 
                      ? "bg-amber-100 text-amber-800 border border-amber-200" 
                      : "bg-slate-200 text-slate-700"
                  }`}>
                    {prop.acquaMeter?.activeFlag === "conduttore" ? "Conduttore (ON)" : "Proprietario (OFF)"}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <p><span className="text-slate-400">Contatore:</span> <strong className="text-slate-800 font-mono">{prop.acquaMeter?.meterNumber || "N/A"}</strong></p>
                  <p><span className="text-slate-400">Lettura:</span> <strong className="text-slate-800">{prop.acquaMeter?.lastReading || 0} m³</strong></p>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200/50 text-[10px] text-slate-400 font-medium">
                Data lettura: {prop.acquaMeter?.readingDate || "Non registrata"}
              </div>
            </div>
          </div>
        </div>

        {/* Master Tenant / Occupier Section (If Occupied) */}
        <div className="bg-white rounded-2xl border-2 border-slate-100 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
            <div className="flex items-center space-x-2 text-slate-400">
              <Users size={18} />
              <h3 className="text-xs font-mono font-black uppercase tracking-wider">Anagrafica Inquilino & Relazione</h3>
            </div>
            {associatedTenant && (
              <button
                onClick={handleNavigateToTenantLedger}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] rounded-xl active:transition-all cursor-pointer shadow-xs"
              >
                <Receipt size={12} />
                <span>Indaga Mastrino Inquilino 🔍</span>
              </button>
            )}
          </div>

          {!associatedTenant ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              ℹ️ L'immobile risulta attualmente **Libero**. Non ci sono contratti di locazione attivi associati.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              {/* Tenant Identity Details */}
              <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-wider">Dati Conduttore</p>
                
                {/* Highlight name in red if critical/legal */}
                <h4 className={`text-base font-extrabold ${
                  tenantClassification?.status === "critical" 
                    ? "text-rose-600 font-black flex items-center gap-1.5" 
                    : tenantClassification?.status === "red"
                    ? "text-rose-500 font-bold flex items-center gap-1.5"
                    : "text-slate-900"
                }`}>
                  {tenantClassification?.status === "critical" && <span className="text-sm shrink-0" title="Contenzioso Legale Attivo">⚖️</span>}
                  <span>{associatedTenant.name}</span>
                </h4>

                <div className="space-y-2 text-xs text-slate-600 pt-1">
                  {associatedTenant.email && (
                    <p className="flex items-center space-x-2">
                      <Mail size={13} className="text-slate-400 shrink-0" />
                      <span className="font-medium">{associatedTenant.email}</span>
                    </p>
                  )}
                  {associatedTenant.phone && (
                    <p className="flex items-center space-x-2">
                      <Phone size={13} className="text-slate-400 shrink-0" />
                      <span className="font-medium">{associatedTenant.phone}</span>
                    </p>
                  )}
                  {associatedTenant.fiscalCode && (
                    <p className="flex items-center space-x-2 font-mono">
                      <FileCheck size={13} className="text-slate-400 shrink-0" />
                      <span>Codice Fiscale: <strong className="uppercase text-slate-700">{associatedTenant.fiscalCode}</strong></span>
                    </p>
                  )}
                </div>
              </div>

              {/* Dynamic Rating / Classification Relationship representation */}
              {tenantClassification && (
                <div className={`p-4 rounded-xl border flex flex-col justify-between ${tenantClassification.colorClass}`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono font-black uppercase tracking-wider opacity-75">Valutazione Rapporto</span>
                      <span className="text-base">{tenantClassification.emoji}</span>
                    </div>
                    <h5 className="text-xs font-black block mt-2">{tenantClassification.label}</h5>
                    <p className="text-[10px] opacity-85 mt-1 leading-relaxed">{tenantClassification.description}</p>
                  </div>

                  <div className="mt-3.5 pt-2 border-t border-current/15 flex justify-between items-center text-[9px] font-bold uppercase tracking-wider">
                    <span>Stato Contabile:</span>
                    <span className="font-extrabold">
                      {tenantClassification.status === "green" ? "In Regola ✓" : tenantClassification.status === "orange" ? "Pendenze Minime" : "Sofferenza Grave"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Financial movements tables: Condo Debts & Registration Costs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Debiti Condominiali */}
          <div className="bg-white rounded-2xl border-2 border-slate-100 p-6 shadow-sm flex flex-col">
            <div className="pb-3">
              <h3 className="font-sans font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <span>🏢 Oneri e Spese Condominiali</span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Spese condominiali registrate a carico della proprietà o dell'inquilino.</p>
            </div>

            <div className="flex-1 mt-3">
              {!prop.isCondoConstituted ? (
                <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  📢 Condominio assente o autogestito. Non sono previste quote condominiali ordinarie esterne.
                </div>
              ) : condoDebts.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  📢 Nessuna spesa condominiale registrata al momento per questo immobile.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] uppercase font-mono font-bold text-slate-400">
                        <th className="py-2.5">Scadenza</th>
                        <th className="py-2.5">Descrizione</th>
                        <th className="py-2.5 text-right">Importo</th>
                        <th className="py-2.5 text-right">Stato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs">
                      {condoDebts.map(debt => (
                        <tr key={debt.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 font-mono text-slate-500">
                            {new Date(debt.dueDate).toLocaleDateString("it-IT")}
                          </td>
                          <td className="py-2.5 font-medium text-slate-800 leading-snug">
                            {debt.title}
                          </td>
                          <td className="py-2.5 text-right font-bold text-slate-900">
                            €{debt.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 text-right font-black">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider ${
                              debt.status === "Paid" 
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100/50" 
                                : "bg-rose-50 text-rose-700 border border-rose-100/50"
                            }`}>
                              {debt.status === "Paid" ? "Pagato" : "Da Pagare"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Registration Costs (Costi di Registrazione) */}
          <div className="bg-white rounded-2xl border-2 border-slate-100 p-6 shadow-sm flex flex-col">
            <div className="pb-3">
              <h3 className="font-sans font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <span>📄 Imposte di Registro & Marche da Bollo</span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Spese per imposte di registro annuali, divisa proporzionalmente al 50%.</p>
            </div>

            <div className="flex-1 mt-3">
              {regCosts.length === 0 ? (
                /* Generate initial registration cost items for the demonstration if list is empty */
                <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  📢 Nessun movimento di imposta di registro inserito.
                  <button 
                    type="button"
                    onClick={async () => {
                      // Add dummy registration costs
                      const dummyCost: Omit<FastClosingItem, "id" | "userId" | "createdAt"> = {
                        title: `Imposta di Registro Annuale - ${prop.name}`,
                        description: `Imposta registro obbligatoria. Totale €134,00 (Quota Inquilino: 50% €67,00, Quota Proprietario: 50% €67,00)`,
                        amount: 134,
                        dueDate: new Date().toISOString().split("T")[0],
                        status: "Pending",
                        source: "reminder"
                      };
                      await onAddProperty(dummyCost as any); // just mock adding through props
                      alert("Iniezione completata! Ricarica o riesplora la pagina.");
                    }}
                    className="mt-3 block mx-auto bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-lg text-[10px] cursor-pointer"
                  >
                    Inietta Imposta di Registro Demo
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] uppercase font-mono font-bold text-slate-400">
                        <th className="py-2.5">Imposta</th>
                        <th className="py-2.5 text-right">Totale</th>
                        <th className="py-2.5 text-right">Inquilino (50%)</th>
                        <th className="py-2.5 text-right">Proprietario (50%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs">
                      {regCosts.map(cost => (
                        <tr key={cost.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 font-medium text-slate-800 leading-snug">
                            {cost.title}
                            <span className="block text-[8px] text-slate-400 mt-0.5 uppercase font-mono">Scadenza: {new Date(cost.dueDate).toLocaleDateString("it-IT")}</span>
                          </td>
                          <td className="py-2.5 text-right font-black text-slate-900">
                            €{cost.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 text-right">
                            <div className="font-bold text-slate-700">€{(cost.amount / 2).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</div>
                            <span className={`text-[8px] font-black uppercase px-1 py-0.2 rounded ${
                              cost.status === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                            }`}>
                              {cost.status === "Paid" ? "Reconciled ✓" : "In attesa"}
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <div className="font-bold text-slate-700">€{(cost.amount / 2).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</div>
                            <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-emerald-50 text-emerald-700">
                              RECONCILED ✓
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mastrino Manutenzioni Immobile (Tabulare) */}
        <div className="bg-white rounded-2xl border-2 border-slate-100 p-6 shadow-sm mt-6 flex flex-col">
          <div className="pb-3 flex justify-between items-center">
            <div>
              <h3 className="font-sans font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <span>🛠️ Mastrino Manutenzioni & Ripartizioni Quote</span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Resoconto contabile di tutti gli interventi tecnici e ripartizioni quote (inquilino / proprietario / comproprietari).
              </p>
            </div>
            <span className="bg-slate-100 text-slate-700 font-mono text-[10px] px-2 py-0.5 rounded-md font-bold">
              {(maintenance || []).filter(m => m.propertyId === prop.id).length} interventi
            </span>
          </div>

          <div className="mt-4">
            {(() => {
              const propertyMaintenanceTickets = (maintenance || []).filter(m => m.propertyId === prop.id);
              
              // Maintenance fast closing items related to this property
              const maintDebts = fastClosing.filter(fc => {
                const isMaint = fc.source === "maintenance";
                const matchesPropertyId = (fc as any).propertyId === prop.id;
                const matchesTitle = (fc.title || "").toLowerCase().includes((prop.name || "").toLowerCase()) ||
                                     (fc.description && (fc.description || "").toLowerCase().includes((prop.name || "").toLowerCase()));
                return isMaint && (matchesPropertyId || matchesTitle);
              });

              if (propertyMaintenanceTickets.length === 0) {
                return (
                  <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    📢 Nessuna spesa o ticket di manutenzione registrato per questo immobile.
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {/* Tabella degli Interventi */}
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-mono">Elenco Interventi (Ticket)</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-[10px] uppercase font-mono font-bold text-slate-400">
                            <th className="py-2.5">Data</th>
                            <th className="py-2.5">Intervento</th>
                            <th className="py-2.5">Impresa</th>
                            <th className="py-2.5 text-right">Costo Totale</th>
                            <th className="py-2.5 text-right">Stato</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-xs">
                          {propertyMaintenanceTickets.map(ticket => (
                            <tr key={ticket.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 font-mono text-slate-500">
                                {ticket.date ? new Date(ticket.date).toLocaleDateString("it-IT") : new Date(ticket.createdAt).toLocaleDateString("it-IT")}
                              </td>
                              <td className="py-2.5 font-medium text-slate-800">
                                <div className="font-bold text-slate-900">{ticket.title}</div>
                                {ticket.description && <div className="text-[10px] text-slate-400 font-normal">{ticket.description}</div>}
                              </td>
                              <td className="py-2.5 font-semibold text-slate-600">{ticket.contractor || "N/A"}</td>
                              <td className="py-2.5 text-right font-black text-slate-900">
                                €{(ticket.cost || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 text-right">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider ${
                                  ticket.status === "Completed"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-150"
                                    : ticket.status === "Cancelled"
                                    ? "bg-slate-50 text-slate-500 border border-slate-150"
                                    : "bg-amber-50 text-amber-700 border border-amber-150"
                                }`}>
                                  {ticket.status === "Completed" ? "Risolto" : ticket.status === "Cancelled" ? "Annullato" : "In Corso"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Tabella delle Scadenze Contabili (Mastrino) */}
                  <div className="border-t border-slate-100 pt-4">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                      Mastrino Quote ed Esigibilità (Righe Contabili in Fast Closing)
                    </h4>
                    {maintDebts.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Nessuna riga contabile registrata in Fast Closing per queste manutenzioni.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="text-[10px] uppercase font-mono font-bold text-slate-400">
                              <th className="py-2.5">Data Scadenza</th>
                              <th className="py-2.5">Descrizione Contabile / Debitore</th>
                              <th className="py-2.5 text-right">Importo Quota</th>
                              <th className="py-2.5 text-right">Stato</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 text-xs">
                            {maintDebts.map(debt => {
                              const isTenant = (debt.title || "").toLowerCase().includes("inquilino") || 
                                               (debt.title || "").toLowerCase().includes("conduttore") ||
                                               (associatedTenant && (debt.title || "").toLowerCase().includes((associatedTenant.name || "").toLowerCase()));
                              return (
                                <tr key={debt.id} className="hover:bg-slate-50/50">
                                  <td className="py-2.5 font-mono text-slate-500">
                                    {new Date(debt.dueDate).toLocaleDateString("it-IT")}
                                  </td>
                                  <td className="py-2.5 font-medium text-slate-800">
                                    <div className="font-bold text-slate-900">{debt.title}</div>
                                    <div className="text-[10px] text-slate-400 font-normal flex items-center gap-1.5 mt-0.5">
                                      <span className={`px-1 py-0.2 rounded text-[8px] uppercase tracking-wider ${
                                        isTenant 
                                          ? "bg-indigo-50 text-indigo-700 border border-indigo-150" 
                                          : "bg-amber-50 text-amber-700 border border-amber-150"
                                      }`}>
                                        {isTenant ? "Inquilino 👤" : "Proprietario 💼"}
                                      </span>
                                      <span>{debt.description}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 text-right font-bold text-slate-900">
                                    €{debt.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2.5 text-right font-black">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider ${
                                      debt.status === "Paid" 
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-150" 
                                        : "bg-rose-50 text-rose-700 border border-rose-150 animate-pulse"
                                    }`}>
                                      {debt.status === "Paid" ? "Pagato" : "Da Pagare"}
                                    </span>
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
              );
            })()}
          </div>

          {/* Spacer to maintain margin bottom layout */}
          <div className="mt-6"></div>
        </div>

        {/* Property Documents (Planimetria, APE, Contratto, etc.) with Save & Dispatch triggers */}
        <div className="bg-white rounded-2xl border-2 border-slate-100 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
            <div className="flex items-center space-x-2 text-slate-400">
              <FileText size={18} />
              <h3 className="text-xs font-mono font-black uppercase tracking-wider">Documenti Immobile & Condivisione</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] rounded-lg active:transition-all cursor-pointer shadow-sm"
            >
              <Upload size={12} />
              <span>Salva Nuovo Documento</span>
            </button>
          </div>

          {docs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              📂 Nessun documento salvato. Puoi caricare e associare planimetrie o APE cliccando su "Salva Nuovo Documento".
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {docs.map(doc => (
                <div key={doc.id} className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-200 hover:bg-indigo-50/10 transition-all duration-300">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-mono">
                        {doc.type}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">{doc.date}</span>
                    </div>
                    <h4 className="text-xs font-extrabold text-slate-800 mt-2.5 truncate" title={doc.name}>
                      {doc.name}
                    </h4>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => alert(`Anteprima documento "${doc.name}" in caricamento...`)}
                      className="p-1 text-slate-500 hover:text-indigo-600 rounded transition-colors cursor-pointer"
                      title="Visualizza documento"
                    >
                      <FileText size={14} />
                    </button>
                    
                    <div className="flex gap-1">
                      {/* Share / Dispatch dialog button */}
                      <button
                        type="button"
                        onClick={() => handleOpenDispatch(doc)}
                        className="inline-flex items-center space-x-1 bg-white hover:bg-indigo-50 text-indigo-700 font-black text-[10px] px-2.5 py-1 rounded-lg border border-indigo-200 transition-all cursor-pointer"
                        title="Invia a Conduttore / Avvocato / Amministratore / Proprietario"
                      >
                        <Send size={11} />
                        <span>Invia 📤</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => handleRemoveDoc(doc.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        title="Rimuovi documento"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Insurance Policies Section (Correction 16) */}
        <div className="bg-white rounded-2xl border-2 border-slate-100 p-6 shadow-sm mt-6 flex flex-col">
          <div className="pb-3 flex justify-between items-center">
            <div>
              <h3 className="font-sans font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <span>🛡️ Polizze Assicurative Attive</span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Gestione polizze assicurative e scadenze coperture collegate a questo immobile.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddInsuranceModal}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] rounded-lg active:transition-all cursor-pointer shadow-sm"
            >
              <Plus size={12} />
              <span>Aggiungi Polizza</span>
            </button>
          </div>

          <div className="mt-4">
            {(() => {
              const matchedPolicies = insurancePolicies.filter(ip => ip.propertyId === prop.id);
              if (matchedPolicies.length === 0) {
                return (
                  <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    📢 Nessuna polizza assicurativa registrata per questo immobile. Clicca su "Aggiungi Polizza" per registrarne una.
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] uppercase font-mono font-bold text-slate-400">
                        <th className="py-2.5">Compagnia / Polizza</th>
                        <th className="py-2.5">Tipo Copertura</th>
                        <th className="py-2.5">Scadenza</th>
                        <th className="py-2.5 text-right">Premio Annuo</th>
                        <th className="py-2.5 text-center">Documento Allegato</th>
                        <th className="py-2.5 text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs font-sans">
                      {matchedPolicies.map(policy => {
                        const expiryDateObj = new Date(policy.expiryDate);
                        const now = new Date();
                        now.setHours(0,0,0,0);
                        const diffTime = expiryDateObj.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
                        
                        const isExpired = diffDays <= 0;
                        const isNearExpiry = diffDays > 0 && diffDays <= 30;

                        return (
                          <tr key={policy.id} className="hover:bg-slate-50/50">
                            <td className="py-3 font-medium text-slate-800">
                              <div className="font-extrabold text-slate-900">{policy.company}</div>
                              <div className="text-[10px] font-mono text-slate-400">{policy.policyNumber}</div>
                            </td>
                            <td className="py-3 text-slate-600">
                              {policy.coverageType}
                            </td>
                            <td className="py-3">
                              <div className="font-semibold text-slate-700">{expiryDateObj.toLocaleDateString("it-IT")}</div>
                              {isExpired ? (
                                <span className="inline-block text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 animate-pulse mt-0.5">
                                  🔴 SCADUTA
                                </span>
                              ) : isNearExpiry ? (
                                <span className="inline-block text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 animate-pulse mt-0.5">
                                  ⚠️ IN SCADENZA ({diffDays} gg)
                                </span>
                              ) : (
                                <span className="inline-block text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 mt-0.5">
                                  🟢 ATTIVA
                                </span>
                              )}
                            </td>
                            <td className="py-3 text-right font-black text-slate-900">
                              €{policy.premiumAmount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 text-center">
                              {policy.docName ? (
                                <button
                                  type="button"
                                  onClick={() => alert(`Anteprima polizza: visualizzazione del documento "${policy.docName}"`)}
                                  className="inline-flex items-center space-x-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] px-2 py-1 rounded-md font-bold transition-all"
                                >
                                  <FileText size={11} />
                                  <span>{policy.docName}</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">Nessun allegato</span>
                              )}
                            </td>
                            <td className="py-3 text-right font-bold">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditInsuranceModal(policy)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                                  title="Modifica"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteInsurancePolicyLocal(policy.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                  title="Elimina"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Insurance Policy Modal */}
        {showInsuranceModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <h3 className="font-sans font-bold text-sm">
                  {editingInsurancePolicy ? "Modifica Polizza Assicurativa" : "Registra Nuova Polizza Assicurativa"}
                </h3>
                <button type="button" onClick={() => setShowInsuranceModal(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveInsurancePolicyLocal} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Compagnia Assicuratrice *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Esempio: Allianz, Generali, Unipol"
                    value={insCompany}
                    onChange={(e) => setInsCompany(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 outline-hidden focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Numero Polizza *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Esempio: POL-982173"
                    value={insPolicyNumber}
                    onChange={(e) => setInsPolicyNumber(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 outline-hidden focus:border-indigo-500 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tipo Copertura
                  </label>
                  <select
                    value={insCoverageType}
                    onChange={(e) => setInsCoverageType(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-white outline-hidden focus:border-indigo-500 transition-all"
                  >
                    <option value="Incendio e Scoppio">Incendio e Scoppio 🔥</option>
                    <option value="R.C. Fabbricato">R.C. Fabbricato 🏢</option>
                    <option value="Tutela Legale">Tutela Legale ⚖️</option>
                    <option value="Multirischio Fabbricati">Multirischio Fabbricati 🛡️</option>
                    <option value="Kasko">Kasko Completa 🚗</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Scadenza *
                    </label>
                    <input
                      type="date"
                      required
                      value={insExpiryDate}
                      onChange={(e) => setInsExpiryDate(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 outline-hidden focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Premio Annuo (€)
                    </label>
                    <input
                      type="number"
                      placeholder="Esempio: 450"
                      value={insPremiumAmount}
                      onChange={(e) => setInsPremiumAmount(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 outline-hidden focus:border-indigo-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nome File Documento (Allegato)
                  </label>
                  <input
                    type="text"
                    placeholder="Esempio: Polizza_Allianz_Firmata.pdf"
                    value={insDocName}
                    onChange={(e) => setInsDocName(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 outline-hidden focus:border-indigo-500 transition-all"
                  />
                  <p className="text-[9px] text-slate-400 mt-1">Carica un documento per registrare la quietanza firmata.</p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowInsuranceModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-xs cursor-pointer"
                  >
                    {editingInsurancePolicy ? "Aggiorna" : "Salva Polizza"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Upload simulated document modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <h3 className="font-sans font-bold text-sm">Salva Documento Immobile</h3>
                <button type="button" onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUploadDocSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Nome File *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Esempio: Planimetria_Catastale_Via_Torino"
                    value={uploadDocName}
                    onChange={(e) => setUploadDocName(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-hidden focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Categoria Documento
                  </label>
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white outline-hidden focus:border-indigo-500 transition-all"
                  >
                    <option value="Planimetria Catastale">Planimetria Catastale 🗺️</option>
                    <option value="Planimetria">Planimetria Semplice 🗺️</option>
                    <option value="APE">Attestato APE (Prestazione Energetica) ⚡</option>
                    <option value="Contratto">Contratto di Locazione 📄</option>
                    <option value="Verbale">Verbale Assemblea Condominiale 🏢</option>
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
                    Salva File
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Simulated Document Dispatch modal (Dialog window) */}
        {showDispatchModal && dispatchDoc && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <h3 className="font-sans font-bold text-sm">Spedisci File a Soggetto Qualificato</h3>
                <button type="button" onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-xs">
                  <p className="font-bold text-indigo-900">Documento da condividere:</p>
                  <p className="font-semibold text-slate-700 mt-1 flex items-center gap-1.5">
                    <FileText size={14} className="text-indigo-600" />
                    <span>{dispatchDoc.name} ({dispatchDoc.type})</span>
                  </p>
                </div>

                {dispatchSuccessMsg ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl leading-relaxed">
                    {dispatchSuccessMsg}
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                        Seleziona Soggetto Qualificato Presente nel Sistema *
                      </label>
                      <select
                        value={selectedRecipientId}
                        onChange={(e) => setSelectedRecipientId(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-white outline-hidden focus:border-indigo-500 transition-all"
                      >
                        <option value="">-- Seleziona destinatario abilitato --</option>
                        {associatedTenant && (
                          <option value="tenant">👤 Inquilino: {associatedTenant.name}</option>
                        )}
                        <option value="owner">👤 Proprietario: {ownerName}</option>
                        <option value="lawyer">⚖️ Avvocato: Studio Legale Associato</option>
                        <option value="admin">🏢 Amministratore Condominio: Ing. Neri</option>
                      </select>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowDispatchModal(false)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        disabled={!selectedRecipientId}
                        onClick={handleConfirmDispatch}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg text-xs shadow-xs flex items-center space-x-1 cursor-pointer"
                      >
                        <Send size={11} />
                        <span>Invia Documento</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const filteredProperties = filterStatus === "all" 
    ? properties 
    : properties.filter(p => p.status === filterStatus);

  return (
    <div className="space-y-6" id="properties-view-container">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Anagrafica Immobili</h2>
          <p className="text-xs text-slate-500 mt-0.5">Gestisci e cataloga le unità immobiliari del tuo portafoglio.</p>
        </div>
        <button
          onClick={openAddModal}
          id="add-property-btn"
          className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Aggiungi Immobile</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 pb-3">
        {["all", "Available", "Rented", "Maintenance", "Archived"].map((statusOption) => (
          <button
            key={statusOption}
            onClick={() => setFilterStatus(statusOption)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === statusOption
                ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100"
                : "text-slate-500 hover:bg-slate-50 border border-transparent"
            }`}
          >
            {statusOption === "all" && "Tutti"}
            {statusOption === "Available" && "Disponibili"}
            {statusOption === "Rented" && "Inquilini Presenti"}
            {statusOption === "Maintenance" && "In Manutenzione"}
            {statusOption === "Archived" && "Archiviati"}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filteredProperties.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-lg mx-auto mt-8">
          <div className="bg-slate-50 text-slate-400 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <Home size={28} />
          </div>
          <h3 className="font-sans font-bold text-slate-800 text-base">Nessun immobile trovato</h3>
          <p className="text-xs text-slate-500 mt-2">
            Non hai immobili inseriti in questa categoria. Aggiungine uno manualmente o caricalo tramite la procedura guidata con l'AI.
          </p>
          <button
            onClick={openAddModal}
            className="mt-5 inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs transition-colors"
          >
            <Plus size={14} />
            <span>Inserisci ora</span>
          </button>
        </div>
      ) : (
        /* Properties Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map((property) => {
            return (
              <div 
                key={property.id} 
                className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:shadow-md hover:border-indigo-100 transition-all duration-300 flex flex-col justify-between"
                id={`property-card-${property.id}`}
              >
                {/* Status bar */}
                <div className="p-5 flex-1">
                  <div className="flex items-center justify-between">
                    <span 
                      onClick={() => setSelectedPropertyDetails(property)}
                      className="text-[10px] font-mono font-semibold tracking-wider uppercase text-indigo-500 cursor-pointer hover:underline"
                    >
                      {property.type}
                    </span>
                    <span 
                      onClick={() => setSelectedPropertyDetails(property)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide cursor-pointer hover:opacity-80 ${
                        property.status === "Available" 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100/50" 
                          : property.status === "Rented" 
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-100/50" 
                          : property.status === "Maintenance"
                          ? "bg-amber-50 text-amber-700 border border-amber-100/50"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {property.status === "Available" && "Libero"}
                      {property.status === "Rented" && "Locato"}
                      {property.status === "Maintenance" && "Manutenzione"}
                      {property.status === "Archived" && "Archiviato"}
                    </span>
                  </div>

                  <h3 
                    onClick={() => setSelectedPropertyDetails(property)}
                    className="font-sans font-bold text-slate-900 text-base mt-3 leading-snug cursor-pointer hover:text-indigo-600 hover:underline transition-colors"
                  >
                    {property.name}
                  </h3>
                  
                  <div className="space-y-2 mt-4 text-xs text-slate-500">
                    <div className="flex items-start space-x-2">
                      <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                      <span>{property.address}</span>
                    </div>
                    {property.owner && (
                      <div className="flex items-center space-x-2">
                        <Tag size={14} className="text-slate-400 shrink-0" />
                        <span>Proprietario: <strong className="text-slate-700">{property.owner}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Badges for Bare Ownership & Condo Constituted at a glance */}
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-slate-50">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      property.isBareOwnership 
                        ? "bg-amber-50 text-amber-700 border border-amber-200/50" 
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                    }`}>
                      {property.isBareOwnership ? "🟠 Nuda Proprietà" : "🟢 Piena Proprietà (Ammin. Ordinaria)"}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      property.isCondoConstituted 
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200/50" 
                        : "bg-rose-50 text-rose-700 border border-rose-200/50"
                    }`}>
                      {property.isCondoConstituted ? "🏢 Condominio Costituito" : "⚠️ Condominio Assente / Non Costituito"}
                    </span>
                  </div>

                  {property.notes && (
                    <div className="mt-4 p-3 bg-slate-50/50 rounded-xl text-xs text-slate-600 border border-slate-100/50 flex items-start space-x-2">
                      <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
                      <p className="line-clamp-2">{property.notes}</p>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedPropertyDetails(property)}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl border border-indigo-200 transition-all cursor-pointer"
                    title="Analizza Scheda Immobile"
                  >
                    <span>Analizza Scheda 🔍</span>
                  </button>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditModal(property)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Modifica"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(property.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Elimina"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Property Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-sans font-bold text-base">
                {editingProperty ? "Modifica Immobile" : "Nuovo Immobile"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nome Immobile / Unità *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Esempio: Bilocale Via Torino 15"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Indirizzo Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Via, Civico, Città, CAP"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tipologia Unità
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-hidden focus:border-indigo-500 transition-all"
                  >
                    <option value="Appartamento">Appartamento</option>
                    <option value="Monolocale">Monolocale</option>
                    <option value="Bilocale">Bilocale</option>
                    <option value="Ufficio">Ufficio</option>
                    <option value="Negozio">Negozio</option>
                    <option value="Garage/Box">Garage/Box</option>
                    <option value="Villa">Villa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Stato Locazione
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-hidden focus:border-indigo-500 transition-all"
                  >
                    <option value="Available">Libero (Disponibile)</option>
                    <option value="Rented">Locato (Occupato)</option>
                    <option value="Maintenance">In Manutenzione</option>
                    <option value="Archived">Archiviato</option>
                  </select>
                </div>
              </div>

              {/* Proprietario / Locatore Section (Required & Guided) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                    Proprietario / Locatore *
                  </label>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase">Obbligatorio</span>
                </div>
                
                <div className="flex bg-white p-1 rounded-xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setOwnerMode("select")}
                    className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${
                      ownerMode === "select"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Seleziona Esistente 👥
                  </button>
                  <button
                    type="button"
                    onClick={() => setOwnerMode("guided")}
                    className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${
                      ownerMode === "guided"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Procedura Guidata ✨
                  </button>
                </div>

                {ownerMode === "select" ? (
                  <div className="space-y-1.5">
                    {getUniqueOwners().length === 0 ? (
                      <p className="text-[11px] text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-150 font-semibold leading-relaxed">
                        Nessun proprietario presente in anagrafica. Usa la <strong>Procedura Guidata</strong> per crearne uno nuovo su questo immobile.
                      </p>
                    ) : (
                      <select
                        value={selectedExistingOwner}
                        onChange={(e) => setSelectedExistingOwner(e.target.value)}
                        className="w-full text-sm border border-slate-200 bg-white rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 transition-all font-bold text-slate-800"
                      >
                        <option value="">-- Seleziona un proprietario esistente --</option>
                        {getUniqueOwners().map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 border-t border-slate-200/60 pt-3">
                    {/* Guided flow types */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "individual", label: "Privato 👤" },
                        { id: "company", label: "Società 🏢" },
                        { id: "multiple", label: "Multipli 👥" }
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setGuidedOwnerType(t.id as any)}
                          className={`py-1.5 text-[10px] font-bold border rounded-lg text-center transition-all ${
                            guidedOwnerType === t.id
                              ? "bg-indigo-50 text-indigo-700 border-indigo-300 font-black"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Conditional inputs */}
                    {guidedOwnerType === "individual" && (
                      <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                        <div>
                          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
                            Nome
                          </label>
                          <input
                            type="text"
                            placeholder="Mario"
                            value={indFirstName}
                            onChange={(e) => setIndFirstName(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 outline-hidden focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
                            Cognome
                          </label>
                          <input
                            type="text"
                            placeholder="Rossi"
                            value={indLastName}
                            onChange={(e) => setIndLastName(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 outline-hidden focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    )}

                    {guidedOwnerType === "company" && (
                      <div className="space-y-1 animate-fadeIn">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
                          Ragione Sociale / Ente
                        </label>
                        <input
                          type="text"
                          placeholder="Immobiliare Duomo S.r.l."
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 outline-hidden focus:border-indigo-500"
                        />
                      </div>
                    )}

                    {guidedOwnerType === "multiple" && (
                      <div className="space-y-2 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider">
                            Comproprietari
                          </label>
                          <button
                            type="button"
                            onClick={() => setMultipleOwnersList([...multipleOwnersList, ""])}
                            className="text-[10px] text-indigo-600 font-extrabold hover:underline"
                          >
                            + Aggiungi
                          </button>
                        </div>
                        <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                          {multipleOwnersList.map((ownerName, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-slate-400 w-4">#{idx + 1}</span>
                              <input
                                type="text"
                                placeholder={`Comprietario ${idx + 1}`}
                                value={ownerName}
                                onChange={(e) => {
                                  const updated = [...multipleOwnersList];
                                  updated[idx] = e.target.value;
                                  setMultipleOwnersList(updated);
                                }}
                                className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-hidden focus:border-indigo-500"
                              />
                              {multipleOwnersList.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = multipleOwnersList.filter((_, i) => i !== idx);
                                    setMultipleOwnersList(updated);
                                  }}
                                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150">
                <div className="flex items-center space-x-2.5">
                  <input
                    type="checkbox"
                    id="isBareOwnership"
                    checked={isBareOwnership}
                    onChange={(e) => setIsBareOwnership(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="isBareOwnership" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                    Nuda Proprietà (Bare Ownership)
                  </label>
                </div>

                <div className="flex flex-col justify-center">
                  <div className="flex items-center space-x-2.5">
                    <input
                      type="checkbox"
                      id="isCondoConstituted"
                      checked={isCondoConstituted}
                      onChange={(e) => setIsCondoConstituted(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="isCondoConstituted" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      Condominio Costituito
                    </label>
                  </div>
                </div>
              </div>

              {isCondoConstituted && (
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 space-y-1.5 animate-fadeIn">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Condominio & Amministratore Associato *
                  </label>
                  <select
                    value={condominiumId}
                    onChange={(e) => setCondominiumId(e.target.value)}
                    required={isCondoConstituted}
                    className="w-full text-sm border border-slate-200 bg-white rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 transition-all font-bold text-slate-800"
                  >
                    <option value="">-- Seleziona Condominio --</option>
                    {condominiums.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.administrator ? `(Amministratore: ${c.administrator})` : ""}
                      </option>
                    ))}
                  </select>
                  {condominiums.length === 0 && (
                    <p className="text-[10px] text-amber-600">
                      Nessun condominio esistente nel sistema. Creane uno nella sezione Condomini prima di procedere.
                    </p>
                  )}
                </div>
              )}

              {/* Quota Millesimale ed Utenze */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    Quota Millesimale *
                  </label>
                  <p className="text-[10px] text-slate-500 mb-2">Inserisci il valore in millesimi (es. 120 per 120/1000) utilizzato per la ripartizione reale delle spese condominiali.</p>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      required
                      min="0"
                      max="1000"
                      value={millesimi}
                      onChange={(e) => setMillesimi(Number(e.target.value) || 0)}
                      className="w-32 text-xs border border-slate-200 bg-white rounded-lg px-2.5 py-2 outline-hidden focus:border-indigo-500 font-bold"
                    />
                    <span className="text-xs font-mono font-bold text-slate-500">/ 1000 millesimi</span>
                  </div>
                </div>

                <div className="border-t border-slate-200/60 pt-3">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center space-x-1">
                    <span>⚡</span>
                    <span>Gestione Contatori Utenze</span>
                  </h4>
                  <p className="text-[10px] text-slate-500 mb-3">Registra i dettagli dei contatori dell'immobile e indica a chi sono intestate le utenze (ON: conduttore, OFF: proprietario).</p>

                  <div className="space-y-4">
                    {/* Luce Meter */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between pb-1.5">
                        <span className="text-[11px] font-bold text-indigo-700 uppercase flex items-center space-x-1">
                          <span>💡</span> <span>Utenza Luce</span>
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-semibold text-slate-500">Intestazione:</span>
                          <button
                            type="button"
                            onClick={() => setLuceActiveFlag(luceActiveFlag === "conduttore" ? "proprietario" : "conduttore")}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                              luceActiveFlag === "conduttore"
                                ? "bg-amber-100 text-amber-800 border border-amber-250 font-black"
                                : "bg-slate-100 text-slate-700 border border-slate-250 font-bold"
                            }`}
                          >
                            {luceActiveFlag === "conduttore" ? "Conduttore (ON)" : "Proprietario (OFF)"}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">N. Contatore</label>
                          <input
                            type="text"
                            placeholder="Es. IT001E..."
                            value={luceMeterNo}
                            onChange={(e) => setLuceMeterNo(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-md px-2 py-1 outline-hidden focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Ultima Lettura</label>
                          <input
                            type="number"
                            placeholder="0"
                            value={luceLastReading || ""}
                            onChange={(e) => setLuceLastReading(Number(e.target.value) || 0)}
                            className="w-full text-xs border border-slate-200 rounded-md px-2 py-1 outline-hidden focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Data Lettura</label>
                          <input
                            type="date"
                            value={luceReadingDate}
                            onChange={(e) => setLuceReadingDate(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-md px-2 py-1 outline-hidden focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Gas Meter */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between pb-1.5">
                        <span className="text-[11px] font-bold text-orange-700 uppercase flex items-center space-x-1">
                          <span>🔥</span> <span>Utenza Gas</span>
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-semibold text-slate-500">Intestazione:</span>
                          <button
                            type="button"
                            onClick={() => setGasActiveFlag(gasActiveFlag === "conduttore" ? "proprietario" : "conduttore")}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                              gasActiveFlag === "conduttore"
                                ? "bg-amber-100 text-amber-800 border border-amber-250 font-black"
                                : "bg-slate-100 text-slate-700 border border-slate-250 font-bold"
                            }`}
                          >
                            {gasActiveFlag === "conduttore" ? "Conduttore (ON)" : "Proprietario (OFF)"}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">N. Contatore</label>
                          <input
                            type="text"
                            placeholder="Es. IT002G..."
                            value={gasMeterNo}
                            onChange={(e) => setGasMeterNo(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-md px-2 py-1 outline-hidden focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Ultima Lettura</label>
                          <input
                            type="number"
                            placeholder="0"
                            value={gasLastReading || ""}
                            onChange={(e) => setGasLastReading(Number(e.target.value) || 0)}
                            className="w-full text-xs border border-slate-200 rounded-md px-2 py-1 outline-hidden focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Data Lettura</label>
                          <input
                            type="date"
                            value={gasReadingDate}
                            onChange={(e) => setGasReadingDate(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-md px-2 py-1 outline-hidden focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Acqua Meter */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between pb-1.5">
                        <span className="text-[11px] font-bold text-sky-700 uppercase flex items-center space-x-1">
                          <span>💧</span> <span>Utenza Acqua</span>
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-semibold text-slate-500">Intestazione:</span>
                          <button
                            type="button"
                            onClick={() => setAcquaActiveFlag(acquaActiveFlag === "conduttore" ? "proprietario" : "conduttore")}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                              acquaActiveFlag === "conduttore"
                                ? "bg-amber-100 text-amber-800 border border-amber-250 font-black"
                                : "bg-slate-100 text-slate-700 border border-slate-250 font-bold"
                            }`}
                          >
                            {acquaActiveFlag === "conduttore" ? "Conduttore (ON)" : "Proprietario (OFF)"}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">N. Contatore</label>
                          <input
                            type="text"
                            placeholder="Es. IT003W..."
                            value={acquaMeterNo}
                            onChange={(e) => setAcquaMeterNo(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-md px-2 py-1 outline-hidden focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Ultima Lettura</label>
                          <input
                            type="number"
                            placeholder="0"
                            value={acquaLastReading || ""}
                            onChange={(e) => setAcquaLastReading(Number(e.target.value) || 0)}
                            className="w-full text-xs border border-slate-200 rounded-md px-2 py-1 outline-hidden focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Data Lettura</label>
                          <input
                            type="date"
                            value={acquaReadingDate}
                            onChange={(e) => setAcquaReadingDate(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-md px-2 py-1 outline-hidden focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Note Addizionali
                </label>
                <textarea
                  placeholder="Annotazioni catastali, impianti, dettagli interni, spese..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-3 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                >
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
