import React, { useState } from "react";
import { 
  Sparkles, 
  FileText, 
  Building, 
  Landmark, 
  Users, 
  Home, 
  AlertTriangle, 
  CalendarClock, 
  ArrowRight, 
  Check, 
  AlertCircle,
  Copy,
  Camera,
  Upload,
  Trash2,
  Image,
  X,
  Plus
} from "lucide-react";
import { AppSection } from "../types";

interface AIAreaViewProps {
  onAddProperty: (property: any) => Promise<void>;
  onAddContract: (contract: any) => Promise<void>;
  onAddTenant: (tenant: any) => Promise<void>;
  onAddCondominium: (condo: any) => Promise<void>;
  onAddMovement: (movement: any) => Promise<void>;
  onAddReminder: (reminder: any) => Promise<void>;
  onAddClosingItem: (item: any) => Promise<void>;
  setCurrentSection: (section: AppSection) => void;
}

type AiContextType = "contracts" | "condominiums" | "banks" | "tenants" | "properties" | "reminders" | "fast_closing";

export default function AIAreaView({
  onAddProperty,
  onAddContract,
  onAddTenant,
  onAddCondominium,
  onAddMovement,
  onAddReminder,
  onAddClosingItem,
  setCurrentSection
}: AIAreaViewProps) {
  const [selectedContext, setSelectedContext] = useState<AiContextType>("contracts");
  const [documentText, setDocumentText] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  // Stored parsed suggestion
  const [parsedResult, setParsedResult] = useState<any | null>(null);

  // Camera & Photo upload states
  const [images, setImages] = useState<string[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  // Clean up camera on unmount
  React.useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setError("");
    setSuccessMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setError("Impossibile avviare la webcam: " + err.message + ". Puoi comunque scegliere o scattare una foto con la fotocamera del tuo cellulare cliccando su 'Scatta o Scegli Foto'.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      try {
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setImages(prev => [...prev, dataUrl]);
          stopCamera();
        }
      } catch (err: any) {
        setError("Errore durante la cattura della foto: " + err.message);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: any) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const contextButtons = [
    { id: "contracts", label: "Contratti", icon: FileText, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
    { id: "condominiums", label: "Condomini", icon: Building, color: "text-amber-600 bg-amber-50 border-amber-200" },
    { id: "banks", label: "Banche", icon: Landmark, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    { id: "tenants", label: "Inquilini", icon: Users, color: "text-blue-600 bg-blue-50 border-blue-200" },
    { id: "properties", label: "Immobili", icon: Home, color: "text-purple-600 bg-purple-50 border-purple-200" },
    { id: "reminders", label: "Solleciti", icon: AlertTriangle, color: "text-rose-600 bg-rose-50 border-rose-200" },
    { id: "fast_closing", label: "Fast Closing", icon: CalendarClock, color: "text-teal-600 bg-teal-50 border-teal-200" },
  ] as const;

  const handleProcessAi = async () => {
    if (!documentText.trim() && images.length === 0) {
      setError("Inserisci del testo oppure scatta/carica almeno una fotografia o un file PDF del documento da elaborare.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");
    setParsedResult(null);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: documentText,
          images: images,
          context: selectedContext,
          userPrompt: customInstructions
        })
      });

      const result = await response.json();
      if (result.success && result.data) {
        setParsedResult(result.data);
      } else {
        setError(result.error || "Impossibile elaborare il documento. Riprova con un testo o foto differente.");
      }
    } catch (err: any) {
      setError("Errore di rete durante la connessione al server: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!parsedResult) return;
    setLoading(true);
    setError("");

    try {
      let targetSection: AppSection = "dashboard";

      switch (selectedContext) {
        case "properties":
          await onAddProperty({
            name: parsedResult.name || parsedResult.title || "Immobile Estratto AI",
            address: parsedResult.address || "Indirizzo non specificato",
            type: parsedResult.type || "Appartamento",
            status: parsedResult.status || "Available",
            notes: parsedResult.notes || "Caricato tramite l'Area AI",
            owner: parsedResult.owner || ""
          });
          targetSection = "properties";
          break;

        case "contracts":
          await onAddContract({
            propertyId: parsedResult.propertyId || "",
            propertyName: parsedResult.propertyName || "Immobile Generico",
            tenantId: parsedResult.tenantId || "",
            tenantName: parsedResult.tenantName || "Inquilino Generico",
            startDate: parsedResult.startDate || new Date().toISOString().split("T")[0],
            endDate: parsedResult.endDate || new Date(Date.now() + 365*24*3600*1000).toISOString().split("T")[0],
            rentAmount: Number(parsedResult.rentAmount) || 0,
            frequency: parsedResult.frequency || "Mensile",
            status: parsedResult.status || "Active",
            notes: parsedResult.notes || "Caricato tramite l'Area AI",
            ownerName: parsedResult.ownerName || ""
          });
          targetSection = "contracts";
          break;

        case "tenants":
          await onAddTenant({
            name: parsedResult.name || "Inquilino Estratto AI",
            email: parsedResult.email || "email@sconosciuta.it",
            phone: parsedResult.phone || "",
            fiscalCode: parsedResult.fiscalCode || "",
            notes: parsedResult.notes || "Caricato tramite l'Area AI"
          });
          targetSection = "tenants";
          break;

        case "condominiums":
          await onAddCondominium({
            name: parsedResult.name || "Condominio Estratto AI",
            administrator: parsedResult.administrator || "",
            phone: parsedResult.phone || "",
            email: parsedResult.email || "",
            notes: parsedResult.notes || "Caricato tramite l'Area AI",
            rates: parsedResult.rates || []
          });
          targetSection = "condominiums";
          break;

        case "banks":
          if (parsedResult.movements && Array.isArray(parsedResult.movements)) {
            for (const m of parsedResult.movements) {
              await onAddMovement({
                date: m.date || new Date().toISOString().split("T")[0],
                description: m.description || "Transazione",
                amount: Number(m.amount) || 0,
                reconciled: false
              });
            }
          } else if (parsedResult.date) {
            await onAddMovement({
              date: parsedResult.date,
              description: parsedResult.description || "Transazione",
              amount: Number(parsedResult.amount) || 0,
              reconciled: false
            });
          }
          targetSection = "banks";
          break;

        case "reminders":
          await onAddReminder({
            tenantId: parsedResult.tenantId || "",
            tenantName: parsedResult.tenantName || "Inquilino",
            amount: Number(parsedResult.amount) || 0,
            reason: parsedResult.reason || "Sollecito Canone",
            dueDate: parsedResult.dueDate || new Date().toISOString().split("T")[0],
            status: "Pending",
            suggestedLetterBody: parsedResult.suggestedLetterBody || ""
          });
          targetSection = "reminders";
          break;

        case "fast_closing":
          await onAddClosingItem({
            title: parsedResult.title || "Scadenza Estratta AI",
            description: parsedResult.description || "",
            amount: Number(parsedResult.amount || parsedResult.estimatedAmount) || 0,
            dueDate: parsedResult.dueDate || new Date().toISOString().split("T")[0],
            source: "manual",
            status: "Pending"
          });
          targetSection = "fast_closing";
          break;
      }

      setSuccessMsg("Perfetto! I dati estratti dall'AI sono stati importati con successo nel database.");
      setParsedResult(null);
      setDocumentText("");
      setCustomInstructions("");
      
      // Auto redirect to target tab
      setTimeout(() => {
        setCurrentSection(targetSection);
      }, 1500);

    } catch (err: any) {
      setError("Errore durante l'importazione nel database: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" id="ai-area-view-container">
      {/* View Header */}
      <div className="pb-5">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <Sparkles className="text-amber-500 animate-pulse" size={20} />
          <span>Area AI • Cabina di Regia Documentale</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Punto d'ingresso unico per analizzare contratti, estrarre rate di bilanci condominiali, transazioni bancarie o generare solleciti di pagamento.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form: Input documents */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Quick Context Buttons */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">
              1. Quale modulo desideri popolare?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {contextButtons.map((btn) => {
                const Icon = btn.icon;
                const isSelected = selectedContext === btn.id;
                return (
                  <button
                    key={btn.id}
                    onClick={() => {
                      setSelectedContext(btn.id);
                      setParsedResult(null);
                    }}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center text-center space-y-2 transition-all ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/10"
                        : "bg-slate-50 border-slate-100 hover:bg-slate-100/50 hover:border-slate-200 text-slate-700"
                    }`}
                  >
                    <Icon size={18} className={isSelected ? "text-amber-400" : "text-slate-500"} />
                    <span className="truncate w-full">{btn.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Photo Acquisition Section */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4" id="ai-photo-capture-card">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                2. Allega o Scatta Pagine del Documento (PDF o Immagini Multiple)
              </label>
              {images.length > 0 && (
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-100 flex items-center space-x-1">
                  <Check size={12} />
                  <span>{images.length} {images.length === 1 ? "Pagina Caricata" : "Pagine Caricate"}</span>
                </span>
              )}
            </div>

            {/* Camera stream view when active */}
            {cameraActive && (
              <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800 aspect-video flex flex-col items-center justify-center">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                {/* Visual scanner laser overlay */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-indigo-500 shadow-lg shadow-indigo-500 animate-bounce" style={{ animationDuration: '3s' }} />
                
                <div className="absolute bottom-4 inset-x-0 flex justify-center space-x-3 px-4 z-10">
                  <button
                    onClick={capturePhoto}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <Camera size={14} />
                    <span>Cattura Pagina {images.length + 1}</span>
                  </button>
                  <button
                    onClick={stopCamera}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Termina Scatti
                  </button>
                </div>
              </div>
            )}

            {!cameraActive && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Button to start webcam */}
                <button
                  onClick={startCamera}
                  className="flex items-center justify-center space-x-2 p-4 border border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-xl transition-all text-slate-700 text-xs font-semibold group cursor-pointer"
                >
                  <Camera size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  <span>Scatta con Webcam</span>
                </button>

                {/* Input file and button styled together */}
                <div>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    id="camera-file-input"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <label
                    htmlFor="camera-file-input"
                    className="flex items-center justify-center space-x-2 p-4 border border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-xl transition-all text-slate-700 text-xs font-semibold cursor-pointer group w-full"
                  >
                    <Upload size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    <span>Carica Pagine (PDF o Immagini)</span>
                  </label>
                </div>
              </div>
            )}

            {/* Display list of preview images/PDFs if they exist */}
            {images.length > 0 && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Pagine che verranno inviate a Gemini ({images.length})</p>
                  <label
                    htmlFor="camera-file-input"
                    className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold uppercase tracking-wider cursor-pointer flex items-center space-x-1"
                  >
                    <Plus size={12} />
                    <span>Aggiungi un'altra pagina</span>
                  </label>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {images.map((img, idx) => {
                    const isPdf = img.startsWith("data:application/pdf") || img.includes("pdf");
                    return (
                      <div key={idx} className="relative bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 flex items-center justify-between animate-fadeIn group">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="relative w-11 h-11 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shrink-0 flex items-center justify-center shadow-3xs">
                            {isPdf ? (
                              <div className="flex flex-col items-center justify-center bg-rose-50 w-full h-full text-rose-600">
                                <FileText size={18} />
                                <span className="text-[8px] font-bold uppercase mt-0.5 font-mono">PDF</span>
                              </div>
                            ) : (
                              <img 
                                src={img} 
                                alt={`Pagina ${idx + 1}`} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <div className="absolute top-0 left-0 bg-slate-900/70 text-white text-[8px] font-black font-mono px-1 rounded-br">
                              P.{idx + 1}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">
                              {isPdf ? "Documento PDF" : "Fotografia"}
                            </p>
                            <p className="text-[9px] text-slate-400 truncate">Pronto per OCR</p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeImage(idx)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                          title="Rimuovi questa pagina"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Paste Document text box */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                3. Oppure incolla il testo del documento {images.length > 0 ? "(Opzionale)" : "*"}
              </label>
              <textarea
                placeholder={images.length > 0 ? "Puoi lasciare vuoto se hai caricato file o foto sopra, oppure aggiungi note..." : `Incolla il testo relativo a ${selectedContext}...`}
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                rows={6}
                className="w-full text-xs font-mono border border-slate-200 rounded-xl p-3 bg-slate-50/30 outline-hidden focus:border-indigo-500 leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Istruzioni aggiuntive per l'AI (Opzionale)
              </label>
              <input
                type="text"
                placeholder="Es: estraimi le rate del condominio e crea le scadenze"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleProcessAi}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-md shadow-indigo-600/5 disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Sparkles size={14} className="text-amber-300" />
              )}
              <span>{loading ? "AI al lavoro... Analisi in corso" : "Avvia Analisi ed Estrazione AI"}</span>
            </button>
          </div>

        </div>

        {/* Right Preview Card: Proposals */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-850 h-full flex flex-col justify-between min-h-[400px]">
            <div>
              <div className="flex items-center space-x-2.5 pb-3">
                <Sparkles size={16} className="text-amber-400" />
                <h3 className="font-sans font-bold text-slate-100 text-sm">Preview dei Dati Estratti dall'AI</h3>
              </div>

              {/* Status messages */}
              {loading && (
                <div className="py-16 text-center space-y-4">
                  <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-slate-400">Gemini sta interpretando il documento strutturando le anagrafiche, gli importi e le scadenze...</p>
                </div>
              )}

              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl mt-6 flex items-start space-x-2">
                  <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-300 leading-relaxed">{error}</p>
                </div>
              )}

              {successMsg && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mt-6 flex items-start space-x-2">
                  <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-300 leading-relaxed">{successMsg}</p>
                </div>
              )}

              {!loading && !error && !successMsg && !parsedResult && (
                <div className="py-20 text-center space-y-2 text-slate-500">
                  <Sparkles size={32} className="mx-auto text-slate-700" />
                  <p className="text-xs max-w-xs mx-auto">Scegli una categoria a sinistra, incolla il testo del documento e premi su Avvia. I dati strutturati compariranno qui per la conferma.</p>
                </div>
              )}

              {/* Parsed results visual rendering */}
              {parsedResult && !loading && (
                <div className="mt-5 space-y-4 overflow-y-auto max-h-[350px] pr-1 text-slate-200">
                  <p className="text-[11px] font-mono text-amber-400 tracking-wide font-semibold uppercase">Proposta di compilazione automatica:</p>
                  
                  <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-4 space-y-3 text-xs">
                    {Object.entries(parsedResult).map(([key, val]) => {
                      if (typeof val === "object" && val !== null) {
                        return (
                          <div key={key} className="border-t border-slate-850 pt-2.5 mt-2">
                            <span className="text-[10px] font-mono text-slate-500 capitalize">{key}:</span>
                            <pre className="mt-1 bg-slate-900/40 p-2 rounded-lg text-[10px] overflow-x-auto text-slate-300 whitespace-pre-wrap font-sans">
                              {JSON.stringify(val, null, 2)}
                            </pre>
                          </div>
                        );
                      }
                      return (
                        <div key={key} className="flex justify-between items-start py-1 /30">
                          <span className="text-[10px] font-mono text-slate-500 capitalize">{key}:</span>
                          <span className="font-semibold text-slate-200 pl-4 text-right max-w-[200px] truncate">{String(val)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm save button */}
            {parsedResult && !loading && (
              <div className="pt-4 border-t border-slate-800 mt-4">
                <button
                  onClick={handleConfirmAndSave}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/10"
                >
                  <Check size={14} />
                  <span>Conferma e Salva nel Database</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
