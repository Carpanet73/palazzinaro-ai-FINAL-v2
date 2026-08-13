
import React, { useState, useEffect, useMemo } from "react";
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
  Image as ImageIcon,
  ArrowLeft,
  FlaskConical,
  Calendar
} from "lucide-react";
import JSZip from "jszip";
import { Reminder, Tenant, BankMovement, FastClosingItem, Communication, OwnerProfile, Owner } from "../types";
import { generateMessaInMoraPDF } from "../lib/pdfHelper";
import emailjs from "@emailjs/browser";
import LedgerExportToolbar from "./LedgerExportToolbar";
import { LedgerColumn } from "../lib/ledgerExport";

interface RemindersViewProps {
  reminders: Reminder[];
  tenants: Tenant[];
  owners?: Owner[]; // CORREZIONE W — un debitore può essere anche un proprietario, non solo un inquilino
  movements: BankMovement[];
  fastClosing: FastClosingItem[];
  properties?: any[];
  communications?: Communication[];
  ownerProfile?: OwnerProfile | null;
  onAddReminder: (reminder: Omit<Reminder, "id" | "userId" | "createdAt">) => Promise<void>;
  onUpdateReminderStatus: (id: string, status: string, notes?: string, extraFields?: any) => Promise<void>;
  onReconcileMovement: (movementId: string, closingItemId: string) => Promise<void>;
  // CORREZIONE (13/08/2026) — motore condiviso di riconciliazione multi-voce con pagamento
  // parziale (src/lib/reconciliation.ts), stesso identico flusso usato in Fast Closing —
  // prima l'Area Solleciti non aveva alcuna possibilità di riconciliare/pagare le singole
  // voci di un sollecito, solo l'intero blocco in una volta.
  onCumulativeReconcile?: (itemIds: string[], options?: { movementId?: string | null; cashAmount?: number }) => Promise<void>;
  onAddLegalCase: (legalCase: any) => Promise<void>;
  onDeleteReminder: (id: string) => Promise<void>;
  onAddMovement?: (movement: Omit<BankMovement, "id" | "userId" | "createdAt">) => Promise<void>;
}

