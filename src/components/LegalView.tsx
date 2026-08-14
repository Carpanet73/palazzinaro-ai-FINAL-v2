
import React, { useState, useEffect } from "react";
import AddressFields, { AddressValue } from "./AddressFields";
import { Scale, FolderOpen, X, Trash2, Briefcase, Download, FileText, User, Pencil, CheckCircle2, Mail, AlertTriangle, Wallet, RotateCcw, Landmark } from "lucide-react";
import { LegalCase, Property, Lawyer, Tenant, OwnerProfile, Contract, Reminder, DeliveryReport, FastClosingItem, BankMovement } from "../types";
import JSZip from "jszip";
import emailjs from "@emailjs/browser";
import LedgerExportToolbar from "./LedgerExportToolbar";
import { LedgerColumn } from "../lib/ledgerExport";

interface LegalViewProps {
  legalCases: LegalCase[];
  properties: Property[];
  tenants?: Tenant[]; // CORREZIONE G — per includere i dati del Garante nel fascicolo ZIP
  contracts?: Contract[]; // per il contratto reale nel fascicolo ZIP
  reminders?: Reminder[]; // per i Solleciti/Messa in Mora reali nel fascicolo ZIP
  deliveryReports?: DeliveryReport[]; // per i Verbali di Consegna/Riconsegna reali nel fascicolo ZIP
  lawyers?: Lawyer[];
  // CORREZIONE (14/08/2026, su richiesta di Massimo) — necessari per le azioni "Rientra in
  // Solleciti / Riconcilia / Segna come Pagato" direttamente da Area Legale (sezione 5 delle
  // regole di progetto): prima la pratica legale non aveva alcun collegamento al motore di
  // riconciliazione condiviso (src/lib/reconciliation.ts), quindi un pagamento incassato
  // mentre la pratica era in mano al legale non poteva mai essere tolto dal saldo insoluto.
  fastClosing?: FastClosingItem[];
  movements?: BankMovement[];
  onCumulativeReconcile?: (itemIds: string[], options?: { movementId?: string | null; cashAmount?: number }) => Promise<void>;
  onUpdateReminderStatus?: (id: string, status: string, notes?: string, extraFields?: any) => Promise<void>;
  onAddLegalCase: (caseData: Omit<LegalCase, "id" | "userId" | "createdAt">) => Promise<void>;
  onUpdateLegalCaseStatus: (id: string, status: "Active" | "Pending" | "Closed") => Promise<void>;
  onUpdateLegalCase?: (id: string, updates: Partial<LegalCase>) => Promise<void>;
  onDeleteLegalCase: (id: string) => Promise<void>;
  onAddLawyer?: (lawyerData: Omit<Lawyer, "id" | "userId" | "createdAt">) => Promise<void>;
  onEditLawyer?: (id: string, data: Partial<Lawyer>) => Promise<void>;
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
  contracts = [],
  reminders = [],
  deliveryReports = [],
  lawyers = [],
  fastClosing = [],
  movements = [],
  onCumulativeReconcile,
  onUpdateReminderStatus,
  onAddLegalCase,
  onUpdateLegalCaseStatus,
  onUpdateLegalCase,
  onDeleteLegalCase,
  onAddLawyer,
  onEditLawyer,
  registerAddHandler,
  ownerProfile
}: LegalViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [showLawyerModal, setShowLawyerModal] = useState(false);
  const [editingLawyer, setEditingLawyer] = useState<Lawyer | null>(null); // CORREZIONE AE

  // CORREZIONE Q — espone l'apertura del modulo Studio Legale al tasto flottante globale
  useEffect(() => {
    registerAddHandler?.(() => {
      setEditingLawyer(null);
      setLawyerStudioName("");
      setLawyerName("");
      setLawyerEmail("");
      setLawyerPhone("");
      setLawyerAddress("");
      setLawyerStructuredAddress({});
      setLawyerSpecialization("Sfratti e Morosità");
      setShowLawyerModal(true);
    });
  });

  // Studio Legale Form states
  const [lawyerName, setLawyerName] = useState("");
  const [lawyerStudioName, setLawyerStudioName] = useState("");
  const [lawyerEmail, setLawyerEmail] = useState("");
  const [lawyerPhone, setLawyerPhone] = useState("");
  const [lawyerAddress, setLawyerAddress] = useState("");
  const [lawyerStructuredAddress, setLawyerStructuredAddress] = useState<AddressValue>({}); // CORREZIONE AB
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

  const handleOpenEditLawyer = (lawyer: Lawyer) => {
    setEditingLawyer(lawyer);
    setLawyerStudioName(lawyer.studioName);
    setLawyerName(lawyer.name);
    setLawyerEmail(lawyer.email || "");
    setLawyerPhone(lawyer.phone || "");
    setLawyerAddress(lawyer.address || "");
    setLawyerStructuredAddress(lawyer.structuredAddress || {});
    setLawyerSpecialization(lawyer.specialization || "Sfratti e Morosità");
    setShowLawyerModal(true);
  };

  const handleLawyerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lawyerStudioName.trim() || !lawyerName.trim()) {
      alert("Il nome dello studio e il nome del referente sono obbligatori.");
      return;
    }
    try {
      const payload = {
        studioName: lawyerStudioName,
        name: lawyerName,
        email: lawyerEmail || undefined,
        phone: lawyerPhone || undefined,
        address: lawyerAddress || undefined,
        structuredAddress: lawyerStructuredAddress,
        specialization: lawyerSpecialization
      };
      if (editingLawyer) {
        await onEditLawyer?.(editingLawyer.id, payload as any);
      } else if (onAddLawyer) {
        await onAddLawyer(payload as any);
      }
      setEditingLawyer(null);
      setLawyerStudioName("");
      setLawyerName("");
      setLawyerEmail("");
      setLawyerPhone("");
      setLawyerAddress("");
      setLawyerStructuredAddress({});
      setLawyerSpecialization("Sfratti e Morosità");
      setShowLawyerModal(false);
    } catch (err) {
      console.error("Error creating lawyer", err);
    }
  };

  // Piccolo formattatore di indirizzo strutturato, stessa logica usata in RemindersView
  // (tenuto locale qui per non introdurre una dipendenza incrociata tra i due componenti).
  const formatAddressForDossier = (addr?: { via?: string; civico?: string; interno?: string; citta?: string; provincia?: string; cap?: string }): string => {
    if (!addr) return "";
    const parts: string[] = [];
    if (addr.via) parts.push(`${addr.via}${addr.civico ? ` ${addr.civico}` : ""}${addr.interno ? `, int. ${addr.interno}` : ""}`);
    if (addr.cap || addr.citta || addr.provincia) {
      parts.push([addr.cap, addr.citta, addr.provincia ? `(${addr.provincia})` : ""].filter(Boolean).join(" "));
    }
    return parts.filter(Boolean).join(", ");
  };

  // CORREZIONE R — Estratta per essere riutilizzabile sia dal download manuale
  // sia dall'invio email automatico del fascicolo.
  // CORREZIONE CI (05/08/2026) — Ricostruito con dati REALI presi dagli atti dell'app
  // (Contratto, Solleciti, Verbali di Consegna/Riconsegna), al posto del contenuto di
  // esempio precompilato (date, importi e codici finti) usato finora. Dove un dato reale
  // non esiste ancora nell'app (es. Registrazione F24, non ancora implementata — vedi punto
  // pendente dedicato), il fascicolo lo dichiara esplicitamente invece di inventarlo: un
  // codice o un importo falso in un fascicolo destinato a un avvocato per una causa reale
  // sarebbe pericoloso, non solo scorretto.
  const buildDossierZipBlob = async (lawsuit: LegalCase): Promise<Blob> => {
    const zip = new JSZip();

    const divider = "================================================================================\n";
    const timestamp = new Date().toLocaleDateString("it-IT") + " " + new Date().toLocaleTimeString("it-IT");

    const relatedContract = contracts.find(c => c.id === lawsuit.contractId);
    const relatedTenant = tenants.find(t => t.name.toLowerCase().trim() === (lawsuit.tenantName || "").toLowerCase().trim());

    // Il Sollecito collegato a questa pratica: tra quelli con lo stesso nome debitore,
    // prende quello più avanti nella sequenza (più vicino o già arrivato in Messa in Mora),
    // stessa logica di riconoscimento per nome già usata altrove in questo file per il Garante.
    const relatedReminders = reminders
      .filter(r => (r.tenantName || "").toLowerCase().trim() === (lawsuit.tenantName || "").toLowerCase().trim())
      .sort((a, b) => (b.step || 0) - (a.step || 0));
    const relatedReminder = relatedReminders[0];

    const relatedDeliveryReports = deliveryReports.filter(dr =>
      (lawsuit.relatedDeliveryReportIds || []).includes(dr.id) ||
      (relatedContract && dr.contractId === relatedContract.id)
    );

    // 1. Contratto di Locazione
    let contractText = `${divider}FASCICOLO LEGALE PALAZZINARO AI - CONTRATTO DI LOCAZIONE\n${divider}\nData Generazione: ${timestamp}\nImmobile: ${lawsuit.propertyName || "Non Specificato"}\nInquilino: ${lawsuit.tenantName || "Non Specificato"}\n\n`;
    if (relatedContract) {
      contractText += `Stato Contratto: ${relatedContract.status}\nDecorrenza: ${relatedContract.startDate ? new Date(relatedContract.startDate).toLocaleDateString("it-IT") : "-"}\nScadenza: ${relatedContract.endDate ? new Date(relatedContract.endDate).toLocaleDateString("it-IT") : "-"}\nCanone: ${relatedContract.rentAmount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })} € (${relatedContract.frequency || "Mensile"})\nRegime Fiscale: ${relatedContract.taxRegime === "CedolareSecca" ? "Cedolare Secca" : relatedContract.taxRegime === "Ordinaria" ? "Ordinaria" : "Non specificato in anagrafica contratto"}\n\n`;
      contractText += relatedContract.generatedContractText
        ? `TESTO INTEGRALE DEL CONTRATTO GENERATO DAL WIZARD:\n\n${relatedContract.generatedContractText}\n`
        : `NOTA: il testo integrale del contratto non risulta generato tramite il Wizard Generatore Contratti di Palazzinaro AI. Allegare manualmente la copia firmata.\n`;
    } else {
      contractText += `NOTA: nessun contratto risulta collegato a questa pratica legale in Palazzinaro AI (contractId non impostato o contratto non trovato). Verificare e collegare manualmente.\n`;
    }
    zip.file("1_contratto_locazione.txt", contractText);

    // 2. Registrazione F24 — funzionalità non ancora implementata in Palazzinaro AI
    const f24Text = `${divider}FASCICOLO LEGALE PALAZZINARO AI - REGISTRAZIONE F24\n${divider}\nNOTA: la gestione delle registrazioni F24 reali non è ancora stata implementata in\nPalazzinaro AI (funzionalità pianificata, non ancora costruita). Questo fascicolo non può\nquindi includere una ricevuta F24 reale. Verificare la registrazione del contratto\ndirettamente con il commercialista o sul portale dell'Agenzia delle Entrate.\n`;
    zip.file("2_registrazione_f24.txt", f24Text);

    // 3/4. Solleciti — dati reali dal Sollecito collegato (date, importo, causale, testo
    // effettivamente proposto per l'invio se presente in suggestedLetterBody)
    if (relatedReminder) {
      const request1Text = `${divider}FASCICOLO LEGALE PALAZZINARO AI - CRONOLOGIA SOLLECITI: PRIMO SOLLECITO\n${divider}\nData Invio: ${relatedReminder.firstRequestDate ? new Date(relatedReminder.firstRequestDate).toLocaleDateString("it-IT") : "Non risulta ancora inviato in Palazzinaro AI"}\nDestinatario: ${relatedReminder.tenantName}\nImporto al momento del Sollecito: ${relatedReminder.amount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €\nCausale (voci insolute collegate): ${relatedReminder.reason || "Non specificata"}\n${relatedReminder.suggestedLetterBody ? `\nTesto del messaggio:\n"${relatedReminder.suggestedLetterBody}"\n` : ""}`;
      zip.file("3_primo_sollecito.txt", request1Text);

      const request2Text = relatedReminder.secondRequestDate || (relatedReminder.step || 0) >= 3
        ? `${divider}FASCICOLO LEGALE PALAZZINARO AI - CRONOLOGIA SOLLECITI: SECONDO SOLLECITO\n${divider}\nData Invio: ${relatedReminder.secondRequestDate ? new Date(relatedReminder.secondRequestDate).toLocaleDateString("it-IT") : "Non risulta ancora inviato in Palazzinaro AI"}\nDestinatario: ${relatedReminder.tenantName}\nImporto: ${relatedReminder.amount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €\n`
        : `${divider}FASCICOLO LEGALE PALAZZINARO AI - CRONOLOGIA SOLLECITI: SECONDO SOLLECITO\n${divider}\nNOTA: il secondo sollecito non risulta ancora inviato per questo debitore in Palazzinaro AI.\n`;
      zip.file("4_secondo_sollecito.txt", request2Text);
    } else {
      zip.file("3_primo_sollecito.txt", `${divider}NOTA: nessun Sollecito collegato trovato in Palazzinaro AI per "${lawsuit.tenantName}".\n`);
      zip.file("4_secondo_sollecito.txt", `${divider}NOTA: nessun Sollecito collegato trovato in Palazzinaro AI per "${lawsuit.tenantName}".\n`);
    }

    // 5. Messa in mora — stessi dati reali (debitore, importo, immobile, proprietario,
    // garante) usati per generare il PDF reale in Solleciti (jsPDF, generateMessaInMoraPDF).
    // Il PDF stampato non viene salvato in modo persistente da quella funzione: qui se ne
    // ricostruisce il contenuto testuale equivalente dagli stessi dati reali, non da un
    // modello fittizio con importi/codici inventati.
    const linkedProperty = properties.find(p => p.id === lawsuit.propertyId);
    const demandText = `${divider}FASCICOLO LEGALE PALAZZINARO AI - DIFFIDA AD ADEMPIERE E MESSA IN MORA (ART. 1219 C.C.)\n${divider}
Mittente (Proprietario): ${ownerProfile?.name || "Non impostato in Impostazioni"}${ownerProfile?.fiscalCode ? ` — C.F. ${ownerProfile.fiscalCode}` : ""}
Residenza Mittente: ${formatAddressForDossier(ownerProfile?.structuredAddress) || ownerProfile?.address || "Non impostata in Impostazioni"}
Destinatario: ${lawsuit.tenantName || "Non Specificato"}
Residenza Destinatario: ${formatAddressForDossier(relatedTenant?.address) || "Non disponibile in anagrafica Inquilino"}
Immobile Oggetto della Locazione: ${linkedProperty?.address || lawsuit.propertyName || "Non specificato"}
Importo Oggetto della Diffida: ${(relatedReminder?.amount ?? lawsuit.unpaidBalance)?.toLocaleString("it-IT", { minimumFractionDigits: 2 }) || "Non quantificato"} €
Causale: ${relatedReminder?.reason || "Canoni di locazione e/o spese accessorie scaduti e non versati"}
${relatedTenant?.guarantor?.name ? `Garante citato per conoscenza: ${relatedTenant.guarantor.name}\n` : ""}
Stato: ${(relatedReminder?.step || 0) >= 3 || relatedReminder?.status === "MessaInMora" ? "Generata e avviata a stampa per raccomandata A/R (da Solleciti in Palazzinaro AI)" : "NON risulta ancora generata per questa pratica in Palazzinaro AI"}
`;
    zip.file("5_diffida_messa_in_mora.txt", demandText);

    // 6. Ricevuta di ritorno (Raccomandata) — campi reali del Sollecito se presenti
    let receiptText = `${divider}FASCICOLO LEGALE PALAZZINARO AI - RICEVUTA DI RITORNO / CONSEGNA RACCOMANDATA\n${divider}\n`;
    if (relatedReminder?.registeredLetterReceiptName) {
      receiptText += `Ricevuta Raccomandata Caricata:\n- Nome File: ${relatedReminder.registeredLetterReceiptName}\n${relatedReminder.registeredLetterReceiptUrl ? `- Collegamento: ${relatedReminder.registeredLetterReceiptUrl}\n` : ""}`;
    } else if (lawsuit.notes && lawsuit.notes.includes("Ricevuta raccomandata:")) {
      const match = lawsuit.notes.match(/Ricevuta raccomandata: ([^\.]+)/);
      receiptText += `Ricevuta Raccomandata Caricata (da note pratica):\n- ${match ? match[0] : lawsuit.notes}\n`;
    } else {
      receiptText += `NOTA: nessuna ricevuta di ritorno della raccomandata risulta ancora caricata in Palazzinaro AI per questa pratica.\n`;
    }
    zip.file("6_ricevuta_ritorno.txt", receiptText);

    // 7. Mastrino Saldo — importo reale + causale reale del Sollecito
    const balanceText = `${divider}FASCICOLO LEGALE PALAZZINARO AI - ESTRATTO CONTO DELLA MOROSITA'\n${divider}
Situazione al ${timestamp}
Inquilino: ${lawsuit.tenantName || "Non Specificato"}
Posizione Debitoria Rilevata: ${lawsuit.unpaidBalance ? lawsuit.unpaidBalance.toLocaleString("it-IT", { minimumFractionDigits: 2 }) + " €" : "Non ancora quantificata in Palazzinaro AI"}
Voci Insolute Collegate: ${relatedReminder?.reason || "Vedere il registro Fast Closing/Solleciti in Palazzinaro AI per il dettaglio delle singole voci"}
Numero Voci Contabili Associate: ${relatedReminder?.associatedItemsIds?.length ?? "Non disponibile"}
`;
    zip.file("7_mastrino_saldo.txt", balanceText);

    // 9. Verbali di Consegna/Riconsegna reali, se presenti
    if (relatedDeliveryReports.length > 0) {
      relatedDeliveryReports.forEach((dr, idx) => {
        const checklistText = (dr.checklist || []).map(it => `- ${it.item}: ${it.status}${it.notes ? ` (${it.notes})` : ""}`).join("\n") || "Nessuna voce checklist registrata.";
        const drText = `${divider}FASCICOLO LEGALE PALAZZINARO AI - VERBALE DI ${dr.type === "riconsegna" ? "RICONSEGNA" : "CONSEGNA"}\n${divider}
Data Verbale: ${dr.date ? new Date(dr.date).toLocaleDateString("it-IT") : "Non specificata"}
Firma Proprietario: ${dr.signatures?.ownerSigned ? `Sì (${dr.signatures.ownerSignedAt || "data non tracciata"})` : "Non firmato"}
Firma Inquilino: ${dr.signatures?.tenantSigned ? `Sì (${dr.signatures.tenantSignedAt || "data non tracciata"})` : "Non firmato"}
Danni Riscontrati: ${dr.hasDamages ? `Sì — ${dr.damagesDescription || "descrizione non specificata"}${dr.estimatedDamagesAmount ? ` (stima: ${dr.estimatedDamagesAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €)` : ""}` : "No"}

Checklist:
${checklistText}
`;
        zip.file(`9_verbale_${dr.type}_${idx + 1}.txt`, drText);
      });
    }

      // 8. CORREZIONE G — Dati del Garante (se presente), con dati fiscali reali e documenti allegati
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
    if (!lawyer.email || !lawyer.email.includes("@")) {
      alert(`Lo studio legale "${lawyer.studioName}" non ha un indirizzo email valido in anagrafica. Impossibile inviare.`);
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
La presente email è stata generata automaticamente dal sistema di intelligenza artificiale Palazzinaro AI, in nome e per conto del proprietario. La firma del proprietario è raccolta digitalmente.`;

    // CORREZIONE BD — Ora si usa davvero Resend (via la funzione server /api/send-email),
    // che supporta allegati veri fino a 10MB anche sul piano gratuito — niente più client di
    // posta da aprire a mano, l'email parte per davvero con lo ZIP allegato.
    try {
      const zipBlob = await buildDossierZipBlob(lawsuit);
      const zipFileName = `Fascicolo_Legale_${lawsuit.tenantName?.replace(/\s+/g, "_") || "Pratica"}.zip`;

      // Converte il Blob in base64, formato richiesto da Resend per gli allegati
      const zipBase64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] || ""); // rimuove il prefisso "data:...;base64,"
        };
        reader.onerror = reject;
        reader.readAsDataURL(zipBlob);
      });

      const htmlBody = emailBody.split("\n").map(line => line.trim() === "---" ? "<hr/>" : `<p>${line || "&nbsp;"}</p>`).join("\n");

      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: lawyer.email,
          subject: "Invio Documentazione per Recupero Coattivo",
          html: htmlBody,
          attachments: [{ filename: zipFileName, content: zipBase64 }]
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Errore sconosciuto durante l'invio tramite Resend.");
      }

      const nowIso = new Date().toISOString();
      await onUpdateLegalCase?.(lawsuit.id, {
        dossierSentAt: nowIso,
        dossierSentToEmail: lawyer.email
      });

      alert(`Fascicolo inviato con successo a ${lawyer.email} (${lawyer.studioName}), con lo ZIP allegato per davvero.`);
    } catch (err: any) {
      console.error("Errore invio fascicolo via Resend:", err);
      alert(`Errore durante l'invio: ${err?.message || JSON.stringify(err)}\n\nVerifica che RESEND_API_KEY sia configurata su Vercel.`);
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

  // ── CORREZIONE (14/08/2026) — Riconciliazione/Pagamento/Rientro in Solleciti dall'Area
  // Legale, richiesto da Massimo: "quando la pratica è al legale deve essere possibile o
  // riportarla in solleciti o riconciliarla o darla per pagata come nelle altre parti".
  // Prima non esisteva alcuna azione economica su una pratica legale: un pagamento incassato
  // mentre il fascicolo era in mano al legale non poteva mai essere tolto dal saldo insoluto.

  // Trova il Sollecito d'origine di una pratica: per ID reale (sourceReminderId, impostato
  // dal 14/08/2026 in poi in RemindersView.handleMoveToLegalAction), oppure — solo per i
  // fascicoli storici creati prima di questa data — per abbinamento sul nome del debitore,
  // stessa logica già usata (con gli stessi limiti) da buildDossierZipBlob più sopra.
  const resolveCaseReminder = (legalCase: LegalCase): Reminder | undefined => {
    if (legalCase.sourceReminderId) {
      const byId = reminders.find(r => r.id === legalCase.sourceReminderId);
      if (byId) return byId;
    }
    return reminders
      .filter(r => (r.tenantName || "").toLowerCase().trim() === (legalCase.tenantName || "").toLowerCase().trim())
      .sort((a, b) => (b.step || 0) - (a.step || 0))[0];
  };

  // Voci Fast Closing ancora da saldare collegate alla pratica (canoni + spese accessorie),
  // stessa fonte reale usata in Solleciti — mai un fallback per nome+stato generico (regola 5).
  const getCaseLinkedItems = (legalCase: LegalCase): FastClosingItem[] => {
    const reminder = resolveCaseReminder(legalCase);
    const ids = new Set<string>(
      (legalCase.associatedItemsIds && legalCase.associatedItemsIds.length > 0)
        ? legalCase.associatedItemsIds
        : (reminder?.associatedItemsIds || [])
    );
    return fastClosing.filter(item => ids.has(item.id) && (item.status === "Pending" || item.status === "Overdue"));
  };

  // CORREZIONE (14/08/2026, su richiesta di Massimo) — un ritaglio del mastrino con TUTTE le
  // righe contabili oggetto della pratica, incluse quelle già Pagate, non solo le insolute:
  // serve come descrizione/contesto della pratica (da dove nasce il debito), non solo come
  // lista di voci ancora da riconciliare (quello resta lo scopo di getCaseLinkedItems sopra,
  // usata dalla modale di riconciliazione — nessuna modifica al suo comportamento).
  const getCaseAllLinkedItems = (legalCase: LegalCase): FastClosingItem[] => {
    const reminder = resolveCaseReminder(legalCase);
    const ids = new Set<string>(
      (legalCase.associatedItemsIds && legalCase.associatedItemsIds.length > 0)
        ? legalCase.associatedItemsIds
        : (reminder?.associatedItemsIds || [])
    );
    return fastClosing
      .filter(item => ids.has(item.id))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  };

  const caseLedgerExportColumns: LedgerColumn[] = [
    { key: "title", label: "Voce", align: "left" },
    { key: "dueDateFormatted", label: "Scadenza", align: "center" },
    { key: "statusLabel", label: "Stato", align: "center" },
    { key: "amountFormatted", label: "Importo", align: "right" }
  ];

  const handleCaseMarkPaid = async (legalCase: LegalCase) => {
    const reminder = resolveCaseReminder(legalCase);
    const linkedItems = getCaseLinkedItems(legalCase);
    if (!reminder) {
      alert("Impossibile trovare il Sollecito d'origine di questa pratica (fascicolo storico senza collegamento reale). Segna come pagato direttamente dalla pagina Solleciti.");
      return;
    }
    const total = linkedItems.reduce((s, i) => s + i.amount, 0) || legalCase.unpaidBalance || reminder.amount || 0;
    if (!confirm(`Confermi che il debitore "${legalCase.tenantName}" ha saldato per intero €${total.toLocaleString("it-IT", { minimumFractionDigits: 2 })}? Le voci collegate in Fast Closing e il Sollecito verranno segnati come Pagati.`)) {
      return;
    }
    try {
      await onUpdateReminderStatus?.(reminder.id, "Paid", "Saldato direttamente da Area Legale.");
      await onUpdateLegalCase?.(legalCase.id, {
        unpaidBalance: 0,
        balanceSettledAt: new Date().toISOString(),
        balanceSettledNotes: `${legalCase.balanceSettledNotes ? legalCase.balanceSettledNotes + "\n" : ""}Saldo azzerato da Area Legale il ${new Date().toLocaleDateString("it-IT")}: pagamento diretto di €${total.toLocaleString("it-IT", { minimumFractionDigits: 2 })}.`
      });
      alert("Pratica saldata con successo. Il saldo insoluto è stato azzerato.");
    } catch (err) {
      console.error("Error marking legal case as paid", err);
    }
  };

  const handleCaseReturnToReminders = async (legalCase: LegalCase) => {
    const reminder = resolveCaseReminder(legalCase);
    if (!reminder) {
      alert("Impossibile trovare il Sollecito d'origine di questa pratica (fascicolo storico senza collegamento reale). Contatta l'assistenza per ripristinare il collegamento.");
      return;
    }
    if (!confirm(`Confermi di voler riportare la posizione di "${legalCase.tenantName}" in Area Solleciti? La pratica legale verrà archiviata (non eliminata) e il Sollecito tornerà attivo e azionabile dalla pagina Solleciti.`)) {
      return;
    }
    try {
      // Riporta il Sollecito allo step "Messa in Mora già inviata" (4), togliendolo dallo
      // stato "In Legale" (step 5) — resta comunque tutta la cronologia dei passaggi già fatti.
      await onUpdateReminderStatus?.(reminder.id, reminder.status === "Paid" ? "Paid" : "MessaInMora", "Pratica riportata in Area Solleciti dall'Area Legale.", { step: 4 });
      await onUpdateLegalCase?.(legalCase.id, {
        status: "Closed",
        notes: `${legalCase.notes ? legalCase.notes + "\n\n" : ""}Pratica riportata in Area Solleciti il ${new Date().toLocaleDateString("it-IT")} (archiviata qui, non eliminata).`
      });
      alert("Posizione riportata in Area Solleciti. La pratica legale resta archiviata qui per lo storico, non è stata eliminata.");
    } catch (err) {
      console.error("Error returning legal case to reminders", err);
    }
  };

  // Stato del modulo di riconciliazione con bonifico bancario
  const [reconcileCaseId, setReconcileCaseId] = useState<string | null>(null);
  const [caseSelectedItemIds, setCaseSelectedItemIds] = useState<string[]>([]);
  const [caseSelectedMovementId, setCaseSelectedMovementId] = useState("");
  const [caseReconcileCashMode, setCaseReconcileCashMode] = useState(false);
  const [caseReconciliationError, setCaseReconciliationError] = useState("");

  const handleOpenCaseReconcile = (legalCase: LegalCase) => {
    setReconcileCaseId(legalCase.id);
    setCaseSelectedItemIds(getCaseLinkedItems(legalCase).map(i => i.id));
    setCaseSelectedMovementId("");
    setCaseReconcileCashMode(false);
    setCaseReconciliationError("");
  };

  const unreconciledMovements = movements.filter(m => !m.reconciled);

  const handleConfirmCaseReconciliation = async () => {
    const legalCase = legalCases.find(c => c.id === reconcileCaseId);
    if (!legalCase || !onCumulativeReconcile) return;
    const linkedItems = getCaseLinkedItems(legalCase);
    const selectedItems = linkedItems.filter(i => caseSelectedItemIds.includes(i.id));
    if (selectedItems.length === 0) return;
    if (!caseReconcileCashMode && !caseSelectedMovementId) return;

    const totalNeeded = selectedItems.reduce((s, i) => s + i.amount, 0);
    const currentUnpaid = legalCase.unpaidBalance || 0;

    try {
      if (caseReconcileCashMode) {
        if (!confirm(`Confermi di aver saldato in contanti (o comunque verificato personalmente) €${totalNeeded.toFixed(2)} per "${legalCase.tenantName}"?`)) return;
        await onCumulativeReconcile(caseSelectedItemIds, { cashAmount: totalNeeded });
        const newUnpaid = Math.max(0, currentUnpaid - totalNeeded);
        await onUpdateLegalCase?.(legalCase.id, {
          unpaidBalance: newUnpaid,
          balanceSettledAt: newUnpaid === 0 ? new Date().toISOString() : legalCase.balanceSettledAt,
          balanceSettledNotes: `${legalCase.balanceSettledNotes ? legalCase.balanceSettledNotes + "\n" : ""}Incasso in contanti registrato da Area Legale il ${new Date().toLocaleDateString("it-IT")}: €${totalNeeded.toFixed(2)}.`
        });
        alert("Incasso registrato con successo.");
      } else {
        const movement = movements.find(m => m.id === caseSelectedMovementId);
        if (!movement) return;
        await onCumulativeReconcile(caseSelectedItemIds, { movementId: movement.id });
        const applied = Math.min(movement.amount, totalNeeded);
        const newUnpaid = Math.max(0, currentUnpaid - applied);
        await onUpdateLegalCase?.(legalCase.id, {
          unpaidBalance: newUnpaid,
          balanceSettledAt: newUnpaid === 0 ? new Date().toISOString() : legalCase.balanceSettledAt,
          balanceSettledNotes: `${legalCase.balanceSettledNotes ? legalCase.balanceSettledNotes + "\n" : ""}Riconciliato da Area Legale il ${new Date().toLocaleDateString("it-IT")} con bonifico di €${movement.amount.toFixed(2)}.`
        });
        if (movement.amount < totalNeeded) {
          alert(`Riconciliazione parziale eseguita! Bonifico da €${movement.amount.toFixed(2)} applicato su €${totalNeeded.toFixed(2)}. Il residuo resta sulla relativa voce.`);
        } else {
          alert("Riconciliazione completata con successo.");
        }
      }
      setReconcileCaseId(null);
      setCaseSelectedItemIds([]);
      setCaseSelectedMovementId("");
      setCaseReconciliationError("");
    } catch (err) {
      console.error("Error reconciling legal case", err);
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
      </div>

      {/* Legal Cases Grid */}
      {legalCases.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-lg mx-auto mt-8">
          <div className="bg-slate-50 text-slate-400 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <Scale size={28} />
          </div>
          <h3 className="font-sans font-bold text-slate-800 text-base">Nessun fascicolo legale aperto</h3>
          <p className="text-xs text-slate-500 mt-2">
            Non ci sono vertenze o pratiche legali registrate. Il tuo portafoglio è in piena armonia amministrativa! Una pratica arriva qui automaticamente solo dalla sequenza Solleciti, dopo l'upload della ricevuta di ritorno della raccomandata.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* CORREZIONE Q — Colonna 1: Fascicoli da Associare (trascinabili) */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FolderOpen size={13} className="text-amber-700 shrink-0" />
              Fascicoli da Associare ({unassignedCases.length})
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
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <User size={13} className="text-indigo-700 shrink-0" />
              Studi Legali ({lawyers.length})
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
                      onClick={() => handleOpenEditLawyer(l)}
                      className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer group ${
                        dragOverLawyerId === l.id
                          ? "border-indigo-500 ring-2 ring-indigo-200 scale-[1.02] bg-indigo-50/30"
                          : "border-slate-100 bg-slate-50/40 hover:border-indigo-200"
                      }`}
                    >
                      <span className="relative w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 overflow-hidden">
                        <LegalPersonAvatarIcon className="w-7 h-7" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{l.studioName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{l.name} · {count} pratiche</p>
                      </div>
                      <span className="text-slate-300 group-hover:text-indigo-500 shrink-0" title="Modifica dati">
                        <Pencil size={12} />
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Colonna 3: Pratiche Già Associate */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              Pratiche Associate ({assignedCases.length})
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
                      <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Mail size={10} className="text-indigo-700 shrink-0" />
                        Inviato il {new Date(c.dossierSentAt).toLocaleDateString("it-IT")} a {c.dossierSentToEmail}
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

                  {/* CORREZIONE (14/08/2026) — Posizione Debitoria: prima una pratica in Area
                      Legale non aveva alcuna azione economica, il saldo insoluto restava
                      "congelato" anche a pagamento avvenuto. */}
                  <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        <Wallet size={14} className="text-indigo-600" />
                        <span>Posizione Debitoria</span>
                      </div>
                      <span className={`text-xs font-mono font-black ${(lawsuit.unpaidBalance || 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        €{(lawsuit.unpaidBalance || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {lawsuit.balanceSettledAt && (lawsuit.unpaidBalance || 0) === 0 && (
                      <p className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-1.5">
                        Saldo azzerato il {new Date(lawsuit.balanceSettledAt).toLocaleDateString("it-IT")}.
                      </p>
                    )}
                    {(lawsuit.unpaidBalance || 0) > 0 && lawsuit.status !== "Closed" && (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => handleOpenCaseReconcile(lawsuit)}
                          className="inline-flex items-center gap-1 text-[10px] font-black text-amber-900 bg-amber-500 hover:bg-amber-400 px-2.5 py-1.5 rounded-lg transition-colors"
                          title="Riconcilia con un bonifico bancario registrato"
                        >
                          <Landmark size={11} />
                          Riconcilia
                        </button>
                        <button
                          onClick={() => handleCaseMarkPaid(lawsuit)}
                          className="inline-flex items-center gap-1 text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1.5 rounded-lg transition-colors"
                          title="Segna come saldato per intero (contanti o verifica personale)"
                        >
                          <CheckCircle2 size={11} />
                          Segna Pagato
                        </button>
                        <button
                          onClick={() => handleCaseReturnToReminders(lawsuit)}
                          className="inline-flex items-center gap-1 text-[10px] font-black text-slate-700 bg-slate-200 hover:bg-slate-300 px-2.5 py-1.5 rounded-lg transition-colors"
                          title="Chiude la pratica legale (archiviata, non eliminata) e riporta il Sollecito attivo in Area Solleciti"
                        >
                          <RotateCcw size={11} />
                          Rientra in Solleciti
                        </button>
                      </div>
                    )}
                  </div>

                  {/* CORREZIONE (14/08/2026, su richiesta di Massimo) — "Righe Contabili della
                      Pratica": prima la pratica legale mostrava solo un totale insoluto senza
                      spiegare da quali voci derivasse. Qui un vero ritaglio del mastrino
                      (stessa fonte reale — Fast Closing — mai un riepilogo testuale scollegato),
                      con tutte le righe collegate (anche quelle già Pagate, per il contesto
                      storico completo), stessa identica veste grafica delle altre tabelle
                      mastrino (intestazione scura, bordi sottili, importi in monospazio
                      allineati a destra) e barra di stampa/export universale. */}
                  {(() => {
                    const caseAllItems = getCaseAllLinkedItems(lawsuit);
                    const caseLedgerExportRows = caseAllItems.map(item => ({
                      title: item.title,
                      dueDateFormatted: new Date(item.dueDate).toLocaleDateString("it-IT"),
                      statusLabel: item.status === "Paid" ? "Saldato" : item.status === "Overdue" ? "Scaduto" : "In Sospeso",
                      amountFormatted: `€${item.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`
                    }));
                    const caseItemsTotal = caseAllItems.reduce((s, i) => s + i.amount, 0);
                    return (
                      <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            <FileText size={14} className="text-indigo-600" />
                            <span>Righe Contabili della Pratica</span>
                          </div>
                          {caseAllItems.length > 0 && (
                            <LedgerExportToolbar
                              title={`Pratica Legale — ${lawsuit.tenantName}`}
                              columns={caseLedgerExportColumns}
                              rows={caseLedgerExportRows}
                              totalsRow={{ title: "TOTALE", amountFormatted: `€${caseItemsTotal.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` }}
                              filenameBase={`pratica-legale-${lawsuit.tenantName}`}
                            />
                          )}
                        </div>
                        {caseAllItems.length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic px-1 py-1">
                            Nessuna voce contabile reale collegata a questa pratica (probabile
                            fascicolo storico creato prima del collegamento per ID — vedi il
                            Sollecito d'origine per il dettaglio).
                          </p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <table className="w-full text-[10.5px] border-collapse">
                              <thead>
                                <tr className="bg-slate-800 text-slate-100">
                                  <th className="p-2 text-left font-bold uppercase tracking-wider text-[9px] border border-slate-700">Voce</th>
                                  <th className="p-2 text-center font-bold uppercase tracking-wider text-[9px] border border-slate-700">Scadenza</th>
                                  <th className="p-2 text-center font-bold uppercase tracking-wider text-[9px] border border-slate-700">Stato</th>
                                  <th className="p-2 text-right font-bold uppercase tracking-wider text-[9px] border border-slate-700">Importo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {caseAllItems.map((item, idx) => (
                                  <tr key={item.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"} ${item.status === "Paid" ? "opacity-50" : ""}`}>
                                    <td className="p-2 border border-slate-200 text-slate-700 align-top max-w-[220px] truncate" title={item.title}>
                                      {item.title}
                                    </td>
                                    <td className="p-2 border border-slate-200 text-center font-mono text-slate-600 align-top">
                                      {new Date(item.dueDate).toLocaleDateString("it-IT")}
                                    </td>
                                    <td className="p-2 border border-slate-200 text-center align-top">
                                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                        item.status === "Paid"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : item.status === "Overdue"
                                          ? "bg-rose-200 text-rose-900"
                                          : "bg-amber-100 text-amber-800"
                                      }`}>
                                        {item.status === "Paid" ? "Saldato" : item.status === "Overdue" ? "Scaduto" : "In Sospeso"}
                                      </span>
                                    </td>
                                    <td className="p-2 border border-slate-200 text-right font-mono font-black text-slate-800 align-top">
                                      €{item.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-slate-100 font-black">
                                  <td colSpan={3} className="p-2 border border-slate-200 text-right text-[9px] uppercase tracking-wider text-slate-500">Totale</td>
                                  <td className="p-2 border border-slate-200 text-right font-mono text-slate-900">
                                    €{caseItemsTotal.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}

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
                          <p className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-1.5 flex items-start gap-1">
                            <Mail size={10} className="text-indigo-700 shrink-0 mt-0.5" />
                            <span>Fascicolo inviato il {new Date(lawsuit.dossierSentAt).toLocaleDateString("it-IT")} alle {new Date(lawsuit.dossierSentAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} a {lawsuit.dossierSentToEmail}</span>
                          </p>
                        ) : (
                          <p className="text-[9px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 flex items-center gap-1">
                            <AlertTriangle size={10} className="text-amber-600 shrink-0" />
                            Fascicolo non ancora inviato a questo studio.
                          </p>
                        )}
                        <button
                          onClick={() => {
                            const lawyer = lawyers.find(l => l.id === lawsuit.assignedLawyerId);
                            if (!lawyer) return;
                            // CORREZIONE AG — ogni invio richiede conferma con possibilità di annullare
                            const confirmed = confirm(
                              lawsuit.dossierSentAt
                                ? `Vuoi inviare di nuovo il fascicolo a ${lawyer.studioName} (${lawyer.email})?`
                                : `Vuoi inviare ora il fascicolo a ${lawyer.studioName} (${lawyer.email})?`
                            );
                            if (!confirmed) return;
                            handleSendDossierEmail(lawsuit, lawyer);
                          }}
                          className="w-full text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg py-1.5 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <span className="w-[14px] h-[14px] rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <Mail size={9} className="text-white" />
                          </span>
                          {lawsuit.dossierSentAt ? "Invia di Nuovo il Fascicolo" : "Invia il Fascicolo Ora"}
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
              <h3 className="font-sans font-bold text-base">
                {editingLawyer ? "Modifica Studio Legale" : "Registra Nuovo Studio Legale"}
              </h3>
              <button onClick={() => { setShowLawyerModal(false); setEditingLawyer(null); }} className="text-slate-100 hover:text-white transition-colors">
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

              <AddressFields value={lawyerStructuredAddress} onChange={setLawyerStructuredAddress} />

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
                  {editingLawyer ? "Salva Modifiche" : "Registra Studio"}
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

      {/* CORREZIONE (14/08/2026) — Modulo di riconciliazione con bonifico/incasso in
          contanti per una pratica in Area Legale, stesso motore condiviso e stessa UX già
          in uso in Solleciti (src/lib/reconciliation.ts). */}
      {reconcileCaseId && (() => {
        const legalCase = legalCases.find(c => c.id === reconcileCaseId);
        if (!legalCase) return null;
        const linkedItems = getCaseLinkedItems(legalCase);
        const selectionTotal = linkedItems.filter(i => caseSelectedItemIds.includes(i.id)).reduce((s, i) => s + i.amount, 0);
        return (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 bg-amber-600 text-white flex items-center justify-between shrink-0">
                <h3 className="font-sans font-bold text-base">Riconcilia — {legalCase.tenantName}</h3>
                <button onClick={() => setReconcileCaseId(null)} className="text-amber-100 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto">
                {linkedItems.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Nessuna voce Fast Closing ancora da saldare risulta collegata a questa pratica (fascicolo storico senza collegamento reale al Sollecito d'origine). Usa "Segna Pagato" oppure gestisci la riconciliazione direttamente dalla pagina Solleciti.
                  </p>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-bold text-slate-700 mb-2">Voci da saldare:</p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {linkedItems.map(item => (
                          <label key={item.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-100 hover:bg-slate-50 text-xs cursor-pointer">
                            <span className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={caseSelectedItemIds.includes(item.id)}
                                onChange={() => setCaseSelectedItemIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])}
                              />
                              <span className="truncate text-slate-700">{item.title}</span>
                            </span>
                            <span className="font-mono font-bold text-slate-900 shrink-0">€{item.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-right text-xs font-mono font-black text-slate-900 mt-2">
                        Totale selezionato: €{selectionTotal.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setCaseReconcileCashMode(false)}
                        className={`flex-1 text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${!caseReconcileCashMode ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"}`}
                      >
                        Bonifico Bancario
                      </button>
                      <button
                        type="button"
                        onClick={() => setCaseReconcileCashMode(true)}
                        className={`flex-1 text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${caseReconcileCashMode ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"}`}
                      >
                        Contanti / Verifica Manuale
                      </button>
                    </div>

                    {!caseReconcileCashMode && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Movimento Bancario da Abbinare
                        </label>
                        <select
                          value={caseSelectedMovementId}
                          onChange={(e) => setCaseSelectedMovementId(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-hidden focus:border-indigo-500"
                        >
                          <option value="">Seleziona un movimento non riconciliato...</option>
                          {unreconciledMovements.map(m => (
                            <option key={m.id} value={m.id}>
                              {new Date(m.date).toLocaleDateString("it-IT")} — {m.description} — €{m.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                            </option>
                          ))}
                        </select>
                        {unreconciledMovements.length === 0 && (
                          <p className="text-[10px] text-slate-400 mt-1">Nessun movimento bancario non riconciliato disponibile. Importalo prima dall'Area Banche.</p>
                        )}
                      </div>
                    )}

                    {caseReconciliationError && (
                      <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{caseReconciliationError}</p>
                    )}
                  </>
                )}
              </div>
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2 shrink-0">
                <button
                  onClick={() => setReconcileCaseId(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-white transition-colors"
                >
                  Annulla
                </button>
                {linkedItems.length > 0 && (
                  <button
                    onClick={handleConfirmCaseReconciliation}
                    disabled={caseSelectedItemIds.length === 0 || (!caseReconcileCashMode && !caseSelectedMovementId)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    Conferma Riconciliazione
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

