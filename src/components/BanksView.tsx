import React, { useState } from "react";
import { 
  Plus, 
  Landmark, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CheckCircle2, 
  Sparkles, 
  X, 
  FileSpreadsheet, 
  Trash2,
  ArrowLeft,
  CreditCard,
  Check,
  Upload,
  Camera,
  FileText,
  AlertCircle,
  Image as ImageIcon
} from "lucide-react";
import { BankMovement, FastClosingItem, CreditInstitution, BankAccount } from "../types";

interface BanksViewProps {
  movements: BankMovement[];
  fastClosing: FastClosingItem[];
  creditInstitutions?: CreditInstitution[];
  bankAccounts?: BankAccount[];
  onAddMovement: (movement: Omit<BankMovement, "id" | "userId" | "createdAt">) => Promise<void>;
  onReconcileMovement: (movementId: string, closingItemId: string) => Promise<void>;
  onDeleteMovement: (id: string) => Promise<void>;
  onAddCreditInstitution?: (data: Omit<CreditInstitution, "id" | "userId" | "createdAt">) => Promise<void>;
  onAddBankAccount?: (data: Omit<BankAccount, "id" | "userId" | "createdAt">) => Promise<void>;
}

export default function BanksView({
  movements,
  fastClosing,
  creditInstitutions = [],
  bankAccounts = [],
  onAddMovement,
  onReconcileMovement,
  onDeleteMovement,
  onAddCreditInstitution,
  onAddBankAccount
}: BanksViewProps) {
  // Navigation Drill-down States
  const [selectedInstId, setSelectedInstId] = useState<string | null>(null);
  const [selectedAccId, setSelectedAccId] = useState<string | null>(null);

  // Modals States
  const [showInstModal, setShowInstModal] = useState(false);
  const [showAccModal, setShowAccModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<BankMovement | null>(null);

  // Institution Form Fields
  const [instName, setInstName] = useState("");
  const [instBranch, setInstBranch] = useState("");
  const [instNotes, setInstNotes] = useState("");

  // Bank Account Form Fields
  const [accIban, setAccIban] = useState("");
  const [accHolder, setAccHolder] = useState("");
  const [accCurrency, setAccCurrency] = useState("EUR");
  const [accIsActive, setAccIsActive] = useState(true);

  // Import fields
  const [pasteText, setPasteText] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [extractedMovements, setExtractedMovements] = useState<Omit<BankMovement, "id" | "userId" | "reconciled" | "createdAt">[]>([]);

  // Manual transaction fields
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);

  // Reconcile manual selection
  const [selectedClosingItemId, setSelectedClosingItemId] = useState("");

  // Accounts OCR states
  const [accountImages, setAccountImages] = useState<string[]>([]);
  const [accountOcrLoading, setAccountOcrLoading] = useState(false);
  const [accountOcrError, setAccountOcrError] = useState("");
  const [accountOcrSuccess, setAccountOcrSuccess] = useState(false);
  const [accCameraActive, setAccCameraActive] = useState(false);
  const accVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const accStreamRef = React.useRef<MediaStream | null>(null);

  // Statement Import PDF/Photo OCR states
  const [statementImages, setStatementImages] = useState<string[]>([]);
  const [stmtCameraActive, setStmtCameraActive] = useState(false);
  const stmtVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const stmtStreamRef = React.useRef<MediaStream | null>(null);

  // Clean up cameras on unmount
  React.useEffect(() => {
    return () => {
      if (accStreamRef.current) {
        accStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (stmtStreamRef.current) {
        stmtStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Account OCR handlers
  const startAccCamera = async () => {
    setAccountOcrError("");
    setAccountOcrSuccess(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      accStreamRef.current = stream;
      if (accVideoRef.current) {
        accVideoRef.current.srcObject = stream;
        accVideoRef.current.play();
      }
      setAccCameraActive(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setAccountOcrError("Impossibile avviare la webcam: " + err.message);
    }
  };

  const stopAccCamera = () => {
    if (accStreamRef.current) {
      accStreamRef.current.getTracks().forEach(track => track.stop());
      accStreamRef.current = null;
    }
    if (accVideoRef.current) {
      accVideoRef.current.srcObject = null;
    }
    setAccCameraActive(false);
  };

  const captureAccPhoto = () => {
    if (accVideoRef.current) {
      try {
        const video = accVideoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setAccountImages(prev => [...prev, dataUrl]);
          stopAccCamera();
        }
      } catch (err: any) {
        setAccountOcrError("Errore durante la cattura della foto: " + err.message);
      }
    }
  };

  const handleAccFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: any) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAccountImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeAccImage = (index: number) => {
    setAccountImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleExtractAccountWithAi = async () => {
    if (accountImages.length === 0) {
      setAccountOcrError("Carica o scatta almeno una foto o allega un file PDF.");
      return;
    }
    setAccountOcrLoading(true);
    setAccountOcrError("");
    setAccountOcrSuccess(false);
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: accountImages,
          context: "bank_account"
        })
      });
      const result = await response.json();
      if (result.success && result.data) {
        if (result.data.iban) {
          setAccIban(result.data.iban);
        }
        if (result.data.holder) {
          setAccHolder(result.data.holder);
        }
        setAccountOcrSuccess(true);
      } else {
        setAccountOcrError(result.error || "Impossibile estrarre i dati del conto.");
      }
    } catch (err: any) {
      setAccountOcrError("Errore durante l'elaborazione AI: " + err.message);
    } finally {
      setAccountOcrLoading(false);
    }
  };

  // Statement OCR handlers
  const startStmtCamera = async () => {
    setImportError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      stmtStreamRef.current = stream;
      if (stmtVideoRef.current) {
        stmtVideoRef.current.srcObject = stream;
        stmtVideoRef.current.play();
      }
      setStmtCameraActive(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setImportError("Impossibile avviare la webcam: " + err.message);
    }
  };

  const stopStmtCamera = () => {
    if (stmtStreamRef.current) {
      stmtStreamRef.current.getTracks().forEach(track => track.stop());
      stmtStreamRef.current = null;
    }
    if (stmtVideoRef.current) {
      stmtVideoRef.current.srcObject = null;
    }
    setStmtCameraActive(false);
  };

  const captureStmtPhoto = () => {
    if (stmtVideoRef.current) {
      try {
        const video = stmtVideoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setStatementImages(prev => [...prev, dataUrl]);
          stopStmtCamera();
        }
      } catch (err: any) {
        setImportError("Errore durante la cattura della foto: " + err.message);
      }
    }
  };

  const handleStmtFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: any) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setStatementImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeStmtImage = (index: number) => {
    setStatementImages(prev => prev.filter((_, i) => i !== index));
  };

  // Get active selected elements
  const currentInst = creditInstitutions.find(i => i.id === selectedInstId);
  const currentAcc = bankAccounts.find(a => a.id === selectedAccId);

  // Filter accounts and movements
  const activeAccounts = bankAccounts.filter(acc => acc.institutionId === selectedInstId);
  const activeMovements = movements.filter(m => m.bankAccountId === selectedAccId);

  // Modal resets
  const handleOpenInstModal = () => {
    setInstName("");
    setInstBranch("");
    setInstNotes("");
    setShowInstModal(true);
  };

  const handleOpenAccModal = () => {
    setAccIban("");
    setAccHolder("");
    setAccCurrency("EUR");
    setAccIsActive(true);
    setAccountImages([]);
    setAccountOcrLoading(false);
    setAccountOcrError("");
    setAccountOcrSuccess(false);
    setShowAccModal(true);
  };

  const handleOpenImportModal = () => {
    setPasteText("");
    setImportError("");
    setExtractedMovements([]);
    setDate("");
    setDescription("");
    setAmount(0);
    setStatementImages([]);
    setShowImportModal(true);
  };

  // Form Submissions
  const handleSubmitInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instName.trim()) {
      alert("Il nome dell'istituto è obbligatorio.");
      return;
    }
    if (onAddCreditInstitution) {
      try {
        await onAddCreditInstitution({
          name: instName,
          branch: instBranch || undefined,
          notes: instNotes || undefined
        });
        setInstName("");
        setInstBranch("");
        setInstNotes("");
        setShowInstModal(false);
      } catch (err) {
        console.error("Error adding credit institution:", err);
      }
    }
  };

  const handleSubmitBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accIban.trim() || !accHolder.trim()) {
      alert("IBAN e Intestatario sono obbligatori.");
      return;
    }
    if (onAddBankAccount && selectedInstId) {
      try {
        await onAddBankAccount({
          institutionId: selectedInstId,
          iban: accIban,
          holder: accHolder,
          currency: accCurrency,
          isActive: accIsActive
        });
        setAccIban("");
        setAccHolder("");
        setAccCurrency("EUR");
        setAccIsActive(true);
        setShowAccModal(false);
      } catch (err) {
        console.error("Error adding bank account:", err);
      }
    }
  };

  // AI Extraction & Save for movements
  const handleExtractWithAi = async () => {
    if (!pasteText.trim() && statementImages.length === 0) {
      setImportError("Incolla un estratto conto in formato testuale, oppure scatta/carica foto o PDF per la lettura intelligente.");
      return;
    }

    setImportLoading(true);
    setImportError("");

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: pasteText || undefined,
          images: statementImages.length > 0 ? statementImages : undefined,
          context: "banks"
        })
      });

      const result = await response.json();
      if (result.success && result.data && Array.isArray(result.data.movements)) {
        setExtractedMovements(result.data.movements.map((m: any) => ({
          date: m.date || new Date().toISOString().split("T")[0],
          description: m.description || "Transazione bancaria",
          amount: Number(m.amount) || 0
        })));
      } else {
        setImportError(result.error || "Formato estratto non supportato o errore AI.");
      }
    } catch (err: any) {
      setImportError("Errore durante l'estrazione: " + err.message);
    } finally {
      setImportLoading(false);
    }
  };

  const handleSaveExtracted = async () => {
    try {
      for (const m of extractedMovements) {
        await onAddMovement({
          date: m.date,
          description: m.description,
          amount: m.amount,
          reconciled: false,
          bankAccountId: selectedAccId || undefined
        });
      }
      setShowImportModal(false);
    } catch (err) {
      console.error("Error saving extracted movements", err);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !description.trim() || amount === 0) {
      alert("Inserisci data, causale e un importo diverso da zero.");
      return;
    }

    try {
      await onAddMovement({
        date,
        description,
        amount,
        reconciled: false,
        bankAccountId: selectedAccId || undefined
      });
      setShowImportModal(false);
    } catch (err) {
      console.error("Error adding manual movement", err);
    }
  };

  // Reconciliation Procedures
  const openReconcileModal = (movement: BankMovement) => {
    setSelectedMovement(movement);
    
    const recommendation = fastClosing.find(item => 
      item.status === "Pending" && 
      (Math.abs(item.amount - Math.abs(movement.amount)) < 0.05 || 
       (movement.description || "").toLowerCase().includes((item.title || "").toLowerCase()) ||
       (item.title || "").toLowerCase().includes((movement.description || "").toLowerCase()))
    );

    setSelectedClosingItemId(recommendation?.id || "");
    setShowReconcileModal(true);
  };

  const handleConfirmReconciliation = async () => {
    if (!selectedMovement || !selectedClosingItemId) {
      alert("Seleziona una scadenza con cui effettuare la riconciliazione.");
      return;
    }

    try {
      await onReconcileMovement(selectedMovement.id, selectedClosingItemId);
      setShowReconcileModal(false);
      setSelectedMovement(null);
    } catch (err) {
      console.error("Reconciliation error", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Rimuovere questo movimento bancario?")) {
      try {
        await onDeleteMovement(id);
      } catch (err) {
        console.error("Error deleting movement", err);
      }
    }
  };

  const pendingDues = fastClosing.filter(item => item.status === "Pending" || item.status === "Overdue");

  return (
    <div className="space-y-6" id="banks-view-container">
      
      {/* 1. TOP LEVEL: INSTITUTIONS LIST */}
      {selectedInstId === null && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Istituti di Credito</h2>
              <p className="text-xs text-slate-500 mt-0.5">Seleziona un istituto per gestire i conti correnti e i movimenti bancari.</p>
            </div>
            <button
              onClick={handleOpenInstModal}
              id="add-institution-btn"
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-5 py-3 rounded-xl active:transition-all shadow-md self-start sm:self-auto"
            >
              <Plus size={15} />
              <span>Aggiungi Istituto</span>
            </button>
          </div>

          {creditInstitutions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-lg mx-auto">
              <div className="bg-slate-50 text-slate-400 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4">
                <Landmark size={28} />
              </div>
              <h3 className="font-sans font-bold text-slate-800 text-base">Nessun istituto registrato</h3>
              <p className="text-xs text-slate-500 mt-2">
                Non hai ancora inserito un istituto di credito. Clicca su "Aggiungi Istituto" per iniziare a censire le tue banche.
              </p>
              <button
                onClick={handleOpenInstModal}
                className="mt-5 inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs transition-colors"
              >
                <Plus size={14} />
                <span>Aggiungi ora</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {creditInstitutions.map((inst) => {
                const accountsCount = bankAccounts.filter(a => a.institutionId === inst.id).length;
                return (
                  <div
                    key={inst.id}
                    onClick={() => setSelectedInstId(inst.id)}
                    className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-indigo-400 cursor-pointer hover:shadow-md transition-all group relative"
                  >
                    <div className="flex items-start justify-between">
                      <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <Landmark size={22} />
                      </div>
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-slate-200">
                        {accountsCount} {accountsCount === 1 ? "Conto" : "Conti"}
                      </span>
                    </div>
                    <div className="mt-4">
                      <h4 className="font-sans font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-base">{inst.name}</h4>
                      {inst.branch && (
                        <p className="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">Filiale: {inst.branch}</p>
                      )}
                      {inst.notes && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2 italic">"{inst.notes}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. SECOND LEVEL: CONTI CORRENTI DI UN ISTITUTO */}
      {selectedInstId !== null && selectedAccId === null && (
        <div className="space-y-6 animate-fadeIn">
          {/* Breadcrumb / Back Navigation */}
          <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold">
            <button 
              onClick={() => setSelectedInstId(null)} 
              className="hover:text-slate-900 flex items-center space-x-1"
            >
              <ArrowLeft size={14} />
              <span>Istituti</span>
            </button>
            <span>/</span>
            <span className="text-slate-800">{currentInst?.name}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Conti Correnti • {currentInst?.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">Seleziona un conto corrente per visualizzare e riconciliare i movimenti.</p>
            </div>
            <button
              onClick={handleOpenAccModal}
              id="add-account-btn"
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-5 py-3 rounded-xl active:transition-all shadow-md self-start sm:self-auto"
            >
              <Plus size={15} />
              <span>Aggiungi Conto Corrente</span>
            </button>
          </div>

          {/* Institute Brief Detail Card */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-4 text-xs flex flex-col sm:flex-row sm:items-center gap-4 text-slate-600">
            <div>
              <strong>Istituto:</strong> {currentInst?.name}
            </div>
            {currentInst?.branch && (
              <div>
                <strong>Filiale:</strong> {currentInst?.branch}
              </div>
            )}
            {currentInst?.notes && (
              <div className="italic">
                <strong>Note:</strong> "{currentInst?.notes}"
              </div>
            )}
          </div>

          {activeAccounts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-lg mx-auto">
              <div className="bg-slate-50 text-slate-400 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4">
                <CreditCard size={28} />
              </div>
              <h3 className="font-sans font-bold text-slate-800 text-base">Nessun conto corrente</h3>
              <p className="text-xs text-slate-500 mt-2">
                Non hai ancora registrato un conto corrente per questo istituto. Clicca su "Aggiungi Conto Corrente" per inserire l'IBAN e l'intestatario.
              </p>
              <button
                onClick={handleOpenAccModal}
                className="mt-5 inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs transition-colors"
              >
                <Plus size={14} />
                <span>Aggiungi ora</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeAccounts.map((acc) => {
                const movementsCount = movements.filter(m => m.bankAccountId === acc.id).length;
                const reconciledCount = movements.filter(m => m.bankAccountId === acc.id && m.reconciled).length;
                return (
                  <div
                    key={acc.id}
                    onClick={() => setSelectedAccId(acc.id)}
                    className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-indigo-400 cursor-pointer hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
                        <CreditCard size={20} />
                      </div>
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                        acc.isActive 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {acc.isActive ? "ATTIVO" : "INATTIVO"}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-mono font-bold text-slate-800 select-all">{acc.iban}</p>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Intestatario:</span>
                        <span className="font-bold text-slate-900">{acc.holder}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                        <span className="text-slate-500">Valuta:</span>
                        <span className="font-mono font-bold text-slate-700">{acc.currency}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] font-semibold text-indigo-600 bg-indigo-50/40 p-2 rounded-lg">
                        <span>Movimenti associati:</span>
                        <span>{reconciledCount} / {movementsCount} Riconciliati</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. THIRD LEVEL: MOVEMENTS LIST & IMPORT FOR SELECTED ACCOUNT */}
      {selectedInstId !== null && selectedAccId !== null && (
        <div className="space-y-6 animate-fadeIn">
          {/* Breadcrumb / Back Navigation */}
          <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold">
            <button 
              onClick={() => setSelectedInstId(null)} 
              className="hover:text-slate-900 flex items-center space-x-1"
            >
              <Landmark size={12} />
              <span>Istituti</span>
            </button>
            <span>/</span>
            <button 
              onClick={() => setSelectedAccId(null)} 
              className="hover:text-slate-900"
            >
              {currentInst?.name}
            </button>
            <span>/</span>
            <span className="text-slate-800 font-mono truncate max-w-[150px]">{currentAcc?.iban}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Registro Movimenti Bancari</h2>
              <p className="text-xs text-slate-500 mt-0.5">Gestisci ed esegui la riconciliazione contabile per questo conto corrente specifico.</p>
            </div>
            <button
              onClick={handleOpenImportModal}
              id="import-statements-btn"
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-5 py-3.5 rounded-xl active:transition-all shadow-md self-start sm:self-auto"
            >
              <FileSpreadsheet size={15} />
              <span>Importa Estratto Conto</span>
            </button>
          </div>

          {/* Account Detail Summary Header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-extrabold">{currentInst?.name}</span>
              <h3 className="text-sm font-mono font-black text-slate-900 select-all">{currentAcc?.iban}</h3>
              <p className="text-xs text-slate-500">Intestatario: <strong className="text-slate-700">{currentAcc?.holder}</strong> | Valuta: <strong className="text-slate-700 font-mono">{currentAcc?.currency}</strong></p>
            </div>
            <div className="flex space-x-2">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
                <p className="text-[9px] uppercase font-mono text-indigo-400 font-extrabold">Riconciliati</p>
                <p className="text-base font-black text-indigo-900">{activeMovements.filter(m => m.reconciled).length}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
                <p className="text-[9px] uppercase font-mono text-slate-400 font-extrabold">In attesa</p>
                <p className="text-base font-black text-slate-800">{activeMovements.filter(m => !m.reconciled).length}</p>
              </div>
            </div>
          </div>

          {/* Movements list table (Excel-style / Mastrino) */}
          {activeMovements.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-lg mx-auto">
              <div className="bg-slate-50 text-slate-400 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet size={28} />
              </div>
              <h3 className="font-sans font-bold text-slate-800 text-base">Nessun movimento registrato</h3>
              <p className="text-xs text-slate-500 mt-2">
                Non sono presenti movimenti bancari registrati per questo conto corrente. Clicca su "Importa Estratto Conto" per inserire le transazioni.
              </p>
              <button
                onClick={handleOpenImportModal}
                className="mt-5 inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs transition-colors"
              >
                <Plus size={14} />
                <span>Importa ora</span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-300 text-[11px] font-mono">
                  <thead>
                    <tr className="bg-slate-100 text-[9px] font-mono uppercase text-slate-700 tracking-wider font-extrabold border border-slate-300">
                      <th className="py-1 px-2.5 border border-slate-300">Data Operazione</th>
                      <th className="py-1 px-2.5 border border-slate-300">Causale / Descrizione</th>
                      <th className="py-1 px-2.5 border border-slate-300">Importo</th>
                      <th className="py-1 px-2.5 border border-slate-300">Riconciliazione</th>
                      <th className="py-1 px-2.5 border border-slate-300 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {activeMovements.map((movement) => {
                      const isCredit = movement.amount > 0;
                      return (
                        <tr key={movement.id} className="hover:bg-slate-50 transition-colors" id={`movement-row-${movement.id}`}>
                          <td className="p-1.5 px-2.5 border border-slate-300 font-mono text-[10.5px] text-slate-600">
                            {new Date(movement.date).toLocaleDateString("it-IT")}
                          </td>
                          <td className="p-1.5 px-2.5 border border-slate-300 font-semibold text-slate-850">
                            {movement.description}
                          </td>
                          <td className={`p-1.5 px-2.5 border border-slate-300 font-bold ${isCredit ? "text-emerald-600" : "text-slate-900"}`}>
                            <div className="flex items-center space-x-1">
                              {isCredit ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                              <span>
                                {isCredit ? "+" : ""}€{movement.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </td>
                          <td className="p-1.5 px-2.5 border border-slate-300">
                            {movement.reconciled ? (
                              <div className="flex items-center space-x-1 text-emerald-600 text-[10px] font-semibold">
                                <CheckCircle2 size={12} />
                                <span className="max-w-[130px] truncate" title={movement.reconciledWith?.title}>
                                  Abbinato: {movement.reconciledWith?.title}
                                </span>
                              </div>
                            ) : (
                              <button
                                onClick={() => openReconcileModal(movement)}
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-[8.5px] font-black px-2 py-1 rounded transition-all cursor-pointer shadow-sm"
                              >
                                Riconcilia Ora
                              </button>
                            )}
                          </td>
                          <td className="p-3.5 border border-slate-300 text-right">
                            <button
                              onClick={() => handleDelete(movement.id)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-[10px] font-black -2 border-rose-800 transition-all cursor-pointer shadow-sm"
                              title="Elimina movimento"
                            >
                              <Trash2 size={11} />
                              <span>Elimina</span>
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
        </div>
      )}

      {/* MODAL: ADD CREDIT INSTITUTION */}
      {showInstModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 bg-indigo-900 text-white flex items-center justify-between">
              <h3 className="font-sans font-bold text-sm flex items-center space-x-2">
                <Landmark size={18} />
                <span>Crea Nuovo Istituto di Credito</span>
              </h3>
              <button onClick={() => setShowInstModal(false)} className="text-indigo-200 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitInstitution} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome Istituto *</label>
                <input
                  required
                  type="text"
                  placeholder="es: Intesa Sanpaolo"
                  value={instName}
                  onChange={(e) => setInstName(e.target.value)}
                  className="w-full text-xs border border-slate-250 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Filiale / Sede (Opzionale)</label>
                <input
                  type="text"
                  placeholder="es: Sede Milano Cordusio"
                  value={instBranch}
                  onChange={(e) => setInstBranch(e.target.value)}
                  className="w-full text-xs border border-slate-250 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Note (Opzionale)</label>
                <textarea
                  placeholder="Note aggiuntive"
                  value={instNotes}
                  onChange={(e) => setInstNotes(e.target.value)}
                  rows={3}
                  className="w-full text-xs border border-slate-250 rounded-xl p-2.5 outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInstModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Salva Istituto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD BANK ACCOUNT */}
      {showAccModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 bg-indigo-900 text-white flex items-center justify-between">
              <h3 className="font-sans font-bold text-sm flex items-center space-x-2">
                <CreditCard size={18} />
                <span>Aggiungi Conto Corrente a {currentInst?.name}</span>
              </h3>
              <button onClick={() => { stopAccCamera(); setShowAccModal(false); }} className="text-indigo-200 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
              {/* AI Auto-Compile Section */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-indigo-950 flex items-center space-x-1.5 uppercase tracking-wider">
                    <Sparkles size={14} className="text-amber-500 animate-pulse" />
                    <span>Lettura Intelligente AI (OCR)</span>
                  </h4>
                  <span className="text-[9px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">NOVITÀ</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Scatta una foto o allega un documento del conto (es: contratto, estratto conto, screenshot) per compilare automaticamente i campi IBAN e Intestatario.
                </p>

                {/* Camera view */}
                {accCameraActive && (
                  <div className="relative rounded-xl overflow-hidden bg-black border border-slate-200 aspect-video flex flex-col justify-end">
                    <video ref={accVideoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
                    <div className="relative z-10 p-3 bg-gradient-to-t from-black/80 to-transparent flex justify-center space-x-2">
                      <button
                        type="button"
                        onClick={captureAccPhoto}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1"
                      >
                        <Camera size={13} />
                        <span>Scatta Foto</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopAccCamera}
                        className="bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload & Capture Buttons */}
                {!accCameraActive && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={startAccCamera}
                      className="inline-flex items-center justify-center space-x-1.5 border border-slate-200 hover:border-indigo-400 bg-white p-2.5 rounded-xl text-[11px] font-bold text-slate-700 shadow-xs transition-all cursor-pointer"
                    >
                      <Camera size={14} className="text-indigo-600" />
                      <span>Usa Fotocamera</span>
                    </button>
                    <label className="inline-flex items-center justify-center space-x-1.5 border border-slate-200 hover:border-indigo-400 bg-white p-2.5 rounded-xl text-[11px] font-bold text-slate-700 shadow-xs transition-all cursor-pointer">
                      <Upload size={14} className="text-indigo-600" />
                      <span>Scegli File / PDF</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        multiple
                        onChange={handleAccFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {/* Document Previews */}
                {accountImages.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Documenti Allegati ({accountImages.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {accountImages.map((img, idx) => {
                        const isPdf = img.startsWith("data:application/pdf");
                        return (
                          <div key={idx} className="relative w-14 h-14 rounded-lg border border-slate-200 bg-white overflow-hidden group">
                            {isPdf ? (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 text-rose-600">
                                <FileText size={20} />
                                <span className="text-[8px] font-bold mt-0.5">PDF</span>
                              </div>
                            ) : (
                              <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            )}
                            <button
                              type="button"
                              onClick={() => removeAccImage(idx)}
                              className="absolute top-0.5 right-0.5 bg-rose-600 hover:bg-rose-750 text-white p-0.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <button
                        type="button"
                        onClick={() => setAccountImages([])}
                        className="text-rose-600 text-[10px] font-bold hover:underline"
                      >
                        Rimuovi tutti
                      </button>
                      <button
                        type="button"
                        disabled={accountOcrLoading}
                        onClick={handleExtractAccountWithAi}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black px-4 py-2 rounded-xl flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                      >
                        {accountOcrLoading ? (
                          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <Sparkles size={12} />
                        )}
                        <span>{accountOcrLoading ? "Analisi in corso..." : "Estrai Dati Conto"}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Error & Success Messages */}
                {accountOcrError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-700 font-medium flex items-start space-x-1.5">
                    <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                    <span>{accountOcrError}</span>
                  </div>
                )}

                {accountOcrSuccess && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-700 font-medium flex items-start space-x-1.5 animate-fadeIn">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>Dati del conto estratti con successo! Verificali prima di salvare.</span>
                  </div>
                )}
              </div>

              {/* Original Form Inputs */}
              <form onSubmit={(e) => { stopAccCamera(); handleSubmitBankAccount(e); }} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Codice IBAN *</label>
                  <input
                    required
                    type="text"
                    placeholder="IT60X0542403200000000123456"
                    value={accIban}
                    onChange={(e) => setAccIban(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-250 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Intestatario del Conto *</label>
                  <input
                    required
                    type="text"
                    placeholder="es: Mario Rossi s.r.l."
                    value={accHolder}
                    onChange={(e) => setAccHolder(e.target.value)}
                    className="w-full text-xs border border-slate-250 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Valuta</label>
                    <select
                      value={accCurrency}
                      onChange={(e) => setAccCurrency(e.target.value)}
                      className="w-full text-xs border border-slate-250 rounded-xl px-3 py-2.5 bg-white outline-hidden"
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="USD">USD ($)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Stato</label>
                    <select
                      value={accIsActive ? "true" : "false"}
                      onChange={(e) => setAccIsActive(e.target.value === "true")}
                      className="w-full text-xs border border-slate-250 rounded-xl px-3 py-2.5 bg-white outline-hidden"
                    >
                      <option value="true">Attivo</option>
                      <option value="false">Inattivo</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 flex justify-end space-x-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { stopAccCamera(); setShowAccModal(false); }}
                    className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    Crea Conto
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: STATEMENT IMPORT (WITH AI OR MANUAL) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-sans font-bold text-sm flex items-center space-x-2">
                <FileSpreadsheet size={18} />
                <span>Importazione Transazioni • IBAN: {currentAcc?.iban}</span>
              </h3>
              <button onClick={() => { stopStmtCamera(); setShowImportModal(false); }} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              {/* Method 1: AI Extraction */}
              <div className="pb-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1">
                    <Sparkles size={14} className="text-indigo-600 animate-pulse" />
                    <span>Metodo 1: Estrai righe estratto conto con l'AI</span>
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">Supporta Foto & PDF OCR</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Incolla righe dell'estratto conto bancario OPPURE scatta/allega un file PDF o un'immagine del documento per estrarre data, causale e importi.</p>
                
                <div className="mt-3 space-y-3">
                  {/* Camera view for Statement */}
                  {stmtCameraActive && (
                    <div className="relative rounded-xl overflow-hidden bg-black border border-slate-200 aspect-video flex flex-col justify-end max-w-md mx-auto">
                      <video ref={stmtVideoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
                      <div className="relative z-10 p-3 bg-gradient-to-t from-black/80 to-transparent flex justify-center space-x-2">
                        <button
                          type="button"
                          onClick={captureStmtPhoto}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1"
                        >
                          <Camera size={13} />
                          <span>Scatta Foto</span>
                        </button>
                        <button
                          type="button"
                          onClick={stopStmtCamera}
                          className="bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dual Mode: Text paste OR Camera/File Upload */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Column 1: Text Paste */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">A) Incolla Righe di Testo</label>
                      <textarea
                        placeholder="Incolla qui l'estratto conto... (es: 12/06/2026 BONIFICO DA ROSSI MARIO €850,00)"
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        rows={5}
                        className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-hidden focus:border-indigo-500 font-mono bg-slate-50/50 resize-none"
                      />
                    </div>

                    {/* Column 2: Upload Files & Photo capture */}
                    <div className="space-y-2 flex flex-col justify-between">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">B) Carica Documento / Foto</label>
                        {!stmtCameraActive && (
                          <div className="grid grid-cols-2 gap-2 mt-1.5">
                            <button
                              type="button"
                              onClick={startStmtCamera}
                              className="inline-flex items-center justify-center space-x-1.5 border border-slate-200 hover:border-indigo-400 bg-white p-3 rounded-xl text-[11px] font-bold text-slate-700 shadow-xs transition-all cursor-pointer"
                            >
                              <Camera size={14} className="text-indigo-600" />
                              <span>Usa Fotocamera</span>
                            </button>
                            <label className="inline-flex items-center justify-center space-x-1.5 border border-slate-200 hover:border-indigo-400 bg-white p-3 rounded-xl text-[11px] font-bold text-slate-700 shadow-xs transition-all cursor-pointer">
                              <Upload size={14} className="text-indigo-600" />
                              <span>Scegli File / PDF</span>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                multiple
                                onChange={handleStmtFileChange}
                                className="hidden"
                              />
                            </label>
                          </div>
                        )}
                      </div>

                      {/* File Previews */}
                      {statementImages.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Estratti Allegati ({statementImages.length})</span>
                            <button
                              type="button"
                              onClick={() => setStatementImages([])}
                              className="text-rose-600 text-[9px] font-bold hover:underline"
                            >
                              Rimuovi tutti
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white rounded-lg border border-slate-100">
                            {statementImages.map((img, idx) => {
                              const isPdf = img.startsWith("data:application/pdf");
                              return (
                                <div key={idx} className="relative w-10 h-10 rounded-md border border-slate-200 bg-white overflow-hidden group">
                                  {isPdf ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 text-rose-600">
                                      <FileText size={14} />
                                      <span className="text-[6px] font-bold mt-0.5">PDF</span>
                                    </div>
                                  ) : (
                                    <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeStmtImage(idx)}
                                    className="absolute top-0.5 right-0.5 bg-rose-600 hover:bg-rose-750 text-white p-0.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X size={8} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-[10px] text-slate-500 leading-normal">
                        <strong>Nota:</strong> Puoi combinare l'estrazione incollando righe e allegando file! L'AI leggerà tutto per estrarre l'elenco completo dei movimenti.
                      </div>
                    </div>
                  </div>

                  {importError && (
                    <p className="text-xs text-rose-600 font-semibold">{importError}</p>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      disabled={importLoading}
                      onClick={handleExtractWithAi}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center space-x-2 shadow-sm disabled:opacity-50"
                    >
                      {importLoading ? (
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <Sparkles size={14} />
                      )}
                      <span>{importLoading ? "AI in elaborazione (OCR)..." : "Avvia Lettura Intelligente AI"}</span>
                    </button>
                  </div>
                </div>

                {extractedMovements.length > 0 && (
                  <div className="mt-4 border border-indigo-100 bg-indigo-50/10 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-bold text-indigo-950">Movimenti rilevati ({extractedMovements.length}) - Conferma salvataggio:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {extractedMovements.map((m, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg text-xs border border-slate-100 font-mono">
                          <span className="text-slate-500">{new Date(m.date).toLocaleDateString("it-IT")}</span>
                          <span className="text-slate-800 font-semibold truncate max-w-[200px] ml-2">{m.description}</span>
                          <span className={`font-bold ml-auto ${m.amount > 0 ? "text-emerald-600" : "text-slate-700"}`}>
                            €{m.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={handleSaveExtracted}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                      >
                        Salva ed Importa in Registro
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Method 2: Manual Single Transaction */}
              <div className="pt-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Metodo 2: Inserimento Singolo Manuale</h4>
                <form onSubmit={handleManualAdd} className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">Data</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">Causale</label>
                    <input
                      type="text"
                      placeholder="Pagamento rate condominio"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-hidden"
                    />
                  </div>
                  <div className="flex space-x-1.5 items-center">
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">Importo (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="-250.00"
                        value={amount || ""}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-hidden"
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold px-3 py-2 rounded-lg mt-5 h-8 animate-pulse hover:animate-none"
                    >
                      Salva
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECONCILIATION MODAL */}
      {showReconcileModal && selectedMovement && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 bg-indigo-900 text-white flex items-center justify-between">
              <h3 className="font-sans font-bold text-sm flex items-center space-x-2">
                <Sparkles size={16} className="text-amber-400" />
                <span>Riconcilia Transazione con l'AI</span>
              </h3>
              <button onClick={() => setShowReconcileModal(false)} className="text-indigo-200 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <p className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Transazione Bancaria da abbinare:</p>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-slate-600">{new Date(selectedMovement.date).toLocaleDateString("it-IT")}</span>
                  <span className="text-xs font-bold text-slate-900 max-w-[200px] truncate">{selectedMovement.description}</span>
                  <span className="text-xs font-bold text-slate-950 font-mono">€{selectedMovement.amount.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Seleziona la scadenza in sospeso correlata:
                </label>
                <select
                  required
                  value={selectedClosingItemId}
                  onChange={(e) => setSelectedClosingItemId(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-hidden focus:border-indigo-500"
                >
                  <option value="">-- Seleziona una scadenza dovuta --</option>
                  {pendingDues.length === 0 ? (
                    <option value="" disabled>Nessuna scadenza in attesa nel Fast Closing!</option>
                  ) : (
                    pendingDues.map(item => (
                      <option key={item.id} value={item.id}>
                        [{item.source.toUpperCase()}] {item.title} - €{item.amount.toFixed(2)} (Scad: {new Date(item.dueDate).toLocaleDateString("it-IT")})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="bg-indigo-50/40 p-3 rounded-xl text-xs text-indigo-900 border border-indigo-100/50">
                <p className="font-semibold">Cosa succede adesso?</p>
                <p className="mt-1 leading-relaxed">
                  Confermando l'abbinamento, questa transazione verrà contrassegnata come <strong>Riconciliata</strong>. La scadenza associata in Fast Closing verrà automaticamente registrata come <strong>Pagata</strong>, mantenendo aggiornato e pulito lo stato contabile complessivo.
                </p>
              </div>

              <div className="pt-3 flex justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleConfirmReconciliation}
                  disabled={!selectedClosingItemId}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  Conferma Riconciliazione
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
