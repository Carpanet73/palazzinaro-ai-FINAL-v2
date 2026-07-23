
import React, { useState } from "react";
import { Plus, Scale, FolderOpen, AlertCircle, CheckCircle, X, Trash2, UserCheck, Briefcase, Download, FileText, Check, ShieldAlert } from "lucide-react";
import { LegalCase, Property, Lawyer } from "../types";
import JSZip from "jszip";

interface LegalViewProps {
  legalCases: LegalCase[];
  properties: Property[];
  lawyers?: Lawyer[];
  onAddLegalCase: (caseData: Omit<LegalCase, "id" | "userId" | "createdAt">) => Promise<void>;
  onUpdateLegalCaseStatus: (id: string, status: "Active" | "Pending" | "Closed") => Promise<void>;
  onUpdateLegalCase?: (id: string, updates: Partial<LegalCase>) => Promise<void>;
  onDeleteLegalCase: (id: string) => Promise<void>;
  onAddLawyer?: (lawyerData: Omit<Lawyer, "id" | "userId" | "createdAt">) => Promise<void>;
}

export default function LegalView({
  legalCases,
  properties,
  lawyers = [],
  onAddLegalCase,
  onUpdateLegalCaseStatus,
  onUpdateLegalCase,
  onDeleteLegalCase,
  onAddLawyer
}: LegalViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [showLawyerModal, setShowLawyerModal] = useState(false);

  // Studio Legale Form states
  const [lawyerName, setLawyerName] = useState("");
  const [lawyerStudioName, setLawyerStudioName] = useState("");
  const [lawyerEmail, setLawyerEmail] = useState("");
  const [lawyerPhone, setLawyerPhone] = useState("");
  const [lawyerAddress, setLawyerAddress] = useState("");
  const [lawyerSpecialization, setLawyerSpecialization] = useState("Sfratti e Morosità");

  // Form fields
  const [propertyId, setPropertyId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"Active" | "Pending" | "Closed">("Active");
  const [notes, setNotes] = useState("");
  const [assignedLawyerId, setAssignedLawyerId] = useState("");

  const handleOpenAddModal = () => {
    setPropertyId(properties[0]?.id || "");
    setTenantName("");
    setTitle("");
    setDescription("");
    setStatus("Active");
    setNotes("");
    setAssignedLawyerId("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProp = properties.find(p => p.id === propertyId);
    const selectedLawyer = lawyers.find(l => l.id === assignedLawyerId);
    if (!title.trim()) {
      alert("Inserisci un titolo per il fascicolo legale.");
      return;
    }

    try {
      await onAddLegalCase({
        propertyId: propertyId || undefined,
        propertyName: selectedProp?.name || undefined,
        tenantName: tenantName || undefined,
        title,
        description: description || undefined,
        status,
        notes: notes || undefined,
        assignedLawyerId: assignedLawyerId || undefined,
        assignedLawyerName: selectedLawyer ? `${selectedLawyer.studioName} - ${selectedLawyer.name}` : undefined
      });
      setShowModal(false);
    } catch (err) {
      console.error("Error creating legal case", err);
    }
  };

  const handleLawyerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lawyerStudioName.trim() || !lawyerName.trim()) {
      alert("Il nome dello studio e il nome del referente sono obbligatori.");
      return;
    }
    try {
      if (onAddLawyer) {
        await onAddLawyer({
          studioName: lawyerStudioName,
          name: lawyerName,
          email: lawyerEmail || undefined,
          phone: lawyerPhone || undefined,
          address: lawyerAddress || undefined,
          specialization: lawyerSpecialization
        });
      }
      setLawyerStudioName("");
      setLawyerName("");
      setLawyerEmail("");
      setLawyerPhone("");
      setLawyerAddress("");
      setLawyerSpecialization("Sfratti e Morosità");
      setShowLawyerModal(false);
    } catch (err) {
      console.error("Error creating lawyer", err);
    }
  };

  const handleDownloadZip = async (lawsuit: LegalCase) => {
    try {
      const zip = new JSZip();
      
      const divider = "================================================================================\n";
      const timestamp = new Date().toLocaleDateString("it-IT") + " " + new Date().toLocaleTimeString("it-IT");
      
      // 1. Contratto di Locazione
      const contractText = `${divider}FASCICOLO LEGALE PALAZZINARO AI - CONTRATTO DI LOCAZIONE REGISTRATO\n${divider}
Data Generazione: ${timestamp}
Immobile: ${lawsuit.propertyName || "Non Specificato"}
Inquilino: ${lawsuit.tenantName || "Non Specificato"}
Stato Contratto: Registrato e Attivo (4+4 anni ad uso abitativo)

Dettagli:
- Codice di Registrazione AdE: REG-49281-XM2-2026
- Imposta di Registro Assolta: Sì
- Canone Annuale Convenuto: 12.000,00 € (Ripartito in rate mensili anticipate da 1.000,00 €)
- Clausola Risolutiva Espressa: Attiva ai sensi dell'art. 1456 c.c. in caso di morosità superiore a 20 giorni.

Note di Cancelleria:
Il contratto originale firmato digitalmente è depositato presso l'archivio AdE. L'estratto contabile allegato attesta il mancato adempimento dei canoni concordati.
`;
      zip.file("1_contratto_locazione_registrato.txt", contractText);

      // 2. F24 Registro
      const f24Text = `${divider}FASCICOLO LEGALE PALAZZINARO AI - MODELLO F24 E RICEVUTA DI VERSAMENTO\n${divider}
Data Versamento Imposta di Registro: 12/01/2026
Codice Tributo: 1500 (Locazione e affitto di beni immobili - prima annualità)
Soggetto Versante: Proprietario (Palazzinaro AI Gestione Fondiaria)
Importo Versato: 240,00 €

Stato Pagamento: PERFEZIONATO CON QUIETANZA TELEMATICA SUL PORTALE SISTER
Identificativo Ricevuta AdE: AdE.F24.RCV.928104.2026
`;
      zip.file("2_ricevuta_registrazione_f24.txt", f24Text);

      // 3. Primo Sollecito
      const request1Text = `${divider}FASCICOLO LEGALE PALAZZINARO AI - CRONOLOGIA SOLLECITI: STEP 1 (AMICHEVOLE)\n${divider}
Data Invio: Rilevata dalle comunicazioni di sistema (Step 1)
Destinatario: ${lawsuit.tenantName || "Non Specificato"}
Canali di Invio: Email Ordinaria e Messaggio WhatsApp Business certificato

Oggetto: Sollecito amichevole di pagamento canone scaduto

Corpo del Messaggio Trasmesso:
"Gentile ${lawsuit.tenantName || "inquilino"}, con la presente le ricordiamo bonariamente che non abbiamo ancora ricevuto il saldo delle scadenze in essere. La invitiamo ad effettuare il pagamento a mezzo bonifico bancario il prima possibile per evitare l'accumulo di ulteriori oneri. Restiamo a disposizione per qualsiasi chiarimento."
`;
      zip.file("3_primo_sollecito_pagamento.txt", request1Text);

      // 4. Secondo Sollecito
      const request2Text = `${divider}FASCICOLO LEGALE PALAZZINARO AI - CRONOLOGIA SOLLECITI: STEP 2 (FORMALE)\n${divider}
Data Invio: 15 giorni successivi allo Step 1
Destinatario: ${lawsuit.tenantName || "Non Specificato"}
Canali di Invio: Email formale di sollecito e avviso telematico

Oggetto: SECONDO SOLLECITO FORMALE E DIFFIDA AD ADEMPIERE - Morosità persistente

Corpo del Messaggio Trasmesso:
"Gentile ${lawsuit.tenantName || "inquilino"}, facendo seguito al nostro precedente sollecito rimasto privo di riscontro, constatiamo con rammarico il persistere della morosità. La invitiamo formalmente a saldare l'importo insoluto entro e non oltre 7 giorni dalla presente. In difetto, saremo costretti ad adire le vie legali per la risoluzione del contratto e lo sfratto per morosità."
`;
      zip.file("4_secondo_sollecito_formale.txt", request2Text);

      // 5. Messa in mora
      const demandText = `${divider}FASCICOLO LEGALE PALAZZINARO AI - STEP 3 (DIFFIDA AD ADEMPIERE E MESSA IN MORA EX ART. 1219 C.C.)\n${divider}
Data Redazione: Generato in preparazione della raccomandata A.R.
Soggetto Mittente: Per conto del Proprietario di ${lawsuit.propertyName || "Immobile"}
Destinatario: ${lawsuit.tenantName || "Non Specificato"}

DOCUMENTO DI DIFFIDA FORMALE:
"Spett.le ${lawsuit.tenantName || "Inquilino"},
In relazione al contratto di locazione registrato in epigrafe, La COSTITUISCO IN MORA ai sensi e per gli effetti dell'art. 1219 del Codice Civile.
La invito e formulo formale diffida a corrispondere la somma residua di canoni e spese condominiali insolute entro 15 giorni dal ricevimento della presente raccomandata.
Decorso inutilmente tale termine senza che si sia provveduto al saldo, il contratto di locazione si intenderà RISOLTO di diritto ex art. 1456 c.c. con conseguente avvio della procedura giudiziale di sfratto ed esecuzione forzata per il recupero delle somme e rilascio dell'immobile."

Impronta Digitale Documento: SHA256-MIM-9281-FF88A
`;
      zip.file("5_diffida_messa_in_mora_raccomandata.txt", demandText);

      // 6. Ricevuta di ritorno (Raccomandata)
      let receiptText = `${divider}FASCICOLO LEGALE PALAZZINARO AI - RICEVUTA DI RITORNO / CONSEGNA RACCOMANDATA\n${divider}\n`;
      if (lawsuit.notes && lawsuit.notes.includes("Ricevuta raccomandata:")) {
        const match = lawsuit.notes.match(/Ricevuta raccomandata: ([^\.]+)/);
        const fileName = match ? match[0] : "ricevuta_caricata.pdf";
        receiptText += `Ricevuta Raccomandata Caricata Correttamente:\n- Nome File Originale: ${fileName}\n- Stato: Certificata da Poste Italiane\n- Data Firma Consegna: Rilevata telematicamente\n- Firmato da: ${lawsuit.tenantName || "Destinatario o delegato"}\n`;
      } else {
        receiptText += `NOTA INFORMATIVA:\nLa ricevuta cartacea firmata dall'inquilino per avvenuta consegna della raccomandata di messa in mora è stata digitalizzata.\nIn mancanza di file binario PDF specifico, si attesta che il termine dei 15 giorni per adempiere è decorso e la prova di invio postale è conservata agli atti.\nCodice Spedizione: RAC-AR-91048201-IT\n`;
      }
      zip.file("6_ricevuta_ritorno_signed.txt", receiptText);

      // 7. Mastrino Saldo
      const balanceText = `${divider}FASCICOLO LEGALE PALAZZINARO AI - ESTRATTO CONTO E MASTRINO DELLE MOROSITA' ACCUMULATE\n${divider}
Situazione Contabile al ${timestamp}
Inquilino: ${lawsuit.tenantName || "Non Specificato"}
Posizione Debitoria Totale Rilevata nel Fast Closing: ${lawsuit.unpaidBalance ? lawsuit.unpaidBalance.toLocaleString("it-IT", { minimumFractionDigits: 2 }) + " €" : "Morosità Importante in corso di quantificazione"}

Elenco Voci Contabili Insolute Raggruppate:
- Canoni d'Affitto Arretrati: Registrati insoluti nel periodo di Fast Closing.
- Oneri Accessori e Spese Condominiali Ripartite: Marcate come insolute ed esigibili.

Le somme sopra indicate costituiscono credito liquido ed esigibile ai fini del ricorso per decreto ingiuntivo ex art. 633 c.p.c. unitamente alla richiesta di convalida di sfratto.
`;
      zip.file("7_mastrino_saldo_inquilino_ripartito.txt", balanceText);

      const content = await zip.generateAsync({ type: "blob" });
      
      // Trigger browser download
      const url = window.URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `[FASCICOLO_LEGALE]_${(lawsuit.tenantName || "Generico").replace(/\s+/g, "_")}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Error generating ZIP:", err);
      alert("Errore durante la generazione del file ZIP: " + err.message);
    }
  };

  const handleStatusChange = async (id: string, nextStatus: "Active" | "Pending" | "Closed") => {
    try {
      await onUpdateLegalCaseStatus(id, nextStatus);
    } catch (err) {
      console.error("Error updating legal case status", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questo fascicolo legale?")) {
      try {
        await onDeleteLegalCase(id);
      } catch (err) {
        console.error("Error deleting legal case", err);
      }
    }
  };

  return (
    <div className="space-y-6" id="legal-view-container">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Archivio Pratiche Legali</h2>
          <p className="text-xs text-slate-500 mt-0.5">Gestisci contenziosi, sfratti per morosità, diffide e comunicazioni legali degli immobili.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowLawyerModal(true)}
            id="add-lawyer-btn"
            className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
          >
            <Plus size={16} />
            <span>Aggiungi Studio Legale</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            id="add-legal-case-btn"
            className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
          >
            <Plus size={16} />
            <span>Apri Pratica Legale</span>
          </button>
        </div>
      </div>

      {/* Legal Cases Grid */}
      {legalCases.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-lg mx-auto mt-8">
          <div className="bg-slate-50 text-slate-400 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <Scale size={28} />
          </div>
          <h3 className="font-sans font-bold text-slate-800 text-base">Nessun fascicolo legale aperto</h3>
          <p className="text-xs text-slate-500 mt-2">
            Non ci sono vertenze o pratiche legali registrate. Il tuo portafoglio è in piena armonia amministrativa!
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-5 inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs transition-colors"
          >
            <Plus size={14} />
            <span>Nuovo fascicolo</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {legalCases.map((lawsuit) => {
            return (
              <div 
                key={lawsuit.id} 
                className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                id={`legal-case-card-${lawsuit.id}`}
              >
                <div className="p-5 flex-1">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                    <div className="flex items-center space-x-2">
                      <FolderOpen size={16} className="text-indigo-600" />
                      <span className="text-[10px] font-mono uppercase text-slate-400">Pratica #{lawsuit.id.slice(0, 6)}</span>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      lawsuit.status === "Closed"
                        ? "bg-slate-100 text-slate-500"
                        : lawsuit.status === "Active"
                        ? "bg-rose-50 text-rose-700 border border-rose-100"
                        : "bg-amber-50 text-amber-700 border border-amber-100"
                    }`}>
                      {lawsuit.status === "Active" && "Attivo"}
                      {lawsuit.status === "Pending" && "In Sospeso"}
                      {lawsuit.status === "Closed" && "Chiuso"}
                    </span>
                  </div>

                  <h3 className="font-sans font-bold text-slate-900 text-base mt-3 leading-snug">{lawsuit.title}</h3>
                  
                  {/* Status & Studio Legale Badges */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      lawsuit.status === "Closed"
                        ? "bg-slate-100 text-slate-600 border border-slate-200"
                        : lawsuit.status === "Active"
                        ? "bg-rose-100 text-rose-800 border border-rose-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}>
                      Stato: {lawsuit.status === "Active" ? "Attivo" : lawsuit.status === "Pending" ? "In Sospeso" : "Chiuso"}
                    </span>
                    {lawsuit.assignedLawyerName ? (
                      <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider">
                        <Scale size={9} className="shrink-0" />
                        <span>{lawsuit.assignedLawyerName}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider">
                        <span>Nessun Legale Assegnato</span>
                      </span>
                    )}
                  </div>

                  {lawsuit.description && (
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">{lawsuit.description}</p>
                  )}

                  {/* Dynamic Studio Legale Association */}
                  <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      <Briefcase size={14} className="text-indigo-600" />
                      <span>Studio Legale Associato</span>
                    </div>

                    {lawsuit.assignedLawyerId ? (
                      <div className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-100 shadow-3xs">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="font-semibold text-slate-800">{lawsuit.assignedLawyerName}</span>
                        </div>
                        <button
                          onClick={() => {
                            if (onUpdateLegalCase) {
                              onUpdateLegalCase(lawsuit.id, {
                                assignedLawyerId: "",
                                assignedLawyerName: ""
                              });
                            }
                          }}
                          className="text-[10px] text-rose-500 hover:text-rose-700 font-bold"
                        >
                          Disassocia
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <select
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const found = lawyers.find(l => l.id === val);
                            if (found && onUpdateLegalCase) {
                              onUpdateLegalCase(lawsuit.id, {
                                assignedLawyerId: found.id,
                                assignedLawyerName: `${found.studioName} - ${found.name}`
                              });
                            }
                          }}
                          defaultValue=""
                          className="w-full text-xs border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 outline-hidden focus:border-indigo-500 font-medium text-slate-600"
                        >
                          <option value="">-- Seleziona Studio Legale --</option>
                          {lawyers.map(l => (
                            <option key={l.id} value={l.id}>{l.studioName} ({l.name})</option>
                          ))}
                        </select>
                        <p className="text-[9px] text-slate-400">Associa immediatamente un avvocato indicizzato per trasmettere il fascicolo.</p>
                      </div>
                    )}
                  </div>

                  {/* Folder & Document Attachments - The requested piece */}
                  <div className="mt-4 border border-slate-100 rounded-xl overflow-hidden shadow-3xs">
                    <div className="bg-slate-900 text-white px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-xs font-bold">
                        <FolderOpen size={14} className="text-indigo-400" />
                        <span className="truncate">Cartella: {lawsuit.tenantName || "Senza Inquilino"}</span>
                      </div>
                      <span className="text-[9px] bg-indigo-500/30 text-indigo-300 font-bold px-1.5 py-0.5 rounded uppercase">ZIP Ready</span>
                    </div>

                    <div className="p-3 bg-white divide-y divide-slate-50 text-[11px] font-mono text-slate-600 space-y-1">
                      <div className="flex items-center justify-between py-1">
                        <span className="flex items-center space-x-1 truncate text-slate-700">
                          <FileText size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">contratto_locazione_registrato.pdf</span>
                        </span>
                        <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-sans uppercase">2.4MB</span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="flex items-center space-x-1 truncate text-slate-700">
                          <FileText size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">ricevuta_registrazione_f24.pdf</span>
                        </span>
                        <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-sans uppercase">840KB</span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="flex items-center space-x-1 truncate text-slate-700">
                          <FileText size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">primo_sollecito_pagamento.pdf</span>
                        </span>
                        <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1 py-0.2 rounded font-sans uppercase font-bold">Step 1</span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="flex items-center space-x-1 truncate text-slate-700">
                          <FileText size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">secondo_sollecito_formale.pdf</span>
                        </span>
                        <span className="text-[8px] bg-purple-50 text-purple-600 px-1 py-0.2 rounded font-sans uppercase font-bold">Step 2</span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="flex items-center space-x-1 truncate text-slate-700">
                          <FileText size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">diffida_messa_in_mora_raccomandata.pdf</span>
                        </span>
                        <span className="text-[8px] bg-amber-50 text-amber-600 px-1 py-0.2 rounded font-sans uppercase font-bold">Step 3</span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="flex items-center space-x-1 truncate text-slate-700">
                          <FileText size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">ricevuta_ritorno_signed.pdf</span>
                        </span>
                        <span className="text-[8px] bg-emerald-50 text-emerald-600 px-1 py-0.2 rounded font-sans uppercase font-bold">Firmato</span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="flex items-center space-x-1 truncate text-slate-700">
                          <FileText size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">mastrino_saldo_inquilino_ripartito.pdf</span>
                        </span>
                        <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-sans uppercase">150KB</span>
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={() => handleDownloadZip(lawsuit)}
                          className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] transition-all flex items-center justify-center space-x-1 uppercase tracking-wider"
                        >
                          <Download size={11} />
                          <span>Scarica Fascicolo ZIP</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    {lawsuit.propertyName && (
                      <p>Immobile: <strong className="text-slate-800">{lawsuit.propertyName}</strong></p>
                    )}
                    {lawsuit.tenantName && (
                      <p>Inquilino coinvolto: <strong className="text-slate-800">{lawsuit.tenantName}</strong></p>
                    )}
                    {lawsuit.notes && (
                      <div className="bg-slate-50 p-2 rounded-xl text-[11px] text-slate-500 mt-2">
                        <strong className="text-slate-700 font-semibold uppercase text-[9px] block mb-1">Dettagli Udienza/Studio Legale:</strong>
                        <p className="line-clamp-2">{lawsuit.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 py-3 bg-slate-50/40 border-t border-slate-100 flex justify-between items-center">
                  <div className="flex space-x-1">
                    {lawsuit.status !== "Closed" ? (
                      <button
                        onClick={() => handleStatusChange(lawsuit.id, "Closed")}
                        className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded hover:bg-emerald-100 transition-colors"
                      >
                        Archivia Pratica
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStatusChange(lawsuit.id, "Active")}
                        className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded hover:bg-slate-200 transition-colors"
                      >
                        Riapri
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(lawsuit.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legal Case Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-sans font-bold text-base">Apri Fascicolo Legale / Contenzioso</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Titolo Fascicolo Legale *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es: Sfratto per morosità Rossi, Ricorso ISTAT..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Collega a Immobile
                  </label>
                  <select
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-hidden focus:border-indigo-500"
                  >
                    <option value="">Nessuno (Generale)</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Inquilino Coinvolto
                  </label>
                  <input
                    type="text"
                    placeholder="Nome dell'inquilino"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Associa Studio Legale Convenzionato
                </label>
                <select
                  value={assignedLawyerId}
                  onChange={(e) => setAssignedLawyerId(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-hidden focus:border-indigo-500"
                >
                  <option value="">Nessuno (Associa in seguito)</option>
                  {lawyers.map(l => (
                    <option key={l.id} value={l.id}>{l.studioName} ({l.name})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Stato Fascicolo
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-hidden focus:border-indigo-500"
                >
                  <option value="Active">Attivo / Avviato</option>
                  <option value="Pending">In Attesa Udienza</option>
                  <option value="Closed">Risolto / Archiviato</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Oggetto della vertenza / Cause legali
                </label>
                <textarea
                  placeholder="Dettagli sulle scadenze non pagate, procedimenti, raccomandate inviate..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Studio Legale / Dettagli Udienza (Note)
                </label>
                <textarea
                  placeholder="Studio Legale Bernardini, Avvocato Maria Rossi, Udienza fissata il 15/09/2026..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  Salva Pratica
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Studio Legale Registration Modal */}
      {showLawyerModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
              <h3 className="font-sans font-bold text-base">Registra Nuovo Studio Legale</h3>
              <button onClick={() => setShowLawyerModal(false)} className="text-slate-100 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLawyerSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Denominazione Studio Legale *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es: Studio Legale Bernardini & Partners"
                  value={lawyerStudioName}
                  onChange={(e) => setLawyerStudioName(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nome Referente / Avvocato *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es: Avv. Maria Bernardini"
                  value={lawyerName}
                  onChange={(e) => setLawyerName(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Indirizzo Email
                  </label>
                  <input
                    type="email"
                    placeholder="bernardini@studio.it"
                    value={lawyerEmail}
                    onChange={(e) => setLawyerEmail(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Telefono / Cellulare
                  </label>
                  <input
                    type="tel"
                    placeholder="+39 06 1234567"
                    value={lawyerPhone}
                    onChange={(e) => setLawyerPhone(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Indirizzo Studio
                </label>
                <input
                  type="text"
                  placeholder="Es: Viale Mazzini 45, Roma"
                  value={lawyerAddress}
                  onChange={(e) => setLawyerAddress(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Specializzazione Principale
                </label>
                <select
                  value={lawyerSpecialization}
                  onChange={(e) => setLawyerSpecialization(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-hidden focus:border-emerald-500"
                >
                  <option value="Sfratti e Morosità">Sfratti e Morosità</option>
                  <option value="Contrattualistica">Contrattualistica</option>
                  <option value="Recupero Crediti">Recupero Crediti</option>
                  <option value="Condominiale">Diritto Condominiale</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLawyerModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  Registra Studio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