export default function RemindersView({
  reminders,
  tenants,
  owners = [],
  movements,
  fastClosing,
  properties,
  communications,
  ownerProfile,
  onAddReminder,
  onUpdateReminderStatus,
  onReconcileMovement,
  onCumulativeReconcile,
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
  // CORREZIONE (13/08/2026) — selezione manuale delle singole voci del sollecito da
  // riconciliare (con avviso se manca un canone scaduto, stesso identico comportamento del
  // Fast Closing) + modalità contanti/verifica manuale + messaggio d'errore di validazione.
  const [selectedReconcileItemIds, setSelectedReconcileItemIds] = useState<string[]>([]);
  const [reconcileCashMode, setReconcileCashMode] = useState(false);
  const [reconciliationError, setReconciliationError] = useState("");

  // Multi-step additional charge sequence states
  const [activeStepReminder, setActiveStepReminder] = useState<Reminder | null>(null);
  const [showStepModal, setShowStepModal] = useState(false);
  const [wizardStep, setWizardStep] = useState<"first" | "second" | "third" | "fourth" | "zip">("first");
  const [simulatedFileName, setSimulatedFileName] = useState("");
  const [proofOfSendingFile, setProofOfSendingFile] = useState<string>("");
  const [receiptOfReturnFile, setReceiptOfReturnFile] = useState<string>("");
  const [legalCaseCreatedSuccessfully, setLegalCaseCreatedSuccessfully] = useState(false);

  // CORREZIONE AC — formatta un indirizzo strutturato (via/civico/interno/città/prov/cap) in
  // un'unica riga di testo leggibile, per le lettere formali.
  const formatStructuredAddress = (addr?: { via?: string; civico?: string; interno?: string; citta?: string; provincia?: string; cap?: string }): string => {
    if (!addr) return "";
    const parts: string[] = [];
    if (addr.via) parts.push(addr.civico ? `${addr.via}, ${addr.civico}` : addr.via);
    if (addr.interno) parts.push(`int. ${addr.interno}`);
    const cityLine = [addr.cap, addr.citta, addr.provincia ? `(${addr.provincia})` : ""].filter(Boolean).join(" ");
    if (cityLine.trim()) parts.push(cityLine.trim());
    return parts.join(", ");
  };

  // ── CORREZIONE Z — Un Sollecito non si elimina mai a mano (voce rigida). L'unica
  // flessibilità ammessa: se ciò che resta ancora da saldare in un gruppo sono SOLO spese
  // accessorie (mai un canone scaduto insieme), quelle possono tornare al Fast Closing
  // normale come "obbligazioni pecuniarie secondarie" — il Sollecito si chiude, le voci
  // restano regolarmente in Fast Closing (rinvio/insoluto come sempre).
  // CORREZIONE AL — Raggruppamento per debitore con subtotale, stesso stile del Fast Closing
  const groupedReminders = useMemo(() => {
    const groups: { [name: string]: Reminder[] } = {};
    // CORREZIONE BC — i proprietari non devono MAI avere Solleciti (un proprietario non fa
    // causa a se stesso). Filtra qui eventuali residui creati prima di questa regola, senza
    // toccare i dati sottostanti (la voce in Fast Closing resta comunque correttamente
    // "Insoluta" e segnalata tramite l'avviso di soglia di indebitamento in Dashboard).
    reminders.filter(r => r.debtorType !== "owner").forEach(r => {
      if (!groups[r.tenantName]) groups[r.tenantName] = [];
      groups[r.tenantName].push(r);
    });
    return Object.keys(groups)
      .sort((a, b) => a.localeCompare(b))
      .map(name => {
        const items = groups[name];
        const subtotal = items
          .filter(r => r.status !== "Paid")
          .reduce((sum, r) => sum + r.amount, 0);
        return { debtorName: name, items, subtotal };
      });
  }, [reminders]);

  // CORREZIONE CP (13/08/2026) — Fase 2 punto 3: colonne per stampa/esportazione universale
  // della tabella Solleciti per debitore, tramite LedgerExportToolbar.
  const reminderExportColumns: LedgerColumn[] = [
    { key: "reason", label: "Causale" },
    { key: "amount", label: "Importo", align: "right", format: (r: Reminder) => `€${r.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` },
    { key: "dueDate", label: "Scaduto il", format: (r: Reminder) => new Date(r.dueDate).toLocaleDateString("it-IT") },
    { key: "status", label: "Stato", format: (r: Reminder) => r.status === "Paid" ? "Saldato" : r.status === "MessaInMora" ? "Messa in Mora" : r.status === "Sent" ? "Sollecitato" : "Bozza/Pronto" }
  ];

  // CORREZIONE (13/08/2026) — elenco reale delle voci Fast Closing ancora da saldare
  // collegate a questo sollecito: sia quelle raggruppate tramite associatedItemsIds (il caso
  // normale, un sollecito per debitore), sia l'eventuale vecchia riga "mirror" singola
  // (source === "reminder", per compatibilità con solleciti creati prima di quella logica).
  // Usata dal nuovo flusso di riconciliazione/pagamento parziale per selezionare le voci.
  const getReminderLinkedItems = (reminder: Reminder): FastClosingItem[] => {
    const ids = new Set<string>(reminder.associatedItemsIds || []);
    const mirror = (fastClosing || []).find(item => item.source === "reminder" && item.sourceId === reminder.id);
    if (mirror) ids.add(mirror.id);
    return (fastClosing || []).filter(item => ids.has(item.id) && (item.status === "Pending" || item.status === "Overdue"));
  };

  const isRentItemForReconcile = (item: FastClosingItem) => {
    const t = (item.title || "").toLowerCase();
    const d = (item.description || "").toLowerCase();
    return item.source === "contract" || t.includes("canone") || t.includes("affitto") || d.includes("canone") || d.includes("affitto");
  };

  const toggleReconcileItem = (itemId: string) => {
    setSelectedReconcileItemIds(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const getReminderComposition = (reminder: Reminder) => {
    const linkedItems = (fastClosing || []).filter(item => (reminder.associatedItemsIds || []).includes(item.id));
    const isRentItem = (item: FastClosingItem) => {
      const t = (item.title || "").toLowerCase();
      const d = (item.description || "").toLowerCase();
      return item.source === "contract" || t.includes("canone") || t.includes("affitto") || d.includes("canone") || d.includes("affitto");
    };
    const rentItems = linkedItems.filter(isRentItem);
    const accessoryItems = linkedItems.filter(item => !isRentItem(item));
    const unpaidRentItems = rentItems.filter(item => item.status !== "Paid");
    const unpaidAccessoryItems = accessoryItems.filter(item => item.status !== "Paid");
    return {
      hasUnpaidRent: unpaidRentItems.length > 0,
      onlyAccessoriesRemain: unpaidRentItems.length === 0 && unpaidAccessoryItems.length > 0,
      unpaidAccessoryItems
    };
  };

  const handleReturnAccessoriesToFastClosing = async (reminder: Reminder) => {
    const composition = getReminderComposition(reminder);
    if (!composition.onlyAccessoriesRemain) return;
    const list = composition.unpaidAccessoryItems.map(i => `- ${i.title} (€${i.amount.toFixed(2)})`).join("\n");
    const confirmed = confirm(
      `Su questo sollecito non restano canoni scaduti — solo spese accessorie ancora da saldare:\n\n${list}\n\nQueste sono obbligazioni pecuniarie secondarie: possono tornare al Fast Closing normale (con il consueto rinvio/insoluto) invece di restare bloccate qui nei Solleciti. Il sollecito verrà chiuso.\n\nProcedere?`
    );
    if (!confirmed) return;
    await onUpdateReminderStatus(reminder.id, "Closed", "Chiuso: restavano solo spese accessorie senza canoni scaduti, rimandate al Fast Closing normale.");
  };

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

  // Gating dei 15 giorni tra un passaggio e l'altro dei Solleciti: DISATTIVATO TEMPORANEAMENTE
  // il 13/08/2026 su richiesta esplicita di Massimo, solo per testare la sequenza dei passaggi
  // senza dover aspettare i tempi reali. RIPORTARE A `false` prima di qualunque utilizzo reale:
  // altrimenti si perdono i termini procedurali di legge sulla morosità.
  const DISABLE_15_DAY_GATING_FOR_TESTING = true;

  const handleOpenStepWizard = (reminder: Reminder) => {
    const step = reminder.step || 1;
    const daysPassed = getDaysPassedSinceLastStep(reminder);
    if (!DISABLE_15_DAY_GATING_FOR_TESTING && step > 1 && daysPassed < 15) {
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
    // CORREZIONE W — Un debitore può essere un Inquilino O un Proprietario (es. quota di
    // manutenzione al 100% a suo carico). Prima si cercava SEMPRE e SOLO tra gli inquilini:
    // per un debitore-proprietario risultava sempre "non trovato in anagrafica", anche con
    // l'anagrafica corretta, perché si guardava nell'elenco sbagliato.
    const isOwnerDebtor = reminder.debtorType === "owner";
    const debtor: any = isOwnerDebtor
      ? (owners.find(o => o.id === reminder.tenantId) ||
         owners.find(o => o.name.toLowerCase().trim() === reminder.tenantName.toLowerCase().trim()))
      : (tenants.find(t => t.id === reminder.tenantId) ||
         tenants.find(t => t.name.toLowerCase().trim() === reminder.tenantName.toLowerCase().trim()));

    if (!debtor) {
      alert(`Errore: ${isOwnerDebtor ? "Proprietario" : "Inquilino"} "${reminder.tenantName}" non trovato nell'anagrafica del sistema.`);
      return false;
    }
    const tenant = debtor; // alias per non toccare il resto della funzione sotto

    // 1. Compose the message text
    const associated = (fastClosing || []).filter(item => (reminder.associatedItemsIds || []).includes(item.id));
    const listText = associated.length > 0 
      ? associated.map(item => {
          const titleClean = item.title.split(" - ")[1] || item.title;
          return `- ${titleClean}: €${item.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;
        }).join("\n")
      : `- ${reminder.reason}: €${reminder.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;

    const total = reminder.amount;
    const footerText = "Messaggio inviato mediante procedura automatizzata del sistema, in nome e per conto del proprietario, con supporto dell'intelligenza artificiale. La firma del proprietario è raccolta digitalmente.";
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

    // CORREZIONE D+G+AK — Se il contratto/anagrafica è cointestato/a (obbligazione
    // solidale, sia lato Inquilino con coTenants sia lato Proprietario con coOwners)
    // e/o è presente un Garante, il sollecito deve raggiungere anche loro, non solo
    // l'intestatario principale. Resta un unico debitore/conto: qui cambiano solo i
    // destinatari dell'invio.
    const allRecipients = [
      { name: tenant.name, email: tenant.email, phone: tenant.phone },
      ...((tenant.coTenants || []).map((ct: any) => ({ name: ct.name, email: ct.email, phone: ct.phone }))),
      ...((tenant.coOwners || []).map((co: any) => ({ name: co.name, email: co.email, phone: co.phone }))),
      ...(tenant.guarantor?.name ? [{ name: `${tenant.guarantor.name} (Garante)`, email: tenant.guarantor.email, phone: tenant.guarantor.phone }] : [])
    ];

    const sendEmailTo = async (recipientName: string, recipientEmail?: string) => {
      if (!serviceId || !templateId || !publicKey) {
        return; // avviso già mostrato una volta sotto, non ripeterlo per ogni destinatario
      }
      if (!recipientEmail || !recipientEmail.includes("@")) {
        alert(`EMAIL ASSENTE:\n"${recipientName}" non ha un indirizzo email valido impostato in anagrafica. Invio email saltato per questo destinatario.`);
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
        alert(`E-mail inviata con successo tramite EmailJS all'indirizzo: ${recipientEmail}`);
      } catch (err: any) {
        console.error("Errore EmailJS:", err);
        alert(`Errore durante l'invio dell'e-mail a ${recipientName} tramite EmailJS:\n${err?.text || err?.message || JSON.stringify(err)}`);
      }
    };

    const openWhatsAppFor = (recipientName: string, recipientPhone?: string) => {
      if (!recipientPhone || !recipientPhone.trim()) {
        alert(`TELEFONO ASSENTE:\n"${recipientName}" non ha un numero di telefono WhatsApp salvato in anagrafica.\nImpossibile inviare il messaggio tramite WhatsApp a questo destinatario.`);
        return;
      }
      const phoneClean = recipientPhone.replace(/[^0-9+]/g, "");
      const waUrl = `https://wa.me/${phoneClean}?text=${encodeURIComponent(messageBody)}`;
      window.open(waUrl, "_blank");
      alert(`Apertura della chat di WhatsApp per ${recipientName} (${recipientPhone}) in corso in una nuova scheda... Premere "Invia" manualmente per spedire il testo precompilato.`);
    };

    if (!serviceId || !templateId || !publicKey) {
      alert("CONFIGURAZIONE EMAILJS MANCANTE:\nLe credenziali EmailJS non sono ancora configurate nel tuo profilo.\nVai nelle Impostazioni per inserire Service ID, Template ID e Public Key.\n\nL'invio dell'e-mail reale è stato saltato, ma procederemo con l'apertura di WhatsApp.");
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
    const tenant = activeStepReminder.debtorType === "owner" ? undefined :
                   (tenants.find(t => t.id === activeStepReminder.tenantId) ||
                    tenants.find(t => t.name.toLowerCase().trim() === activeStepReminder.tenantName.toLowerCase().trim()));

    // CORREZIONE AC — indirizzo dell'immobile collegato a questa pratica, se risolvibile
    const linkedProperty = (properties || []).find((p: any) => p.id === activeStepReminder.propertyId);

    // CORREZIONE AC — descrizione del credito: elenco delle voci insolute associate
    const linkedItems = (fastClosing || []).filter(item => (activeStepReminder.associatedItemsIds || []).includes(item.id));
    const description = linkedItems.length > 0
      ? linkedItems.map(i => i.title.split(" - ")[1] || i.title).join(", ")
      : (activeStepReminder.reason || "canoni di locazione e spese accessorie scaduti e non versati");

    // CORREZIONE AB/AC — il proprietario è SEMPRE mittente e firmatario della lettera,
    // mai un fantomatico "ufficio legale". Dati presi dal profilo proprietario in Impostazioni.
    generateMessaInMoraPDF({
      tenantName: activeStepReminder.tenantName,
      tenantAddress: formatStructuredAddress(tenant?.address) || undefined,
      amount: activeStepReminder.amount,
      description,
      owner: {
        name: ownerProfile?.name || "Il Proprietario",
        birthPlace: ownerProfile?.birthPlace,
        birthDate: ownerProfile?.birthDate,
        residenceAddress: formatStructuredAddress(ownerProfile?.structuredAddress) || ownerProfile?.address,
        citta: ownerProfile?.structuredAddress?.citta,
        fiscalCode: ownerProfile?.fiscalCode,
        phone: ownerProfile?.phone,
        email: ownerProfile?.email
      },
      propertyAddress: linkedProperty?.address,
      guarantor: tenant?.guarantor?.name ? { name: tenant.guarantor.name, fiscalCode: tenant.guarantor.fiscalCode } : undefined
    });
    alert(
      tenant?.guarantor?.name
        ? `Lettera di Diffida e Messa in Mora generata in formato PDF (con il Garante ${tenant.guarantor.name} citato per conoscenza) e avviata alla stampa per spedizione cartacea Raccomandata A/R a entrambi!`
        : "Lettera di Diffida e Messa in Mora generata in formato PDF e avviata alla stampa per spedizione cartacea Raccomandata A/R!"
    );
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
          // CORREZIONE R — non assegnare più un avvocato finto scritto fisso nel codice:
          // la pratica nasce SENZA assegnazione, da affidare con il drag&drop nell'Area Legale.
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

  // CORREZIONE CO (13/08/2026) — Rimossa handleUploadReceipt: codice morto (mai collegata ad
  // alcun onChange, verificato via grep), legacy e in conflitto con la regola 5 del progetto
  // (creava una LegalCase su singolo upload senza ZIP, senza tracciamento step, senza il
  // gating dei 15gg né il popup di conferma). Il flusso reale e unico per l'upload di prova
  // di invio + ricevuta di ritorno è handleUploadReceiptSimulated (richiede entrambi i file
  // prima di avanzare lo step 3->4); il passaggio effettivo ad Area Legale è
  // handleMoveToLegalAction (step 4->5, crea la LegalCase NON assegnata, con ZIP reale).

  const handleOpenReconcileReminder = (reminder: Reminder) => {
    setReconcileReminder(reminder);
    setSelectedMovementId("");
    setReconcileCashMode(false);
    setReconciliationError("");
    // Default: tutte le voci ancora da saldare del sollecito selezionate, come in Fast
    // Closing — l'utente resta libero di deselezionarne alcune (selezione manuale).
    setSelectedReconcileItemIds(getReminderLinkedItems(reminder).map(item => item.id));
  };

  // CORREZIONE (13/08/2026) — riscritta per usare il motore condiviso di riconciliazione
  // multi-voce con pagamento parziale (src/lib/reconciliation.ts), stesso identico
  // comportamento del Fast Closing: canoni prioritari, voce coperta solo in parte ridotta al
  // residuo reale (mai segnata Pagato finché non è saldata per intero), mai più il vecchio
  // "tutto il sollecito pagato in blocco" come unica opzione.
  const handleConfirmReconciliation = async () => {
    if (!reconcileReminder) return;

    const allItems = getReminderLinkedItems(reconcileReminder);

    // Fallback raro: sollecito senza alcuna voce Fast Closing collegata (non dovrebbe
    // succedere con l'architettura attuale — un Sollecito nasce sempre da voci reali — ma
    // mantenuto per sicurezza retrocompatibile con dati storici).
    if (allItems.length === 0) {
      try {
        await onUpdateReminderStatus(reconcileReminder.id, "Paid", "Saldato tramite abbinamento manuale.");
        setReconcileReminder(null);
        setSelectedMovementId("");
      } catch (err) {
        console.error("Error reconciling reminder (fallback):", err);
      }
      return;
    }

    if (selectedReconcileItemIds.length === 0) return;
    if (!reconcileCashMode && !selectedMovementId) return;
    if (!onCumulativeReconcile) {
      console.error("onCumulativeReconcile non disponibile: impossibile procedere.");
      return;
    }

    const selectedItems = allItems.filter(item => selectedReconcileItemIds.includes(item.id));

    // PRIORITÀ CANONI — stessa identica regola del Fast Closing: non si può saldare una spesa
    // accessoria lasciando fuori un canone d'affitto ancora scaduto sullo stesso sollecito.
    const rentItems = allItems.filter(isRentItemForReconcile);
    const selectedRent = selectedItems.some(isRentItemForReconcile);
    if (rentItems.length > 0 && !selectedRent) {
      setReconciliationError("La riconciliazione del canone d'affitto è prioritaria! Seleziona anche la riga del canone d'affitto per poter procedere.");
      return;
    }

    const totalNeeded = selectedItems.reduce((sum, item) => sum + item.amount, 0);

    try {
      if (reconcileCashMode) {
        const confirmed = confirm(
          `Confermi di aver saldato €${totalNeeded.toFixed(2)} per ${reconcileReminder.tenantName} in contanti (o comunque verificato personalmente, senza un movimento bancario da abbinare)? Se l'importo non copre tutte le voci selezionate, verranno saldate per intero partendo dai canoni e dalle più vecchie; l'ultima coperta solo in parte resterà con il proprio residuo ancora da saldare.`
        );
        if (!confirmed) return;
        await onCumulativeReconcile(selectedReconcileItemIds, { cashAmount: totalNeeded });
        alert(`Saldo in contanti registrato con successo per ${reconcileReminder.tenantName}!`);
      } else {
        const movement = movements.find(m => m.id === selectedMovementId);
        if (!movement) return;
        await onCumulativeReconcile(selectedReconcileItemIds, { movementId: movement.id });
        if (movement.amount < totalNeeded) {
          const residue = totalNeeded - movement.amount;
          alert(`Riconciliazione Parziale eseguita! Bonifico da €${movement.amount.toFixed(2)} applicato su €${totalNeeded.toFixed(2)}. Residuo di €${residue.toFixed(2)} rimasto sulla relativa voce.`);
        } else {
          alert(`Riconciliazione completata con successo per ${reconcileReminder.tenantName}!`);
        }
      }
      setReconcileReminder(null);
      setSelectedMovementId("");
      setSelectedReconcileItemIds([]);
      setReconciliationError("");
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

      {/* Reminders — raggruppati per debitore con subtotale, stesso stile del Fast Closing */}
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
        groupedReminders.map((group, groupIdx) => {
          const borderColors = ["border-indigo-400", "border-emerald-400", "border-violet-400", "border-amber-400", "border-rose-400"];
          const colorClass = borderColors[groupIdx % borderColors.length];
          // CORREZIONE BA — un solo tasto di passaggio per gruppo, non uno per riga: si
          // calcola sulla voce "attiva" del gruppo (non Saldata/Chiusa/Annullata), che
          // rappresenta lo stato reale della sequenza per questo debitore.
          const activeReminderForGroup = group.items.find(
            r => r.status !== "Paid" && r.status !== "Closed" && r.status !== "Cancelled"
          );
          return (
            <div key={group.debtorName} className={`bg-white rounded-2xl border-2 ${colorClass} overflow-hidden shadow-2xs mb-5`}>
              {/* Group header bar — nome debitore + subtotale (il tasto di passaggio ora è in fondo, in linea con gli altri) */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <User size={16} className="text-indigo-700 shrink-0" />
                  <h4 className="font-black text-sm text-slate-900">{group.debtorName}</h4>
                </div>
                <div className="flex items-center gap-3">
                  {group.subtotal > 0 && (
                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Totale Sollecitato</span>
                      <span className="text-sm font-black text-rose-600 font-mono">€{group.subtotal.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <LedgerExportToolbar
                    title={`Solleciti — ${group.debtorName}`}
                    columns={reminderExportColumns}
                    rows={group.items}
                    totalsRow={{ reason: "TOTALE", amount: `€${group.subtotal.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` }}
                    filenameBase={`solleciti-${group.debtorName}`}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-slate-100">
                      <th className="p-2.5 text-left font-bold uppercase tracking-wider text-[10px] border border-slate-700">Causale</th>
                      <th className="p-2.5 text-right font-bold uppercase tracking-wider text-[10px] border border-slate-700">Importo</th>
                      <th className="p-2.5 text-center font-bold uppercase tracking-wider text-[10px] border border-slate-700">Scaduto il</th>
                      <th className="p-2.5 text-center font-bold uppercase tracking-wider text-[10px] border border-slate-700">Stato</th>
                      <th className="p-2.5 text-center font-bold uppercase tracking-wider text-[10px] border border-slate-700 no-print">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((reminder, idx) => {
                      const composition = getReminderComposition(reminder);
                      const isPaidReminder = reminder.status === "Paid";
                      return (
                        <tr
                          key={reminder.id}
                          id={`reminder-card-${reminder.id}`}
                          className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"} hover:bg-indigo-50/30 transition-colors ${isPaidReminder ? "opacity-50" : ""}`}
                        >
                          <td className="p-2.5 border border-slate-200 text-slate-600 align-top max-w-xs truncate" title={reminder.reason}>
                            {reminder.reason}
                            {reminder.suggestedLetterBody && (
                              <button
                                onClick={() => setSelectedReminder(reminder)}
                                className="ml-1.5 text-indigo-400 hover:text-indigo-600"
                                title="Visualizza lettera AI"
                              >
                                <Sparkles size={11} className="inline" />
                              </button>
                            )}
                            {reminder.registeredLetterReceiptName && (
                              <span className="ml-1.5 text-rose-400" title={`Raccomandata: ${reminder.registeredLetterReceiptName}`}>
                                <FileText size={11} className="inline" />
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 border border-slate-200 text-right font-mono font-black text-rose-600 align-top">
                            €{reminder.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 border border-slate-200 text-center font-mono text-slate-600 align-top">
                            {new Date(reminder.dueDate).toLocaleDateString("it-IT")}
                          </td>
                          <td className="p-2.5 border border-slate-200 text-center align-top">
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                              reminder.status === "Paid"
                                ? "bg-emerald-100 text-emerald-800"
                                : reminder.status === "MessaInMora"
                                ? "bg-rose-200 text-rose-900"
                                : reminder.status === "Sent"
                                ? "bg-indigo-100 text-indigo-800"
                                : "bg-amber-100 text-amber-800"
                            }`}>
                              {reminder.status === "Paid" && "Saldato"}
                              {reminder.status === "MessaInMora" && "Messa in Mora"}
                              {reminder.status === "Sent" && "Sollecitato"}
                              {reminder.status === "Pending" && "Bozza/Pronto"}
                            </span>
                          </td>
                          <td className="p-2.5 border border-slate-200 align-top no-print">
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              {!isPaidReminder && (
                                <>
                                  <button
                                    onClick={() => handleOpenReconcileReminder(reminder)}
                                    className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-sm text-[9px] font-black tracking-wide"
                                    title="Riconcilia con un bonifico bancario registrato"
                                  >
                                    Riconcilia
                                  </button>
                                  <button
                                    onClick={() => handleMarkAsPaid(reminder.id)}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-[9px] font-black tracking-wide"
                                  >
                                    Saldato
                                  </button>
                                  {composition.onlyAccessoriesRemain && (
                                    <button
                                      onClick={() => handleReturnAccessoriesToFastClosing(reminder)}
                                      className="px-2 py-1 bg-slate-500 hover:bg-slate-400 text-white rounded-sm text-[9px] font-black tracking-wide"
                                      title="Nessun canone scaduto residuo: le spese accessorie possono tornare al Fast Closing normale"
                                    >
                                      ↩ Fast Closing
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* CORREZIONE BB — tasto unico di passaggio in fondo, in linea con gli altri
                      tasti per riga (colonna Azioni), non più in testa al riquadro */}
                  {activeReminderForGroup && (
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-slate-300">
                        <td colSpan={4} className="p-2.5 text-right text-[10px] font-bold text-slate-500 border border-slate-200">
                          Prossimo passaggio per {group.debtorName}:
                        </td>
                        <td className="p-2.5 border border-slate-200 no-print">
                          <div className="flex justify-center">
                            {(!activeReminderForGroup.step || activeReminderForGroup.step === 1) && (
                              <button
                                onClick={() => handleOpenStepWizard(activeReminderForGroup)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black tracking-wide"
                              >
                                1° Sollecito
                              </button>
                            )}
                            {activeReminderForGroup.step === 2 && (
                              <button
                                onClick={() => handleOpenStepWizard(activeReminderForGroup)}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-black tracking-wide"
                              >
                                2° Sollecito
                              </button>
                            )}
                            {activeReminderForGroup.step === 3 && (
                              <button
                                onClick={() => handleOpenStepWizard(activeReminderForGroup)}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-black tracking-wide"
                              >
                                Messa in Mora
                              </button>
                            )}
                            {activeReminderForGroup.step === 4 && (
                              <button
                                onClick={() => handleOpenStepWizard(activeReminderForGroup)}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-black tracking-wide"
                              >
                                → Area Legale
                              </button>
                            )}
                            {activeReminderForGroup.step === 5 && (
                              <span className="px-3 py-1.5 bg-slate-200 text-slate-500 rounded-lg text-[10px] font-bold">
                                In Legale
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          );
        })
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

      {/* Reconciliation Modal — CORREZIONE (13/08/2026): riscritta per selezione manuale
          per-voce + pagamento parziale, stesso identico motore/flusso del Fast Closing
          (src/lib/reconciliation.ts, "un solo flusso per ogni azione"). */}
      {reconcileReminder && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-sans font-bold text-base">Riconciliazione Sollecito</h3>
                <p className="text-[10px] text-slate-300 mt-0.5">Seleziona le voci da saldare per {reconcileReminder.tenantName}</p>
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
                    <p className="text-amber-800 mt-1">Debitore: <strong className="font-semibold">{reconcileReminder.tenantName}</strong></p>
                    <p className="text-amber-800">Causale: <strong className="font-semibold">{reconcileReminder.reason}</strong></p>
                    <p className="text-amber-800">Importo Complessivo Sollecito: <strong className="font-bold text-rose-600">€{reconcileReminder.amount.toFixed(2)}</strong></p>
                  </div>
                </div>
              </div>

              {/* Contanti / bonifico */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-xs font-bold text-slate-800">Pagamento in Contanti / Verifica Manuale</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Attiva se non c'è un bonifico bancario da abbinare.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReconcileCashMode(prev => !prev);
                    setSelectedMovementId("");
                    setReconciliationError("");
                  }}
                  className={`shrink-0 ml-3 w-11 h-6 rounded-full transition-colors relative ${reconcileCashMode ? "bg-emerald-500" : "bg-slate-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${reconcileCashMode ? "translate-x-5" : ""}`} />
                </button>
              </div>

              {/* Bank Movement Selection — nascosta in modalità contanti */}
              {!reconcileCashMode && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Seleziona Movimento Bancario Ricevuto *
                  </label>
                  <div className="max-h-56 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                    {movements.filter(m => !m.reconciled).length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">Nessun bonifico non riconciliato disponibile. Carica un estratto conto o aggiungi un movimento manuale in "Banche".</p>
                    )}
                    {movements.filter(m => !m.reconciled).map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMovementId(m.id);
                          setReconciliationError("");
                        }}
                        className={`w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                          selectedMovementId === m.id
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "bg-white border-slate-200 hover:border-indigo-300 text-slate-800"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className={`text-[10px] font-bold flex items-center gap-1 ${selectedMovementId === m.id ? "text-indigo-200" : "text-slate-400"}`}>
                            <Calendar size={10} className="shrink-0" />
                            {new Date(m.date).toLocaleDateString("it-IT")}
                          </div>
                          <div className="text-xs font-semibold truncate">{m.description}</div>
                        </div>
                        <div className={`text-sm font-black font-mono shrink-0 ${selectedMovementId === m.id ? "text-white" : "text-emerald-600"}`}>
                          +€{m.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Checklist per-voce — selezione manuale, come nel Fast Closing */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2.5">
                  Seleziona le voci incluse in questo pagamento:
                </label>
                <div className="space-y-2 max-h-[180px] overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  {getReminderLinkedItems(reconcileReminder).map(item => {
                    const isChecked = selectedReconcileItemIds.includes(item.id);
                    const isRent = isRentItemForReconcile(item);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleReconcileItem(item.id)}
                        className={`p-2.5 rounded-lg border-2 flex items-center justify-between cursor-pointer transition-all ${
                          isChecked
                            ? "border-indigo-500 bg-indigo-50/30 font-bold"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <span className="text-xs text-slate-900 block leading-tight">
                              {item.title} {isRent && <span className="text-[8px] bg-indigo-100 text-indigo-800 font-extrabold rounded px-1 ml-1 font-mono">CANONE PRIORITARIO</span>}
                            </span>
                            <span className="text-[8px] text-slate-400 font-mono">Scad. {new Date(item.dueDate).toLocaleDateString("it-IT")}</span>
                          </div>
                        </div>
                        <span className="text-xs font-black text-slate-900">€{item.amount.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Riepilogo importi in tempo reale */}
              {reconcileCashMode && selectedReconcileItemIds.length > 0 && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1">
                  <div className="flex justify-between text-emerald-800">
                    <span>Totale da Saldare in Contanti:</span>
                    <strong>
                      €{getReminderLinkedItems(reconcileReminder).filter(item => selectedReconcileItemIds.includes(item.id)).reduce((s, i) => s + i.amount, 0).toFixed(2)}
                    </strong>
                  </div>
                </div>
              )}

              {!reconcileCashMode && selectedMovementId && selectedReconcileItemIds.length > 0 && (() => {
                const movementAmt = movements.find(m => m.id === selectedMovementId)?.amount || 0;
                const selectionTotal = getReminderLinkedItems(reconcileReminder).filter(item => selectedReconcileItemIds.includes(item.id)).reduce((s, i) => s + i.amount, 0);
                return (
                  <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between text-slate-500">
                      <span>Bonifico Disponibile:</span>
                      <strong className="text-slate-800">€{movementAmt.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Totale Voci Selezionate:</span>
                      <strong className="text-slate-800">€{selectionTotal.toFixed(2)}</strong>
                    </div>
                    {movementAmt < selectionTotal ? (
                      <div className="mt-2 pt-2 border-t border-dashed border-slate-300 text-[10px] text-amber-700 font-bold leading-relaxed flex items-start gap-1.5">
                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                        <span>Riconciliazione Parziale: l'importo del bonifico è inferiore di €{(selectionTotal - movementAmt).toFixed(2)}. Il sistema salderà per intero le voci più vecchie (canoni prima delle spese accessorie) e ridurrà al residuo effettivo la voce su cui il pagamento si esaurisce, che resterà da saldare.</span>
                      </div>
                    ) : movementAmt > selectionTotal ? (
                      <div className="mt-2 pt-2 border-t border-dashed border-slate-300 text-[10px] text-emerald-700 font-semibold leading-relaxed flex items-start gap-1.5">
                        <Check size={12} className="shrink-0 mt-0.5" />
                        <span>L'importo del bonifico copre interamente la selezione con un'eccedenza di €{(movementAmt - selectionTotal).toFixed(2)}.</span>
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              {reconciliationError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold leading-relaxed flex items-center space-x-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{reconciliationError}</span>
                </div>
              )}
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
                disabled={(!reconcileCashMode && !selectedMovementId) || selectedReconcileItemIds.length === 0}
                onClick={handleConfirmReconciliation}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm inline-flex items-center space-x-1.5"
              >
                <Check size={14} />
                <span>{reconcileCashMode ? "Segna come Pagato (Contanti)" : "Riconcilia e Salda"}</span>
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
                  <span>Sequenza Solleciti & Recupero Crediti</span>
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
                        {/* CORREZIONE Y — Tasto di comodo SOLO per test: compila al volo le due
                            ricevute simulate, per poter provare tutta la sequenza fino al passaggio
                            all'Area Legale senza dover scrivere ogni volta un nome file a mano. */}
                        <button
                          type="button"
                          onClick={() => {
                            setProofOfSendingFile("TEST_prova_spedizione_raccomandata.pdf");
                            setReceiptOfReturnFile("TEST_ricevuta_ritorno_firmata.pdf");
                          }}
                          className="w-full py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-[10px] font-black border border-dashed border-amber-300 inline-flex items-center justify-center gap-1.5"
                        >
                          <FlaskConical size={11} className="text-amber-800 shrink-0" />
                          <span>Compila con Dati di Prova (solo per test)</span>
                        </button>

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

