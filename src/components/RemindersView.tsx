
import React, { useState, useEffect } from "react";
import { 
  Plus, 
  AlertTriangle, 
  Send, 
  Copy, 
  Clipboard, 
  Check, 
  X, 
  Sparkles, 
  User, 
  AlertCircle, 
  Upload, 
  Landmark, 
  FileText, 
  Scale,
  Camera,
  Image as ImageIcon
} from "lucide-react";
import JSZip from "jszip";
import { Reminder, Tenant, BankMovement, FastClosingItem, Communication, OwnerProfile } from "../types";
import { generateMessaInMoraPDF } from "../lib/pdfHelper";
import emailjs from "@emailjs/browser";

interface RemindersViewProps {
  reminders: Reminder[];
  tenants: Tenant[];
  movements: BankMovement[];
  fastClosing: FastClosingItem[];
  properties?: any[];
  communications?: Communication[];
  ownerProfile?: OwnerProfile | null;
  onAddReminder: (reminder: Omit<Reminder, "id" | "userId" | "createdAt">) => Promise<void>;
  onUpdateReminderStatus: (id: string, status: string, notes?: string, extraFields?: any) => Promise<void>;
  onReconcileMovement: (movementId: string, closingItemId: string) => Promise<void>;
  onAddLegalCase: (legalCase: any) => Promise<void>;
  onDeleteReminder: (id: string) => Promise<void>;
  onAddMovement?: (movement: Omit<BankMovement, "id" | "userId" | "createdAt">) => Promise<void>;
}

