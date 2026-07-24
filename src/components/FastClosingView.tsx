
import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  CalendarClock, 
  DollarSign, 
  Calendar, 
  Landmark, 
  Check, 
  X, 
  AlertCircle, 
  Trash2, 
  ArrowRight,
  Printer,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  FileSpreadsheet,
  Upload,
  Camera,
  FileText,
  Image as ImageIcon,
  Sparkles
} from "lucide-react";
import { FastClosingItem, BankMovement, Tenant, Property, LegalCase, Reminder, Owner } from "../types";

interface FastClosingViewProps {
  fastClosing: FastClosingItem[];
  movements: BankMovement[];
  tenants: Tenant[];
  owners?: Owner[]; // CORREZIONE D — per risolvere il debitore reale delle voci a carico proprietario
  properties: Property[];
  legalCases?: LegalCase[];
  reminders?: Reminder[];
  onAddClosingItem: (item: Omit<FastClosingItem, "id" | "userId" | "createdAt">) => Promise<void>;
  onUpdateClosingItemStatus: (id: string, status: "Pending" | "Paid" | "Overdue" | "Cancelled") => Promise<void>;
  onPostponeClosingItem: (id: string, newDueDate: string) => Promise<void>;
  onReconcileMovement: (movementId: string, closingItemId: string) => Promise<void>;
  onDeleteClosingItem: (id: string) => Promise<void>;
  onAddMovement?: (movement: Omit<BankMovement, "id" | "userId" | "createdAt">) => Promise<void>;
  onAddReminder?: (reminder: Omit<Reminder, "id" | "userId" | "createdAt">) => Promise<void>;
  onUpdateReminderStatus?: (id: string, status: string, notes?: string, extraFields?: any) => Promise<void>;
}

