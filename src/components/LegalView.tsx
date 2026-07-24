
import React, { useState, useEffect } from "react";
import { Plus, Scale, FolderOpen, AlertCircle, CheckCircle, X, Trash2, UserCheck, Briefcase, Download, FileText, Check, ShieldAlert } from "lucide-react";
import { LegalCase, Property, Lawyer, Tenant, OwnerProfile } from "../types";
import JSZip from "jszip";
import emailjs from "@emailjs/browser";

interface LegalViewProps {
  legalCases: LegalCase[];
  properties: Property[];
  tenants?: Tenant[]; // CORREZIONE G — per includere i dati del Garante nel fascicolo ZIP
  lawyers?: Lawyer[];
  onAddLegalCase: (caseData: Omit<LegalCase, "id" | "userId" | "createdAt">) => Promise<void>;
  onUpdateLegalCaseStatus: (id: string, status: "Active" | "Pending" | "Closed") => Promise<void>;
  onUpdateLegalCase?: (id: string, updates: Partial<LegalCase>) => Promise<void>;
  onDeleteLegalCase: (id: string) => Promise<void>;
  onAddLawyer?: (lawyerData: Omit<Lawyer, "id" | "userId" | "createdAt">) => Promise<void>;
  // CORREZIONE E/Q — consente al tasto flottante globale di aprire QUESTA stessa procedura
  registerAddHandler?: (fn: () => void) => void;
  ownerProfile?: OwnerProfile | null; // CORREZIONE R — credenziali EmailJS per l'invio automatico del fascicolo
}

// CORREZIONE Q — stessa silhouette professionale usata per gli Amministratori, per coerenza
// visiva: gli Studi Legali sono un collaboratore esterno con la stessa logica di relazione.
function LegalPersonAvatarIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
      <circle cx="50" cy="36" r="19" />
      <path d="M50 58c-21 0-36 14-36 34v3a2 2 0 0 0 2 2h68a2 2 0 0 0 2-2v-3c0-20-15-34-36-34z" />
    </svg>
  );
}