export default function RemindersView({
  reminders,
  tenants,
  movements,
  fastClosing,
  properties,
  communications,
  ownerProfile,
  onAddReminder,
  onUpdateReminderStatus,
  onReconcileMovement,
  onAddLegalCase,
  onDeleteReminder,
  onAddMovement
}: RemindersViewProps) {
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Statement Import PDF/Photo OCR states
  const [showImportModal, setShowImportModal] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [statementImages, setStatementImages] = useState<string[]>([]);
  const [extractedMovements, setExtractedMovements] = useState<Omit<BankMovement, "id" | "userId" | "reconciled" | "createdAt">[]>([]);
  const [stmtCameraActive, setStmtCameraActive] = useState(false);
  const stmtVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const stmtStreamRef = React.useRef<MediaStream | null>(null);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (stmtStreamRef.current) {
        stmtStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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

  const handleOpenImportModal = () => {
    setPasteText("");
    setImportError("");
    setExtractedMovements([]);
    setStatementImages([]);
    setShowImportModal(true);
  };

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
      if (onAddMovement) {
        for (const m of extractedMovements) {
          await onAddMovement({
            date: m.date,
            description: m.description,
            amount: m.amount,
            reconciled: false
          });
        }
      }
      setShowImportModal(false);
      alert("Movimenti caricati con successo in contabilità!");
    } catch (err) {
      console.error("Error saving extracted movements", err);
    }
  };

  // Reconciliation state
  const [reconcileReminder, setReconcileReminder] = useState<Reminder | null>(null);
  const [selectedMovementId, setSelectedMovementId] = useState("");

  // Multi-step additional charge sequence states
  const [activeStepReminder, setActiveStepReminder] = useState<Reminder | null>(null);
  const [showStepModal, setShowStepModal] = useState(false);
  const [wizardStep, setWizardStep] = useState<"first" | "second" | "third" | "fourth" | "zip">("first");
  const [simulatedFileName, setSimulatedFileName] = useState("");
  const [proofOfSendingFile, setProofOfSendingFile] = useState<string>("");
  const [receiptOfReturnFile, setReceiptOfReturnFile] = useState<string>("");
  const [legalCaseCreatedSuccessfully, setLegalCaseCreatedSuccessfully] = useState(false);

  const getDaysPassedSinceLastStep = (reminder: Reminder) => {
    const now = new Date();
    let baseDate: Date;
    if (reminder.step === 2 && reminder.firstRequestDate) {
      baseDate = new Date(reminder.firstRequestDate);
    } else if (reminder.step === 3 && reminder.secondRequestDate) {
      baseDate = new Date(reminder.secondRequestDate);
    } else if (reminder.step === 4 && reminder.thirdRequestDate) {
      baseDate = new Date(reminder.thirdRequestDate);
    } else {
      return 100; // default large number for step 1 or if no date is recorded
    }
    const diffTime = now.getTime() - baseDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleOpenStepWizard = (reminder: Reminder) => {
    const step = reminder.step || 1;
    const daysPassed = getDaysPassedSinceLastStep(reminder);
    if (step > 1 && daysPassed < 15) {
      alert(`BLOCCO TEMPORALE (Gating 15 Giorni): Non sono ancora trascorsi 15 giorni dall'azione precedente per questo sollecito. Giorni trascorsi: ${daysPassed}/15.\n\nPer legge, è necessario rispettare i termini procedurali di morosità.`);
      return;
    }

    setActiveStepReminder(reminder);
    if (step === 1) {
      setWizardStep("first");
    } else if (step === 2) {
      setWizardStep("second");
    } else if (step === 3) {
      setWizardStep("third");
    } else if (step === 4) {
      setWizardStep("fourth");
    } else {
      setWizardStep("zip");
    }
    setSimulatedFileName("");
    setProofOfSendingFile("");
    setReceiptOfReturnFile("");
    setLegalCaseCreatedSuccessfully(false);
    setShowStepModal(true);
  };

  const getAssociatedItemsForActiveReminder = () => {
    if (!activeStepReminder) return [];
    const itemIds = activeStepReminder.associatedItemsIds || [];
    if (itemIds.length === 0) {
      return [];
    }
    return (fastClosing || []).filter(item => itemIds.includes(item.id));
  };

  const dispatchCommunications = async (reminder: Reminder, stepLabel: string) => {
    const tenant = tenants.find(t => t.id === reminder.tenantId) || 
                   tenants.find(t => t.name.toLowerCase().trim() === reminder.tenantName.toLowerCase().trim());
    
    if (!tenant) {
      alert(`Errore: Inquilino "${reminder.tenantName}" non trovato nell'anagrafica del sistema.`);
      return false;
    }

    // 1. Compose the message text
    const associated = (fastClosing || []).filter(item => (reminder.associatedItemsIds || []).includes(item.id));
    const listText = associated.length > 0 
      ? associated.map(item => {
          const titleClean = item.title.split(" - ")[1] || item.title;
          return `- ${titleClean}: €${item.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;
        }).join("\n")
      : `- ${reminder.reason}: €${reminder.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;

    const total = reminder.amount;
    const footerText = "Messaggio inviato mediante procedura automatizzata del sistema, in nome e per conto del proprietario, con supporto dell'intelligenza artificiale.";
    const messageBody = `Gentile ${tenant.name},\n` +
      `Le inviamo questo ${stepLabel} in merito alla Sua posizione contabile.\n\n` +
      `Dettaglio delle scadenze insolute:\n` +
      `${listText}\n\n` +
      `Totale dovuto: €${total.toLocaleString("it-IT", { minimumFractionDigits: 2 })}\n\n` +
      `La preghiamo di provvedere al saldo al più presto tramite bonifico bancario.\n\n` +
      `${footerText}`;

    // 2. EMAIL (EmailJS) — credentials must be configured in Settings → Profilo Proprietario
    const serviceId = ownerProfile?.emailServiceId || "";
    const templateId = ownerProfile?.emailTemplateId || "";
    const publicKey = ownerProfile?.emailPublicKey || "";

    // CORREZIONE D — Se il contratto è cointestato (obbligazione solidale), il sollecito
    // deve raggiungere anche gli altri cointestatari, non solo l'intestatario principale.
    // Restano un unico debitore/conto: qui cambiano solo i destinatari dell'invio.
    const allRecipients = [
      { name: tenant.name, email: tenant.email, phone: tenant.phone },
      ...((tenant.coTenants || []).map(ct => ({ name: ct.name, email: ct.email, phone: ct.phone })))
    ];

    const sendEmailTo = async (recipientName: string, recipientEmail?: string) => {
      if (!serviceId || !templateId || !publicKey) {
        return; // avviso già mostrato una volta sotto, non ripeterlo per ogni destinatario
      }
      if (!recipientEmail || !recipientEmail.includes("@")) {
        alert(`⚠️ EMAIL ASSENTE:\n"${recipientName}" non ha un indirizzo email valido impostato in anagrafica. Invio email saltato per questo destinatario.`);
        return;
      }
      try {
        const templateParams = {
          to_email: recipientEmail,
          tenant_name: recipientName,
          subject: `${stepLabel} - Posizione Debitoria Contabile`,
          message: messageBody,
          message_content: messageBody,
          total_amount: `€${total.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`,
          items_list: listText
        };
        await emailjs.send(serviceId, templateId, templateParams, publicKey);
        alert(`📧 E-mail inviata con successo tramite EmailJS all'indirizzo: ${recipientEmail}`);
      } catch (err: any) {
        console.error("Errore EmailJS:", err);
        alert(`❌ Errore durante l'invio dell'e-mail a ${recipientName} tramite EmailJS:\n${err?.text || err?.message || JSON.stringify(err)}`);
      }
    };

    const openWhatsAppFor = (recipientName: string, recipientPhone?: string) => {
      if (!recipientPhone || !recipientPhone.trim()) {
        alert(`⚠️ TELEFONO ASSENTE:\n"${recipientName}" non ha un numero di telefono WhatsApp salvato in anagrafica.\nImpossibile inviare il messaggio tramite WhatsApp a questo destinatario.`);
        return;
      }
      const phoneClean = recipientPhone.replace(/[^0-9+]/g, "");
      const waUrl = `https://wa.me/${phoneClean}?text=${encodeURIComponent(messageBody)}`;
      window.open(waUrl, "_blank");
      alert(`💬 Apertura della chat di WhatsApp per ${recipientName} (${recipientPhone}) in corso in una nuova scheda... Premere "Invia" manualmente per spedire il testo precompilato.`);
    };

    if (!serviceId || !templateId || !publicKey) {
      alert("⚠️ CONFIGURAZIONE EMAILJS MANCANTE:\nLe credenziali EmailJS non sono ancora configurate nel tuo profilo.\nVai nelle Impostazioni per inserire Service ID, Template ID e Public Key.\n\nL'invio dell'e-mail reale è stato saltato, ma procederemo con l'apertura di WhatsApp.");
    } else {
      for (const recipient of allRecipients) {
        await sendEmailTo(recipient.name, recipient.email);
      }
    }

    // 3. WHATSAPP — un tab per ciascun destinatario (intestatario principale + cointestatari)
    for (const recipient of allRecipients) {
      openWhatsAppFor(recipient.name, recipient.phone);
    }

    return true;
  };

  const handleExecuteFirstStep = async () => {
    if (!activeStepReminder) return;
    const associated = getAssociatedItemsForActiveReminder();
    const listText = associated.map(item => `- ${item.title.split(" - ")[1] || item.title}: €${item.amount.toFixed(2)}`).join("\n");
    if (!confirm(`CONFERMA INVIO:\nSei sicuro di voler procedere con il PRIMO SOLLECITO per un totale di €${activeStepReminder.amount.toFixed(2)}?\n\nVerranno avviati l'invio e-mail reale via EmailJS e la messaggistica WhatsApp.`)) {
      return;
    }

    const success = await dispatchCommunications(activeStepReminder, "Primo Sollecito di Pagamento");
    if (!success) return;

    try {
      await onUpdateReminderStatus(activeStepReminder.id, "Sent", "Inviato primo sollecito addebito via WhatsApp ed Email reale.", {
        step: 2,
        firstRequestDate: new Date().toISOString().split("T")[0]
      });
      setShowStepModal(false);
      setActiveStepReminder(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExecuteSecondStep = async () => {
    if (!activeStepReminder) return;
    const associated = getAssociatedItemsForActiveReminder();
    const listText = associated.map(item => `- ${item.title.split(" - ")[1] || item.title}: €${item.amount.toFixed(2)}`).join("\n");
    if (!confirm(`CONFERMA INVIO:\nSei sicuro di voler procedere con il SECONDO SOLLECITO per un totale di €${activeStepReminder.amount.toFixed(2)}?\n\nVerranno avviati l'invio e-mail reale via EmailJS e la messaggistica WhatsApp.`)) {
      return;
    }

    const success = await dispatchCommunications(activeStepReminder, "Secondo Sollecito di Pagamento");
    if (!success) return;

    try {
      await onUpdateReminderStatus(activeStepReminder.id, "Sent", "Inviato secondo sollecito addebito via WhatsApp ed Email reale.", {
        step: 3,
        secondRequestDate: new Date().toISOString().split("T")[0]
      });
      setShowStepModal(false);
      setActiveStepReminder(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExecuteThirdStepPrint = () => {
    if (!activeStepReminder) return;
    generateMessaInMoraPDF(
      activeStepReminder.tenantName,
      activeStepReminder.amount,
      activeStepReminder.dueDate
    );
    alert("Lettera di Diffida e Messa in Mora generata in formato PDF e avviata alla stampa per spedizione cartacea Raccomandata A/R!");
  };

  const handleExecuteThirdStepMailOwners = () => {
    if (!activeStepReminder) return;
    alert(`Email formale inviata con successo ai comproprietari indicando che l'allegato è la diffida di pagamento ufficiale per l'inquilino ${activeStepReminder.tenantName}.`);
  };

  const handleUploadReceiptSimulated = async () => {
    if (!activeStepReminder || !proofOfSendingFile || !receiptOfReturnFile) return;
    const associated = getAssociatedItemsForActiveReminder();
    const listText = associated.map(item => `- ${item.title.split(" - ")[1] || item.title}: €${item.amount.toFixed(2)}`).join("\n");
    if (!confirm(`CONFERMA ARCHIVIAZIONE:\nSei sicuro di voler caricare la prova di invio ("${proofOfSendingFile}") e la ricevuta di ritorno ("${receiptOfReturnFile}") per generare la MESSA IN MORA di €${activeStepReminder.amount.toFixed(2)}?\n\nVoci di spesa raggruppate:\n${listText || 'Nessun dettaglio'}`)) {
      return;
    }

    try {
      await onUpdateReminderStatus(activeStepReminder.id, "MessaInMora", "Ricevuta di ritorno e prova di invio caricate con successo.", {
        step: 4,
        thirdRequestDate: new Date().toISOString().split("T")[0],
        proofOfSendingName: proofOfSendingFile.endsWith(".pdf") ? proofOfSendingFile : proofOfSendingFile + ".pdf",
        registeredLetterReceiptName: receiptOfReturnFile.endsWith(".pdf") ? receiptOfReturnFile : receiptOfReturnFile + ".pdf"
      });
      setWizardStep("fourth");
    } catch (e) {
      console.error(e);
    }
  };

  const handleMoveToLegalAction = async () => {
    if (!activeStepReminder) return;
    const associated = getAssociatedItemsForActiveReminder();
    const listText = associated.map(item => `- ${item.title.split(" - ")[1] || item.title}: €${item.amount.toFixed(2)}`).join("\n");
    if (!confirm(`CONFERMA PASSAGGIO ALL'AREA LEGALE:\nSei sicuro di voler chiudere la fase extra-giudiziale e passare il fascicolo completo all'Area Legale per un importo totale di €${activeStepReminder.amount.toFixed(2)}?\n\nVoci di spesa raggruppate:\n${listText || 'Nessun dettaglio'}`)) {
      return;
    }

    try {
      // Generate real ZIP file
      const zip = new JSZip();
      zip.file("riassunto_fascicolo.txt", `Fascicolo Digitale Morosità Grave\n\nInquilino: ${activeStepReminder.tenantName}\nCausale: ${activeStepReminder.reason}\nImporto: €${activeStepReminder.amount.toFixed(2)}\nScadenza: ${new Date(activeStepReminder.dueDate).toLocaleDateString("it-IT")}\nProva di Invio: ${activeStepReminder.proofOfSendingName || "prova_invio.pdf"}\nRicevuta Ritorno: ${activeStepReminder.registeredLetterReceiptName || "ricevuta_ritorno.pdf"}\n\nStato: Trasferito all'Avvocato per azione legale.`);
      
      const zipContent = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipContent);
      link.download = `Fascicolo_Legale_${activeStepReminder.tenantName.replace(/\s+/g, "_")}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Update status to mark as completely processed for Legal Action
      await onUpdateReminderStatus(activeStepReminder.id, "MessaInMora", "Fascicolo trasferito all'Ufficio Legale.", {
        step: 5 // step 5 hides the dashboard accounting lists!
      });

      // Automatically create the legal case
      if (onAddLegalCase) {
        const propName = properties?.find(p => p.id === activeStepReminder.propertyId)?.name || "Immobile Portafoglio";
        await onAddLegalCase({
          title: `Contenzioso Morosità Grave - Inquilino: ${activeStepReminder.tenantName}`,
          description: `Procedura coattiva avviata dopo 3 solleciti infruttuosi per insoluto accumulato di €${activeStepReminder.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}.`,
          tenantName: activeStepReminder.tenantName,
          propertyId: activeStepReminder.propertyId || "",
          propertyName: propName,
          contractId: activeStepReminder.contractId || "",
          unpaidBalance: activeStepReminder.amount,
          status: "Active",
          assignedLawyerId: "lawyer-1", // standard assigned lawyer
          assignedLawyerName: "Studio Legale Bovio & Partners",
          zipFileName: `Fascicolo_Legale_${activeStepReminder.tenantName.replace(/\s+/g, "_")}.zip`,
          filesToAssign: true,
          notes: `Cartella fascicolo creata in Area Legale con nome "${activeStepReminder.tenantName}". Allegati inseriti: Contratto di locazione registrato, Prova di invio, Ricevuta di ritorno firmata (${activeStepReminder.registeredLetterReceiptName || "ricevuta.pdf"}), Registro solleciti 1-2, F24 imposta di registro, Mastrino spese condominiali e canoni insoluti.`
        });
      }

      setLegalCaseCreatedSuccessfully(true);
      setTimeout(() => {
        setShowStepModal(false);
        setActiveStepReminder(null);
      }, 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAsSent = async (id: string) => {
    try {
      await onUpdateReminderStatus(id, "Sent", "Inviato tramite email/raccomandata in data odierna.");
    } catch (err) {
      console.error("Error marking reminder as sent", err);
    }
  };

  const handleUploadReceipt = async (reminder: Reminder, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileName = file.name;
      // Transition reminder to MessaInMora and save receipt name
      await onUpdateReminderStatus(reminder.id, "MessaInMora", "Ricevuta raccomandata caricata.", {
        registeredLetterReceiptName: fileName
      });

      // Automatically generate a new Legal Case dossier
      if (onAddLegalCase) {
        await onAddLegalCase({
          title: `Messa in mora - ${reminder.tenantName}`,
          description: `Morosità canone pari a €${reminder.amount.toFixed(2)} per la causale "${reminder.reason}". Pratica legale aperta automaticamente a seguito del caricamento della ricevuta della raccomandata.`,
          tenantName: reminder.tenantName,
          status: "Active",
          notes: `Ricevuta raccomandata: ${fileName}. Caricata in data ${new Date().toLocaleDateString("it-IT")}. Termine per adempiere avviato.`
        });
      }
    } catch (err) {
      console.error("Error uploading receipt and creating legal case:", err);
    }
  };

  const handleOpenReconcileReminder = (reminder: Reminder) => {
    setReconcileReminder(reminder);
    setSelectedMovementId("");
  };

  const handleConfirmReconciliation = async () => {
    if (!reconcileReminder || !selectedMovementId) return;

    try {
      // Find the associated Fast Closing item
      const linkedFastClosing = fastClosing.find(
        item => item.source === "reminder" && item.sourceId === reconcileReminder.id
      );

      if (linkedFastClosing) {
        await onReconcileMovement(selectedMovementId, linkedFastClosing.id);
        setReconcileReminder(null);
        setSelectedMovementId("");
      } else {
        // Fallback if no linked Fast Closing item exists (rare)
        await onUpdateReminderStatus(reconcileReminder.id, "Paid", "Saldato tramite abbinamento manuale.");
        setReconcileReminder(null);
        setSelectedMovementId("");
      }
    } catch (err) {
      console.error("Error reconciling reminder:", err);
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    try {
      await onUpdateReminderStatus(id, "Paid", "Inquilino ha saldato l'importo dovuto.");
    } catch (err) {
      console.error("Error marking reminder as paid", err);
    }
  };

  const handleCopyLetter = (text: string, id: string) => {
    const footer = "\n\nMessaggio inviato mediante procedura automatizzata del sistema, in nome e per conto del proprietario, con supporto dell'intelligenza artificiale.";
    navigator.clipboard.writeText(text + footer);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6" id="reminders-view-container">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Solleciti di Pagamento</h2>
          <p className="text-xs text-slate-500 mt-0.5">Gestisci canoni arretrati, invia avvisi formali e genera diffide di pagamento con l'AI.</p>
        </div>
        <div className="flex flex-wrap gap-3 self-start sm:self-auto">
          <button
            onClick={handleOpenImportModal}
            id="import-statement-solleciti-btn"
            className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 py-3.5 rounded-xl transition-all shadow-md active:shadow-xs"
          >
            <Upload size={14} />
            <span>Importa Estratto Conto (OCR AI)</span>
          </button>
        </div>
      </div>

      {/* Reminders Grid */}
      {reminders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-lg mx-auto mt-8">
          <div className="bg-slate-50 text-slate-400 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} />
          </div>
          <h3 className="font-sans font-bold text-slate-800 text-base">Nessun sollecito attivo</h3>
          <p className="text-xs text-slate-500 mt-2">
            Nessun sollecito attivo. I Solleciti vengono generati automaticamente alla chiusura del Fast Closing per le voci insolute.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {reminders.map((reminder) => {
            return (
              <div 
                key={reminder.id} 
                className="bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                id={`reminder-card-${reminder.id}`}
              >
                <div className="p-5 flex-1">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
                        <User size={15} />
                      </div>
                      <div>
                        <h4 className="font-sans font-bold text-slate-900 text-sm">{reminder.tenantName}</h4>
                        <span className="text-[10px] text-slate-400">Scaduto il: {new Date(reminder.dueDate).toLocaleDateString("it-IT")}</span>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      reminder.status === "Paid"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        : reminder.status === "MessaInMora"
                        ? "bg-rose-100 text-rose-850 border border-rose-200"
                        : reminder.status === "Sent"
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                        : "bg-amber-50 text-amber-700 border border-amber-100"
                    }`}>
                      {reminder.status === "Paid" && "Saldato"}
                      {reminder.status === "MessaInMora" && "Messa in Mora"}
                      {reminder.status === "Sent" && "Sollecitato"}
                      {reminder.status === "Pending" && "Bozza / Pronto"}
                    </span>
                  </div>

                  {/* Body Info */}
                  <div className="grid grid-cols-2 gap-4 mt-4 bg-slate-50/50 p-3 rounded-xl border border-slate-100/40 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">Causale debito</span>
                      <strong className="text-slate-800 font-semibold">{reminder.reason}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">Importo insoluto</span>
                      <strong className="text-rose-600 font-bold text-sm">€{reminder.amount.toFixed(2)}</strong>
                    </div>
                  </div>

                  {reminder.registeredLetterReceiptName && (
                    <div className="mt-3 px-3 py-2 bg-rose-50/40 border border-rose-100/60 rounded-xl text-xs flex items-center justify-between">
                      <span className="text-rose-950 flex items-center space-x-1.5 truncate">
                        <FileText size={13} className="text-rose-500 shrink-0" />
                        <span className="truncate font-semibold">{reminder.registeredLetterReceiptName}</span>
                      </span>
                      <span className="text-[9px] text-rose-600 bg-rose-100/50 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Raccomandata</span>
                    </div>
                  )}

                  {/* AI Suggested letter block */}
                  {reminder.suggestedLetterBody && (
                    <div className="mt-4 border border-indigo-100/40 bg-indigo-50/5 p-3 rounded-xl relative">
                      <p className="text-[10px] font-bold text-indigo-950 uppercase tracking-wide flex items-center space-x-1">
                        <Sparkles size={12} className="text-amber-500" />
                        <span>Lettera compilata dall'AI</span>
                      </p>
                      <pre className="text-[11px] font-sans text-slate-700 mt-2 whitespace-pre-wrap line-clamp-4 leading-relaxed font-normal bg-white p-2.5 rounded-lg border border-slate-100">
                        {reminder.suggestedLetterBody}
                      </pre>
                      
                      <div className="flex justify-end space-x-2 mt-2 pt-1 border-t border-slate-100/50">
                        <button
                          onClick={() => handleCopyLetter(reminder.suggestedLetterBody || "", reminder.id)}
                          className="inline-flex items-center space-x-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          {copiedId === reminder.id ? (
                            <>
                              <Check size={12} className="text-emerald-500" />
                              <span>Copiato!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copia lettera</span>
                            </>
                          )}
                        </button>
                        <span>•</span>
                        <button
                          onClick={() => {
                            setSelectedReminder(reminder);
                          }}
                          className="text-[10px] font-semibold text-slate-500 hover:text-slate-800"
                        >
                          Visualizza intero testo
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                 {/* Actions bottom - Mobile & Desktop optimized */}
                 <div className="px-5 py-4 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 w-full">
                                       {reminder.status !== "Paid" && (
                      <div className="w-full sm:w-auto flex flex-wrap gap-2">
                        {(!reminder.step || reminder.step === 1) && (
                          <button
                            onClick={() => handleOpenStepWizard(reminder)}
                            className="inline-flex items-center justify-center space-x-1.5 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold active:transition-all shadow-md active:shadow-sm"
                          >
                            <Send size={14} />
                            <span>Invia Addebito Addizionale</span>
                          </button>
                        )}
                        {reminder.step === 2 && (
                          <button
                            onClick={() => handleOpenStepWizard(reminder)}
                            className="inline-flex items-center justify-center space-x-1.5 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold active:transition-all shadow-md active:shadow-sm"
                          >
                            <Send size={14} />
                            <span>Invia Secondo Addebito Addizionale</span>
                          </button>
                        )}
                        {reminder.step === 3 && (
                          <button
                            onClick={() => handleOpenStepWizard(reminder)}
                            className="inline-flex items-center justify-center space-x-1.5 px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold active:transition-all shadow-md active:shadow-sm"
                          >
                            <FileText size={14} />
                            <span>Invia Messa in Mora (Send Entry)</span>
                          </button>
                        )}
                        {reminder.step === 4 && (
                          <button
                            onClick={() => handleOpenStepWizard(reminder)}
                            className="inline-flex items-center justify-center space-x-1.5 px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold active:transition-all shadow-md active:shadow-sm"
                          >
                            <Scale size={14} />
                            <span>Sposta in Azione Legale</span>
                          </button>
                        )}
                        {reminder.step === 5 && (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold border border-slate-200">
                            <Scale size={13} />
                            <span>Fascicolo in Azione Legale</span>
                          </span>
                        )}
                      </div>
                    )}

                   {reminder.status !== "Paid" && (
                     <button
                       onClick={() => handleOpenReconcileReminder(reminder)}
                       className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold active:transition-all shadow-md active:shadow-sm"
                       title="Riconcilia con un bonifico bancario registrato"
                     >
                       <Landmark size={14} />
                       <span>Riconcilia</span>
                     </button>
                   )}

                   {reminder.status !== "Paid" && (
                     <button
                       onClick={() => handleMarkAsPaid(reminder.id)}
                       className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold active:transition-all shadow-md active:shadow-sm"
                     >
                       <Check size={14} />
                       <span>Saldato</span>
                     </button>
                   )}

                   <button
                     onClick={() => onDeleteReminder(reminder.id)}
                     className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-3 bg-slate-500 hover:bg-slate-400 text-white rounded-xl text-xs font-bold active:transition-all shadow-md active:shadow-sm"
                     title="Elimina"
                   >
                     <X size={14} />
                     <span>Elimina</span>
                   </button>
                 </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reminder Full View Modal */}
      {selectedReminder && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-sans font-bold text-base">Lettera di Sollecito di Pagamento</h3>
              <button onClick={() => setSelectedReminder(null)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 bg-slate-50 max-h-[60vh] overflow-y-auto">
              <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs font-serif text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                {selectedReminder.suggestedLetterBody}
              </div>
            </div>
            <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex justify-end space-x-2">
              <button
                onClick={() => handleCopyLetter(selectedReminder.suggestedLetterBody || "", "full-view")}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl inline-flex items-center space-x-1.5"
              >
                {copiedId === "full-view" ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedId === "full-view" ? "Copiato!" : "Copia nel Clipboard"}</span>
              </button>
              <button
                onClick={() => setSelectedReminder(null)}
                className="px-4 py-2 border border-slate-200 text-slate-500 text-xs font-semibold rounded-xl hover:bg-slate-50"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reconciliation Modal */}
      {reconcileReminder && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-sans font-bold text-base">Riconciliazione Movimento</h3>
                <p className="text-[10px] text-slate-300 mt-0.5">Associa un bonifico bancario per sanare il sollecito di {reconcileReminder.tenantName}</p>
              </div>
              <button onClick={() => setReconcileReminder(null)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs">
                <div className="flex items-start space-x-2.5">
                  <AlertCircle className="text-amber-600 shrink-0" size={16} />
                  <div>
                    <h5 className="font-bold text-amber-900">Sollecito Selezionato</h5>
                    <p className="text-amber-800 mt-1">Inquilino: <strong className="font-semibold">{reconcileReminder.tenantName}</strong></p>
                    <p className="text-amber-800">Causale: <strong className="font-semibold">{reconcileReminder.reason}</strong></p>
                    <p className="text-amber-800">Importo da Saldo: <strong className="font-bold text-rose-600">€{reconcileReminder.amount.toFixed(2)}</strong></p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Seleziona Movimento Bancario Disponibile *
                </label>
                <select
                  required
                  value={selectedMovementId}
                  onChange={(e) => setSelectedMovementId(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-hidden focus:border-indigo-500"
                >
                  <option value="">-- Seleziona un bonifico non riconciliato --</option>
                  {movements.filter(m => !m.reconciled).map(m => (
                    <option key={m.id} value={m.id}>
                      {new Date(m.date).toLocaleDateString("it-IT")} - {m.description} (+€{m.amount.toFixed(2)})
                    </option>
                  ))}
                </select>
                {movements.filter(m => !m.reconciled).length === 0 && (
                  <p className="text-[10px] text-rose-500 mt-1.5">Nessun movimento bancario non riconciliato disponibile. Carica un estratto conto o aggiungi un movimento manuale in "Banche".</p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setReconcileReminder(null)}
                className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={!selectedMovementId}
                onClick={handleConfirmReconciliation}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm inline-flex items-center space-x-1.5"
              >
                <Check size={14} />
                <span>Riconcilia e Salda</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-step Additional Charge Sequence Modal */}
      {showStepModal && activeStepReminder && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-sans font-bold text-base flex items-center space-x-2">
                  <Scale size={18} className="text-indigo-400" />
                  <span>Sequenza Addebito Addizionale & Solleciti</span>
                </h3>
                <p className="text-[10px] text-slate-300 mt-0.5">Gestione morosità inquilino: {activeStepReminder.tenantName}</p>
              </div>
              <button onClick={() => { setShowStepModal(false); setActiveStepReminder(null); }} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Stepper Visual Indicator */}
            <div className="bg-slate-50 px-6 py-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <div className="flex flex-col items-center flex-1">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mb-1 ${
                    activeStepReminder.step === 1 || !activeStepReminder.step ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-800"
                  }`}>1</span>
                  <span className="text-[10px]">1° Sollecito</span>
                </div>
                <div className="h-0.5 bg-slate-200 flex-1 -mt-4"></div>
                <div className="flex flex-col items-center flex-1">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mb-1 ${
                    activeStepReminder.step === 2 ? "bg-purple-600 text-white" : activeStepReminder.step > 2 ? "bg-purple-100 text-purple-800" : "bg-slate-200 text-slate-400"
                  }`}>2</span>
                  <span className="text-[10px]">2° Sollecito</span>
                </div>
                <div className="h-0.5 bg-slate-200 flex-1 -mt-4"></div>
                <div className="flex flex-col items-center flex-1">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mb-1 ${
                    activeStepReminder.step === 3 ? "bg-amber-600 text-white" : activeStepReminder.step > 3 ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-400"
                  }`}>3</span>
                  <span className="text-[10px]">Diffida</span>
                </div>
                <div className="h-0.5 bg-slate-200 flex-1 -mt-4"></div>
                <div className="flex flex-col items-center flex-1">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mb-1 ${
                    activeStepReminder.step === 4 ? "bg-rose-600 text-white" : "bg-slate-200 text-slate-400"
                  }`}>4</span>
                  <span className="text-[10px]">Azione Legale</span>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex-1 space-y-4">
              
              {legalCaseCreatedSuccessfully ? (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce">
                    <Check size={36} />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900">Azione Legale Avviata!</h4>
                  <p className="text-sm text-slate-600 max-w-md">
                    Il fascicolo digitale per l'avvocato è stato compresso e scaricato con successo. La pratica legale è stata creata nel pannello contenziosi.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Inquilino:</span>
                      <strong className="font-bold text-slate-900">{activeStepReminder.tenantName}</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Causale:</span>
                      <strong className="font-semibold text-slate-900">{activeStepReminder.reason}</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Scadenza:</span>
                      <strong className="font-semibold text-slate-900">{new Date(activeStepReminder.dueDate).toLocaleDateString("it-IT")}</strong>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <span className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Voci di Debito Consolidate:</span>
                      <div className="space-y-1 max-h-[120px] overflow-y-auto bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px]">
                        {(() => {
                          const itemIds = activeStepReminder.associatedItemsIds || [];
                          if (itemIds.length === 0) {
                            return <p className="text-slate-500 italic text-[10px] font-sans">dettaglio non disponibile</p>;
                          }
                          const associated = getAssociatedItemsForActiveReminder();
                          if (associated.length === 0) {
                            return <p className="text-slate-500 italic text-[10px] font-sans">dettaglio non disponibile</p>;
                          }
                          return associated.map(item => (
                            <div key={item.id} className="flex justify-between text-slate-700">
                              <span>• {item.title.split(" - ")[1] || item.title}</span>
                              <span className="font-bold text-slate-900">€{item.amount.toFixed(2)}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                      <span className="font-bold text-slate-800">Totale Sollecitato:</span>
                      <strong className="text-sm font-black text-rose-600">€{activeStepReminder.amount.toFixed(2)}</strong>
                    </div>
                  </div>

                  {/* Step Specific Displays */}
                  {(wizardStep === "first") && (
                    <div className="space-y-3">
                      <div className="flex items-start space-x-2.5 bg-indigo-50 border border-indigo-100 p-3.5 rounded-xl text-xs text-indigo-900">
                        <AlertCircle className="shrink-0 text-indigo-600" size={16} />
                        <div>
                          <h5 className="font-bold mb-0.5">Primo Sollecito di Pagamento</h5>
                          <p>
                            Verrà inviato un messaggio di cortesia formale tramite email e WhatsApp contenente la distinta dettagliata delle spese extra addebitate e le coordinate bancarie per il bonifico.
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={handleExecuteFirstStep}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold active:transition-all shadow-md active:shadow-sm flex items-center space-x-1.5"
                        >
                          <Send size={14} />
                          <span>Invia Primo Sollecito (WhatsApp/Email)</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {wizardStep === "second" && (
                    <div className="space-y-3">
                      <div className="flex items-start space-x-2.5 bg-purple-50 border border-purple-100 p-3.5 rounded-xl text-xs text-purple-900">
                        <AlertCircle className="shrink-0 text-purple-600" size={16} />
                        <div>
                          <h5 className="font-bold mb-0.5">Secondo Sollecito di Pagamento</h5>
                          <p>
                            Il primo sollecito è stato inviato il <strong>{activeStepReminder.firstRequestDate ? new Date(activeStepReminder.firstRequestDate).toLocaleDateString("it-IT") : "di recente"}</strong> ma non è stato rilevato alcun pagamento. Inviamo un sollecito formale di secondo livello, con avviso di imminente messa in mora.
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={handleExecuteSecondStep}
                          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold active:transition-all shadow-md active:shadow-sm flex items-center space-x-1.5"
                        >
                          <Send size={14} />
                          <span>Invia Secondo Sollecito (WhatsApp/Email)</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {wizardStep === "third" && (
                    <div className="space-y-4">
                      <div className="flex items-start space-x-2.5 bg-amber-50 border border-amber-100 p-3.5 rounded-xl text-xs text-amber-900">
                        <AlertTriangle className="shrink-0 text-amber-600" size={16} />
                        <div>
                          <h5 className="font-bold mb-0.5">Diffida e Costituzione in Mora (Raccomandata A/R)</h5>
                          <p>
                            Entrambi i solleciti sono rimasti inevasi. Procedere all'azione formale obbligatoria ai fini di legge prima di adire le vie legali.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                          <h6 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                            <FileText size={14} className="text-slate-500" />
                            <span>1. Lettera di Diffida (PDF)</span>
                          </h6>
                          <p className="text-[10px] text-slate-500">
                            Genera, scarica e stampa la lettera ufficiale di messa in mora per spedizione postale Raccomandata A/R.
                          </p>
                          <button
                            onClick={handleExecuteThirdStepPrint}
                            className="w-full px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1"
                          >
                            <FileText size={12} />
                            <span>Stampa Lettera PDF</span>
                          </button>
                        </div>

                        <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                          <h6 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                            <Send size={14} className="text-slate-500" />
                            <span>2. Notifica Comproprietari</span>
                          </h6>
                          <p className="text-[10px] text-slate-500">
                            Invia email formale in copia per conoscenza a tutti i comproprietari dell'immobile interessato.
                          </p>
                          <button
                            onClick={handleExecuteThirdStepMailOwners}
                            className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1"
                          >
                            <Send size={12} />
                            <span>Invia Email Comproprietari</span>
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-slate-150 pt-4 space-y-4">
                        <div>
                          <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                            3. Carica Prova di Invio (Raccomandata)
                          </label>
                          <p className="text-[10px] text-slate-500 mb-2">
                            Scannerizza o fotografa la ricevuta di spedizione postale (es. ricevuta di invio cartacea).
                          </p>
                          <input
                            type="text"
                            placeholder="es. prova_spedizione_raccomandata.pdf"
                            value={proofOfSendingFile}
                            onChange={(e) => setProofOfSendingFile(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 outline-hidden focus:border-indigo-500 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                            4. Carica Ricevuta di Ritorno Firmata
                          </label>
                          <p className="text-[10px] text-slate-500 mb-2">
                            Scannerizza o fotografa la cartolina di avvenuta ricezione firmata dal conduttore.
                          </p>
                          <input
                            type="text"
                            placeholder="es. ricevuta_ritorno_firmata.pdf"
                            value={receiptOfReturnFile}
                            onChange={(e) => setReceiptOfReturnFile(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 outline-hidden focus:border-indigo-500 font-mono"
                          />
                        </div>

                        <div className="pt-2">
                          <button
                            disabled={!proofOfSendingFile || !receiptOfReturnFile}
                            onClick={handleUploadReceiptSimulated}
                            className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 transition-all cursor-pointer active:disabled:pointer-events-none"
                          >
                            <Upload size={14} />
                            <span>Valida Ricevute e Avvia Messa in Mora</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {wizardStep === "fourth" && (
                    <div className="space-y-3">
                      <div className="flex items-start space-x-2.5 bg-rose-50 border border-rose-100 p-3.5 rounded-xl text-xs text-rose-900">
                        <AlertCircle className="shrink-0 text-rose-600" size={16} />
                        <div>
                          <h5 className="font-bold mb-0.5">Sposta Pratica in Azione Legale</h5>
                          <p>
                            Tutti i passi extra-giudiziali sono stati compiuti. La diffida cartacea è stata inviata e la ricevuta <strong>{activeStepReminder.registeredLetterReceiptName || "ricevuta.pdf"}</strong> è stata archiviata.
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600">
                        Verrà generato un <strong>fascicolo digitale completo in formato ZIP</strong> contenente tutta la corrispondenza pre-contenziosa, i dettagli contrattuali e la ricevuta di messa in mora. La controversia verrà assegnata automaticamente all'Avvocato convenzionato.
                      </p>
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={handleMoveToLegalAction}
                          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold active:transition-all shadow-md active:shadow-sm flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Scale size={14} />
                          <span>Passa Fascicolo ad Area Legale</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => { setShowStepModal(false); setActiveStepReminder(null); }}
                className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Chiudi
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Statement Import OCR Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-150 flex flex-col">
            <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-sans font-bold text-base flex items-center space-x-2">
                  <Sparkles size={18} className="text-amber-400" />
                  <span>Importa Estratto Conto con OCR AI</span>
                </h3>
                <p className="text-[10px] text-slate-300 mt-0.5">Analisi intelligente dei movimenti per riconciliazione rapida.</p>
              </div>
              <button onClick={() => { stopStmtCamera(); setShowImportModal(false); }} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {importError && (
                <div className="bg-rose-50 border border-rose-150 rounded-xl p-3.5 text-xs text-rose-800 flex items-start space-x-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Input Methods */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* File Drop/Camera Block */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                    1. Scatta Foto o Carica Estratto (PDF / Immagine)
                  </label>

                  {stmtCameraActive ? (
                    <div className="relative bg-slate-950 rounded-2xl overflow-hidden aspect-video border border-slate-800 flex flex-col items-center justify-center">
                      <video ref={stmtVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <div className="absolute bottom-3 inset-x-0 flex justify-center space-x-2">
                        <button
                          type="button"
                          onClick={captureStmtPhoto}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] flex items-center space-x-1"
                        >
                          <Camera size={12} />
                          <span>Scatta</span>
                        </button>
                        <button
                          type="button"
                          onClick={stopStmtCamera}
                          className="bg-slate-800 hover:bg-slate-750 text-white font-bold py-1.5 px-3 rounded-lg text-[10px]"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={startStmtCamera}
                        className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-xl text-slate-700 text-[10.5px] font-bold space-y-1"
                      >
                        <Camera size={16} className="text-slate-400" />
                        <span>Usa Fotocamera</span>
                      </button>

                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          id="stmt-solleciti-file-upload"
                          multiple
                          onChange={handleStmtFileChange}
                          className="hidden"
                        />
                        <label
                          htmlFor="stmt-solleciti-file-upload"
                          className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-xl text-slate-700 text-[10.5px] font-bold space-y-1 cursor-pointer text-center"
                        >
                          <Upload size={16} className="text-slate-400" />
                          <span>Carica PDF / Foto</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Previews */}
                  {statementImages.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Pagine Acquisite ({statementImages.length})</span>
                      <div className="grid grid-cols-3 gap-2">
                        {statementImages.map((img, idx) => {
                          const isPdf = img.startsWith("data:application/pdf");
                          return (
                            <div key={idx} className="relative aspect-square rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                              {isPdf ? (
                                <FileText className="text-rose-500" size={24} />
                              ) : (
                                <img src={img} alt="Preview" className="w-full h-full object-cover" />
                              )}
                              <button
                                type="button"
                                onClick={() => removeStmtImage(idx)}
                                className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full p-1 shadow-md"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Paste Text Area */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Oppure: Incolla Testo Estratto Conto
                  </label>
                  <textarea
                    placeholder="Incolla qui le righe del tuo home banking, file CSV o testo copiato dall'estratto conto..."
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={6}
                    className="w-full text-xs border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex justify-center">
                <button
                  type="button"
                  disabled={importLoading || (!pasteText && statementImages.length === 0)}
                  onClick={handleExtractWithAi}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-850 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md"
                >
                  {importLoading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Elaborazione AI con Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="text-amber-400" />
                      <span>Estrai Movimenti con AI</span>
                    </>
                  )}
                </button>
              </div>

              {/* Extracted results display */}
              {extractedMovements.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-100 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Movimenti Strutturati Rilevati ({extractedMovements.length})</h4>
                    <span className="text-[10px] text-slate-400 italic">Verifica i dati estratti prima di confermare</span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse font-mono">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                        <tr>
                          <th className="p-2.5">Data</th>
                          <th className="p-2.5">Causale</th>
                          <th className="p-2.5 text-right">Importo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                        {extractedMovements.map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5">{new Date(m.date).toLocaleDateString("it-IT")}</td>
                            <td className="p-2.5 max-w-[200px] truncate">{m.description}</td>
                            <td className={`p-2.5 text-right font-bold ${m.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              €{m.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleSaveExtracted}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center space-x-1.5"
                    >
                      <Check size={14} />
                      <span>Conferma e Salva in Contabilità</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => { stopStmtCamera(); setShowImportModal(false); }}
                className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

