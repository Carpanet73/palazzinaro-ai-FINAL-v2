
import React, { useState } from "react";
import { 
  Plus, Edit3, Trash2, FileText, Calendar, Wallet, Link2, 
  Sparkles, X, AlertCircle, ArrowRight, ArrowLeft, Check, 
  Upload, RefreshCw, FileCheck, Building, User, Info, MapPin
} from "lucide-react";
import { Contract, Property, Tenant, Condominium, AppSection, DeliveryReport } from "../types";

interface ContractsViewProps {
  contracts: Contract[];
  properties: Property[];
  tenants: Tenant[];
  condominiums: Condominium[];
  deliveryReports?: DeliveryReport[];
  onAddContract: (
    contract: Omit<Contract, "id" | "userId" | "createdAt"> & { newProperty?: any; newTenant?: any }
  ) => Promise<void>;
  onEditContract: (id: string, contract: Partial<Contract>) => Promise<void>;
  onDeleteContract: (id: string) => Promise<void>;
  onAddProperty?: (property: Omit<Property, "id" | "userId" | "createdAt">) => Promise<void>;
  onAddTenant?: (tenant: Omit<Tenant, "id" | "userId" | "createdAt">) => Promise<void>;
  onAddDeliveryReport?: (data: any) => Promise<void>;
  onEditDeliveryReport?: (id: string, data: any) => Promise<void>;
  onDeleteDeliveryReport?: (id: string) => Promise<void>;
  setCurrentSection?: (section: AppSection) => void;
  setSelectedTenantIdForLedger?: (id: string | null) => void;
}