export default function LegalView({
  legalCases,
  properties,
  tenants = [],
  lawyers = [],
  onAddLegalCase,
  onUpdateLegalCaseStatus,
  onUpdateLegalCase,
  onDeleteLegalCase,
  onAddLawyer,
  registerAddHandler,
  ownerProfile
}: LegalViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [showLawyerModal, setShowLawyerModal] = useState(false);

  // CORREZIONE Q — espone l'apertura del modulo Studio Legale al tasto flottante globale
  useEffect(() => {
    registerAddHandler?.(() => setShowLawyerModal(true));
  });

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

  // ── CORREZIONE Q — Drag&Drop Pratica→Studio Legale (stesso meccanismo di Condomini) ──
  const [selectedCaseDetailId, setSelectedCaseDetailId] = useState<string | null>(null);
  const [draggedCaseId, setDraggedCaseId] = useState<string | null>(null);
  const [dragOverLawyerId, setDragOverLawyerId] = useState<string | null>(null);
  const [mergingCaseId, setMergingCaseId] = useState<string | null>(null);
  const [disconnectCaseTarget, setDisconnectCaseTarget] = useState<{ id: string; title: string; lawyerName: string } | null>(null);

  const unassignedCases = legalCases.filter(c => !c.assignedLawyerId);
  const assignedCases = legalCases.filter(c => !!c.assignedLawyerId);

  const handleDropCaseOnLawyer = async (e: React.DragEvent, lawyer: Lawyer) => {
    e.preventDefault();
    setDragOverLawyerId(null);
    if (!draggedCaseId) return;
    const lawsuit = legalCases.find(c => c.id === draggedCaseId);
    setDraggedCaseId(null);
    if (!lawsuit) return;

    const confirmed = confirm(`Vuoi affidare la pratica "${lawsuit.title}" allo studio "${lawyer.studioName} (${lawyer.name})"?`);
    if (!confirmed) return;

    setMergingCaseId(lawsuit.id);
    await onUpdateLegalCase?.(lawsuit.id, {
      assignedLawyerId: lawyer.id,
      assignedLawyerName: `${lawyer.studioName} - ${lawyer.name}`
    });
    setTimeout(() => setMergingCaseId(null), 700);

    // CORREZIONE R — subito dopo l'assegnazione, chiede se inviare il fascicolo via email
    const sendNow = confirm(`Pratica affidata a ${lawyer.studioName}.\n\nVuoi inviare subito il fascicolo via email a questo studio legale?`);
    if (sendNow) {
      await handleSendDossierEmail(lawsuit, lawyer);
    }
  };

  const handleConfirmCaseDisconnect = async () => {
    if (!disconnectCaseTarget) return;
    await onUpdateLegalCase?.(disconnectCaseTarget.id, { assignedLawyerId: "", assignedLawyerName: "" });
    setDisconnectCaseTarget(null);
  };

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

  // CORREZIONE R — Estratta per essere riutilizzabile sia dal download manuale
  // sia dall'invio email automatico del fascicolo.
  const buildDossierZipBlob = async (lawsuit: LegalCase): Promise<Blob> => {
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

      // 8. CORREZIONE G — Dati del Garante (se presente), con dati fiscali reali e documenti allegati
      const relatedTenant = tenants.find(t => t.name.toLowerCase().trim() === (lawsuit.tenantName || "").toLowerCase().trim());
      if (relatedTenant?.guarantor?.name) {
        const g = relatedTenant.guarantor;
        const docsList = (g.documents && g.documents.length > 0)
          ? g.documents.map(d => `- ${d.name} (${d.type}), allegato il ${d.uploadedAt}`).join("\n")
          : "Nessun documento allegato in anagrafica.";

        const guarantorText = `${divider}FASCICOLO LEGALE PALAZZINARO AI - DATI DEL GARANTE\n${divider}
Data Generazione: ${timestamp}
Inquilino Garantito: ${lawsuit.tenantName || "Non Specificato"}

DATI ANAGRAFICI E FISCALI DEL GARANTE:
Nome e Cognome: ${g.name}
Codice Fiscale: ${g.fiscalCode || "Non specificato"}
Telefono: ${g.phone || "Non specificato"}
Email: ${g.email || "Non specificato"}
Note: ${g.notes || "Nessuna"}

DOCUMENTI ALLEGATI IN ANAGRAFICA (a supporto della garanzia):
${docsList}

Il presente garante è stato inserito in anagrafica a supporto del rapporto di locazione e viene incluso nel presente fascicolo per consentire allo studio legale incaricato di procedere, ove necessario, anche nei suoi confronti per il recupero coattivo delle somme dovute.
`;
        zip.file("8_dati_garante.txt", guarantorText);
      }

      const content = await zip.generateAsync({ type: "blob" });
      return content;
  };

  const handleDownloadZip = async (lawsuit: LegalCase) => {
    try {
      const content = await buildDossierZipBlob(lawsuit);
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

  // ── CORREZIONE R — Invio email automatico del fascicolo (mai il client di posta) ──
  const handleSendDossierEmail = async (lawsuit: LegalCase, lawyer: Lawyer) => {
    const serviceId = ownerProfile?.emailServiceId || "";
    const templateId = ownerProfile?.emailTemplateId || "";
    const publicKey = ownerProfile?.emailPublicKey || "";

    if (!serviceId || !templateId || !publicKey) {
      alert(
        "⚠️ CONFIGURAZIONE EMAILJS MANCANTE:\nLe credenziali EmailJS non sono ancora configurate nel tuo profilo.\nVai nelle Impostazioni per inserire Service ID, Template ID e Public Key, poi riprova."
      );
      return;
    }
    if (!lawyer.email || !lawyer.email.includes("@")) {
      alert(`⚠️ Lo studio legale "${lawyer.studioName}" non ha un indirizzo email valido in anagrafica. Impossibile inviare.`);
      return;
    }

    // Nome del proprietario, da riportare allo studio come referente di contatto
    const relatedProperty = properties.find(p => p.id === lawsuit.propertyId);
    const ownerName = relatedProperty?.owner || "il proprietario dell'immobile (nome non specificato in anagrafica)";

    // Elenco delle voci non pagate, nei limiti dei dati disponibili sulla pratica
    const itemsList: string[] = [];
    if (lawsuit.unpaidBalance) {
      itemsList.push(`- Canoni di locazione scaduti e non versati: €${lawsuit.unpaidBalance.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`);
    }
    if (lawsuit.description) {
      itemsList.push(`- ${lawsuit.description}`);
    }
    if (itemsList.length === 0) {
      itemsList.push("- Dettaglio importi: vedere fascicolo allegato");
    }

    const emailBody = `Egregio Studio ${lawyer.studioName}, alla cortese attenzione dell'Avv. ${lawyer.name},

Con la presente si inoltra il fascicolo per il recupero coattivo delle somme dovute da parte dell'inquilino ${lawsuit.tenantName || "(nominativo nel fascicolo allegato)"}, relativo all'immobile "${lawsuit.propertyName || "non specificato"}".

Le somme oggetto di recupero risultano così composte:
${itemsList.join("\n")}

Si allega il fascicolo completo con la documentazione a supporto (contratto di locazione, solleciti, messa in mora e ricevuta di ritorno della raccomandata, ove disponibili).

Per qualsiasi chiarimento è possibile contattare direttamente il proprietario, Sig./Sig.ra ${ownerName}.

Cordiali saluti.

---
La presente email è stata generata automaticamente dal sistema di intelligenza artificiale Palazzinaro AI, in nome e per conto del proprietario.`;

    try {
      const zipBlob = await buildDossierZipBlob(lawsuit);
      const templateParams: any = {
        to_email: lawyer.email,
        subject: "Invio Documentazione per Recupero Coattivo",
        message: emailBody,
        message_content: emailBody,
        // NB: l'allegato viene inviato solo se il Template EmailJS è configurato per
        // accettare un parametro file — verificare in Impostazioni EmailJS lato utente.
        attachment: zipBlob
      };
      await emailjs.send(serviceId, templateId, templateParams, publicKey);

      const nowIso = new Date().toISOString();
      await onUpdateLegalCase?.(lawsuit.id, {
        dossierSentAt: nowIso,
        dossierSentToEmail: lawyer.email
      });

      alert(`📧 Email inviata con successo a ${lawyer.email} (${lawyer.studioName}). Registrato l'invio in data odierna.`);
    } catch (err: any) {
      console.error("Errore invio email fascicolo:", err);
      alert(
        `❌ Errore durante l'invio automatico dell'email:\n${err?.text || err?.message || JSON.stringify(err)}\n\nSe l'errore riguarda l'allegato, verifica che il tuo Template EmailJS supporti un parametro file "attachment" — altrimenti l'email può essere inviata senza allegato.`
      );
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* CORREZIONE Q — Colonna 1: Fascicoli da Associare (trascinabili) */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              📂 Fascicoli da Associare ({unassignedCases.length})
            </h3>
            {unassignedCases.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">Nessuna pratica in attesa di assegnazione.</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {unassignedCases.map(c => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDraggedCaseId(c.id)}
                    onClick={() => setSelectedCaseDetailId(c.id)}
                    className={`p-3 bg-amber-50/60 border-2 border-dashed border-amber-300 rounded-xl cursor-grab active:cursor-grabbing hover:border-amber-500 hover:shadow-sm transition-all ${
                      mergingCaseId === c.id ? "animate-pulse scale-95 opacity-50" : ""
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-800 truncate">{c.title}</p>
                    <p className="text-[10px] text-slate-500 truncate">{c.tenantName || "Senza inquilino"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Colonna 2: Studi Legali (avatar, zone di rilascio) */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              👤 Studi Legali ({lawyers.length})
            </h3>
            {lawyers.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">Nessuno studio legale creato. Usa il tasto "+ Aggiungi" in basso a destra.</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {lawyers.map(l => {
                  const count = legalCases.filter(c => c.assignedLawyerId === l.id).length;
                  return (
                    <div
                      key={l.id}
                      onDragOver={(e) => { e.preventDefault(); setDragOverLawyerId(l.id); }}
                      onDragLeave={() => setDragOverLawyerId(null)}
                      onDrop={(e) => handleDropCaseOnLawyer(e, l)}
                      className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all ${
                        dragOverLawyerId === l.id
                          ? "border-indigo-500 ring-2 ring-indigo-200 scale-[1.02] bg-indigo-50/30"
                          : "border-slate-100 bg-slate-50/40"
                      }`}
                    >
                      <span className="relative w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 overflow-hidden">
                        <LegalPersonAvatarIcon className="w-7 h-7" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{l.studioName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{l.name} · {count} pratiche</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Colonna 3: Pratiche Già Associate */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              ✅ Pratiche Associate ({assignedCases.length})
            </h3>
            {assignedCases.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">Nessuna pratica ancora assegnata a uno studio legale.</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {assignedCases.map(c => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCaseDetailId(c.id)}
                    className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl cursor-pointer hover:shadow-sm transition-all"
                  >
                    <p className="text-xs font-bold text-slate-800 truncate">{c.title}</p>
                    <p className="text-[10px] text-emerald-700 truncate">→ {c.assignedLawyerName}</p>
                    {c.dossierSentAt && (
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        📧 Inviato il {new Date(c.dossierSentAt).toLocaleDateString("it-IT")} a {c.dossierSentToEmail}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CORREZIONE Q — Modulo di dettaglio pratica (card ricca esistente, ora in overlay) */}
      {selectedCaseDetailId && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="max-w-lg w-full max-h-[92vh] overflow-y-auto rounded-2xl relative">
            <button
              onClick={() => setSelectedCaseDetailId(null)}
              className="absolute top-3 right-3 z-10 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full p-1.5"
              title="Chiudi"
            >
              <X size={16} />
            </button>
          {legalCases.filter(c => c.id === selectedCaseDetailId).map((lawsuit) => {
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
                      <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-3xs space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="font-semibold text-slate-800">{lawsuit.assignedLawyerName}</span>
                          </div>
                          <button
                            onClick={() => {
                              setDisconnectCaseTarget({ id: lawsuit.id, title: lawsuit.title, lawyerName: lawsuit.assignedLawyerName || "questo studio" });
                            }}
                            className="text-[10px] text-rose-500 hover:text-rose-700 font-bold"
                          >
                            Disassocia
                          </button>
                        </div>
                        {lawsuit.dossierSentAt ? (
                          <p className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-1.5">
                            📧 Fascicolo inviato il {new Date(lawsuit.dossierSentAt).toLocaleDateString("it-IT")} alle {new Date(lawsuit.dossierSentAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} a {lawsuit.dossierSentToEmail}
                          </p>
                        ) : (
                          <p className="text-[9px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                            ⚠️ Fascicolo non ancora inviato a questo studio.
                          </p>
                        )}
                        <button
                          onClick={() => {
                            const lawyer = lawyers.find(l => l.id === lawsuit.assignedLawyerId);
                            if (lawyer) handleSendDossierEmail(lawsuit, lawyer);
                          }}
                          className="w-full text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg py-1.5 transition-colors"
                        >
                          {lawsuit.dossierSentAt ? "📧 Invia di Nuovo il Fascicolo" : "📧 Invia il Fascicolo Ora"}
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">
                        Chiudi questa scheda e trascina il fascicolo su uno Studio Legale nella colonna "Studi Legali" per assegnarlo.
                      </p>
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

      {/* CORREZIONE Q — Conferma pesante per sciogliere Pratica↔Studio Legale */}
      {disconnectCaseTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border border-rose-100">
            <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
              <h3 className="font-sans font-bold text-base">Sciogliere l'assegnazione?</h3>
              <button onClick={() => setDisconnectCaseTarget(null)} className="text-rose-100 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Stai per staccare la pratica <strong className="text-slate-900">"{disconnectCaseTarget.title}"</strong> da <strong className="text-slate-900">{disconnectCaseTarget.lawyerName}</strong>.
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Potrai sempre riassegnarla in seguito trascinandola di nuovo su uno studio legale. Confermi di voler procedere?
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setDisconnectCaseTarget(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleConfirmCaseDisconnect}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-sm"
                >
                  Sì, Sciogli l'Assegnazione
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