export default function FastClosingView({
  fastClosing,
  movements,
  tenants,
  owners = [],
  properties,
  legalCases = [],
  reminders = [],
  onAddClosingItem,
  onUpdateClosingItemStatus,
  onPostponeClosingItem,
  onReconcileMovement,
  onDeleteClosingItem,
  onAddMovement,
  onAddReminder,
  onUpdateReminderStatus
}: FastClosingViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>("current"); // "current", "2026-06", "2026-05"

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

  // Countdown States
  const [timeLeftAuto, setTimeLeftAuto] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [timeLeftManual, setTimeLeftManual] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, unlocked: false });

  // Dialog States
  const [reconcileItem, setReconcileItem] = useState<FastClosingItem | null>(null);
  const [postponeItem, setPostponeItem] = useState<FastClosingItem | null>(null);
  const [selectedMovementId, setSelectedMovementId] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  // Cumulative Reconciliation States
  const [cumulativeTenant, setCumulativeTenant] = useState<Tenant | null>(null);
  const [selectedCumulativeItemIds, setSelectedCumulativeItemIds] = useState<string[]>([]);
  const [cumulativeMovementId, setCumulativeMovementId] = useState("");
  // CORREZIONE K — consente di saldare anche senza abbinare un movimento bancario
  // (contanti, o un movimento già verificato manualmente dall'utente fuori sistema)
  const [cumulativeCashMode, setCumulativeCashMode] = useState(false);
  const [reconciliationError, setReconciliationError] = useState("");

  // Manual Closing State / Summary
  const [showPreCloseModal, setShowPreCloseModal] = useState(false);
  const [showClosingSummary, setShowClosingSummary] = useState(false);
  const [closedItemsCount, setClosedItemsCount] = useState(0);
  const [reproposedItemsList, setReproposedItemsList] = useState<string[]>([]);
  const [forceUnlock, setForceUnlock] = useState(false);

  // Form fields for new item
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState("");
  const [source, setSource] = useState<"contract" | "condominium" | "manual">("manual");

  // Real-time timer ticks
  useEffect(() => {
    const updateCountdowns = () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      // Target 1: End of current month
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
      const diffAuto = endOfMonth.getTime() - now.getTime();
      if (diffAuto > 0) {
        setTimeLeftAuto({
          days: Math.floor(diffAuto / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diffAuto % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diffAuto % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diffAuto % (1000 * 60)) / 1000)
        });
      } else {
        setTimeLeftAuto({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }

      // Target 2: 20th of the current month
      const manualDate = new Date(currentYear, currentMonth, 20, 0, 0, 0);
      const diffManual = manualDate.getTime() - now.getTime();
      if (diffManual > 0) {
        setTimeLeftManual({
          days: Math.floor(diffManual / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diffManual % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diffManual % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diffManual % (1000 * 60)) / 1000),
          unlocked: false
        });
      } else {
        setTimeLeftManual({ days: 0, hours: 0, minutes: 0, seconds: 0, unlocked: true });
      }
    };

    updateCountdowns();
    const interval = setInterval(updateCountdowns, 1000);
    return () => clearInterval(interval);
  }, []);

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

  // Helper to determine tenant for a fast closing item
  const getTenantGroup = (item: FastClosingItem) => {
    const titleLower = (item.title || "").toLowerCase();
    const descLower = (item.description || "").toLowerCase();
    
    for (const t of tenants) {
      const nameClean = (t.name || "").replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase().trim();
      const nameParts = nameClean.split(" ");
      
      // Direct match or matching key parts of the name
      const matchesFullName = titleLower.includes(nameClean) || descLower.includes(nameClean);
      const matchesSurname = nameParts.length > 1 && (titleLower.includes(nameParts[nameParts.length - 1]) || descLower.includes(nameParts[nameParts.length - 1]));
      
      if (matchesFullName || matchesSurname) {
        return t;
      }
    }
    return null;
  };

  const getDebtorName = (item: FastClosingItem) => {
    // ── CORREZIONE D — Collegamento diretto e sicuro (ID reale), sempre verificato per primo ──
    // Le voci create dopo questa correzione portano con sé debtorId + debtorType: qui si
    // risolve il nome attuale della persona direttamente dal suo record reale (Tenant/Owner),
    // così il nome resta sempre corretto anche se la persona viene rinominata in seguito.
    if (item.debtorId && item.debtorType === "tenant") {
      const t = tenants.find((tt) => tt.id === item.debtorId);
      if (t) return t.name;
    }
    if (item.debtorId && item.debtorType === "owner") {
      const o = owners.find((oo) => oo.id === item.debtorId);
      if (o) return o.name;
    }

    // ── Fallback legacy — solo per voci create PRIMA della CORREZIONE D, senza debtorId ──
    // Riconoscimento a partire dal testo del titolo. Nessun nome scritto fisso: se non si
    // trova corrispondenza reale, la voce resta genericamente "Spese Generali / Condomini"
    // (che nel resto dell'app significa esplicitamente "nessun sollecito da generare").
    if (item.source === "maintenance") {
      const matchQuota = item.title.match(/Quota\s+([^-]+?)\s*-\s*Manutenzione:/i);
      if (matchQuota) {
        return matchQuota[1].trim();
      }

      const matchQuotaProp = item.title.match(/Quota\s+Proprietari\s*\(([^)]+)\)/i);
      if (matchQuotaProp) {
        return matchQuotaProp[1].trim();
      }

      const matchQuotaInq = item.title.match(/Quota\s+Inquilina\s*\(([^)]+)\)/i);
      if (matchQuotaInq) {
        return matchQuotaInq[1].trim();
      }
    }

    // Prova a trovare corrispondenze reali nella lista inquilini
    for (const t of tenants) {
      const nameClean = (t.name || "").replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase().trim();
      if (nameClean && (item.title.toLowerCase().includes(nameClean) || (item.description || "").toLowerCase().includes(nameClean))) {
        return t.name;
      }

      const lastSpaceIdx = t.name.lastIndexOf(" ");
      if (lastSpaceIdx !== -1) {
        const surname = t.name.substring(lastSpaceIdx + 1).toLowerCase().trim();
        if (surname.length > 2 && (item.title.toLowerCase().includes(surname) || (item.description || "").toLowerCase().includes(surname))) {
          return t.name;
        }
      }
    }

    // Prova a trovare corrispondenze reali nella lista proprietari
    for (const o of owners) {
      const nameClean = (o.name || "").replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase().trim();
      if (nameClean && (item.title.toLowerCase().includes(nameClean) || (item.description || "").toLowerCase().includes(nameClean))) {
        return o.name;
      }
    }

    return "Spese Generali / Condomini";
  };

  // 1. Filter items by selected month archive
  const monthFilteredItems = useMemo(() => {
    return fastClosing.filter(item => {
      const dateStr = item.dueDate; // format YYYY-MM-DD
      if (selectedMonthYear === "current") {
        // Current month and general upcoming/overdue
        return dateStr.startsWith("2026-07") || item.status === "Overdue" || (item.status === "Pending" && new Date(item.dueDate) < new Date());
      } else {
        // Specific past month (e.g. June 2026 "2026-06", May 2026 "2026-05")
        return dateStr.startsWith(selectedMonthYear);
      }
    });
  }, [fastClosing, selectedMonthYear]);

  // Group month-filtered fast closing items of source "maintenance" by sourceId (ticket)
  const maintenanceReconciliationGroups = useMemo(() => {
    const groups: { [ticketId: string]: { ticketId: string; title: string; propertyName: string; totalCost: number; items: FastClosingItem[] } } = {};
    
    monthFilteredItems.forEach(item => {
      if (item.source === "maintenance" && item.sourceId) {
        const ticketId = item.sourceId;
        if (!groups[ticketId]) {
          // Extract title of the maintenance intervention. 
          let cleanedTitle = item.title;
          const splitParts = item.title.split(" - ");
          if (splitParts.length >= 3) {
            cleanedTitle = splitParts.slice(2).join(" - ");
          } else if (splitParts.length === 2) {
            cleanedTitle = splitParts[1];
          }
          
          // Get the property name from title or description
          let propertyName = "Immobile";
          const matchProp = item.title.match(/-\s*([^-]+)$/);
          if (matchProp) {
            propertyName = matchProp[1].trim();
          } else {
            const descProp = item.description?.split(" per l'immobile ")[1]?.split(".")[0];
            if (descProp) propertyName = descProp;
          }

          groups[ticketId] = {
            ticketId,
            title: cleanedTitle,
            propertyName,
            totalCost: 0,
            items: []
          };
        }
        groups[ticketId].items.push(item);
      }
    });

    // Calculate total cost as sum of splits
    Object.values(groups).forEach(g => {
      g.totalCost = g.items.reduce((sum, item) => sum + item.amount, 0);
    });

    return Object.values(groups);
  }, [monthFilteredItems]);

  // 2. Apply status filters on top of month filter
  const filteredItems = useMemo(() => {
    return filterStatus === "all" 
      ? monthFilteredItems 
      : monthFilteredItems.filter(item => {
          if (filterStatus === "Overdue") {
            return item.status === "Overdue" || (item.status === "Pending" && new Date(item.dueDate) < new Date());
          }
          return item.status === filterStatus;
        });
  }, [monthFilteredItems, filterStatus]);

  // 3. Group filtered items by Debitore for the spreadsheet view
  const groupedItems = useMemo(() => {
    const groups: { [debtorName: string]: FastClosingItem[] } = {};
    
    filteredItems.forEach(item => {
      const name = getDebtorName(item);
      if (!groups[name]) {
        groups[name] = [];
      }
      groups[name].push(item);
    });
    
    return Object.keys(groups)
      .sort((a, b) => {
        if (a === "Spese Generali / Condomini") return 1;
        if (b === "Spese Generali / Condomini") return -1;
        return a.localeCompare(b);
      })
      .map(debtorName => {
        const matchingTenant = tenants.find(t => t.name === debtorName);
        return {
          tenant: matchingTenant || null,
          debtorName,
          items: groups[debtorName]
        };
      });
  }, [filteredItems, tenants]);

  const handleOpenAddModal = () => {
    setTitle("");
    setDescription("");
    setAmount(0);
    setDueDate("");
    setSource("manual");
    setShowModal(true);
  };

  // Handle single item submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || amount <= 0 || !dueDate) {
      alert("Titolo, importo maggiore di zero e scadenza sono obbligatori.");
      return;
    }

    try {
      await onAddClosingItem({
        title,
        description,
        amount,
        dueDate,
        source,
        status: "Pending"
      });
      setShowModal(false);
    } catch (err) {
      console.error("Error creating deadline item", err);
    }
  };

  // Status updates
  const handleStatusChange = async (id: string, nextStatus: "Pending" | "Paid" | "Overdue" | "Cancelled") => {
    try {
      await onUpdateClosingItemStatus(id, nextStatus);

      // CORREZIONE A — Se si tratta di un canone d'affitto marcato Insoluto (Overdue) tramite
      // questo pulsante (non tramite la chiusura mensile), crea SUBITO il Sollecito, con la
      // stessa logica di raggruppamento per debitore già usata in chiusura. Se il debitore ha
      // già un Sollecito attivo in corso, la voce si aggiunge a quello invece di duplicarlo.
      if (nextStatus === "Overdue" && onAddReminder) {
        const item = fastClosing.find(f => f.id === id);
        const isRigid = !!item && (item.source === "contract" || (item.title || "").toLowerCase().includes("canone"));
        if (item && isRigid) {
          const debtorName = getDebtorName(item);
          if (debtorName && debtorName !== "Spese Generali / Condomini") {
            const matchingTenant = tenants.find(t => t.name === debtorName) || null;

            // Cerca un Sollecito già attivo (non concluso/pagato) per questo debitore
            const activeReminder = (reminders || []).find(r =>
              r.tenantName === debtorName &&
              r.status !== "Paid" &&
              r.status !== "Cancelled"
            );

            if (activeReminder) {
              // Aggiunge la voce al gruppo esistente invece di creare un nuovo Sollecito
              const updatedIds = Array.from(new Set([...(activeReminder.associatedItemsIds || []), item.id]));
              const updatedAmount = (activeReminder.amount || 0) + item.amount;
              if (onUpdateReminderStatus) {
                await onUpdateReminderStatus(activeReminder.id, activeReminder.status as any, activeReminder.followUpNotes, {
                  associatedItemsIds: updatedIds,
                  amount: updatedAmount
                });
              }
            } else {
              const itemLabel = item.title.split(" - ")[1] || item.title;
              await onAddReminder({
                tenantId: matchingTenant?.id || "",
                tenantName: debtorName,
                amount: item.amount,
                reason: `Sollecito automatico: ${itemLabel} (€${item.amount.toFixed(2)})`,
                dueDate: new Date().toISOString().split("T")[0],
                status: "Pending",
                isSequence: true,
                step: 1,
                associatedItemsIds: [item.id]
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("Error updating status", err);
    }
  };

  const handleOpenPostpone = (item: FastClosingItem) => {
    setPostponeItem(item);
    setNewDueDate(item.dueDate);
  };

  const handleConfirmPostpone = async () => {
    if (!postponeItem || !newDueDate) return;
    try {
      await onPostponeClosingItem(postponeItem.id, newDueDate);
      setPostponeItem(null);
    } catch (err) {
      console.error("Error postponing item", err);
    }
  };

  // Open single reconciliation
  const handleOpenReconcile = (item: FastClosingItem) => {
    setReconcileItem(item);
    setSelectedMovementId("");
  };

  const handleConfirmReconciliation = async () => {
    if (!reconcileItem || !selectedMovementId) return;
    try {
      await onReconcileMovement(selectedMovementId, reconcileItem.id);
      setReconcileItem(null);
      setSelectedMovementId("");
    } catch (err) {
      console.error("Error reconciling item", err);
    }
  };

  // Cumulative Reconciliation Modal triggers
  const handleOpenCumulative = (tenant: Tenant, groupItems: FastClosingItem[]) => {
    setCumulativeTenant(tenant);
    // Auto-select all Pending/Overdue items initially
    const activeItemIds = groupItems
      .filter(item => (item.status as any) === "Pending" || (item.status as any) === "Overdue" || ((item.status as any) === "Pending" && new Date(item.dueDate) < new Date()))
      .map(item => item.id);
    setSelectedCumulativeItemIds(activeItemIds);
    setCumulativeMovementId("");
    setReconciliationError("");
  };

  const handleOpenCumulativeForDebtor = (debtorName: string, groupItems: FastClosingItem[], tenantObj: Tenant | null) => {
    const dummyTenant: Tenant = tenantObj || {
      id: debtorName,
      userId: "",
      name: debtorName,
      email: "",
      phone: "",
      createdAt: ""
    };
    
    setCumulativeTenant(dummyTenant);
    const activeItemIds = groupItems
      .filter(item => (item.status as any) === "Pending" || (item.status as any) === "Overdue" || ((item.status as any) === "Pending" && new Date(item.dueDate) < new Date()))
      .map(item => item.id);
    setSelectedCumulativeItemIds(activeItemIds);
    setCumulativeMovementId("");
    setCumulativeCashMode(false);
    setReconciliationError("");
  };

  const toggleCumulativeItem = (itemId: string) => {
    setSelectedCumulativeItemIds(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  // Confirm Cumulative reconciliation — con bonifico, oppure in contanti/verifica manuale
  const handleConfirmCumulativeReconciliation = async () => {
    if (!cumulativeTenant || selectedCumulativeItemIds.length === 0) return;
    if (!cumulativeCashMode && !cumulativeMovementId) return;
    
    const selectedItems = monthFilteredItems.filter(item => selectedCumulativeItemIds.includes(item.id));
    
    // PRIORITY CHECK: Has rent item in pending, but didn't select it?
    const allTenantPendingItems = monthFilteredItems.filter(item => {
      const itemDebtor = getDebtorName(item);
      return itemDebtor === cumulativeTenant.name && (item.status === "Pending" || item.status === "Overdue");
    });
    
    const rentItems = allTenantPendingItems.filter(item => 
      item.source === "contract" || 
      (item.title || "").toLowerCase().includes("canone") || 
      (item.title || "").toLowerCase().includes("affitto")
    );

    const containsRent = rentItems.length > 0;
    const selectedRent = selectedItems.some(item => 
      item.source === "contract" || 
      (item.title || "").toLowerCase().includes("canone") || 
      (item.title || "").toLowerCase().includes("affitto")
    );

    if (containsRent && !selectedRent) {
      setReconciliationError("La riconciliazione del canone d'affitto è prioritaria! Seleziona anche la riga del canone d'affitto per poter procedere.");
      return;
    }

    const totalNeeded = selectedItems.reduce((sum, item) => sum + item.amount, 0);

    // ── CORREZIONE K — Saldo in contanti / verifica manuale, senza bonifico da abbinare ──
    if (cumulativeCashMode) {
      const confirmed = confirm(
        `Confermi di aver saldato €${totalNeeded.toFixed(2)} per ${cumulativeTenant.name} in contanti (o comunque verificato personalmente, senza un movimento bancario da abbinare)?\n\nQuesta azione segnerà come "Pagato" le voci selezionate.`
      );
      if (!confirmed) return;

      try {
        for (const item of selectedItems) {
          await onUpdateClosingItemStatus(item.id, "Paid");
        }
        alert(`Saldo in contanti registrato con successo per ${cumulativeTenant.name}!`);
        setCumulativeTenant(null);
      } catch (err) {
        console.error("Error in cash settlement", err);
      }
      return;
    }

    const movement = movements.find(m => m.id === cumulativeMovementId);
    if (!movement) return;

    try {
      if (movement.amount < totalNeeded) {
        // PARTIAL RECONCILIATION
        const residue = totalNeeded - movement.amount;
        
        // 1. Reconcile all selected items
        for (const item of selectedItems) {
          await onUpdateClosingItemStatus(item.id, "Paid");
        }
        
        // 2. Mark movement as reconciled
        await onReconcileMovement(movement.id, selectedItems[0].id);

        // 3. Create residue row for next month's Fast Closing
        // CORREZIONE H — mai una data scritta fissa: il "mese prossimo" si calcola sempre da oggi
        const nextMonthDate = new Date();
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
        nextMonthDate.setDate(5);
        const nextMonthDueDate = nextMonthDate.toISOString().split("T")[0];

        await onAddClosingItem({
          title: `Residuo Riconciliazione Parziale - Canone ${cumulativeTenant.name}`,
          description: `Residuo insoluto dopo riconciliazione parziale con bonifico di €${movement.amount.toFixed(2)}.`,
          amount: residue,
          dueDate: nextMonthDueDate,
          source: "contract",
          status: "Pending"
        });

        alert(`Riconciliazione Parziale eseguita! Bonifico da €${movement.amount.toFixed(2)} applicato su €${totalNeeded.toFixed(2)}. Creato residuo di €${residue.toFixed(2)} nel prossimo Fast Closing.`);
      } else {
        // FULL RECONCILIATION
        for (const item of selectedItems) {
          await onUpdateClosingItemStatus(item.id, "Paid");
        }
        await onReconcileMovement(movement.id, selectedItems[0].id);
        alert(`Riconciliazione completata con successo per ${cumulativeTenant.name}!`);
      }

      setCumulativeTenant(null);
    } catch (err) {
      console.error("Error in cumulative reconciliation", err);
    }
  };

  // Pre-closing data memoization for the confirmation & summary modal
  const preCloseData = useMemo(() => {
    const pendingItems = monthFilteredItems.filter(item => item.status === "Pending" || item.status === "Overdue");

    const rigidItems: FastClosingItem[] = [];
    const accessoryOverdueItems: FastClosingItem[] = [];
    const accessoryPendingItems: FastClosingItem[] = [];

    pendingItems.forEach(item => {
      const titleLower = (item.title || "").toLowerCase();
      const descLower = (item.description || "").toLowerCase();
      const isRigid = item.source === "contract" || 
                      titleLower.includes("canone") || 
                      titleLower.includes("affitto") ||
                      descLower.includes("canone") || 
                      descLower.includes("affitto");

      if (isRigid) {
        rigidItems.push(item);
      } else if (item.status === "Overdue") {
        accessoryOverdueItems.push(item);
      } else {
        accessoryPendingItems.push(item);
      }
    });

    // Consolidated Solleciti grouped by debtor name
    const sollecitiGroups: { [debtorName: string]: { tenant: Tenant | null, items: FastClosingItem[], total: number } } = {};
    const goingToSolleciti = [...rigidItems, ...accessoryOverdueItems];

    goingToSolleciti.forEach(item => {
      const debtorName = getDebtorName(item);
      if (debtorName === "Spese Generali / Condomini") {
        return;
      }
      if (!sollecitiGroups[debtorName]) {
        const matchingTenant = tenants.find(t => t.name === debtorName) || null;
        sollecitiGroups[debtorName] = {
          tenant: matchingTenant,
          items: [],
          total: 0
        };
      }
      sollecitiGroups[debtorName].items.push(item);
      sollecitiGroups[debtorName].total += item.amount;
    });

    return {
      rigidItems,
      accessoryOverdueItems,
      accessoryPendingItems,
      sollecitiGroups
    };
  }, [monthFilteredItems, tenants]);

  // Close Fast Closing action:
  // - Disable until day 20 of current month.
  // - All pending current items of selected month become "Overdue".
  // - Rigid items (Rent) are re-proposed on the next month's fast closing scadenziario.
  const handleCloseFastClosing = async () => {
    if (selectedMonthYear !== "current") return;
    
    const pendingItems = monthFilteredItems.filter(item => item.status === "Pending" || item.status === "Overdue");
    if (pendingItems.length === 0) {
      alert("Nessun elemento pendente nel Fast Closing di questo mese.");
      return;
    }

    // Open custom pre-close confirmation modal!
    setShowPreCloseModal(true);
  };

  const handleConfirmCloseFastClosing = async () => {
    setShowPreCloseModal(false);
    let closedCount = 0;
    const reproposedTitles: string[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      // 1. Create consolidated Solleciti for each debtor group
      for (const debtorName of Object.keys(preCloseData.sollecitiGroups)) {
        const group = preCloseData.sollecitiGroups[debtorName];
        if (group.items.length === 0) continue;

        const itemsListText = group.items.map(item => `${item.title.split(" - ")[1] || item.title} (€${item.amount.toFixed(2)})`).join(", ");
        const associatedItemsIds = group.items.map(item => item.id);

        if (onAddReminder) {
          await onAddReminder({
            tenantId: group.tenant?.id || "",
            tenantName: debtorName,
            amount: group.total,
            reason: `Sollecito automatico Fast Closing: ${itemsListText}`,
            dueDate: todayStr,
            status: "Pending",
            isSequence: true,
            step: 1,
            associatedItemsIds
          });
        }
      }

      // 2. Update statuses of the items
      // Rigid items -> Set status to Overdue and Re-propose to next month
      for (const item of preCloseData.rigidItems) {
        await onUpdateClosingItemStatus(item.id, "Overdue");
        closedCount++;

        const d = new Date(item.dueDate);
        d.setMonth(d.getMonth() + 1);
        const nextDueDate = d.toISOString().split('T')[0];

        await onAddClosingItem({
          title: `[Arretrato] ${item.title}`,
          description: `Canone insoluto riportato dalla chiusura del mese corrente.`,
          amount: item.amount,
          dueDate: nextDueDate,
          source: "contract",
          status: "Pending"
        });
        reproposedTitles.push(`${item.title} (€${item.amount.toFixed(2)})`);
      }

      // Accessory Overdue items -> Set status to Overdue
      for (const item of preCloseData.accessoryOverdueItems) {
        await onUpdateClosingItemStatus(item.id, "Overdue");
        closedCount++;
      }

      // Accessory Pending items -> Postpone to next month with status Pending
      for (const item of preCloseData.accessoryPendingItems) {
        const d = new Date(item.dueDate);
        d.setMonth(d.getMonth() + 1);
        const nextDueDate = d.toISOString().split('T')[0];
        await onPostponeClosingItem(item.id, nextDueDate);
      }

      setClosedItemsCount(closedCount);
      setReproposedItemsList(reproposedTitles);
      setShowClosingSummary(true);
    } catch (err) {
      console.error("Error confirming fast closing closure", err);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm("Eliminare questa scadenza dallo scadenziario?")) {
      try {
        await onDeleteClosingItem(id);
      } catch (err) {
        console.error("Error deleting closing item", err);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Check if today is before the 20th to disable the manual closing button (bypassable with admin override state)
  const currentDayOfMonth = new Date().getDate();
  const isClosingButtonDisabled = currentDayOfMonth < 20 && !forceUnlock;

  return (
    <div className="space-y-6" id="fast-closing-view-container">
      
      {/* Printable Section - HIDDEN ON WEB, VISIBLE ON PRINT */}
      <div className="hidden print:block p-10 bg-white text-slate-900 border border-slate-300" id="printable-report">
        <div className="flex justify-between items-center pb-6">
          <div>
            <h1 className="text-xl font-bold font-sans uppercase">Palazzinaro AI - Registro Cassa Fast Closing</h1>
            <p className="text-xs text-slate-500 mt-1">Generato il: {new Date().toLocaleDateString("it-IT")}</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono">Periodo: {selectedMonthYear === "current" ? "Luglio 2026" : selectedMonthYear}</span>
          </div>
        </div>

        <table className="w-full text-left mt-8 text-xs border-collapse">
          <thead>
            <tr className="-2 border-slate-400 bg-slate-50 text-[10px] uppercase font-mono font-bold text-slate-700">
              <th className="py-2.5">Categoria</th>
              <th className="py-2.5">Dettagli Scadenza</th>
              <th className="py-2.5">Scadenza</th>
              <th className="py-2.5">Stato</th>
              <th className="py-2.5 text-right">Importo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {monthFilteredItems.map(item => (
              <tr key={item.id} className="py-2">
                <td className="py-2.5 font-mono capitalize">{item.source}</td>
                <td className="py-2.5 font-semibold">{item.title}</td>
                <td className="py-2.5 font-mono">{new Date(item.dueDate).toLocaleDateString("it-IT")}</td>
                <td className="py-2.5 font-bold uppercase">{item.status}</td>
                <td className="py-2.5 text-right font-bold">€{item.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-10 border-t-2 border-slate-300 pt-6 flex justify-between items-start">
          <div>
            <p className="text-[10px] italic text-slate-400">Generato digitalmente da Palazzinaro AI Enterprise. Copia contabile di cassa.</p>
          </div>
          <div className="text-right space-y-1.5 text-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Totale Cassa Periodo</p>
            <p className="text-lg font-black text-slate-900">
              €{monthFilteredItems.reduce((s, i) => s + i.amount, 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Main View Screen Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-5 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Fast Closing & Scadenze</h2>
          <p className="text-xs text-slate-500 mt-0.5">La cabina di regia mensile per amministrare canoni, spese condominiali, riparti, e stampare il registro.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl -2 border-slate-300 active:-0 transition-all"
            title="Stampa Registro Cassa"
          >
            <Printer size={14} />
            <span>Stampa Registro</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            id="add-deadline-btn"
            className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-5 py-3 rounded-xl active:transition-all shadow-md active:shadow-xs"
          >
            <Plus size={15} />
            <span>Nuova Scadenza Manuale</span>
          </button>

          <button
            onClick={handleOpenImportModal}
            id="import-statement-btn"
            className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 py-3 rounded-xl active:transition-all shadow-md active:shadow-xs"
          >
            <Upload size={14} />
            <span>Importa Estratto Conto (OCR AI)</span>
          </button>
        </div>
      </div>

      {/* Timers & Closing Action Panel (no-print) */}
      {selectedMonthYear === "current" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-950 text-white p-5 rounded-2xl shadow-md border border-slate-900 no-print">
          <div>
            <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider flex items-center space-x-1.5">
              <Clock size={12} className="animate-pulse" />
              <span>Chiusura Automatica Fine Mese</span>
            </span>
            <div className="flex space-x-2.5 mt-2.5 text-center">
              {[
                { label: "G", val: timeLeftAuto.days },
                { label: "O", val: timeLeftAuto.hours },
                { label: "M", val: timeLeftAuto.minutes },
                { label: "S", val: timeLeftAuto.seconds }
              ].map((t, idx) => (
                <div key={idx} className="bg-slate-900 p-2 rounded-lg min-w-[45px] border border-slate-800">
                  <span className="block text-sm font-mono font-black">{String(t.val).padStart(2, "0")}</span>
                  <span className="text-[8px] text-slate-500 uppercase tracking-widest">{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase font-black text-indigo-400 tracking-wider flex items-center space-x-1.5">
              <CalendarClock size={12} />
              <span>Chiusura Anticipata (Dal Giorno 20)</span>
            </span>
            {timeLeftManual.unlocked ? (
              <p className="text-xs text-emerald-400 font-bold mt-3">✓ Sbloccata! Puoi effettuare la chiusura manuale.</p>
            ) : (
              <div className="flex space-x-2.5 mt-2.5 text-center">
                {[
                  { label: "G", val: timeLeftManual.days },
                  { label: "O", val: timeLeftManual.hours },
                  { label: "M", val: timeLeftManual.minutes },
                  { label: "S", val: timeLeftManual.seconds }
                ].map((t, idx) => (
                  <div key={idx} className="bg-slate-900 p-2 rounded-lg min-w-[45px] border border-slate-800">
                    <span className="block text-sm font-mono font-black text-indigo-300">{String(t.val).padStart(2, "0")}</span>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest">{t.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center lg:items-end justify-center gap-2">
            <button
              onClick={handleCloseFastClosing}
              id="close-fast-closing-btn"
              disabled={isClosingButtonDisabled}
              className={`w-full lg:w-auto inline-flex items-center justify-center space-x-2 font-black text-xs px-5 py-4 rounded-xl shadow-lg transition-all ${
                isClosingButtonDisabled
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed opacity-60"
                  : "bg-red-600 hover:bg-red-500 text-white"
              }`}
            >
              <span>{isClosingButtonDisabled ? "🔒" : "🔓"}</span>
              <span>Chiudi Fast Closing Luglio</span>
            </button>
            
            {currentDayOfMonth < 20 && (
              <label className="flex items-center space-x-2 cursor-pointer bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg select-none hover:bg-slate-850 transition-colors">
                <input
                  type="checkbox"
                  checked={forceUnlock}
                  onChange={(e) => setForceUnlock(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-700 h-3.5 w-3.5"
                />
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                  Forza Sblocco Admin (Sperimentale)
                </span>
              </label>
            )}
          </div>
        </div>
      )}

      {/* Archives and Filters bar (no-print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 no-print">
        {/* Month Dropdown Selector */}
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Registro Mese:</span>
          <select
            value={selectedMonthYear}
            onChange={(e) => setSelectedMonthYear(e.target.value)}
            className="text-xs font-black bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2 text-indigo-800 focus:outline-hidden"
          >
            <option value="current">Luglio 2026 (Mese Corrente)</option>
            <option value="2026-06">Giugno 2026 (Archiviato)</option>
            <option value="2026-05">Maggio 2026 (Archiviato)</option>
            <option value="2026-04">Aprile 2026 (Archiviato)</option>
          </select>
        </div>

        {/* Categories / Status filters */}
        <div className="flex flex-wrap gap-1.5">
          {["all", "Pending", "Overdue", "Paid", "Cancelled"].map((statusOption) => (
            <button
              key={statusOption}
              onClick={() => setFilterStatus(statusOption)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatus === statusOption
                  ? "bg-indigo-600 text-white font-bold"
                  : "text-slate-500 hover:bg-slate-100 border border-transparent"
              }`}
            >
              {statusOption === "all" && "Tutte"}
              {statusOption === "Pending" && "In Sospeso"}
              {statusOption === "Overdue" && "Scadute"}
              {statusOption === "Paid" && "Saldato"}
              {statusOption === "Cancelled" && "Annullate"}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped items by Tenant or general list (no-print) */}
      <div className="space-y-6 no-print">
        {/* Color-coded Divided Reconciliation Boxes for Maintenance Splits */}
        {maintenanceReconciliationGroups.length > 0 && (
          <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-6 space-y-4 shadow-md" id="maintenance-reconciliation-panel">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
              <div>
                <h3 className="font-sans font-black text-sm text-indigo-400 flex items-center gap-2">
                  <span>🛠️</span>
                  Riconciliazione Spese Manutenzioni Ripartite
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Visualizzazione ed esazione suddivisa per le manutenzioni a carico Proprietario e Inquilino.
                </p>
              </div>
              <div className="bg-slate-800 text-slate-300 font-mono text-[9px] px-2 py-1 rounded-md font-bold uppercase shrink-0">
                {maintenanceReconciliationGroups.length} interventi questo mese
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {maintenanceReconciliationGroups.map((group) => {
                const totalPaid = group.items.filter(i => i.status === "Paid").reduce((sum, i) => sum + i.amount, 0);
                const totalUnpaid = group.items.filter(i => i.status !== "Paid").reduce((sum, i) => sum + i.amount, 0);
                
                return (
                  <div key={group.ticketId} className="bg-slate-950 rounded-xl border border-slate-800/80 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2 pb-2">
                      <div className="min-w-0">
                        <span className="text-[9px] text-slate-500 font-mono font-bold block uppercase">
                          📍 {group.propertyName}
                        </span>
                        <h4 className="font-black text-xs text-slate-200 truncate leading-snug">
                          {group.title}
                        </h4>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[9px] text-slate-500 block uppercase">Spesa Totale</span>
                        <span className="font-black text-xs text-indigo-300">
                          €{group.totalCost.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Subdivided color-coded boxes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {group.items.map((item) => {
                        const isOwner = item.title.toLowerCase().includes("proprietario");
                        const isPaid = item.status === "Paid";
                        
                        // Set colors: Owner (indigo-slate), Tenant (amber-slate)
                        const bgClass = isPaid
                          ? "bg-emerald-950/20 border-emerald-900/50"
                          : isOwner
                          ? "bg-indigo-950/20 border-indigo-900/50"
                          : "bg-amber-950/20 border-amber-900/50";
                        
                        const titleClass = isOwner ? "text-indigo-400" : "text-amber-400";
                        const icon = isOwner ? "💼" : "👤";
                        const roleLabel = isOwner ? "Proprietario" : "Inquilino";

                        // Settle/reconcile action in the box!
                        return (
                          <div key={item.id} className={`p-3 rounded-lg border flex flex-col justify-between min-h-[96px] ${bgClass}`}>
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-[9px] font-black uppercase tracking-wider ${titleClass}`}>
                                  {icon} {roleLabel}
                                </span>
                                <span className={`text-[8px] font-black rounded px-1 ${
                                  isPaid ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400 animate-pulse"
                                }`}>
                                  {isPaid ? "PAGATO" : "ATTESA"}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-300 truncate mt-1 font-bold">
                                {item.title.split(" - ")[1] || "Quota"}
                              </p>
                              <p className="text-xs font-mono font-black text-slate-100 mt-0.5">
                                €{item.amount.toFixed(2)}
                              </p>
                            </div>

                            <div className="mt-2 pt-1.5 border-t border-slate-900 flex justify-end items-center">
                              {!isPaid ? (
                                <div className="flex gap-1.5 w-full">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReconcile(item)}
                                    className="flex-1 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[9px] rounded-md transition-colors cursor-pointer"
                                  >
                                    Riconcilia
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(item.id, "Paid")}
                                    className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] rounded-md transition-colors cursor-pointer"
                                  >
                                    Salda
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(item.id, "Pending")}
                                  className="w-full py-1 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-[9px] rounded-md transition-colors cursor-pointer"
                                >
                                  Riapri Quota
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Subtotals footer for this ticket */}
                    <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono pt-1">
                      <span>Saldato: <strong className="text-emerald-400">€{totalPaid.toFixed(2)}</strong></span>
                      <span>In Sospeso: <strong className="text-rose-400">€{totalUnpaid.toFixed(2)}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {groupedItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-lg mx-auto">
            <div className="bg-slate-50 text-slate-400 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4">
              <CalendarClock size={28} />
            </div>
            <h3 className="font-sans font-bold text-slate-800 text-base">Nessuna scadenza trovata</h3>
            <p className="text-xs text-slate-500 mt-2">
              Non ci sono scadenze che corrispondono ai filtri scelti. Puoi aggiungere un'entrata o una spesa manualmente.
            </p>
          </div>
        ) : (
          groupedItems.map((group, groupIdx) => {
            const isGeneral = group.tenant === null;
            const tenantName = group.debtorName;
            
            // Calculate group subtotal for Pending/Overdue
            const groupPendingSubtotal = group.items
              .filter(item => item.status === "Pending" || item.status === "Overdue" || (item.status === "Pending" && new Date(item.dueDate) < new Date()))
              .reduce((sum, item) => sum + item.amount, 0);

            // Colored border theme around the grouped sums to clearly close each group
            const borderColors = [
              "border-indigo-400",
              "border-emerald-400",
              "border-violet-400",
              "border-amber-400",
              "border-rose-400"
            ];
            const colorClass = isGeneral ? "border-slate-300" : borderColors[groupIdx % borderColors.length];

            return (
              <div 
                key={group.debtorName}
                className={`p-6 rounded-2xl border-2 bg-white shadow-xs mb-8 ${colorClass}`}
                id={`tenant-group-container-${isGeneral ? "general" : groupIdx}`}
              >
                {/* Group header bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{isGeneral ? "🏢" : "👤"}</span>
                    <div>
                      <h4 className="font-black text-sm text-slate-900">{tenantName}</h4>
                      {!isGeneral && group.tenant?.fiscalCode && (
                        <span className="text-[10px] font-mono text-slate-400">C.F. {group.tenant.fiscalCode}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    {groupPendingSubtotal > 0 && (
                      <div className="text-right">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">In Sospeso Totale</span>
                        <span className="text-sm font-black text-slate-950 font-mono">€{groupPendingSubtotal.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    
                    {groupPendingSubtotal > 0 && selectedMonthYear === "current" && (
                      <button
                        onClick={() => handleOpenCumulativeForDebtor(group.debtorName, group.items, group.tenant)}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-lg transition-all shadow-sm cursor-pointer"
                        title="Riconcilia più scadenze con un unico bonifico"
                      >
                        <Coins size={13} />
                        <span>Riconciliazione Unica</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Spreadsheet style grid */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-slate-300 text-xs font-mono">
                    <thead className="bg-slate-100 border border-slate-300 text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-700">
                      <tr>
                        <th className="p-2.5 border border-slate-300 text-center w-[10%]">Stato</th>
                        <th className="p-2.5 border border-slate-300 text-center w-[12%]">Scadenza</th>
                        <th className="p-2.5 border border-slate-300 text-center w-[12%]">Origine</th>
                        <th className="p-2.5 border border-slate-300 text-left w-[42%] font-sans">Titolo / Causale Contabile</th>
                        <th className="p-2.5 border border-slate-300 text-right w-[12%]">Importo</th>
                        <th className="p-2.5 border border-slate-300 text-center w-[12%] no-print">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {group.items.map(item => {
                        const isOverdue = item.status === "Pending" && new Date(item.dueDate) < new Date();
                        const isPaid = item.status === "Paid";

                        const titleLower = (item.title || "").toLowerCase();
                        const descLower = (item.description || "").toLowerCase();
                        const isRigidItem = item.source === "contract" || 
                                            titleLower.includes("canone") || 
                                            titleLower.includes("affitto") ||
                                            descLower.includes("canone") || 
                                            descLower.includes("affitto");

                        // Check if this item is associated with a tenant undergoing active legal action
                        const isCriticalTenantItem = tenants.some(t => {
                          const tName = (t.name || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
                          const itemTitle = (item.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                          const itemDesc = (item.description || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                          
                          const matches = itemTitle.includes(tName) || tName.includes(itemTitle) || itemDesc.includes(tName);
                          if (!matches) return false;
                          
                          return (legalCases || []).some(lc => {
                            if (lc.status === "Closed") return false;
                            const lcTenantName = (lc.tenantName || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
                            return lcTenantName.includes(tName) || tName.includes(lcTenantName);
                          });
                        });

                        return (
                          <tr 
                            key={item.id} 
                            className={`hover:bg-slate-50 transition-colors ${
                              isCriticalTenantItem ? "bg-rose-50/20" : ""
                            }`}
                          >
                            {/* Stato Cell */}
                            <td className="p-2.5 border border-slate-300 text-center font-bold">
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider block text-center ${
                                isPaid 
                                  ? "bg-emerald-100 text-emerald-800" 
                                  : item.status === "Overdue"
                                  ? "bg-rose-100 text-rose-800 animate-pulse"
                                  : isOverdue 
                                  ? "bg-rose-100 text-rose-800 animate-pulse" 
                                  : "bg-amber-100 text-amber-800"
                              }`}>
                                {isPaid ? "SALDATO" : (item.status === "Overdue" ? "INSOLUTO" : (isOverdue ? "SCADUTO" : "ATTESA"))}
                              </span>
                            </td>

                            {/* Scadenza Cell */}
                            <td className="p-2.5 border border-slate-300 text-center font-bold text-slate-700">
                              {new Date(item.dueDate).toLocaleDateString("it-IT")}
                            </td>

                            {/* Origine Cell */}
                            <td className="p-2.5 border border-slate-300 text-center">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded font-extrabold text-slate-500 uppercase text-[9px]">
                                {item.source}
                              </span>
                            </td>

                            {/* Titolo Cell */}
                            <td className="p-2.5 border border-slate-300 font-sans">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`font-bold text-xs ${
                                  isCriticalTenantItem ? "text-rose-600 font-black flex items-center gap-1" : "text-slate-950"
                                }`}>
                                  {isCriticalTenantItem && <span className="text-sm">⚖️</span>}
                                  {item.title}
                                </span>
                                {isCriticalTenantItem && (
                                  <span className="text-[7px] bg-rose-150 text-rose-800 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                    Contenzioso Legale
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                                  {item.description}
                                </p>
                              )}
                            </td>

                            {/* Importo Cell */}
                            <td className="p-2.5 border border-slate-300 text-right font-black text-slate-900">
                              €{item.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                            </td>

                            {/* Azioni Cell */}
                            <td className="p-2.5 border border-slate-300 text-center no-print">
                              {selectedMonthYear === "current" ? (
                                <div className="flex justify-center items-center gap-1">
                                  {!isPaid ? (
                                    <>
                                      <button
                                        onClick={() => handleOpenReconcile(item)}
                                        className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-sm text-[9px] font-black tracking-wide cursor-pointer"
                                        title="Associa a movimento bancario"
                                      >
                                        Riconcilia
                                      </button>
                                      <button
                                        onClick={() => handleStatusChange(item.id, "Paid")}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-[9px] font-black tracking-wide cursor-pointer"
                                        title="Segna come saldato"
                                      >
                                        Salda
                                      </button>
                                      
                                      {/* Insoluto Toggle — available for both rents and accessory items.
                                          For rents (isRigidItem) this triggers automatic reminder creation in Solleciti.
                                          For accessory items it's just a status flag. */}
                                      {item.status === "Overdue" ? (
                                        <button
                                          onClick={() => handleStatusChange(item.id, "Pending")}
                                          className="px-2 py-1 bg-slate-500 hover:bg-slate-400 text-white rounded-sm text-[9px] font-black tracking-wide cursor-pointer"
                                          title="Segna come in attesa"
                                        >
                                          In Attesa
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleStatusChange(item.id, "Overdue")}
                                          className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-sm text-[9px] font-black tracking-wide cursor-pointer"
                                          title={isRigidItem ? "Segna come insoluto (crea sollecito automatico)" : "Segna come insoluto"}
                                        >
                                          Insoluto
                                        </button>
                                      )}

                                      {/* Rinvia scadenza — SOLO per spese accessorie.
                                          Gli affitti NON possono essere rinviati, devono essere esitati. */}
                                      {!isRigidItem && (
                                        <button
                                          onClick={() => handleOpenPostpone(item)}
                                          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-sm text-[9px] font-black tracking-wide cursor-pointer"
                                          title="Rinvia scadenza"
                                        >
                                          Rinvia
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => handleStatusChange(item.id, "Pending")}
                                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-sm text-[9px] font-black tracking-wide cursor-pointer"
                                      title="Riapri scadenza"
                                    >
                                      Riapri
                                    </button>
                                  )}

                                  {item.source !== "reminder" && item.source !== "contract" && (
                                    <button
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                      title="Elimina"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[9px] text-slate-400 font-mono italic">Archiviato</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Interposed spacing row to neatly close the grid before subtotals */}
                      <tr className="bg-slate-50/50">
                        <td colSpan={6} className="h-2 p-0 border border-slate-300 bg-slate-100/50"></td>
                      </tr>

                      {/* Subtotal row */}
                      <tr className="bg-slate-50 font-bold">
                        <td colSpan={3} className="p-2.5 border border-slate-300 text-slate-500 text-[10px] uppercase tracking-wider font-extrabold font-mono">
                          RIEPILOGO CONTO DI {tenantName.toUpperCase()}
                        </td>
                        <td className="p-2.5 border border-slate-300 text-right font-sans font-black text-xs text-slate-700 uppercase">
                          Totale In Sospeso / Scaduto:
                        </td>
                        <td className="p-2.5 border border-slate-300 text-right font-mono font-black text-xs text-indigo-700 bg-indigo-50/60">
                          €{groupPendingSubtotal.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 border border-slate-300 text-center bg-slate-100/40 no-print">
                          {groupPendingSubtotal > 0 && selectedMonthYear === "current" && (
                            <button
                              onClick={() => handleOpenCumulativeForDebtor(group.debtorName, group.items, group.tenant)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-wide rounded-sm transition-all cursor-pointer"
                              title="Riconcilia tutte le scadenze del gruppo"
                            >
                              <Coins size={10} />
                              <span>Salda Tutto</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Manual Deadline Modal (no-print) */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-sans font-bold text-base">Nuova Scadenza Manuale</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Titolo Scadenza *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es: Rata TARI, Spesa Idraulico, Cedolare Secca"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Importo Dovuto (€) *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0.01"
                    placeholder="150.00"
                    value={amount || ""}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Data di Scadenza *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Origine / Categoria
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as any)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-hidden focus:border-indigo-500"
                >
                  <option value="manual">Spesa Manuale</option>
                  <option value="contract">Affitto (Contratto)</option>
                  <option value="condominium">Spese Condominiali</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Descrizione o Dettagli aggiuntivi
                </label>
                <textarea
                  placeholder="Fattura n. 45 idraulico, pagamento canone in ritardo..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                >
                  Aggiungi Scadenza
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cumulative / Single Bank Transfer Reconciliation Modal (no-print) */}
      {cumulativeTenant && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-sans font-bold text-base">Riconciliazione Cumulativa Unica</h3>
                <p className="text-[10px] text-slate-300 mt-0.5">Sotto-conto inquilino: {cumulativeTenant.name}</p>
              </div>
              <button onClick={() => setCumulativeTenant(null)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">

              {/* CORREZIONE K — Alternativa al bonifico: contanti o verifica manuale */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-xs font-semibold text-slate-700 block">
                    Saldo in Contanti / Verifica Manuale
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Nessun bonifico da abbinare — da usare per pagamenti in contanti o quando hai già verificato tu stesso il movimento
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCumulativeCashMode(prev => !prev);
                    setCumulativeMovementId("");
                    setReconciliationError("");
                  }}
                  className={`shrink-0 ml-3 w-11 h-6 rounded-full transition-colors relative ${cumulativeCashMode ? "bg-emerald-500" : "bg-slate-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${cumulativeCashMode ? "translate-x-5" : ""}`} />
                </button>
              </div>

              {/* Bank Movement Selection — nascosta in modalità contanti */}
              {!cumulativeCashMode && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Seleziona Movimento Bancario Ricevuto *
                </label>
                <select
                  required
                  value={cumulativeMovementId}
                  onChange={(e) => {
                    setCumulativeMovementId(e.target.value);
                    setReconciliationError("");
                  }}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-hidden focus:border-indigo-500 font-semibold text-slate-800"
                >
                  <option value="">-- Seleziona il bonifico d'accredito unico --</option>
                  {movements.filter(m => !m.reconciled).map(m => (
                    <option key={m.id} value={m.id}>
                      📅 {new Date(m.date).toLocaleDateString("it-IT")} - {m.description} (+€{m.amount.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
              )}

              {/* Checklist of all items */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2.5">
                  Seleziona le voci incluse in questo bonifico:
                </label>
                
                <div className="space-y-2 max-h-[180px] overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  {monthFilteredItems
                    .filter(item => {
                      const itemDebtor = getDebtorName(item);
                      return itemDebtor === cumulativeTenant.name && (item.status === "Pending" || item.status === "Overdue");
                    })
                    .map(item => {
                      const isChecked = selectedCumulativeItemIds.includes(item.id);
                      const isRent = item.source === "contract" || (item.title || "").toLowerCase().includes("canone") || (item.title || "").toLowerCase().includes("affitto");
                      
                      return (
                        <div 
                          key={item.id} 
                          onClick={() => toggleCumulativeItem(item.id)}
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
                              onChange={() => {}} // handled by click
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

              {/* Live calculations preview */}
              {cumulativeCashMode && selectedCumulativeItemIds.length > 0 && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1">
                  <div className="flex justify-between text-emerald-800">
                    <span>Totale da Saldare in Contanti:</span>
                    <strong>
                      €{monthFilteredItems.filter(item => selectedCumulativeItemIds.includes(item.id)).reduce((s, i) => s + i.amount, 0).toFixed(2)}
                    </strong>
                  </div>
                </div>
              )}

              {!cumulativeCashMode && cumulativeMovementId && selectedCumulativeItemIds.length > 0 && (
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between text-slate-500">
                    <span>Bonifico Disponibile:</span>
                    <strong className="text-slate-800">€{movements.find(m => m.id === cumulativeMovementId)?.amount.toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Totale Voci Selezionate:</span>
                    <strong className="text-slate-800">
                      €{monthFilteredItems.filter(item => selectedCumulativeItemIds.includes(item.id)).reduce((s, i) => s + i.amount, 0).toFixed(2)}
                    </strong>
                  </div>
                  
                  {(() => {
                    const movementAmt = movements.find(m => m.id === cumulativeMovementId)?.amount || 0;
                    const selectionTotal = monthFilteredItems.filter(item => selectedCumulativeItemIds.includes(item.id)).reduce((s, i) => s + i.amount, 0);
                    
                    if (movementAmt < selectionTotal) {
                      return (
                        <div className="mt-2 pt-2 border-t border-dashed border-slate-300 text-[10px] text-amber-700 font-bold leading-relaxed">
                          ⚠️ Riconciliazione Parziale: L'importo del bonifico è inferiore di €{(selectionTotal - movementAmt).toFixed(2)}. Il sistema registrerà gli elementi come pagati e genererà automaticamente una nuova riga contabile per il residuo nel prossimo Fast Closing.
                        </div>
                      );
                    } else if (movementAmt > selectionTotal) {
                      return (
                        <div className="mt-2 pt-2 border-t border-dashed border-slate-300 text-[10px] text-emerald-700 font-semibold leading-relaxed">
                          ✓ L'importo del bonifico copre interamente la selezione con un'eccedenza di €{(movementAmt - selectionTotal).toFixed(2)}.
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {/* Error box */}
              {reconciliationError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold leading-relaxed flex items-center space-x-2 animate-shake">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{reconciliationError}</span>
                </div>
              )}

            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setCumulativeTenant(null)}
                className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={(!cumulativeCashMode && !cumulativeMovementId) || selectedCumulativeItemIds.length === 0}
                onClick={handleConfirmCumulativeReconciliation}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-sm inline-flex items-center space-x-1.5"
              >
                <Check size={14} />
                <span>{cumulativeCashMode ? "Segna come Pagato (Contanti)" : "Riconcilia Cumulative"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual item reconciliation modal (no-print) */}
      {reconcileItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-sans font-bold text-base">Riconciliazione Singola Scadenza</h3>
                <p className="text-[10px] text-slate-300 mt-0.5">Associa un bonifico per perfezionare la riga contabile</p>
              </div>
              <button onClick={() => setReconcileItem(null)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-100 rounded-xl p-4 text-xs">
                <p className="font-bold text-slate-900">{reconcileItem.title}</p>
                <p className="text-slate-500 mt-1">Importo Dovuto: <strong className="text-slate-900">€{reconcileItem.amount.toFixed(2)}</strong></p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Seleziona Bonifico Disponibile *
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
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
              <button type="button" onClick={() => setReconcileItem(null)} className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold">
                Annulla
              </button>
              <button
                type="button"
                disabled={!selectedMovementId}
                onClick={handleConfirmReconciliation}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-sm"
              >
                Completa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Postponement Modal (no-print) */}
      {postponeItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-sans font-bold text-base">Rinvia Scadenza</h3>
                <p className="text-[10px] text-slate-300 mt-0.5">Sposta la data limite per questo addebito</p>
              </div>
              <button onClick={() => setPostponeItem(null)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-xs">
                <strong className="text-slate-900 block">{postponeItem.title}</strong>
                <span className="block mt-1 font-mono text-slate-500">Scadenza: {new Date(postponeItem.dueDate).toLocaleDateString("it-IT")}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nuova Data di Scadenza *
                </label>
                <input
                  type="date"
                  required
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
              <button type="button" onClick={() => setPostponeItem(null)} className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold">
                Annulla
              </button>
              <button type="button" onClick={handleConfirmPostpone} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm">
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Close Summary and Confirmation Modal (no-print) */}
      {showPreCloseModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-sans font-black text-base">🔍 Anteprima Chiusura Fast Closing</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Verifica il consolidamento contabile prima di procedere.</p>
              </div>
              <button onClick={() => setShowPreCloseModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Canoni / Voci Rigide */}
              {preCloseData.rigidItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-rose-600 uppercase tracking-wider">
                    🚨 Voci Rigide (Canoni d'Affitto) — Passano in Solleciti & Prossimo Mese
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-bold">
                          <th className="p-2">Inquilino</th>
                          <th className="p-2">Titolo</th>
                          <th className="p-2 text-right">Importo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {preCloseData.rigidItems.map(item => (
                          <tr key={item.id} className="font-mono text-[11px]">
                            <td className="p-2 font-sans font-bold text-slate-800">{getDebtorName(item)}</td>
                            <td className="p-2 text-slate-600">{item.title}</td>
                            <td className="p-2 text-right font-bold text-rose-600">€{item.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Spese Accessorie Overdue */}
              {preCloseData.accessoryOverdueItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-amber-600 uppercase tracking-wider">
                    ⚠️ Spese Accessorie Segnate come INSOLUTE — Passano in Solleciti
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-bold">
                          <th className="p-2">Inquilino</th>
                          <th className="p-2">Titolo</th>
                          <th className="p-2 text-right">Importo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {preCloseData.accessoryOverdueItems.map(item => (
                          <tr key={item.id} className="font-mono text-[11px]">
                            <td className="p-2 font-sans font-bold text-slate-800">{getDebtorName(item)}</td>
                            <td className="p-2 text-slate-600">{item.title}</td>
                            <td className="p-2 text-right font-bold text-amber-600">€{item.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Spese Accessorie Pending to be Postponed */}
              {preCloseData.accessoryPendingItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-wider">
                    🔄 Spese Accessorie in ATTESA — Rinviate al Mese Successivo (Nessuna Azione)
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-bold">
                          <th className="p-2">Destinatario</th>
                          <th className="p-2">Titolo</th>
                          <th className="p-2 text-right">Importo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {preCloseData.accessoryPendingItems.map(item => (
                          <tr key={item.id} className="font-mono text-[11px]">
                            <td className="p-2 font-sans font-bold text-slate-800">{getDebtorName(item)}</td>
                            <td className="p-2 text-slate-600">{item.title}</td>
                            <td className="p-2 text-right font-bold text-indigo-600">€{item.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Consolidated Solleciti */}
              {Object.keys(preCloseData.sollecitiGroups).length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-150">
                  <h4 className="text-xs font-black text-emerald-600 uppercase tracking-wider">
                    📊 Solleciti Consolidati da Creare (Raggruppati per Inquilino)
                  </h4>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-xs space-y-3">
                    {Object.keys(preCloseData.sollecitiGroups).map(debtorName => {
                      const g = preCloseData.sollecitiGroups[debtorName];
                      return (
                        <div key={debtorName} className="flex justify-between items-start /50 pb-2 last:border-0 last:pb-0">
                          <div>
                            <span className="font-bold text-slate-800 text-sm">{debtorName}</span>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Consolida {g.items.length} voci: {g.items.map(item => item.title.split(" - ")[1] || item.title).join(", ")}
                            </p>
                          </div>
                          <span className="font-mono font-black text-emerald-700 text-sm">€{g.total.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowPreCloseModal(false)}
                className="px-4 py-2.5 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleConfirmCloseFastClosing}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow-lg active:transition-all cursor-pointer"
              >
                ✓ Conferma ed Esegui Chiusura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Closing Summary Dialog (no-print) */}
      {showClosingSummary && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-5 bg-emerald-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-sans font-black text-base">✓ Chiusura Fast Closing Completata!</h3>
                <p className="text-[11px] text-emerald-200 mt-0.5">La contabilità del mese corrente è stata chiusa.</p>
              </div>
              <button onClick={() => setShowClosingSummary(false)} className="text-emerald-300 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-xs text-slate-700 space-y-2">
                <p className="font-bold text-emerald-900 text-sm">Rapporto di Chiusura Cassa:</p>
                <p>• Scadenze consolidate/spostate a insoluto: <strong className="font-black text-slate-950">{closedItemsCount}</strong></p>
                <p>• Canoni d'affitto insoluti (rigidi) re-proposti nel prossimo mese: <strong className="font-black text-indigo-700">{reproposedItemsList.length}</strong></p>
              </div>

              {reproposedItemsList.length > 0 && (
                <div>
                  <h5 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Canoni Riportati nel Prossimo Mese:</h5>
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-[11px] font-mono">
                    {reproposedItemsList.map((title, i) => (
                      <div key={i} className="flex justify-between font-semibold text-slate-700">
                        <span>{title}</span>
                        <span className="text-rose-600">✓ Riportato</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowClosingSummary(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-sm"
              >
                Fatto, Continua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statement Import OCR Modal (no-print) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
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
                          id="stmt-fc-file-upload"
                          multiple
                          onChange={handleStmtFileChange}
                          className="hidden"
                        />
                        <label
                          htmlFor="stmt-fc-file-upload"
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