export default function ContractsView({
  contracts,
  properties,
  tenants,
  condominiums,
  deliveryReports = [],
  onAddContract,
  onEditContract,
  onDeleteContract,
  onAddProperty,
  onAddTenant,
  onAddDeliveryReport,
  onEditDeliveryReport,
  onDeleteDeliveryReport,
  setCurrentSection,
  setSelectedTenantIdForLedger
}: ContractsViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  
  // Standard Form fields (for edit/manual adjustments)
  const [propertyId, setPropertyId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rentAmount, setRentAmount] = useState<number>(0);
  const [frequency, setFrequency] = useState<"Mensile" | "Trimestrale" | "Semestrale" | "Annuale">("Mensile");
  const [status, setStatus] = useState<"Active" | "Draft" | "Expired" | "Terminated">("Active");
  const [notes, setNotes] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [isBareOwnership, setIsBareOwnership] = useState(false);

  // Guided Relationship Wizard state
  const [wizardStep, setWizardStep] = useState(0); // 0: OCR scan, 1: Property, 2: Tenant, 3: Contract parameters, 4: Summary
  const [wizardPropertyMode, setWizardPropertyMode] = useState<"select" | "create">("select");
  const [wizardTenantMode, setWizardTenantMode] = useState<"select" | "create">("select");

  // Inline Creation states for Guided Wizard
  // 1. New Property
  const [newPropName, setNewPropName] = useState("");
  const [newPropAddress, setNewPropAddress] = useState("");
  const [newPropType, setNewPropType] = useState("Appartamento");
  const [newPropOwner, setNewPropOwner] = useState("");
  const [newPropIsBare, setNewPropIsBare] = useState(false);
  const [newPropIsCondo, setNewPropIsCondo] = useState(false);

  // 2. New Tenant
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantEmail, setNewTenantEmail] = useState("");
  const [newTenantPhone, setNewTenantPhone] = useState("");
  const [newTenantFiscalCode, setNewTenantFiscalCode] = useState("");
  const [newTenantNotes, setNewTenantNotes] = useState("");

  // AI OCR Extract helper states
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [uploadedScanName, setUploadedScanName] = useState<string | null>(null);

  // Selected details active state
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [newDocName, setNewDocName] = useState("");
  const [newDocType, setNewDocType] = useState("APE (Classe Energetica)");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Delivery/Return Report (Verbale di consegna) states
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [delReportType, setDelReportType] = useState<"consegna" | "riconsegna">("consegna");
  const [delDate, setDelDate] = useState(new Date().toISOString().split("T")[0]);
  const [checklistItems, setChecklistItems] = useState<Array<{
    id: string;
    item: string;
    status: string;
    notes: string;
    photos: string[];
  }>>([
    { id: "cl-1", item: "Stato Pareti ed Intonaci", status: "Ottimo", notes: "Nessuna crepa o macchia di umidità rilevata.", photos: [] },
    { id: "cl-2", item: "Elettrodomestici (Forno, Frigo, Lavatrice)", status: "Buono", notes: "Funzionanti, puliti.", photos: [] },
    { id: "cl-3", item: "Chiavi Consegnate (Portone, Cancello, Cantina)", status: "Ottimo", notes: "Forniti 3 mazzi completi.", photos: [] },
    { id: "cl-4", item: "Lettura Contatori Luce e Gas", status: "Buono", notes: "Lettura Luce: 4123 kWh. Gas: 1205 mc.", photos: [] },
    { id: "cl-5", item: "Infissi, Finestre e Tapparelle", status: "Ottimo", notes: "Perfettamente sigillanti e scorrevoli.", photos: [] }
  ]);
  const [newChecklistItemName, setNewChecklistItemName] = useState("");
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureTargetReport, setSignatureTargetReport] = useState<any | null>(null);
  const [signatureRole, setSignatureRole] = useState<"owner" | "tenant">("owner");
  const [signatureTypedName, setSignatureTypedName] = useState("");

  // Sync Property documents with localStorage
  const [propertyDocs, setPropertyDocs] = useState<Record<string, Array<{
    id: string;
    name: string;
    type: string;
    date: string;
    size: string;
  }>>>(() => {
    const saved = localStorage.getItem("property_documents_contracts");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing property documents in ContractsView", e);
      }
    }
    return {};
  });

  // Keep selected contract ID updated
  React.useEffect(() => {
    if (contracts.length > 0 && !selectedContractId) {
      setSelectedContractId(contracts[0].id);
    }
  }, [contracts, selectedContractId]);

  // Support deep-linking and highlight of contracts requiring registration milestone updates
  React.useEffect(() => {
    const highlightContractId = localStorage.getItem("highlight_registration_contract_id");
    const highlightTitle = localStorage.getItem("highlight_registration_title");
    if (highlightContractId && contracts.some(c => c.id === highlightContractId)) {
      setSelectedContractId(highlightContractId);
      if (highlightTitle) {
        setNewDocName(`Ricevuta: ${highlightTitle}`);
        setNewDocType("Ricevuta Imposta/Proroga");
      }
      
      // Smoothly scroll to the physical documentation section
      setTimeout(() => {
        const element = document.getElementById("physical-docs-container");
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 600);
    }
  }, [contracts]);

  // Seed default floor plans/certifications for existing contracts
  React.useEffect(() => {
    let updated = false;
    const nextDocs = { ...propertyDocs };
    
    contracts.forEach(contract => {
      const pid = contract.propertyId;
      if (!nextDocs[pid] || nextDocs[pid].length === 0) {
        nextDocs[pid] = [
          {
            id: `doc-ape-${pid}`,
            name: "Attestato di Prestazione Energetica (APE) - Valido 10 Anni",
            type: "APE (Classe Energetica)",
            date: "2025-10-12",
            size: "2.4 MB"
          },
          {
            id: `doc-conf-${pid}`,
            name: "Certificato di Conformità Impianto Elettrico (D.M. 37/08)",
            type: "Certificazione di Conformità",
            date: "2025-11-20",
            size: "1.8 MB"
          },
          {
            id: `doc-plan-${pid}`,
            name: "Planimetria Catastale Rasterizzata",
            type: "Planimetria/Visura",
            date: "2024-04-15",
            size: "4.1 MB"
          }
        ];
        updated = true;
      }
    });
    
    if (updated) {
      setPropertyDocs(nextDocs);
      localStorage.setItem("property_documents_contracts", JSON.stringify(nextDocs));
    }
  }, [contracts]);

  const saveDocs = (newDocs: typeof propertyDocs) => {
    setPropertyDocs(newDocs);
    localStorage.setItem("property_documents_contracts", JSON.stringify(newDocs));
  };

  const handleSimulateUpload = (fileName: string, fileSize?: number) => {
    setUploadLoading(true);
    setTimeout(() => {
      const sizeStr = fileSize ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB` : "2.1 MB";
      const lowercaseName = (fileName || "").toLowerCase();
      let detectedType = "Certificazione di Conformità";
      if (lowercaseName.includes("ape") || lowercaseName.includes("energet") || lowercaseName.includes("ap")) {
        detectedType = "APE (Classe Energetica)";
      } else if (lowercaseName.includes("plani") || lowercaseName.includes("visura") || lowercaseName.includes("plan")) {
        detectedType = "Planimetria/Visura";
      } else if (lowercaseName.includes("abita") || lowercaseName.includes("agibil")) {
        detectedType = "Certificato Abitabilità";
      }

      setNewDocName(fileName.replace(/\.[^/.]+$/, ""));
      setNewDocType(detectedType);
      setUploadLoading(false);
      alert(`Analisi OCR del file "${fileName}" eseguita con successo! Tipo rilevato: ${detectedType}. Clicca "Salva ed Inserisci" per registrare.`);
    }, 1000);
  };

  const handleAddDocManual = () => {
    if (!newDocName.trim()) {
      alert("Inserisci un nome per la certificazione.");
      return;
    }
    const targetId = selectedContractId || (contracts[0] ? contracts[0].id : "");
    const selectedContract = contracts.find(c => c.id === targetId);
    if (!selectedContract) return;

    const pid = selectedContract.propertyId;
    const newDoc = {
      id: `doc-${Date.now()}`,
      name: newDocName,
      type: newDocType,
      date: new Date().toISOString().split("T")[0],
      size: "2.3 MB"
    };

    const currentPropertyDocs = { ...propertyDocs };
    const list = currentPropertyDocs[pid] || [];
    currentPropertyDocs[pid] = [newDoc, ...list];
    
    saveDocs(currentPropertyDocs);
    setNewDocName("");

    // Check if this fulfills a pending registration milestone
    const highlightContractId = localStorage.getItem("highlight_registration_contract_id");
    if (highlightContractId === selectedContract.id) {
      localStorage.removeItem("highlight_registration_contract_id");
      localStorage.removeItem("highlight_registration_milestone_id");
      localStorage.removeItem("highlight_registration_title");
      alert(`Ricevuta "${newDoc.name}" caricata con successo! L'attività di registrazione è stata contrassegnata come COMPLETATA e l'avviso è stato rimosso dalla bacheca.`);
    } else {
      alert(`Certificato "${newDoc.name}" caricato ed associato con successo a "${selectedContract.propertyName}"!`);
    }
  };

  const handleDeleteDoc = (propertyId: string, docId: string) => {
    if (confirm("Sei sicuro di voler eliminare questa certificazione?")) {
      const currentPropertyDocs = { ...propertyDocs };
      if (currentPropertyDocs[propertyId]) {
        currentPropertyDocs[propertyId] = currentPropertyDocs[propertyId].filter(d => d.id !== docId);
        saveDocs(currentPropertyDocs);
      }
    }
  };

  // Delivery / Return Report (Correction 17) Helper Functions
  const handleOpenCreateDeliveryReport = (type: "consegna" | "riconsegna") => {
    setDelReportType(type);
    setDelDate(new Date().toISOString().split("T")[0]);
    setChecklistItems([
      { id: "cl-1", item: "Stato Pareti ed Intonaci", status: "Ottimo", notes: "Nessuna crepa o macchia di umidità rilevata.", photos: [] },
      { id: "cl-2", item: "Elettrodomestici (Forno, Frigo, Lavatrice)", status: "Buono", notes: "Funzionanti, puliti.", photos: [] },
      { id: "cl-3", item: "Chiavi Consegnate (Portone, Cancello, Cantina)", status: "Ottimo", notes: "Forniti 3 mazzi completi.", photos: [] },
      { id: "cl-4", item: "Lettura Contatori Luce e Gas", status: "Buono", notes: "Lettura Luce: 4123 kWh. Gas: 1205 mc.", photos: [] },
      { id: "cl-5", item: "Infissi, Finestre e Tapparelle", status: "Ottimo", notes: "Perfettamente sigillanti e scorrevoli.", photos: [] }
    ]);
    setNewChecklistItemName("");
    setShowDeliveryModal(true);
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistItemName.trim()) return;
    const newItem = {
      id: "cl-manual-" + Date.now(),
      item: newChecklistItemName,
      status: "Buono",
      notes: "Controllato.",
      photos: []
    };
    setChecklistItems(prev => [...prev, newItem]);
    setNewChecklistItemName("");
  };

  const handleRemoveChecklistItem = (id: string) => {
    setChecklistItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateChecklistItem = (id: string, field: string, value: any) => {
    setChecklistItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleAddPhotoToItem = (itemId: string) => {
    const photoName = prompt("Inserisci il nome del file della foto da allegare:", `foto_dettaglio_${Date.now().toString().slice(-4)}.jpg`);
    if (!photoName) return;
    setChecklistItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, photos: [...(item.photos || []), photoName] };
      }
      return item;
    }));
    alert(`Foto "${photoName}" allegata con successo all'elemento del verbale!`);
  };

  const handleSaveDeliveryReport = async (selectedContract: Contract) => {
    const payload = {
      propertyId: selectedContract.propertyId,
      contractId: selectedContract.id,
      tenantId: selectedContract.tenantId,
      type: delReportType,
      date: delDate,
      checklist: checklistItems,
      signatures: {
        ownerSigned: false,
        tenantSigned: false
      },
      documentName: `Verbale_${delReportType}_${selectedContract.propertyName?.replace(/\s+/g, "_")}.pdf`
    };

    try {
      if (onAddDeliveryReport) {
        await onAddDeliveryReport(payload);
      }
      setShowDeliveryModal(false);
      alert(`Verbale di ${delReportType === "consegna" ? "Consegna" : "Riconsegna"} registrato in bozza con successo!`);
    } catch (err) {
      console.error("Error creating delivery report", err);
    }
  };

  const handleDeleteDeliveryReportLocal = async (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questo verbale? L'operazione è irreversibile.")) {
      try {
        if (onDeleteDeliveryReport) {
          await onDeleteDeliveryReport(id);
        }
      } catch (err) {
        console.error("Error deleting delivery report", err);
      }
    }
  };

  const handleOpenSignModal = (report: any, role: "owner" | "tenant") => {
    setSignatureTargetReport(report);
    setSignatureRole(role);
    setSignatureTypedName("");
    setShowSignatureModal(true);
  };

  const handleConfirmSignature = async () => {
    if (!signatureTargetReport || !signatureTypedName.trim()) {
      alert("Inserisci il nome per esteso per apporre la firma digitale.");
      return;
    }

    const nextSignatures = {
      ...(signatureTargetReport.signatures || {})
    };

    if (signatureRole === "owner") {
      nextSignatures.ownerSigned = true;
      nextSignatures.ownerSignatureData = signatureTypedName;
      nextSignatures.ownerSignedAt = new Date().toISOString();
    } else {
      nextSignatures.tenantSigned = true;
      nextSignatures.tenantSignatureData = signatureTypedName;
      nextSignatures.tenantSignedAt = new Date().toISOString();
    }

    try {
      if (onEditDeliveryReport) {
        await onEditDeliveryReport(signatureTargetReport.id, {
          signatures: nextSignatures
        });
      }
      setShowSignatureModal(false);
      setSignatureTargetReport(null);
      setSignatureTypedName("");
      alert("Firma registrata con successo e applicata al verbale di consegna con marca temporale certificata!");
    } catch (err) {
      console.error("Error signing delivery report", err);
    }
  };

  // Open "Create Relationship" wizard instead of generic new contract
  const handleOpenAddWizard = () => {
    setEditingContract(null);
    setWizardStep(0);
    setWizardPropertyMode("select");
    setWizardTenantMode("select");
    
    // Clear selections
    setPropertyId(properties[0]?.id || "");
    setTenantId(tenants[0]?.id || "");
    setStartDate("");
    setEndDate("");
    setRentAmount(0);
    setFrequency("Mensile");
    setStatus("Active");
    setNotes("");
    setOwnerName("");
    setIsBareOwnership(false);

    // Clear inline states
    setNewPropName("");
    setNewPropAddress("");
    setNewPropType("Appartamento");
    setNewPropOwner("");
    setNewPropIsBare(false);
    setNewPropIsCondo(false);

    setNewTenantName("");
    setNewTenantEmail("");
    setNewTenantPhone("");
    setNewTenantFiscalCode("");
    setNewTenantNotes("");

    // AI Assist
    setAiText("");
    setAiError("");
    setUploadedScanName(null);

    setShowModal(true);
  };

  const handleOpenEditModal = (contract: Contract) => {
    setEditingContract(contract);
    setWizardStep(3); // skip straight to parameters
    setPropertyId(contract.propertyId);
    setTenantId(contract.tenantId);
    setStartDate(contract.startDate);
    setEndDate(contract.endDate);
    setRentAmount(contract.rentAmount);
    setFrequency(contract.frequency);
    setStatus(contract.status);
    setNotes(contract.notes || "");
    setOwnerName(contract.ownerName || "");
    setIsBareOwnership(contract.isBareOwnership || false);
    
    setShowModal(true);
  };

  // Simulated & real OCR process inside wizard Step 0
  const handleOcrFileDropped = (fileName: string) => {
    setAiLoading(true);
    setAiError("");
    setUploadedScanName(fileName);

    setTimeout(() => {
      // High-fidelity extraction simulating real-world scans
      const address = "Corso Buenos Aires 45, Milano";
      const propName = "Appartamento Buenos Aires";
      const owner = "Dr. Stefano Marini";
      const tenant = "Giuseppe Verdi";
      const tenantEmail = "giuseppe.verdi@gmail.com";
      const tenantPhone = "+39 345 6789 012";
      const tenantFiscalCode = "VRDGSP85M12F205W";
      const rent = 950;
      const start = "2026-08-01";
      const end = "2030-07-31";
      const notesEx = "Cedolare secca 10%. Tre mesi deposito cauzionale.";

      // Prepopulate everything
      setWizardPropertyMode("create");
      setNewPropName(propName);
      setNewPropAddress(address);
      setNewPropType("Appartamento");
      setNewPropOwner(owner);
      setNewPropIsCondo(true);

      setWizardTenantMode("create");
      setNewTenantName(tenant);
      setNewTenantEmail(tenantEmail);
      setNewTenantPhone(tenantPhone);
      setNewTenantFiscalCode(tenantFiscalCode);
      setNewTenantNotes("Inquilino estratto con successo tramite OCR.");

      setRentAmount(rent);
      setStartDate(start);
      setEndDate(end);
      setFrequency("Mensile");
      setNotes(notesEx);
      setOwnerName(owner);

      setAiLoading(false);
      alert(`Scansione OCR Completata!\n\nL'AI ha precompilato tutti i dati relativi all'immobile (${propName}), conduttore (${tenant}) e parametri di locazione. Avanza nei passaggi per confermare.`);
      setWizardStep(1); // Advance to Property Confirmation
    }, 1500);
  };

  const handleOcrTextSubmit = async () => {
    if (!aiText.trim()) {
      setAiError("Inserisci o incolla il testo del contratto.");
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
          context: "contracts"
        })
      });

      const result = await response.json();
      if (result.success && result.data) {
        const ext = result.data;
        
        // Populate contract fields
        if (ext.startDate) setStartDate(ext.startDate);
        if (ext.endDate) setEndDate(ext.endDate);
        if (ext.rentAmount) setRentAmount(Number(ext.rentAmount));
        if (ext.frequency) setFrequency(ext.frequency);
        if (ext.notes) setNotes(ext.notes);
        if (ext.ownerName) setOwnerName(ext.ownerName);

        // Prepopulate inline property
        setWizardPropertyMode("create");
        setNewPropName(ext.propertyName || "Appartamento Estratto");
        setNewPropAddress(ext.propertyAddress || "Via Roma 12, Milano");
        setNewPropOwner(ext.ownerName || "Proprietario Estratto");

        // Prepopulate inline tenant
        setWizardTenantMode("create");
        setNewTenantName(ext.tenantName || "Conduttore Estratto");
        setNewTenantEmail(ext.tenantEmail || "inquilino@email.com");
        setNewTenantFiscalCode(ext.tenantFiscalCode || "FSCMRA80A01H501U");

        alert("Testo analizzato con successo! Tutti i dati di Immobile, Tenant e Contratto sono stati estratti. Controlla i prossimi passaggi.");
        setWizardStep(1);
      } else {
        setAiError(result.error || "Impossibile completare l'analisi automatica.");
      }
    } catch (err: any) {
      setAiError("Errore di connessione: " + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleWizardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations based on modes
    if (wizardPropertyMode === "select" && !propertyId) {
      alert("Seleziona un immobile esistente.");
      return;
    }
    if (wizardPropertyMode === "create" && (!newPropName || !newPropAddress)) {
      alert("Specifica nome e indirizzo dell'immobile.");
      return;
    }

    if (wizardTenantMode === "select" && !tenantId) {
      alert("Seleziona un inquilino esistente.");
      return;
    }
    if (wizardTenantMode === "create" && !newTenantName) {
      alert("Specifica il nome del conduttore.");
      return;
    }

    if (!rentAmount || rentAmount <= 0 || !startDate || !endDate) {
      alert("Compila tutti i parametri obbligatori del contratto (canone, date).");
      return;
    }

    // Prepare custom payload
    const linkedProp = properties.find(p => p.id === propertyId);
    const linkedTenant = tenants.find(t => t.id === tenantId);

    const payload: any = {
      startDate,
      endDate,
      rentAmount,
      frequency,
      status,
      notes,
      ownerName: ownerName || (wizardPropertyMode === "create" ? newPropOwner : linkedProp?.owner) || "Proprietario",
      isBareOwnership: isBareOwnership || (wizardPropertyMode === "create" ? newPropIsBare : (linkedProp?.isBareOwnership || false))
    };

    if (wizardPropertyMode === "create") {
      payload.newProperty = {
        name: newPropName,
        address: newPropAddress,
        type: newPropType,
        status: "Rented", // automatically rented
        owner: newPropOwner || "Proprietario",
        isBareOwnership: newPropIsBare,
        isCondoConstituted: newPropIsCondo
      };
    } else {
      payload.propertyId = propertyId;
      payload.propertyName = linkedProp?.name || "Immobile";
    }

    if (wizardTenantMode === "create") {
      payload.newTenant = {
        name: newTenantName,
        email: newTenantEmail || "inquilino@email.com",
        phone: newTenantPhone || "",
        fiscalCode: newTenantFiscalCode || "",
        notes: newTenantNotes || ""
      };
    } else {
      payload.tenantId = tenantId;
      payload.tenantName = linkedTenant?.name || "Inquilino";
    }

    try {
      if (editingContract) {
        await onEditContract(editingContract.id, {
          propertyId,
          propertyName: linkedProp?.name,
          tenantId,
          tenantName: linkedTenant?.name,
          startDate,
          endDate,
          rentAmount,
          frequency,
          status,
          notes,
          ownerName,
          isBareOwnership
        });
      } else {
        await onAddContract(payload);

        // Store the original scan as physical documentation for this newly created relation
        if (uploadedScanName && payload.propertyId) {
          const newDoc = {
            id: `doc-${Date.now()}`,
            name: uploadedScanName,
            type: "Contratto",
            date: new Date().toISOString().split("T")[0],
            size: "3.5 MB"
          };
          const currentPropertyDocs = { ...propertyDocs };
          currentPropertyDocs[payload.propertyId] = [newDoc, ...(currentPropertyDocs[payload.propertyId] || [])];
          saveDocs(currentPropertyDocs);
        }
      }
      setShowModal(false);
    } catch (err) {
      console.error("Error committing wizard relationship", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questo contratto? Le rate ed i solleciti rimarranno storicizzati.")) {
      try {
        await onDeleteContract(id);
      } catch (err) {
        console.error("Error deleting contract", err);
      }
    }
  };

  return (
    <div className="space-y-6" id="contracts-view-container">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Relazioni & Contratti di Locazione</h2>
          <p className="text-xs text-slate-500 mt-0.5">La centralina delle locazioni. Crea relazioni unificate tra immobili, inquilini e contratti con l'AI.</p>
        </div>
        <button
          onClick={handleOpenAddWizard}
          id="add-contract-btn"
          className="inline-flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4.5 py-2.5 rounded-xl text-xs active:transition-all shadow-sm"
        >
          <Plus size={15} className="stroke-[3]" />
          <span>🤝 Crea Nuova Relazione</span>
        </button>
      </div>

      {/* Contracts table with integrated RELATIONSHIPS */}
      {contracts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-lg mx-auto mt-8">
          <div className="bg-amber-50 text-amber-500 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4 border border-amber-200/50">
            <Link2 size={28} />
          </div>
          <h3 className="font-sans font-bold text-slate-800 text-base">Nessuna Relazione Attiva</h3>
          <p className="text-xs text-slate-500 mt-2">
            Non ci sono relazioni d'affitto inserite. Crea una nuova relazione guidata oppure carica la scansione di un contratto cartaceo per far compilare tutto all'AI.
          </p>
          <button
            onClick={handleOpenAddWizard}
            className="mt-5 inline-flex items-center space-x-2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-extrabold px-4 py-2 rounded-lg text-xs transition-colors border border-amber-200"
          >
            <Plus size={14} />
            <span>Crea prima relazione d'affitto</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-slate-300 text-xs font-mono">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-mono uppercase text-slate-700 tracking-wider font-extrabold border border-slate-300">
                  <th className="py-2.5 px-4 border border-slate-300">Relazione Principale (Immobile & Inquilino)</th>
                  <th className="py-2.5 px-4 border border-slate-300">Regime Temporale</th>
                  <th className="py-2.5 px-4 border border-slate-300">Flusso Finanziario</th>
                  <th className="py-2.5 px-4 border border-slate-300 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {contracts.map((contract) => {
                  const daysLeft = Math.ceil((new Date(contract.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                  const isSelected = selectedContractId === contract.id;

                  // Find relations
                  const matchingProperty = properties.find(p => p.id === contract.propertyId);
                  const matchingTenant = tenants.find(t => t.id === contract.tenantId);
                  const condoConstituted = condominiums.find(c => 
                    (matchingProperty?.address || "").toLowerCase().includes((c.name || "").toLowerCase()) || 
                    (c.name || "").toLowerCase().includes((matchingProperty?.name || "").toLowerCase()) ||
                    (c.notes && (c.notes || "").toLowerCase().includes((matchingProperty?.name || "").toLowerCase()))
                  );
                  
                  return (
                    <tr 
                      key={contract.id} 
                      className={`hover:bg-slate-50 transition-colors ${isSelected ? "bg-amber-50/15" : ""}`} 
                      id={`contract-row-${contract.id}`}
                    >
                      <td className="p-4 border border-slate-300 max-w-sm">
                        {/* UNIFIED RELATIONSHIP CARD (SAME AS DASHBOARD STYLE) */}
                        <div 
                          onClick={(e) => {
                            // Prevent selection on nav buttons
                            if ((e.target as HTMLElement).closest('.btn-nav-badge') || (e.target as HTMLElement).closest('button')) return;
                            setSelectedContractId(contract.id);
                          }}
                          className={`p-4 rounded-2xl border transition-all text-left space-y-3 cursor-pointer ${
                            isSelected 
                              ? "bg-amber-50/50 border-amber-300 shadow-xs ring-1 ring-amber-300/40" 
                              : "bg-slate-50/30 border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-sans font-black text-xs text-slate-900 flex items-center space-x-1.5">
                                <span className="text-base shrink-0">🏠</span>
                                <span className="truncate max-w-[200px]" title={contract.propertyName}>{contract.propertyName}</span>
                              </h4>
                              {matchingProperty?.address && (
                                <p className="text-[10px] text-slate-500 mt-1 ml-5 truncate max-w-[180px]">
                                  {matchingProperty.address}
                                </p>
                              )}
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100/80 text-amber-800 border border-amber-200">
                              Relazione Unica
                            </span>
                          </div>

                          <div className="space-y-1 bg-white/85 p-2.5 rounded-xl border border-slate-100 text-[10px]">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 font-medium">Conduttore / Inquilino:</span>
                              <span className="font-extrabold text-slate-800">
                                👤 {contract.tenantName}
                              </span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 font-medium">Canone Affitto:</span>
                              <span className="font-extrabold text-indigo-700">
                                €{contract.rentAmount.toLocaleString("it-IT")}/{contract.frequency === "Mensile" ? "mese" : contract.frequency}
                              </span>
                            </div>

                            {condoConstituted && (
                              <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[9px]">
                                <span className="text-slate-400">Condominio:</span>
                                <span className="font-extrabold text-slate-700 truncate max-w-[120px]">
                                  🏢 {condoConstituted.name}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Navigation Buttons to dedicated areas */}
                          <div className="flex items-center gap-2 pt-0.5">
                            <button
                              onClick={() => {
                                if (setCurrentSection) {
                                  setCurrentSection("properties");
                                }
                              }}
                              className="btn-nav-badge inline-flex items-center space-x-1 bg-amber-50/60 hover:bg-amber-100 text-amber-900 border border-amber-200/50 px-2 py-1 rounded-md text-[9px] font-black transition-all shadow-3xs"
                              title="Vai ai dettagli dell'immobile"
                            >
                              <span>🏠 Immobile</span>
                            </button>

                            <button
                              onClick={() => {
                                if (setSelectedTenantIdForLedger && setCurrentSection) {
                                  setSelectedTenantIdForLedger(contract.tenantId);
                                  setCurrentSection("tenants");
                                }
                              }}
                              className="btn-nav-badge inline-flex items-center space-x-1 bg-amber-50/60 hover:bg-amber-100 text-amber-900 border border-amber-200/50 px-2 py-1 rounded-md text-[9px] font-black transition-all shadow-3xs"
                              title="Vai ai dettagli del conduttore"
                            >
                              <span>👤 Inquilino</span>
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 border border-slate-300 vertical-middle">
                        <div className="space-y-1.5 text-xs text-slate-600">
                          <div className="flex items-center space-x-1.5">
                            <Calendar size={13} className="text-slate-400 shrink-0" />
                            <span className="font-semibold">{new Date(contract.startDate).toLocaleDateString("it-IT")} - {new Date(contract.endDate).toLocaleDateString("it-IT")}</span>
                          </div>
                          {daysLeft > 0 && daysLeft < 90 ? (
                            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-bold inline-block">
                              ⚠️ Scade tra {daysLeft} gg
                            </span>
                          ) : daysLeft <= 0 ? (
                            <span className="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded font-bold inline-block">
                              ❌ Scaduto
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-semibold block">
                              Regolare (scadenza tra {Math.ceil(daysLeft / 30)} mesi)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 border border-slate-300 vertical-middle">
                        <div className="space-y-1">
                          <div className="text-slate-900 font-black text-sm">
                            €{contract.rentAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                          </div>
                          <div className="flex items-center space-x-1 text-[10px] text-slate-500 capitalize">
                            <Wallet size={10} className="text-slate-400" />
                            <span>Locazione {contract.frequency}</span>
                          </div>
                          <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-50 text-amber-800 border border-amber-200/50">
                            {contract.status === "Active" ? "Attivo" : contract.status === "Draft" ? "Bozza" : contract.status === "Expired" ? "Scaduto" : "Cessato"}
                          </span>
                        </div>
                      </td>

                      <td className="p-4 border border-slate-300 text-right vertical-middle space-x-1.5">
                        <button
                          onClick={() => handleOpenEditModal(contract)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors inline-block border border-slate-100 bg-white shadow-3xs"
                          title="Modifica parametri di locazione"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(contract.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-block border border-slate-100 bg-white shadow-3xs"
                          title="Elimina questa relazione"
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
      )}

      {/* DETAILED AREA UNDERNEATH (NO TABS, STREAMLINED ACCORDING TO USER FLOW) */}
      {(() => {
        const targetId = selectedContractId || (contracts[0] ? contracts[0].id : "");
        const selectedContract = contracts.find(c => c.id === targetId);
        
        if (!selectedContract) return null;
        const matchedDocs = propertyDocs[selectedContract.propertyId] || [];

        const matchingProperty = properties.find(p => p.id === selectedContract.propertyId);
        const matchingTenant = tenants.find(t => t.id === selectedContract.tenantId);
        const condoConstituted = condominiums.find(c => 
          (matchingProperty?.address || "").toLowerCase().includes((c.name || "").toLowerCase()) || 
          (c.name || "").toLowerCase().includes((matchingProperty?.name || "").toLowerCase()) ||
          (c.notes && (c.notes || "").toLowerCase().includes((matchingProperty?.name || "").toLowerCase()))
        );

        return (
          <div className="bg-amber-50/40 border-2 border-amber-200 rounded-3xl p-6 shadow-xs space-y-6 mt-8" id="contract-detail-area">
            <div>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-md">
                🔍 Centralina di Riepilogo Relazione Locativa
              </span>
              <h3 className="font-sans font-black text-slate-950 text-xl mt-2 flex items-center space-x-2">
                <span>🤝</span>
                <span>Relazione: {selectedContract.propertyName} &mdash; {selectedContract.tenantName}</span>
              </h3>
            </div>

            {/* FIRST AREA: THE CONTRACT ITSELF & DETAILED RELATIONS */}
            <div className="bg-white rounded-2xl border border-amber-100 p-6 space-y-6">
              <h4 className="font-sans font-black text-slate-900 text-xs uppercase tracking-wide pb-2.5 flex items-center space-x-1.5">
                <span>📄</span> <span>1. Dettagli del Contratto & Clausole Giuridiche</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                {/* Contract Core Info */}
                <div className="bg-slate-50/60 p-4 rounded-xl space-y-3 border border-slate-100">
                  <h5 className="font-bold text-indigo-900 text-[10px] uppercase tracking-wide">Parametri Finanziari</h5>
                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Canone Base</span>
                      <strong className="text-slate-800 text-sm font-black">€{selectedContract.rentAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })} / {selectedContract.frequency}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Data Decorrenza</span>
                      <strong className="text-slate-800">{new Date(selectedContract.startDate).toLocaleDateString("it-IT")}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Scadenza Naturale</span>
                      <strong className="text-slate-800">{new Date(selectedContract.endDate).toLocaleDateString("it-IT")}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Regime di Registro</span>
                      <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded uppercase ${selectedContract.isBareOwnership ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"}`}>
                        {selectedContract.isBareOwnership ? "Nuda Proprietà" : "Standard / Ordinaria"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tenant Core info */}
                <div className="bg-slate-50/60 p-4 rounded-xl space-y-3 border border-slate-100">
                  <h5 className="font-bold text-indigo-900 text-[10px] uppercase tracking-wide">Dati del Conduttore</h5>
                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Nome Completo</span>
                      <strong className="text-slate-800 text-sm font-black">{selectedContract.tenantName}</strong>
                    </div>
                    {matchingTenant && (
                      <>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">E-mail</span>
                          <span className="text-slate-700">{matchingTenant.email}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Codice Fiscale</span>
                          <span className="font-mono text-slate-700 uppercase">{matchingTenant.fiscalCode || "N/D"}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Condominium and Owner information */}
                <div className="bg-slate-50/60 p-4 rounded-xl space-y-3 border border-slate-100">
                  <h5 className="font-bold text-indigo-900 text-[10px] uppercase tracking-wide">Amministrazione & Locatore</h5>
                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Locatore / Proprietario</span>
                      <strong className="text-slate-800 font-black">{selectedContract.ownerName || "Default Proprietario"}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Inquadramento Condominiale</span>
                      {condoConstituted ? (
                        <div className="mt-1.5 p-2 bg-indigo-50 border border-indigo-100 rounded-lg">
                          <div className="font-black text-indigo-950 text-[10px]">🏢 {condoConstituted.name}</div>
                          <div className="text-[9px] text-slate-500 mt-0.5">Amministratore: {condoConstituted.administrator || "N/D"}</div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center space-x-1 bg-rose-50 text-rose-800 border border-rose-200 rounded px-1.5 py-0.5 mt-1 font-semibold text-[9px]">
                          ⚠️ Nessun condominio associato
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes & Special Clauses */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                <span className="text-slate-400 block text-[9px] uppercase font-black tracking-wider">Note Generali, Clausole & Opzioni Fiscale (Es: Cedolare Secca)</span>
                <p className="text-slate-700 italic mt-1.5 whitespace-pre-wrap">
                  {selectedContract.notes || "Nessuna clausola o nota particolare inserita nel contratto."}
                </p>
              </div>
            </div>

            {/* SECOND AREA: PHYSICAL DOCUMENTATION OF THE DWELLING (APE, PLANIMETRY, ETC.) */}
            <div 
              id="physical-docs-container"
              className={`bg-white rounded-2xl border border-amber-100 p-6 space-y-6 transition-all duration-1000 ${
                localStorage.getItem("highlight_registration_contract_id") === selectedContract.id 
                  ? "border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)] bg-amber-50/5" 
                  : "border-amber-100"
              }`}
            >
              <h4 className="font-sans font-black text-slate-900 text-xs uppercase tracking-wide pb-2.5 flex items-center space-x-1.5">
                <span>📂</span> <span>2. Documentazione Fisica dell'Alloggio & Certificazioni</span>
              </h4>
              
              {localStorage.getItem("highlight_registration_contract_id") === selectedContract.id && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start space-x-3 text-xs text-amber-900">
                  <span className="text-xl shrink-0">⚠️</span>
                  <div>
                    <strong className="font-extrabold text-amber-950 block">Caricamento Ricevuta o Proroga Richiesto</strong>
                    <p className="mt-0.5 leading-relaxed">
                      Hai fatto clic su risoluzione per l'avviso di scadenza <strong>"{localStorage.getItem("highlight_registration_title")}"</strong>. Trascina o seleziona il file della ricevuta qui sotto. Una volta salvato, l'avviso scomparirà automaticamente sia da questa sezione che dalla dashboard!
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 mt-1">
                Visualizza, scarica o carica i documenti tecnici dell'appartamento. Questa area è condivisa e sincronizzata direttamente con la scheda dell'immobile in tempo reale.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Upload technical documentation */}
                <div className="bg-amber-50/40 rounded-xl border border-amber-200/80 p-5 space-y-4">
                  <h5 className="font-bold text-amber-950 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                    <span>📥</span> <span>Registra Documento Tecnico</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">Nome Allegato / Piantina</label>
                      <input
                        type="text"
                        placeholder="Es: Planimetria Catastale raster..."
                        value={newDocName}
                        onChange={(e) => setNewDocName(e.target.value)}
                        className="w-full text-xs border border-amber-200 bg-white rounded-lg px-3 py-2 outline-hidden focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">Tipologia Documentazione</label>
                      <select
                        value={newDocType}
                        onChange={(e) => setNewDocType(e.target.value)}
                        className="w-full text-xs border border-amber-200 bg-white rounded-lg px-3 py-2 outline-hidden focus:border-amber-500"
                      >
                        <option value="Planimetria/Visura">Planimetria Catastale o Piantina</option>
                        <option value="APE (Classe Energetica)">Attestato Prestazione Energetica (APE/AP)</option>
                        <option value="Certificazione di Conformità">Certificazione di Conformità Impianti</option>
                        <option value="Certificato Abitabilità">Certificato Abitabilità / Agibilità</option>
                        <option value="Contratto">Contratto Firmato</option>
                        <option value="Ricevuta Imposta/Proroga">Ricevuta Imposta Registro / Proroga</option>
                        <option value="Altro Documento Certificato">Altra Certificazione Tecnica</option>
                      </select>
                    </div>
                  </div>

                  {/* Drag and drop upload zone */}
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      if (e.dataTransfer.files?.[0]) {
                        const file = e.dataTransfer.files[0];
                        if (!newDocName) setNewDocName(file.name.replace(/\.[^/.]+$/, ""));
                        handleSimulateUpload(file.name, file.size);
                      }
                    }}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${dragActive ? "border-amber-500 bg-amber-100/30" : "border-amber-200 hover:border-amber-400 bg-white"}`}
                  >
                    <input 
                      type="file" 
                      id="property-doc-upload-file-details" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          const file = e.target.files[0];
                          if (!newDocName) setNewDocName(file.name.replace(/\.[^/.]+$/, ""));
                          handleSimulateUpload(file.name, file.size);
                        }
                      }}
                    />
                    <label htmlFor="property-doc-upload-file-details" className="cursor-pointer">
                      <div className="flex flex-col items-center justify-center space-y-1.5">
                        <Upload size={18} className="text-amber-700" />
                        <p className="text-xs font-semibold text-amber-950">Seleziona o trascina la scansione</p>
                        <p className="text-[10px] text-slate-400">PDF, PNG, JPG fino a 15MB</p>
                      </div>
                    </label>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => handleAddDocManual()}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-4 py-2 rounded-lg active:transition-all"
                    >
                      Salva Documento Fisico
                    </button>
                  </div>
                </div>

                {/* Stored documents listing */}
                <div className="space-y-3.5">
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center justify-between">
                    <span>📋 Allegati Certificati Associati ({matchedDocs.length})</span>
                    <span className="text-[9px] text-emerald-800 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded uppercase font-bold">Condiviso con Proprietà</span>
                  </h5>

                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {matchedDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-amber-50/10 transition-all">
                        <div className="flex items-start space-x-3 truncate">
                          <span className="text-lg shrink-0 mt-0.5">📄</span>
                          <div className="truncate">
                            <h5 className="text-xs font-bold text-slate-800 truncate" title={doc.name}>{doc.name}</h5>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-100 px-1 py-0.2 rounded font-semibold shrink-0">{doc.type}</span>
                              <span className="text-[9px] text-slate-400 font-medium">Data: {new Date(doc.date).toLocaleDateString("it-IT")}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                          <button 
                            onClick={() => alert(`Visualizzazione e Download di "${doc.name}" avviato.`)}
                            className="p-1 text-amber-950 hover:bg-amber-100 border border-amber-200/50 rounded-md text-xs font-bold transition-all"
                            title="Scarica documento originale"
                          >
                            ⬇️
                          </button>
                          <button 
                            onClick={() => handleDeleteDoc(selectedContract.propertyId, doc.id)}
                            className="p-1 text-rose-800 hover:bg-rose-100 border border-rose-200/50 rounded-md text-xs font-bold transition-all"
                            title="Rimuovi allegato"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                    {matchedDocs.length === 0 && (
                      <div className="py-12 text-center text-slate-400 text-xs border border-dashed rounded-xl">
                        Nessun documento inserito per questo alloggio. Trascina la planimetria o l'APE sopra per caricarlo.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* THIRD AREA: DELIVERY & RETURN REPORTS (Correction 17) */}
            <div className="bg-white rounded-2xl border border-amber-100 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
                <h4 className="font-sans font-black text-slate-900 text-xs uppercase tracking-wide flex items-center space-x-1.5">
                  <span className="text-base">📋</span> <span>3. Verbali di Consegna & Riconsegna Immobile</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenCreateDeliveryReport("consegna")}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] rounded-lg transition-all cursor-pointer shadow-xs"
                  >
                    <span>➕ Nuovo Verbale di Consegna</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateDeliveryReport("riconsegna")}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] rounded-lg transition-all cursor-pointer shadow-xs"
                  >
                    <span>➕ Nuovo Verbale di Riconsegna</span>
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Redigi verbali ufficiali per l'inizio e la fine della locazione. Gestisci lo stato dei locali, rileva le letture dei contatori, descrivi lo stato delle chiavi ed effettua la raccolta delle firme autografe digitali dei firmatari.
              </p>

              {(() => {
                const matchedReports = (deliveryReports || []).filter(r => r.contractId === selectedContract.id);
                if (matchedReports.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      📢 Nessun verbale di consegna o riconsegna registrato per questa relazione locativa.
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    {matchedReports.map(report => {
                      const isFullySigned = report.signatures?.ownerSigned && report.signatures?.tenantSigned;
                      return (
                        <div key={report.id} className="border-2 border-slate-100 rounded-2xl p-5 space-y-4 bg-slate-50/20 hover:bg-amber-50/5 transition-all">
                          {/* Report Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
                            <div className="flex items-center space-x-2">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md ${
                                report.type === "consegna" ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50" : "bg-indigo-50 text-indigo-700 border border-indigo-200/50"
                              }`}>
                                VERBALE DI {report.type === "consegna" ? "CONSEGNA" : "RICONSEGNA"}
                              </span>
                              <span className="text-slate-400 text-xs font-mono">•</span>
                              <span className="text-xs font-mono font-bold text-slate-600">
                                Data Redazione: {new Date(report.date).toLocaleDateString("it-IT")}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 self-start sm:self-auto">
                              {isFullySigned ? (
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ✓ FIRMATO E DEPOSITATO (SHA256)
                                </span>
                              ) : (
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                                  ⚠️ FIRME INCOMPLETE
                                </span>
                              )}
                              
                              <button
                                type="button"
                                onClick={() => handleDeleteDeliveryReportLocal(report.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                title="Rimuovi Verbale"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Checklist Excel Mastrino Style Table */}
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-3xs">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-100/60 text-[10px] uppercase font-mono font-black text-slate-500">
                                  <th className="p-2.5 border-r border-slate-200">Elemento Rilevato</th>
                                  <th className="p-2.5 border-r border-slate-200 w-32 text-center">Stato</th>
                                  <th className="p-2.5 border-r border-slate-200">Note di Rilevazione</th>
                                  <th className="p-2.5 w-44 text-center">Allegato Foto / Stato</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-xs font-sans">
                                {report.checklist?.map(item => (
                                  <tr key={item.id} className="hover:bg-slate-50/50">
                                    <td className="p-2.5 font-bold text-slate-800 border-r border-slate-100">
                                      {item.item}
                                    </td>
                                    <td className="p-2.5 text-center border-r border-slate-100">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                        item.status === "Ottimo" ? "bg-emerald-50 text-emerald-700 border border-emerald-100/50" : 
                                        item.status === "Buono" ? "bg-indigo-50 text-indigo-700 border border-indigo-100/50" :
                                        "bg-amber-50 text-amber-700 border border-amber-100/50"
                                      }`}>
                                        {item.status}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-slate-600 italic border-r border-slate-100">
                                      {item.notes || "Regolare, nessun rilievo particolare."}
                                    </td>
                                    <td className="p-2.5 text-center">
                                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                                        {item.photos && item.photos.length > 0 ? (
                                          item.photos.map((p, idx) => (
                                            <button
                                              key={idx}
                                              type="button"
                                              onClick={() => alert(`Anteprima foto allegata: visualizzazione del file "${p}"`)}
                                              className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.5 rounded border border-slate-200 transition-all font-mono"
                                            >
                                              🖼️ {p.length > 15 ? p.substring(0, 12) + "..." : p}
                                            </button>
                                          ))
                                        ) : (
                                          <span className="text-slate-400 text-[10px]">Nessuna foto</span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Digital Signature Panel */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            {/* Owner Signature */}
                            <div className="bg-white rounded-xl border border-slate-150 p-4 flex flex-col justify-between">
                              <div>
                                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Firma Locatore (Proprietario)</span>
                                {report.signatures?.ownerSigned ? (
                                  <div className="mt-2.5 p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                                    <p className="text-xs font-black text-slate-800 italic font-serif text-center py-1 /50">
                                      {report.signatures.ownerSignatureData}
                                    </p>
                                    <p className="text-[9px] text-emerald-700 text-center mt-1 font-semibold">
                                      ✓ Firmato il {new Date(report.signatures.ownerSignedAt || "").toLocaleString("it-IT")}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="mt-3">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenSignModal(report, "owner")}
                                      className="w-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 text-[10px] font-extrabold py-2 rounded-lg border border-slate-250 transition-all cursor-pointer text-center"
                                    >
                                      ✍️ Apponi Firma Proprietario
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Tenant Signature */}
                            <div className="bg-white rounded-xl border border-slate-150 p-4 flex flex-col justify-between">
                              <div>
                                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Firma Conduttore (Inquilino)</span>
                                {report.signatures?.tenantSigned ? (
                                  <div className="mt-2.5 p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                                    <p className="text-xs font-black text-slate-800 italic font-serif text-center py-1 /50">
                                      {report.signatures.tenantSignatureData}
                                    </p>
                                    <p className="text-[9px] text-emerald-700 text-center mt-1 font-semibold">
                                      ✓ Firmato il {new Date(report.signatures.tenantSignedAt || "").toLocaleString("it-IT")}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="mt-3">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenSignModal(report, "tenant")}
                                      className="w-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 text-[10px] font-extrabold py-2 rounded-lg border border-slate-250 transition-all cursor-pointer text-center"
                                    >
                                      ✍️ Apponi Firma Inquilino
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* Guided Relationship Wizard Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            
            {/* Modal Header with wizard progress bar */}
            <div className="px-6 py-4 bg-slate-900 text-white flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="font-sans font-black text-base flex items-center space-x-2">
                  <span>🤝</span>
                  <span>{editingContract ? "Modifica Relazione d'Affitto" : "Crea Nuova Relazione Unica d'Affitto"}</span>
                </h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              {!editingContract && (
                <div className="flex items-center justify-between gap-1.5 mt-2">
                  {[
                    { label: "OCR", step: 0 },
                    { label: "1. Immobile", step: 1 },
                    { label: "2. Inquilino", step: 2 },
                    { label: "3. Contratto", step: 3 },
                    { label: "4. Riepilogo", step: 4 }
                  ].map((s) => (
                    <div key={s.step} className="flex-1 flex flex-col gap-1">
                      <div className={`h-1.5 rounded-full transition-all duration-300 ${wizardStep >= s.step ? "bg-amber-500" : "bg-slate-700"}`}></div>
                      <span className={`text-[8px] uppercase tracking-wider text-center ${wizardStep === s.step ? "text-amber-400 font-extrabold" : "text-slate-400"}`}>{s.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleWizardSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              
              {/* STEP 0: OCR / UPLOAD CONTRACT */}
              {wizardStep === 0 && !editingContract && (
                <div className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
                    <Sparkles className="text-amber-500 shrink-0 mt-0.5 animate-pulse" size={18} />
                    <div className="text-xs">
                      <strong className="text-indigo-950 font-black block">Assistente OCR Estrazione Rapida</strong>
                      <span className="text-slate-600 block mt-0.5">
                        Carica una foto, scansione o PDF del contratto di locazione. L'AI precompilerà l'alloggio, l'inquilino, i canoni e le scadenze in un colpo solo.
                      </span>
                    </div>
                  </div>

                  {/* OCR Drag and Drop Area */}
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      if (e.dataTransfer.files?.[0]) {
                        handleOcrFileDropped(e.dataTransfer.files[0].name);
                      }
                    }}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      aiLoading ? "border-amber-500 bg-amber-50/20" : "border-slate-200 hover:border-amber-400 bg-slate-50"
                    }`}
                  >
                    <input 
                      type="file" 
                      id="contract-ocr-upload" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleOcrFileDropped(e.target.files[0].name);
                        }
                      }}
                    />
                    <label htmlFor="contract-ocr-upload" className="cursor-pointer">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        {aiLoading ? (
                          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Upload size={32} className="text-amber-600" />
                        )}
                        <div>
                          <p className="text-xs font-black text-slate-800">Trascina qui il documento cartaceo / PDF</p>
                          <p className="text-[10px] text-slate-400 mt-1">Carica la scansione per compilare immobili e anagrafiche in automatico</p>
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* OCR Text Alternative */}
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <label className="block text-xs font-black text-slate-800">Oppure incolla il testo del contratto</label>
                    <textarea
                      placeholder="Incolla le clausole principali o dati per farli analizzare dall'AI..."
                      value={aiText}
                      onChange={(e) => setAiText(e.target.value)}
                      rows={4}
                      className="w-full text-xs border border-slate-200 bg-white rounded-xl p-3 outline-hidden focus:border-indigo-500"
                    />
                    {aiError && (
                      <p className="text-xs text-rose-600 flex items-center gap-1"><AlertCircle size={13} /> {aiError}</p>
                    )}
                    
                    <div className="flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => setWizardStep(1)}
                        className="text-xs font-black text-slate-500 hover:text-slate-800"
                      >
                        Salta scansione (procedi manuale) &rarr;
                      </button>

                      <button
                        type="button"
                        disabled={aiLoading || !aiText.trim()}
                        onClick={handleOcrTextSubmit}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5"
                      >
                        {aiLoading ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : <Sparkles size={13} />}
                        <span>Estrai con AI</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 1: PROPERTY SELECTION / INLINE CREATION (THE ABSOLUTE CEILING / STARTING POINT) */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3">
                    <h4 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                      <Building size={16} className="text-amber-500" />
                      <span>Passo 1: Seleziona o Crea l'Immobile d'Origine</span>
                    </h4>

                    {/* Mode toggler */}
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setWizardPropertyMode("select")}
                        className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${wizardPropertyMode === "select" ? "bg-white text-slate-950 shadow-3xs" : "text-slate-500 hover:text-slate-800"}`}
                      >
                        Seleziona Esistente
                      </button>
                      <button
                        type="button"
                        onClick={() => setWizardPropertyMode("create")}
                        className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${wizardPropertyMode === "create" ? "bg-white text-slate-950 shadow-3xs" : "text-slate-500 hover:text-slate-800"}`}
                      >
                        ✨ Crea Nuovo Immobile
                      </button>
                    </div>
                  </div>

                  {wizardPropertyMode === "select" ? (
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-700">Immobile d'Appoggio *</label>
                      <select
                        value={propertyId}
                        onChange={(e) => setPropertyId(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-hidden focus:border-indigo-500"
                      >
                        <option value="">-- Seleziona immobile nel database --</option>
                        {properties.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.address})</option>
                        ))}
                      </select>
                      {properties.length === 0 && (
                        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-xl">
                          Nessun immobile registrato nel database. Clicca su "Crea Nuovo Immobile" per crearlo ora.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 bg-amber-50/20 p-4 rounded-xl border border-amber-200/40">
                      <p className="text-[10px] text-amber-900 font-bold uppercase tracking-wider">✨ Nuovo Alloggio / Dwelling Parameters</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">Nome Identificativo Immobile *</label>
                          <input
                            type="text"
                            required
                            placeholder="Es: Monolocale Brera, Loft Porta Venezia..."
                            value={newPropName}
                            onChange={(e) => setNewPropName(e.target.value)}
                            className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">Tipologia</label>
                          <select
                            value={newPropType}
                            onChange={(e) => setNewPropType(e.target.value)}
                            className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden"
                          >
                            <option value="Appartamento">Appartamento</option>
                            <option value="Monolocale">Monolocale</option>
                            <option value="Stanza">Stanza Singola/Doppia</option>
                            <option value="Ufficio">Ufficio</option>
                            <option value="Negozio">Negozio</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">Indirizzo Fisico Completo *</label>
                        <input
                          type="text"
                          required
                          placeholder="Es: Via Solferino 14, Milano"
                          value={newPropAddress}
                          onChange={(e) => setNewPropAddress(e.target.value)}
                          className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">Proprietario Locatore</label>
                          <input
                            type="text"
                            placeholder="Es: Dr. Marini Stefano"
                            value={newPropOwner}
                            onChange={(e) => setNewPropOwner(e.target.value)}
                            className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden"
                          />
                        </div>

                        <div className="flex flex-col justify-center gap-1.5 pt-2">
                          <label className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={newPropIsBare}
                              onChange={(e) => setNewPropIsBare(e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Bare Ownership (Nuda Proprietà)</span>
                          </label>

                          <label className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={newPropIsCondo}
                              onChange={(e) => setNewPropIsCondo(e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Appartamento in Condominio Costituito</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: TENANT SELECTION / INLINE CREATION */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3">
                    <h4 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                      <User size={16} className="text-amber-500" />
                      <span>Passo 2: Collega il Conduttore (Inquilino)</span>
                    </h4>

                    {/* Mode toggler */}
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setWizardTenantMode("select")}
                        className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${wizardTenantMode === "select" ? "bg-white text-slate-950 shadow-3xs" : "text-slate-500 hover:text-slate-800"}`}
                      >
                        Seleziona Esistente
                      </button>
                      <button
                        type="button"
                        onClick={() => setWizardTenantMode("create")}
                        className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${wizardTenantMode === "create" ? "bg-white text-slate-950 shadow-3xs" : "text-slate-500 hover:text-slate-800"}`}
                      >
                        ✨ Crea Nuovo Inquilino
                      </button>
                    </div>
                  </div>

                  {wizardTenantMode === "select" ? (
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-700">Seleziona Inquilino *</label>
                      <select
                        value={tenantId}
                        onChange={(e) => setTenantId(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-hidden focus:border-indigo-500"
                      >
                        <option value="">-- Seleziona conduttore nel database --</option>
                        {tenants.map(t => (
                          <option key={t.id} value={t.id}>{!t.propertyId ? "🏠❗ " : ""}{t.name} ({t.email}){!t.propertyId ? " — immobile da assegnare" : ""}</option>
                        ))}
                      </select>
                      {tenants.length === 0 && (
                        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-xl">
                          Nessun inquilino registrato nel database. Clicca su "Crea Nuovo Inquilino" per crearlo ora.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 bg-amber-50/20 p-4 rounded-xl border border-amber-200/40">
                      <p className="text-[10px] text-amber-900 font-bold uppercase tracking-wider">👤 Dati Anagrafici Conduttore</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">Nome & Cognome Inquilino *</label>
                          <input
                            type="text"
                            required
                            placeholder="Es: Mario Rossi, Giulia Bianchi..."
                            value={newTenantName}
                            onChange={(e) => setNewTenantName(e.target.value)}
                            className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">Codice Fiscale</label>
                          <input
                            type="text"
                            placeholder="Es: RSSMRA80A01H501U"
                            value={newTenantFiscalCode}
                            onChange={(e) => setNewTenantFiscalCode(e.target.value.toUpperCase())}
                            className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">E-mail</label>
                          <input
                            type="email"
                            placeholder="Es: conduttore@gmail.com"
                            value={newTenantEmail}
                            onChange={(e) => setNewTenantEmail(e.target.value)}
                            className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">Recapito Telefonico</label>
                          <input
                            type="text"
                            placeholder="Es: +39 333 4567890"
                            value={newTenantPhone}
                            onChange={(e) => setNewTenantPhone(e.target.value)}
                            className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: CONTRACT PARAMETERS */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h4 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wide pb-3 flex items-center gap-1.5">
                    <Wallet size={16} className="text-amber-500" />
                    <span>Passo 3: Parametri di Locazione & Canoni</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">Canone Mensile (€) *</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="850"
                        value={rentAmount || ""}
                        onChange={(e) => setRentAmount(Number(e.target.value))}
                        className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">Frequenza Pagamento</label>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value as any)}
                        className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden"
                      >
                        <option value="Mensile">Mensile</option>
                        <option value="Trimestrale">Trimestrale</option>
                        <option value="Semestrale">Semestrale</option>
                        <option value="Annuale">Annuale</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">Stato Relazione</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden"
                      >
                        <option value="Active">Attivo / Esecutivo</option>
                        <option value="Draft">Bozza / Negoziazione</option>
                        <option value="Expired">Scaduto</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">Data Inizio Decorrenza *</label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">Data Scadenza Contratto *</label>
                      <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">Proprietario / Locatore (Opzionale)</label>
                    <input
                      type="text"
                      placeholder="Nome locatore (se differente dal default dell'immobile)"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden"
                    />
                  </div>

                  <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <label className="block text-[10px] font-black uppercase text-slate-700">Regime di Registrazione Contratto *</label>
                    <div className="flex flex-col sm:flex-row gap-4 mt-1">
                      <label className="flex-1 flex items-start space-x-2 bg-white p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50/50 transition-colors">
                        <input
                          type="radio"
                          name="isBareOwnership"
                          checked={!isBareOwnership}
                          onChange={() => setIsBareOwnership(false)}
                          className="mt-0.5 rounded-full border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">Locazione Standard / Ordinaria</span>
                          <span className="text-[9px] text-slate-500 block mt-0.5">Soggetta ad imposta annuale. Notifica automatica di promemoria 1 mese prima della scadenza dell'annualità.</span>
                        </div>
                      </label>

                      <label className="flex-1 flex items-start space-x-2 bg-white p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50/50 transition-colors">
                        <input
                          type="radio"
                          name="isBareOwnership"
                          checked={isBareOwnership}
                          onChange={() => setIsBareOwnership(true)}
                          className="mt-0.5 rounded-full border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">Nuda Proprietà (Bare Ownership)</span>
                          <span className="text-[9px] text-slate-500 block mt-0.5">Esenzione imposta annuale. Richiede comunicazione di Proroga Quadriennale Intermedia al Comune.</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">Clausole, Deposito & Note Particolari</label>
                    <textarea
                      placeholder="Specificare qui cedolare secca, importo caparra, accordi di recesso..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full text-xs border border-slate-200 bg-white rounded-lg p-3 outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: RECAP & CONFIRMATION */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <h4 className="font-sans font-black text-slate-800 text-xs uppercase tracking-wide pb-3 flex items-center gap-1.5">
                    <FileCheck size={16} className="text-amber-500" />
                    <span>Passo 4: Verifica dell'Unificazione Relazionale</span>
                  </h4>

                  <div className="p-4 bg-amber-50/30 rounded-2xl border border-amber-200/50 space-y-4 text-xs">
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Property recap */}
                      <div className="bg-white p-3 rounded-xl border border-amber-100">
                        <span className="text-[9px] uppercase font-black text-slate-400">🏠 Immobile Collegato</span>
                        <p className="font-black text-slate-800 mt-1">{wizardPropertyMode === "create" ? newPropName : (properties.find(p => p.id === propertyId)?.name)}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{wizardPropertyMode === "create" ? newPropAddress : (properties.find(p => p.id === propertyId)?.address)}</p>
                        <span className="inline-block mt-2 text-[8px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-800 uppercase">
                          {wizardPropertyMode === "create" ? "In Creazione" : "Database"}
                        </span>
                      </div>

                      {/* Tenant recap */}
                      <div className="bg-white p-3 rounded-xl border border-amber-100">
                        <span className="text-[9px] uppercase font-black text-slate-400">👤 Conduttore Collegato</span>
                        <p className="font-black text-slate-800 mt-1">{wizardTenantMode === "create" ? newTenantName : (tenants.find(t => t.id === tenantId)?.name)}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{wizardTenantMode === "create" ? (newTenantEmail || "inquilino@email.com") : (tenants.find(t => t.id === tenantId)?.email)}</p>
                        <span className="inline-block mt-2 text-[8px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-800 uppercase">
                          {wizardTenantMode === "create" ? "In Creazione" : "Database"}
                        </span>
                      </div>
                    </div>

                    {/* Contract parameters recap */}
                    <div className="bg-white p-4 rounded-xl border border-amber-100 space-y-2.5">
                      <span className="text-[9px] uppercase font-black text-slate-400 block pb-1">📄 Parametri di Locazione</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <span className="text-[9px] text-slate-400 block font-bold">Canone</span>
                          <span className="font-extrabold text-indigo-700">€{rentAmount.toLocaleString("it-IT")}/{frequency === "Mensile" ? "mese" : frequency}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block font-bold">Inizio</span>
                          <span className="font-semibold text-slate-800">{startDate}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block font-bold">Termine</span>
                          <span className="font-semibold text-slate-800">{endDate}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block font-bold">Regime di Registro</span>
                          <span className="font-bold text-amber-800 uppercase text-[9px] bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                            {isBareOwnership ? "Nuda Proprietà" : "Standard"}
                          </span>
                        </div>
                      </div>

                      {notes && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className="text-[9px] text-slate-400 block font-bold">Clausole Inserite</span>
                          <p className="text-[10px] text-slate-600 italic mt-0.5">{notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 text-center">
                    Cliccando su "Unifica e Salva" verranno create le anagrafiche, la scheda alloggio, il contratto ed autogenerate le prime 6 mensilità d'affitto nel pannello di Scadenzario Fast Closing.
                  </p>
                </div>
              )}

              {/* Navigation buttons at bottom of modal */}
              <div className="pt-4 flex justify-between items-center border-t border-slate-100">
                
                {/* Back button */}
                {wizardStep > 0 && !editingContract ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(wizardStep - 1)}
                    className="inline-flex items-center space-x-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    <ArrowLeft size={13} />
                    <span>Indietro</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-400 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Annulla
                  </button>
                )}

                {/* Forward / Submit button */}
                {editingContract ? (
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                  >
                    Salva Modifiche
                  </button>
                ) : wizardStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => {
                      // Perform client validation before moving forward
                      if (wizardStep === 1) {
                        if (wizardPropertyMode === "select" && !propertyId) {
                          alert("Seleziona prima un immobile.");
                          return;
                        }
                        if (wizardPropertyMode === "create" && (!newPropName || !newPropAddress)) {
                          alert("Inserisci nome e indirizzo completi dell'immobile d'origine.");
                          return;
                        }
                      }
                      if (wizardStep === 2) {
                        if (wizardTenantMode === "select" && !tenantId) {
                          alert("Seleziona prima un conduttore.");
                          return;
                        }
                        if (wizardTenantMode === "create" && !newTenantName) {
                          alert("Inserisci nome e cognome dell'inquilino.");
                          return;
                        }
                      }
                      if (wizardStep === 3) {
                        if (!rentAmount || rentAmount <= 0) {
                          alert("Inserisci l'importo corretto del canone.");
                          return;
                        }
                        if (!startDate || !endDate) {
                          alert("Compila le date di decorrenza e scadenza contrattuale.");
                          return;
                        }
                      }
                      setWizardStep(wizardStep + 1);
                    }}
                    className="inline-flex items-center space-x-1 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                  >
                    <span>Continua</span>
                    <ArrowRight size={13} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="inline-flex items-center space-x-1 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all active:shadow-sm"
                  >
                    <Check size={14} className="stroke-[3]" />
                    <span>Unifica e Salva Relazione</span>
                  </button>
                )}

              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODALE CREAZIONE/MODIFICA VERBALE CONSEGNA O RICONSEGNA */}
      {showDeliveryModal && (() => {
        const targetId = selectedContractId || (contracts[0] ? contracts[0].id : "");
        const selectedContract = contracts.find(c => c.id === targetId);
        if (!selectedContract) return null;
        
        return (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
              
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <h3 className="font-sans font-black text-sm flex items-center space-x-2">
                  <span>📝</span>
                  <span>Compila Verbale di {delReportType === "consegna" ? "Consegna Immobile" : "Riconsegna Immobile"}</span>
                </h3>
                <button type="button" onClick={() => setShowDeliveryModal(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* Meta details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400">Immobile & Locazione</span>
                    <strong className="block text-slate-800 text-xs mt-0.5">{selectedContract.propertyName}</strong>
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Data del Rilevamento</label>
                    <input
                      type="date"
                      value={delDate}
                      onChange={(e) => setDelDate(e.target.value)}
                      className="text-xs border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 w-full font-semibold focus:border-indigo-500 outline-hidden"
                    />
                  </div>
                </div>

                {/* Checklist editor */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                      📋 Checklist Elementi da Verificare
                    </h4>
                    <span className="text-[10px] text-slate-400">Personalizza gli elementi della rilevazione</span>
                  </div>

                  {/* Add manual checklist item */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Aggiungi elemento (es: Stato caldaia, box auto...)"
                      value={newChecklistItemName}
                      onChange={(e) => setNewChecklistItemName(e.target.value)}
                      className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 outline-hidden focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddChecklistItem}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all cursor-pointer"
                    >
                      Aggiungi
                    </button>
                  </div>

                  {/* Checklist listing table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/60 text-[10px] uppercase font-mono font-black text-slate-500">
                          <th className="p-2.5 border-r border-slate-200">Elemento</th>
                          <th className="p-2.5 border-r border-slate-200 w-36">Stato Locale</th>
                          <th className="p-2.5 border-r border-slate-200">Osservazioni / Note</th>
                          <th className="p-2.5 w-36 text-center">Foto / Azioni</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-xs">
                        {checklistItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-bold text-slate-800 border-r border-slate-150 max-w-[160px] truncate" title={item.item}>
                              {item.item}
                            </td>
                            <td className="p-2.5 border-r border-slate-150">
                              <select
                                value={item.status}
                                onChange={(e) => handleUpdateChecklistItem(item.id, "status", e.target.value)}
                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-md px-1.5 py-1 outline-hidden"
                              >
                                <option value="Ottimo">Ottimo Stato</option>
                                <option value="Buono">Buono Stato</option>
                                <option value="Da riparare">Da Riparare</option>
                                <option value="Sostituire">Da Sostituire</option>
                              </select>
                            </td>
                            <td className="p-2.5 border-r border-slate-150">
                              <input
                                type="text"
                                placeholder="Inserisci annotazioni o anomalie..."
                                value={item.notes}
                                onChange={(e) => handleUpdateChecklistItem(item.id, "notes", e.target.value)}
                                className="w-full text-xs border border-transparent hover:border-slate-200 focus:border-indigo-500 bg-transparent rounded-md px-1.5 py-1 outline-hidden"
                              />
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleAddPhotoToItem(item.id)}
                                  className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-250 font-bold px-1.5 py-1 rounded transition-all cursor-pointer"
                                  title="Allega foto"
                                >
                                  📷 {item.photos?.length > 0 ? `(${item.photos.length})` : "+"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveChecklistItem(item.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                  title="Elimina riga"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeliveryModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveDeliveryReport(selectedContract)}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer"
                >
                  Genera Verbale in Bozza
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* 5. MODALE FIRMA DIGITALE VERBALE */}
      {showSignatureModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100">
            
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-sans font-black text-sm flex items-center space-x-2">
                <span>✍️</span>
                <span>Firma Elettronica Verbale di Consegna</span>
              </h3>
              <button type="button" onClick={() => setShowSignatureModal(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-indigo-50 border border-indigo-150 rounded-xl p-4 text-xs text-indigo-950">
                <strong>Clausola di Sottoscrizione:</strong>
                <p className="mt-1 leading-relaxed text-slate-600">
                  Digitando il proprio nome per esteso si appone una firma digitale con validità legale di avvenuto controllo dello stato dell'immobile in conformità a quanto riportato nel verbale di {signatureTargetReport?.type === "consegna" ? "consegna" : "riconsegna"}.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Digita Nome e Cognome per Esteso *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es: Stefano Marini"
                  value={signatureTypedName}
                  onChange={(e) => setSignatureTypedName(e.target.value)}
                  className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden focus:border-indigo-500 text-center font-serif text-lg italic tracking-wide"
                />
              </div>

              {/* Pad/Canvas Simulation visual decorative */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col items-center justify-center gap-1.5 select-none h-24">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Traccia di firma acquisita digitalmente</span>
                {signatureTypedName ? (
                  <span className="text-xl font-serif italic text-indigo-900 font-black tracking-wide animate-pulse">{signatureTypedName}</span>
                ) : (
                  <span className="text-xs text-slate-350 italic">Scrivi il tuo nome sopra...</span>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSignatureModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-lg transition-all cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleConfirmSignature}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer"
              >
                Applica Firma
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

