
import React, { useState, useEffect, useMemo } from "react";
import { 
  Building2, 
  FileText, 
  Users, 
  CalendarClock, 
  AlertTriangle, 
  TrendingUp, 
  ArrowRight,
  ShieldAlert,
  Sparkles,
  DollarSign,
  Scale,
  Home,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Building,
  Plus,
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Briefcase,
  Wrench
} from "lucide-react";
import { Property, Contract, Tenant, FastClosingItem, Reminder, Condominium, LegalCase, AppSection, Communication, Lawyer, Maintenance, OwnerProfile, InsurancePolicy } from "../types";
import { getTenantClassification } from "../lib/statusHelper";
import { generateMessaInMoraPDF } from "../lib/pdfHelper";

interface DashboardViewProps {
  properties: Property[];
  contracts: Contract[];
  tenants: Tenant[];
  fastClosing: FastClosingItem[];
  reminders: Reminder[];
  condominiums?: Condominium[];
  legalCases?: LegalCase[];
  communications?: Communication[];
  lawyers?: Lawyer[];
  maintenance?: Maintenance[];
  insurancePolicies?: InsurancePolicy[];
  setCurrentSection: (section: AppSection) => void;
  userName: string;
  onSeedDemoData?: () => Promise<void>;
  onSeedSimulationData?: () => Promise<void>;
  onEditContract?: (id: string, data: any) => Promise<void>;
  onUpdateReminderStatus?: (id: string, status: string, notes?: string, extraFields?: any) => Promise<void>;
  onAddLegalCase?: (data: any) => Promise<void>;
  googleAccessToken?: string | null;
  onConnectGoogleCalendar?: () => Promise<void>;
  ownerProfile?: OwnerProfile | null;
}

export default function DashboardView({
  properties,
  contracts,
  tenants,
  fastClosing,
  reminders,
  condominiums = [],
  legalCases = [],
  communications = [],
  lawyers = [],
  maintenance = [],
  insurancePolicies = [],
  setCurrentSection,
  userName,
  onSeedDemoData,
  onSeedSimulationData,
  onEditContract,
  onUpdateReminderStatus,
  onAddLegalCase,
  googleAccessToken,
  onConnectGoogleCalendar,
  ownerProfile = null,
}: DashboardViewProps) {
  
  // Dynamic Real-time Countdown Clocks State
  const [timeLeftAuto, setTimeLeftAuto] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [timeLeftManual, setTimeLeftManual] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, unlocked: false });

  // Custom Second-Level Views States
  const [showConsolidatedReport, setShowConsolidatedReport] = useState(false);
  const [selectedDashboardProperty, setSelectedDashboardProperty] = useState<Property | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<string>("all");
  const [localPayments, setLocalPayments] = useState<Record<string, { status: "Paid" | "Pending" | "Overdue"; paymentDate?: string; txId?: string }>>({});
  const [localNoticeSent, setLocalNoticeSent] = useState<Record<string, { step: number; dateSent: string }>>({});
  const [localRegistrationStatus, setLocalRegistrationStatus] = useState<Record<string, string>>({});

  // Google Calendar synchronization states
  const [syncingContractId, setSyncingContractId] = useState<string | null>(null);
  const [calendarSyncErrors, setCalendarSyncErrors] = useState<Record<string, string>>({});

  // Check if notifications are currently suspended based on Owner's schedule
  const isNotificationsSuspended = useMemo(() => {
    if (!ownerProfile) return false;
    
    const now = new Date();
    
    // 1. Check vacation pause (ferie)
    if (ownerProfile.pauseEnabled && ownerProfile.pauseStartDate && ownerProfile.pauseEndDate) {
      const start = new Date(ownerProfile.pauseStartDate);
      const end = new Date(ownerProfile.pauseEndDate);
      // Cover the whole start and end days
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      if (now >= start && now <= end) {
        return true;
      }
    }
    
    // 2. Check working days
    const daysMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = daysMap[now.getDay()];
    if (ownerProfile.notificationDays && ownerProfile.notificationDays.length > 0) {
      if (!ownerProfile.notificationDays.includes(currentDayName)) {
        return true;
      }
    }
    
    // 3. Check working hours
    if (ownerProfile.notificationHoursStart && ownerProfile.notificationHoursEnd) {
      const [startH, startM] = ownerProfile.notificationHoursStart.split(":").map(Number);
      const [endH, endM] = ownerProfile.notificationHoursEnd.split(":").map(Number);
      
      const currentH = now.getHours();
      const currentM = now.getMinutes();
      
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const currentMinutes = currentH * 60 + currentM;
      
      if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
        return true;
      }
    }
    
    return false;
  }, [ownerProfile]);
  const [calendarSyncSuccess, setCalendarSyncSuccess] = useState<Record<string, boolean>>({});

  const handleSyncToGoogleCalendar = async (contract: Contract) => {
    if (!googleAccessToken) {
      setCalendarSyncErrors(prev => ({
        ...prev,
        [contract.id]: "Google Calendar non connesso. Clicca su 'Connetti Calendar' per autorizzare."
      }));
      return;
    }

    setSyncingContractId(contract.id);
    setCalendarSyncErrors(prev => ({ ...prev, [contract.id]: "" }));
    setCalendarSyncSuccess(prev => ({ ...prev, [contract.id]: false }));

    try {
      const startDateTime = new Date(contract.endDate);
      startDateTime.setHours(9, 0, 0, 0);
      const endDateTime = new Date(contract.endDate);
      endDateTime.setHours(10, 0, 0, 0);

      const event = {
        summary: `Scadenza Locazione: ${contract.propertyName}`,
        description: `Allerta Scadenza/Rinnovo contratto per inquilino ${contract.tenantName}.\nCanone: €${contract.rentAmount}/mese.\nScadenza: ${new Date(contract.endDate).toLocaleDateString("it-IT")}.`,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: "Europe/Rome"
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: "Europe/Rome"
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 * 7 }, // 7 days before
            { method: "popup", minutes: 24 * 60 } // 1 day before
          ]
        }
      };

      const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${googleAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(event)
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Risposta API fallita (${response.status}): ${errBody}`);
      }

      setCalendarSyncSuccess(prev => ({ ...prev, [contract.id]: true }));
    } catch (err: any) {
      console.error("Error creating Google Calendar event:", err);
      setCalendarSyncErrors(prev => ({
        ...prev,
        [contract.id]: `Errore sincronizzazione: ${err.message || String(err)}`
      }));
    } finally {
      setSyncingContractId(null);
    }
  };
  
  // Interactive Stepper Legal Transfer Modal State
  const [transferringReminder, setTransferringReminder] = useState<any | null>(null);
  const [selectedLawyerId, setSelectedLawyerId] = useState("");
  const [actionInProgress, setActionInProgress] = useState(false);
  const [successToast, setSuccessToast] = useState("");

  // Find contracts that require disdetta postal registered letter but have not uploaded it
  const disdettaAlerts = useMemo(() => {
    return contracts.filter(c => {
      if (c.status !== "Active") return false;
      const now = new Date();
      const end = new Date(c.endDate);
      const diffTime = end.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const sevenMonthsDays = 7 * 30.4375;
      return diffDays <= sevenMonthsDays && !c.disdettaReceiptUploaded;
    });
  }, [contracts]);

  const hasOpenFastClosing = useMemo(() => {
    return fastClosing.some(item => item.status === "Pending" || item.status === "Overdue");
  }, [fastClosing]);

  // Calculate stats
  const totalProperties = properties.length;
  const rentedProperties = properties.filter(p => p.status === "Rented").length;
  const occupancyRate = totalProperties > 0 ? Math.round((rentedProperties / totalProperties) * 100) : 0;
  
  const activeContracts = contracts.filter(c => c.status === "Active").length;
  const totalRentAmount = contracts
    .filter(c => c.status === "Active")
    .reduce((sum, c) => sum + (c.rentAmount || 0), 0);

  // Helper to check if a fast closing item is an expense (negative amount, or related to condo/maintenance/taxes)
  const isExpenseItem = (item: FastClosingItem) => {
    return item.amount < 0 ||
           item.source === "condominium" ||
           item.source === "maintenance" ||
           (item.title || "").toLowerCase().match(/(spese|condominio|manutenzion|tassa|tasse|f24|imposta|registro)/) !== null;
  };

  const dashboardFastClosing = useMemo(() => {
    return fastClosing.filter(item => !isExpenseItem(item));
  }, [fastClosing]);

  const pendingFastClosing = useMemo(() => {
    return dashboardFastClosing.filter(item => item.status === "Pending");
  }, [dashboardFastClosing]);

  const overdueFastClosing = useMemo(() => {
    return dashboardFastClosing.filter(
      item => item.status === "Overdue" || (item.status === "Pending" && new Date(item.dueDate) < new Date())
    );
  }, [dashboardFastClosing]);

  const totalPendingAmount = useMemo(() => {
    return pendingFastClosing.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [pendingFastClosing]);

  const contractsCloseToExpiration = useMemo(() => {
    return contracts.filter(c => {
      if (c.status !== "Active") return false;
      const now = new Date();
      const end = new Date(c.endDate);
      const diffTime = end.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      // Close to expiration is within 180 days (6 months)
      return diffDays > 0 && diffDays <= 180;
    });
  }, [contracts]);

  const sequenceAlerts = useMemo(() => {
    const alerts: { id: string; tenantName: string; step: number; daysPassed: number; amount: number; reason: string; tenantId?: string; propertyId?: string; contractId?: string }[] = [];
    reminders.forEach(r => {
      if (!r.isSequence || r.status === "Paid" || r.status === "Cancelled" || (r.step && r.step >= 5)) return;
      
      const now = new Date();
      let daysPassed = 0;
      let activeStep = r.step || 1;

      if (activeStep === 1) {
        const baseDate = r.createdAt ? new Date(r.createdAt) : (r.dueDate ? new Date(r.dueDate) : new Date());
        daysPassed = Math.floor((now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
      } else if (activeStep === 2 && r.firstRequestDate) {
        const sentDate = new Date(r.firstRequestDate);
        daysPassed = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
        // ONLY show if at least 15 days have passed since the previous action (Step 1)
        if (daysPassed < 15) return;
      } else if (activeStep === 3 && r.secondRequestDate) {
        const sentDate = new Date(r.secondRequestDate);
        daysPassed = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
        // ONLY show if at least 15 days have passed since the previous action (Step 2)
        if (daysPassed < 15) return;
      } else if (activeStep === 4 && r.thirdRequestDate) {
        const sentDate = new Date(r.thirdRequestDate);
        daysPassed = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
        // ONLY show if at least 15 days have passed since the previous action (Step 3)
        if (daysPassed < 15) return;
      } else {
        return;
      }

      alerts.push({
        id: r.id,
        tenantName: r.tenantName,
        step: activeStep,
        daysPassed: Math.max(0, daysPassed),
        amount: r.amount,
        reason: r.reason,
        tenantId: r.tenantId,
        propertyId: r.propertyId,
        contractId: r.contractId
      });
    });
    return alerts;
  }, [reminders]);

  const handleAlertStepForward = async (alertItem: any) => {
    if (!onUpdateReminderStatus) return;
    setActionInProgress(true);
    try {
      if (alertItem.step === 1) {
        await onUpdateReminderStatus(alertItem.id, "Sent", "Inviato secondo sollecito di pagamento.", {
          step: 2,
          secondRequestDate: new Date().toISOString().split("T")[0]
        });
        setSuccessToast("Secondo Sollecito Inviato con Successo! L'attività è progredita.");
      } else if (alertItem.step === 2) {
        const matchedReminder = reminders.find(rem => rem.id === alertItem.id);
        const dueDate = matchedReminder?.dueDate || new Date().toISOString().split("T")[0];
        generateMessaInMoraPDF(
          alertItem.tenantName,
          alertItem.amount,
          dueDate
        );

        await onUpdateReminderStatus(alertItem.id, "MessaInMora", "Inviata Raccomandata di Messa in Mora con ricevuta di ritorno.", {
          step: 3,
          thirdRequestDate: new Date().toISOString().split("T")[0]
        });
        setSuccessToast("Diffida / Messa in Mora generata in PDF e contrassegnata come inviata!");
      } else if (alertItem.step === 3) {
        await onUpdateReminderStatus(alertItem.id, "MessaInMora", "Ricevuta di ritorno firmata e registrata a sistema.", {
          step: 4,
          receiptDownloaded: true
        });
        setSuccessToast("Ricevuta di Ritorno Firmata registrata con successo!");
      } else if (alertItem.step === 4) {
        // This opens the legal study assignment modal!
        setTransferringReminder(alertItem);
        setSelectedLawyerId(lawyers[0]?.id || "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionInProgress(false);
      setTimeout(() => setSuccessToast(""), 4000);
    }
  };

  const handleConfirmLegalTransfer = async () => {
    if (!onUpdateReminderStatus || !onAddLegalCase || !transferringReminder) return;
    setActionInProgress(true);
    try {
      const selectedLawyer = lawyers.find(l => l.id === selectedLawyerId);
      
      // Create Legal Case with all default attachments inside the "Fascicolo" folder structure
      await onAddLegalCase({
        title: `Contenzioso Morosità Grave - Inquilino: ${transferringReminder.tenantName}`,
        description: `Procedura coattiva avviata da bacheca dopo 3 solleciti infruttuosi per insoluto accumulato di €${transferringReminder.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}.`,
        tenantName: transferringReminder.tenantName,
        propertyId: transferringReminder.propertyId || "",
        propertyName: properties.find(p => p.id === transferringReminder.propertyId)?.name || "Immobile Portafoglio",
        contractId: transferringReminder.contractId || "",
        unpaidBalance: transferringReminder.amount,
        status: "Active",
        assignedLawyerId: selectedLawyer?.id || "",
        assignedLawyerName: selectedLawyer?.name || "Avvocato d'Ufficio",
        zipFileName: `Fascicolo_Legale_${transferringReminder.tenantName.replace(/\s+/g, "_")}.zip`,
        filesToAssign: true,
        notes: `Cartella fascicolo creata in Area Legale con nome "${transferringReminder.tenantName}". Allegati inseriti: Contratto di locazione registrato, Ricevuta di ritorno firmata, Registro solleciti 1-2, F24 imposta di registro, Mastrino spese condominiali e canoni insoluti.`
      });

      // Update reminder step to 5 so it is hidden from active sequences
      await onUpdateReminderStatus(transferringReminder.id, "MessaInMora", "Fascicolo trasferito legalmente con successo.", {
        step: 5
      });

      setSuccessToast(`Pratica Legale creata con successo! Fascicolo associato allo Studio ${selectedLawyer?.studioName || "selezionato"}.`);
      setTransferringReminder(null);
    } catch (e) {
      console.error(e);
    } finally {
      setActionInProgress(false);
      setTimeout(() => setSuccessToast(""), 5000);
    }
  };

  // Load property documents from local storage to check for uploaded receipts
  const propertyDocs = useMemo(() => {
    const saved = localStorage.getItem("property_documents_contracts");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing property documents in DashboardView", e);
      }
    }
    return {};
  }, [contracts]);

  // Calculate annual or interim 4-year registration reminders
  const pendingRegistrations = useMemo(() => {
    const alerts: Array<{
      id: string;
      contractId: string;
      propertyName: string;
      tenantName: string;
      type: 'annual' | 'quadriennale';
      anniversaryYear: number;
      dueDate: string;
      title: string;
      description: string;
      daysRemaining: number;
    }> = [];

    contracts.forEach(c => {
      if (c.status !== "Active" || !c.startDate) return;
      const start = new Date(c.startDate);
      const end = c.endDate ? new Date(c.endDate) : new Date(start.getTime() + 4 * 365 * 24 * 3600 * 1000);
      const now = new Date();

      // Check if bare ownership
      const isBare = c.isBareOwnership || false;

      // Find difference in years between start and end
      const totalYears = end.getFullYear() - start.getFullYear();

      if (!isBare) {
        // Standard rent: needs annual registration
        for (let year = 1; year <= totalYears; year++) {
          const anniversaryDate = new Date(start);
          anniversaryDate.setFullYear(start.getFullYear() + year);
          if (anniversaryDate > end) break;

          const daysRemaining = Math.ceil((anniversaryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

          // Appear at least 1 month in advance (31 days) OR if overdue
          if (daysRemaining <= 31) {
            // Check if receipt is already uploaded
            const docs = propertyDocs[c.propertyId] || [];
            const isUploaded = docs.some((doc: any) => {
              const docType = (doc.type || "").toLowerCase();
              const docName = (doc.name || "").toLowerCase();
              return (docType.includes("annual") || docType.includes("registro") || docType.includes("contrat") || docType.includes("f24")) && 
                     (docName.includes(`anno ${year}`) || docName.includes(`${year}°`) || docName.includes(`annualità ${year}`) || docName.includes(`registrazione ${year}`) || docName.includes(`f24`));
            });

            if (!isUploaded) {
              alerts.push({
                id: `reg-annual-${c.id}-${year}`,
                contractId: c.id,
                propertyName: c.propertyName || "Immobile",
                tenantName: c.tenantName || "Inquilino",
                type: 'annual',
                anniversaryYear: year,
                dueDate: anniversaryDate.toISOString().split("T")[0],
                title: `F24 Imposta di Registro Annuale (Anno ${year})`,
                description: `Contratto standard con ${c.tenantName}: scadenza annualità il ${anniversaryDate.toLocaleDateString("it-IT")}. Pagare l'imposta di registro F24 (2% del canone) ed caricare qui la ricevuta per interrompere il flashing dell'avviso.`,
                daysRemaining
              });
            }
          }
        }
      } else {
        // Bare ownership: needs quadriennale communication every 4 years
        for (let year = 4; year <= totalYears; year += 4) {
          const anniversaryDate = new Date(start);
          anniversaryDate.setFullYear(start.getFullYear() + year);
          if (anniversaryDate > end) break;

          const daysRemaining = Math.ceil((anniversaryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

          // Appear at least 1 month in advance (31 days) OR if overdue
          if (daysRemaining <= 31) {
            // Check if receipt is already uploaded
            const docs = propertyDocs[c.propertyId] || [];
            const isUploaded = docs.some((doc: any) => {
              const docType = (doc.type || "").toLowerCase();
              const docName = (doc.name || "").toLowerCase();
              return (docType.includes("quadr") || docType.includes("proroga") || docType.includes("comunicaz") || docType.includes("municipal") || docType.includes("comun")) && 
                     (docName.includes(`anno ${year}`) || docName.includes(`${year}°`) || docName.includes(`quadriennale`) || docName.includes(`ricevuta`));
            });

            if (!isUploaded) {
              alerts.push({
                id: `reg-quad-${c.id}-${year}`,
                contractId: c.id,
                propertyName: c.propertyName || "Immobile",
                tenantName: c.tenantName || "Inquilino",
                type: 'quadriennale',
                anniversaryYear: year,
                dueDate: anniversaryDate.toISOString().split("T")[0],
                title: `Comunicazione Proroga Quadriennale (Anno ${year})`,
                description: `Contratto in Nuda Proprietà con ${c.tenantName}: termine quadriennio il ${anniversaryDate.toLocaleDateString("it-IT")}. Inviare comunicazione di proroga quadriennale intermedia al Comune di riferimento.`,
                daysRemaining
              });
            }
          }
        }
      }
    });

    return alerts;
  }, [contracts, propertyDocs]);

  const activeReminders = reminders.filter(r => r.status === "Sent" || r.status === "Pending" || r.status === "MessaInMora").length;

  // Real-time Countdown effect
  useEffect(() => {
    const updateCountdowns = () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed

      // Target 1: End of the current month (Automatic closing at 23:59:59)
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
      const diffAuto = endOfMonth.getTime() - now.getTime();

      if (diffAuto > 0) {
        const d = Math.floor(diffAuto / (1000 * 60 * 60 * 24));
        const h = Math.floor((diffAuto % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diffAuto % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diffAuto % (1000 * 60)) / 1000);
        setTimeLeftAuto({ days: d, hours: h, minutes: m, seconds: s });
      } else {
        setTimeLeftAuto({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }

      // Target 2: 20th of the current month at 00:00:00 (Manual closing enabled)
      const manualClosingDate = new Date(currentYear, currentMonth, 20, 0, 0, 0);
      const diffManual = manualClosingDate.getTime() - now.getTime();

      if (diffManual > 0) {
        const d = Math.floor(diffManual / (1000 * 60 * 60 * 24));
        const h = Math.floor((diffManual % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diffManual % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diffManual % (1000 * 60)) / 1000);
        setTimeLeftManual({ days: d, hours: h, minutes: m, seconds: s, unlocked: false });
      } else {
        setTimeLeftManual({ days: 0, hours: 0, minutes: 0, seconds: 0, unlocked: true });
      }
    };

    updateCountdowns();
    const interval = setInterval(updateCountdowns, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute Rented Properties with missing contract alerts
  const rentedPropertiesMissingContract = useMemo(() => {
    return properties.filter(p => {
      if (p.status !== "Rented") return false;
      const hasContract = contracts.some(c => c.propertyId === p.id && c.status === "Active");
      return !hasContract;
    });
  }, [properties, contracts]);

  const activeContractsCount = useMemo(() => {
    return contracts.filter(c => c.status === "Active").length;
  }, [contracts]);

  // 1. Initial Contract Registration Alert (30 days before deadline, i.e. starting from start date)
  const initialRegistrationContractReminders = useMemo(() => {
    const alerts: Array<{
      id: string;
      contractId: string;
      propertyName: string;
      tenantName: string;
      dueDate: string;
      daysRemaining: number;
      title: string;
      description: string;
    }> = [];

    contracts.forEach(c => {
      if (c.status !== "Active" || !c.startDate) return;
      const start = new Date(c.startDate);
      const deadline = new Date(start.getTime() + 30 * 24 * 3600 * 1000);
      const now = new Date();

      const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 3600 * 24));

      // Show starting 30 days before deadline (which is start date onwards)
      if (daysRemaining <= 30) {
        // Check if receipt is already uploaded in propertyDocs
        const docs = propertyDocs[c.propertyId] || [];
        const isRegistered = docs.some((doc: any) => {
          const docType = (doc.type || "").toLowerCase();
          const docName = (doc.name || "").toLowerCase();
          return (docType.includes("registraz") || docType.includes("ricevuta") || docType.includes("f24") || docType.includes("proroga") || docType.includes("contrat")) && 
                 (docName.includes("iniziale") || docName.includes("registrazione") || docName.includes("ricevuta") || docName.includes("f24") || docName.includes("contratto") || docName.includes("f24"));
        });

        if (!isRegistered) {
          alerts.push({
            id: `reg-initial-${c.id}`,
            contractId: c.id,
            propertyName: c.propertyName || "Immobile",
            tenantName: c.tenantName || "Inquilino",
            dueDate: deadline.toISOString().split("T")[0],
            daysRemaining,
            title: `Registrazione Contratto Necessaria`,
            description: `Contratto di locazione con ${c.tenantName} (avviato il ${start.toLocaleDateString("it-IT")}): scadenza del termine di 30 giorni per la registrazione il ${deadline.toLocaleDateString("it-IT")}. Carica la ricevuta per interrompere questo avviso.`
          });
        }
      }
    });

    return alerts;
  }, [contracts, propertyDocs]);

  // 2. Custom Contract Expiration Reminder (8 months before, monthly)
  const customContractExpiryReminders = useMemo(() => {
    const alerts: Array<{
      id: string;
      contractId: string;
      propertyName: string;
      tenantName: string;
      monthsRemaining: number;
      dueDate: string;
      title: string;
      description: string;
    }> = [];

    contracts.forEach(c => {
      if (c.status !== "Active" || !c.endDate) return;
      const now = new Date();
      const end = new Date(c.endDate);

      // Months remaining diff
      const monthsDiff = (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth();

      // Show from 8 months before up to 0 months
      if (monthsDiff >= 0 && monthsDiff <= 8) {
        alerts.push({
          id: `expiry-custom-${c.id}-${monthsDiff}`,
          contractId: c.id,
          propertyName: c.propertyName || "Immobile",
          tenantName: c.tenantName || "Inquilino",
          monthsRemaining: monthsDiff,
          dueDate: c.endDate,
          title: `Pre-Avviso Scadenza e Rinnovo Contratto`,
          description: `Contratto per ${c.propertyName || "Immobile"} con l'inquilino ${c.tenantName} scadrà il ${end.toLocaleDateString("it-IT")}. Mancano ${monthsDiff} mesi. Valutare tempestivamente le opzioni di rinnovo o i tempi di disdetta.`
        });
      }
    });

    return alerts;
  }, [contracts]);

  // 3. Custom Rent Payment Due Reminder (appears on due date and repeats every 2 days if unpaid, no amount visible)
  const customDueRentReminders = useMemo(() => {
    const alerts: Array<{
      id: string;
      itemId: string;
      propertyName: string;
      tenantName: string;
      dueDate: string;
      daysPassed: number;
      title: string;
      description: string;
    }> = [];

    fastClosing.forEach(fc => {
      // Must be a rent installment (source === "contract")
      if (fc.source !== "contract" || fc.status === "Paid" || fc.status === "Cancelled") return;

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const due = new Date(fc.dueDate);
      due.setHours(0, 0, 0, 0);

      const diffTime = now.getTime() - due.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));

      // Starts on the exact due day (diffDays === 0) and repeats every 2 days (diffDays % 2 === 0)
      if (diffDays >= 0 && diffDays % 2 === 0) {
        // Find linked tenant
        const linkedContract = contracts.find(c => c.id === fc.sourceId);
        const tenantName = linkedContract?.tenantName || "Inquilino";
        const propertyName = linkedContract?.propertyName || "Immobile";

        alerts.push({
          id: `rent-due-custom-${fc.id}-${diffDays}`,
          itemId: fc.id,
          propertyName,
          tenantName,
          dueDate: fc.dueDate,
          daysPassed: diffDays,
          title: `Scadenza Canone Locazione (Insoluto)`,
          description: `Il pagamento del canone di locazione per ${propertyName} (Inquilino: ${tenantName}) con scadenza il ${due.toLocaleDateString("it-IT")} risulta insoluto. Questo sollecito ricorrerà ogni 2 giorni.`
        });
      }
    });

    return alerts;
  }, [fastClosing, contracts]);

  const insuranceExpiryAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      policyNumber: string;
      company: string;
      propertyName: string;
      expiryDate: string;
      daysRemaining: number;
    }> = [];

    insurancePolicies.forEach(p => {
      if (!p.expiryDate) return;
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const expiry = new Date(p.expiryDate);
      expiry.setHours(0, 0, 0, 0);
      
      const diffTime = expiry.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));

      // Show alert if the policy expires in less than 30 days, or is already expired
      if (diffDays <= 30) {
        const linkedProperty = properties.find(prop => prop.id === p.propertyId);
        const propertyName = linkedProperty ? linkedProperty.name : "Immobile Portafoglio";

        alerts.push({
          id: `insurance-exp-${p.id}`,
          policyNumber: p.policyNumber,
          company: p.company,
          propertyName,
          expiryDate: p.expiryDate,
          daysRemaining: diffDays
        });
      }
    });

    return alerts;
  }, [insurancePolicies, properties]);

  if (selectedDashboardProperty) {
    const p = selectedDashboardProperty;
    const activeContract = contracts.find(c => c.propertyId === p.id && c.status === "Active");
    const associatedTenant = tenants.find(t => t.id === activeContract?.tenantId);
    
    // Find condominiums rates for this property name or address
    const condoConstituted = condominiums.find(c => 
      (p.address || "").toLowerCase().includes((c.name || "").toLowerCase()) || 
      (c.name || "").toLowerCase().includes((p.name || "").toLowerCase()) ||
      (c.notes && (c.notes || "").toLowerCase().includes((p.name || "").toLowerCase()))
    );

    // Filter maintenance tickets
    const realMaintenance = maintenance.filter(m => m.propertyId === p.id);
    
    // Default maintenance if database has none
    const defaultMaintenance = [
      {
        id: `${p.id}-maint-1`,
        title: "Revisione Caldaia & Bollino Blu",
        contractor: "Svevo Clima S.r.l.",
        date: "2026-03-10",
        cost: 120,
        status: "Completed" as const,
        chargedTo: "owner" as const,
        description: "Analisi fumi ordinaria caldaia autonoma gas."
      },
      {
        id: `${p.id}-maint-2`,
        title: "Riparazione Sifone Lavabo Bagno",
        contractor: "Termoidraulica Rossi",
        date: "2026-05-20",
        cost: 85,
        status: "Completed" as const,
        chargedTo: "tenant" as const,
        description: "Sostituzione guarnizione e sifone usurato in plastica."
      },
      {
        id: `${p.id}-maint-3`,
        title: "Ripristino Intonaco Balcone Esterno",
        contractor: "Edilizia Costruzioni S.p.A.",
        date: "2026-09-12",
        cost: 650,
        status: "In Progress" as const,
        chargedTo: "owner" as const,
        description: "Rifacimento frontalini ammalorati balcone camera."
      }
    ];
    const maintenanceToShow = realMaintenance.length > 0 ? realMaintenance : defaultMaintenance;

    // Months list for Rents Spreadsheet — derivato dinamicamente dall'anno corrente,
    // mai da un anno scritto fisso (vedi REGOLE_PROGETTO sez. 4/13.5)
    const currentYearForMonths = new Date().getFullYear();
    const italianMonthNames = [
      "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
      "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
    ];
    const monthsList = italianMonthNames.map((name, idx) => {
      const num = idx + 1;
      const monthStr = String(num).padStart(2, "0");
      return {
        name: `${name} ${currentYearForMonths}`,
        num,
        dueDate: `${currentYearForMonths}-${monthStr}-05`
      };
    });

    // Rents spreadsheet calculation
    const generatedRents = monthsList.map(m => {
      const key = `${p.id}-rent-${m.num}`;
      let defaultStatus: "Paid" | "Pending" | "Overdue" = "Paid";
      const mDate = new Date(m.dueDate);
      const now = new Date(); // Data corrente reale, mai una stringa fissa
      
      if (mDate > now) {
        defaultStatus = "Pending";
      } else {
        const hasActiveReminder = reminders.some(r => r.tenantId === associatedTenant?.id && r.status !== "Paid" && r.status !== "Cancelled");
        if (hasActiveReminder && (m.num === 6 || m.num === 5)) {
          defaultStatus = "Overdue";
        }
      }

      const local = localPayments[key];
      const status = local ? local.status : defaultStatus;
      const paymentDate = local?.paymentDate || (status === "Paid" ? m.dueDate : undefined);
      const txId = local?.txId || (status === "Paid" ? `TX-${p.id.slice(0, 3).toUpperCase()}-${100000 + m.num}` : undefined);

      return {
        ...m,
        key,
        amount: activeContract ? activeContract.rentAmount : 0,
        status,
        paymentDate,
        txId
      };
    });

    // Condo rates calculation
    const condoRatesList = condoConstituted?.rates?.map((rate: any, idx: number) => {
      const key = `${p.id}-condo-${idx}`;
      let tenantShare = 0;
      let ownerShare = rate.amount;
      if (activeContract) {
        if (activeContract.splitMethod === "Percentage") {
          tenantShare = rate.amount * 0.9;
          ownerShare = rate.amount * 0.1;
        } else {
          tenantShare = activeContract.fixedTenantAmount || 0;
          ownerShare = Math.max(0, rate.amount - tenantShare);
        }
      }

      let defaultStatus: "Paid" | "Pending" | "Overdue" = "Paid";
      const rDate = new Date(rate.dueDate);
      const now = new Date(); // Data corrente reale, mai una stringa fissa
      if (rDate > now) {
        defaultStatus = "Pending";
      }

      const local = localPayments[key];
      const status = local ? local.status : defaultStatus;

      return {
        ...rate,
        key,
        tenantShare,
        ownerShare,
        status
      };
    }) || [];

    const defaultCondoRates = [
      { title: "Rata 1 - Spese Ordinarie", dueDate: "2026-02-15", amount: 0, status: "Pending" as const, tenantShare: 0, ownerShare: 0, key: `${p.id}-condo-d1` },
      { title: "Rata 2 - Spese Riscaldamento", dueDate: "2026-04-15", amount: 0, status: "Pending" as const, tenantShare: 0, ownerShare: 0, key: `${p.id}-condo-d2` },
      { title: "Rata 3 - Spese Ordinarie", dueDate: "2026-06-15", amount: 0, status: "Pending" as const, tenantShare: 0, ownerShare: 0, key: `${p.id}-condo-d3` },
      { title: "Rata 4 - Conguaglio Esercizio", dueDate: "2026-09-15", amount: 0, status: "Pending" as const, tenantShare: 0, ownerShare: 0, key: `${p.id}-condo-d4` },
    ];
    const condoRatesToShow = condoConstituted ? condoRatesList : defaultCondoRates;

    // Helper for contract registration anniversary
    const fallbackYearBase = new Date().getFullYear();
    const getAnniversaryDate = (startDateStr: string, yearsToAdd: number) => {
      if (!startDateStr) return `${fallbackYearBase}-01-01`;
      try {
        const d = new Date(startDateStr);
        d.setFullYear(d.getFullYear() + yearsToAdd);
        return d.toISOString().split("T")[0];
      } catch (e) {
        return `${fallbackYearBase}-01-01`;
      }
    };

    // Registration taxes (Imposta di Registro) for 4+4 contracts
    const baseRentAmount = activeContract ? activeContract.rentAmount : 0;
    const yearlyTaxAmount = baseRentAmount > 0 ? Math.max(67, Math.round(baseRentAmount * 12 * 0.02)) : 0;
    
    const registrationYears = [
      { year: "1° Anno (Registrazione Iniziale)", dueDate: activeContract ? activeContract.startDate : `${fallbackYearBase - 2}-01-01`, amount: yearlyTaxAmount, f24Code: "1500", key: `${p.id}-reg-1`, defaultStatus: "Paid" },
      { year: "2° Anno (Annualità successiva)", dueDate: activeContract ? getAnniversaryDate(activeContract.startDate, 1) : `${fallbackYearBase - 1}-01-01`, amount: yearlyTaxAmount, f24Code: "1501", key: `${p.id}-reg-2`, defaultStatus: "Paid" },
      { year: "3° Anno (Annualità successiva)", dueDate: activeContract ? getAnniversaryDate(activeContract.startDate, 2) : `${fallbackYearBase}-01-01`, amount: yearlyTaxAmount, f24Code: "1501", key: `${p.id}-reg-3`, defaultStatus: "Overdue" },
      { year: "4° Anno (Annualità successiva)", dueDate: activeContract ? getAnniversaryDate(activeContract.startDate, 3) : `${fallbackYearBase + 1}-01-01`, amount: yearlyTaxAmount, f24Code: "1501", key: `${p.id}-reg-4`, defaultStatus: "Pending" },
    ];

    const generatedRegistration = registrationYears.map(r => {
      const local = localRegistrationStatus[r.key];
      const status = local || r.defaultStatus;
      return {
        ...r,
        status
      };
    });

    // Find any active payment reminders / sequences
    const activeRemindersForProperty = reminders.filter(r => r.tenantId === associatedTenant?.id);

    // Interactive Handler to register payment
    const handleRegisterLocalPayment = (key: string, type: "rent" | "condo") => {
      setLocalPayments(prev => ({
        ...prev,
        [key]: {
          status: "Paid" as const,
          paymentDate: new Date().toISOString().split("T")[0],
          txId: "TX-" + Math.random().toString(36).substring(2, 9).toUpperCase()
        }
      }));
      setSuccessToast(`Pagamento registrato correttamente nel mastrino.`);
      setTimeout(() => setSuccessToast(""), 3500);
    };

    // Interactive Handler for registration payment
    const handleRegisterLocalRegistration = (key: string) => {
      setLocalRegistrationStatus(prev => ({
        ...prev,
        [key]: "Paid"
      }));
      setSuccessToast(`Imposta di registro F24 saldata con successo.`);
      setTimeout(() => setSuccessToast(""), 3500);
    };

    // Interactive Handler to send dynamic reminder
    const handleSendLocalNotice = (key: string) => {
      const currentStep = localNoticeSent[key]?.step || 0;
      const nextStep = currentStep + 1;
      setLocalNoticeSent(prev => ({
        ...prev,
        [key]: {
          step: nextStep,
          dateSent: new Date().toLocaleDateString("it-IT")
        }
      }));
      
      const stepLabels = ["Sollecito Cortese", "Primo Richiamo Formale", "Messa in Mora", "Inoltro a Studio Legale"];
      const appliedLabel = stepLabels[Math.min(nextStep - 1, stepLabels.length - 1)];
      
      setSuccessToast(`Inviato ${appliedLabel} con successo a ${associatedTenant?.name}!`);
      setTimeout(() => setSuccessToast(""), 4000);
    };

    return (
      <div className="space-y-6" id="property-detail-page">
        {/* Dynamic Success Toast */}
        {successToast && (
          <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white font-sans text-xs font-bold px-4 py-3.5 rounded-2xl border border-indigo-500/20 shadow-2xl flex items-center space-x-2.5 animate-bounce duration-300">
            <span className="text-base">✨</span>
            <span>{successToast}</span>
          </div>
        )}

        {/* Back and Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSelectedDashboardProperty(null)}
              className="bg-white hover:bg-slate-50 text-slate-800 p-2.5 rounded-xl border border-slate-200 shadow-3xs transition-all flex items-center justify-center shrink-0 cursor-pointer"
              title="Torna alla Dashboard"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl">📊</span>
                <h2 className="text-xl font-sans font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Pratica di 2° Livello: <span className="text-indigo-600">{p.name}</span>
                </h2>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {p.address} — Gestione dettagliata, spese condominiali, scadenze, canoni ed F24.
              </p>
            </div>
          </div>

          <button
            onClick={() => setSelectedDashboardProperty(null)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] px-4 py-2.5 rounded-xl shadow-2xs hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
          >
            Torna alla Dashboard
          </button>
        </div>

        {/* Contract Status Summary Banner */}
        {!activeContract ? (
          <div className="bg-rose-50 border-2 border-rose-300 p-5 rounded-3xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-300 animate-pulse inline-block">
                🔴 DA LOCARE / VACANTE
              </span>
              <h4 className="font-extrabold text-sm text-rose-950 mt-2">
                Immobile Libero: Costi al 100% a Carico del Proprietario!
              </h4>
              <p className="text-[11px] text-rose-900/80 mt-1 leading-relaxed max-w-2xl">
                Non essendoci alcun contratto di locazione attivo, <strong>tutte le rate del condominio, il riscaldamento e gli interventi di manutenzione tecnica ricadono sul proprietario ({p.owner || "Mario Rossi"})</strong>. Nessun canone è in riscossione.
              </p>
            </div>
            <button
              onClick={() => setCurrentSection("contracts")}
              className="bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] px-3.5 py-2.5 rounded-xl -2 border-rose-800 active:-0 transition-all shrink-0 self-start md:self-center cursor-pointer shadow-3xs"
            >
              Carica Nuovo Contratto
            </button>
          </div>
        ) : (
          <div className="bg-indigo-50 border-2 border-indigo-200 p-5 rounded-3xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200 inline-block">
                🟢 CONTRATTO ATTIVO (4+4)
              </span>
              <h4 className="font-extrabold text-sm text-indigo-950 mt-2">
                Locazione Registrata con {associatedTenant?.name || activeContract.tenantName}
              </h4>
              <p className="text-[11px] text-indigo-900/80 mt-1 leading-relaxed max-w-2xl">
                Canone mensile: <strong>€{activeContract.rentAmount.toLocaleString("it-IT")}</strong>. Ripartizione spese condominiali: <strong>{activeContract.splitMethod === "Percentage" ? "Standard (90% inquilino / 10% proprietà)" : `Nominale fisso (€${activeContract.fixedTenantAmount}/m)`}</strong>.
              </p>
            </div>
            <button
              onClick={() => {
                localStorage.setItem("highlight_contract_id", activeContract.id);
                setCurrentSection("contracts");
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] px-3.5 py-2.5 rounded-xl -2 border-indigo-800 active:-0 transition-all shrink-0 self-start md:self-center cursor-pointer shadow-3xs"
            >
              Gestisci Contratto di Locazione
            </button>
          </div>
        )}

        {/* Dynamic Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pb-px">
          {[
            { id: "all", label: "📊 Vista Completa" },
            { id: "rents", label: `💰 Canoni d'Affitto` },
            { id: "condo", label: "🏢 Spese Condominiali" },
            { id: "maintenance", label: "🛠️ Manutenzioni" },
            { id: "registration", label: "📝 Imposta di Registro" },
            { id: "tenant", label: "👤 Anagrafica Inquilino" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveDetailTab(tab.id)}
              className={`px-4 py-2.5 font-sans font-black text-xs rounded-t-xl transition-all border-t border-x -mb-px cursor-pointer ${
                activeDetailTab === tab.id
                  ? "bg-white border-slate-200 text-indigo-600 font-extrabold shadow-3xs"
                  : "bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Tabs Area */}
        <div className="space-y-6">
          
          {/* A. GENERAL PROPERTIES STATS GRID */}
          {(activeDetailTab === "all" || activeDetailTab === "tenant") && (
            <div className="bg-white rounded-3xl border-2 border-slate-150 p-5 shadow-sm">
              <div className="flex items-center space-x-2 pb-3">
                <span className="text-base">📋</span>
                <h4 className="font-sans font-black text-xs text-slate-900 uppercase tracking-wide">
                  Anagrafica Generale Immobile e Locazione
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 mt-4">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150">
                  <span className="text-slate-400 font-mono text-[9px] uppercase font-bold block">Proprietà</span>
                  <p className="font-bold text-slate-800 text-xs mt-1">{p.owner || "Mario Rossi"}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{p.isBareOwnership ? "Nuda Proprietà" : "Piena Proprietà"}</p>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150">
                  <span className="text-slate-400 font-mono text-[9px] uppercase font-bold block">Dati Catastali & Dimensione</span>
                  <p className="font-bold text-slate-800 text-xs mt-1">{p.type} — {p.size || 85} mq</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Quota Millesimale: <strong>{p.millesimi !== undefined ? p.millesimi : 120} / 1000</strong></p>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150">
                  <span className="text-slate-400 font-mono text-[9px] uppercase font-bold block">Cassa Condominiale</span>
                  <p className="font-bold text-slate-800 text-xs mt-1">
                    {p.isCondoConstituted ? "Costituito & Attivo" : "Nessun Condominio"}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {condoConstituted ? condoConstituted.administrator : "Cassa autonoma (0 spese)"}
                  </p>
                </div>

                {activeContract && (
                  <>
                    <div className="bg-indigo-50/40 p-3.5 rounded-2xl border border-indigo-100">
                      <span className="text-indigo-400 font-mono text-[9px] uppercase font-bold block">Conduttore / Inquilino</span>
                      <p className="font-black text-indigo-950 text-xs mt-1">{associatedTenant?.name || activeContract.tenantName}</p>
                      <p className="text-[10px] text-indigo-700/80 mt-0.5 font-mono">{associatedTenant?.fiscalCode || "N/D"}</p>
                    </div>
                    <div className="bg-indigo-50/40 p-3.5 rounded-2xl border border-indigo-100">
                      <span className="text-indigo-400 font-mono text-[9px] uppercase font-bold block">Dati Contratto 4+4</span>
                      <p className="font-black text-indigo-950 text-xs mt-1">Registrato il {new Date(activeContract.startDate).toLocaleDateString("it-IT")}</p>
                      <p className="text-[10px] text-indigo-700/80 mt-0.5">Scadenza: <strong>{new Date(activeContract.endDate).toLocaleDateString("it-IT")}</strong></p>
                    </div>
                    <div className="bg-indigo-50/40 p-3.5 rounded-2xl border border-indigo-100">
                      <span className="text-indigo-400 font-mono text-[9px] uppercase font-bold block">Deposito & Garanzie</span>
                      <p className="font-black text-indigo-950 text-xs mt-1">Deposito: €{(activeContract.rentAmount * 3).toLocaleString("it-IT")}</p>
                      <p className="text-[10px] text-indigo-700/80 mt-0.5">Fideiussione: <strong>Attiva (Bper)</strong></p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* B. MASTRINO CANONI D'AFFITTO SPREADSHEET */}
          {(activeDetailTab === "all" || activeDetailTab === "rents") && (
            <div className="bg-white rounded-3xl border-2 border-slate-150 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-base">💰</span>
                  <h4 className="font-sans font-black text-xs text-slate-900 uppercase tracking-wide">
                    Mastrino Economico dei Canoni Locativi (Spreadsheet)
                  </h4>
                </div>
                {activeContract && (
                  <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 font-bold font-sans">
                    Totale Riscossione Annuale: €{(activeContract.rentAmount * 12).toLocaleString("it-IT")}
                  </span>
                )}
              </div>

              {!activeContract ? (
                <div className="py-8 text-center text-slate-400 text-xs mt-4">
                  📢 Nessun contratto attivo. Lo spreadsheet dei canoni mostra 0.00€
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-slate-600 text-[11px] leading-relaxed">
                    <thead>
                      <tr className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                        <th className="pb-2">Rata / Mese</th>
                        <th className="pb-2">Data Scadenza</th>
                        <th className="pb-2">Importo Canone</th>
                        <th className="pb-2">Data Incasso</th>
                        <th className="pb-2">ID Transazione</th>
                        <th className="pb-2 text-center">Stato</th>
                        <th className="pb-2 text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {generatedRents.map(row => {
                        const hasSentNotice = localNoticeSent[row.key];
                        return (
                          <tr key={row.key} className="hover:bg-slate-50/50">
                            <td className="py-3 font-sans font-black text-slate-900">{row.name}</td>
                            <td className="py-3 text-slate-500">{new Date(row.dueDate).toLocaleDateString("it-IT")}</td>
                            <td className="py-3 font-extrabold text-slate-800">€{row.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                            <td className="py-3 text-slate-600 font-sans">{row.paymentDate ? new Date(row.paymentDate).toLocaleDateString("it-IT") : "—"}</td>
                            <td className="py-3 text-slate-400 text-[10px]">{row.txId || "—"}</td>
                            <td className="py-3 text-center">
                              <span className={`text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                                row.status === "Paid" 
                                  ? "bg-emerald-100 text-emerald-800" 
                                  : row.status === "Overdue" 
                                  ? "bg-rose-100 text-rose-800 animate-pulse"
                                  : "bg-amber-100 text-amber-800"
                              }`}>
                                {row.status === "Paid" && "🟢 PAGATO"}
                                {row.status === "Overdue" && "🔴 MOROSO"}
                                {row.status === "Pending" && "🟡 IN ATTESA"}
                              </span>
                              {hasSentNotice && (
                                <span className="block text-[7px] text-rose-600 font-black mt-1 font-sans uppercase">
                                  ✉️ SOLLECITO STEP {hasSentNotice.step} ({hasSentNotice.dateSent})
                                </span>
                              )}
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex justify-end gap-1.5 font-sans">
                                {row.status !== "Paid" && (
                                  <button
                                    onClick={() => handleRegisterLocalPayment(row.key, "rent")}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[8px] px-2 py-1 rounded active:-0 cursor-pointer uppercase transition-all"
                                  >
                                    Registra Incasso
                                  </button>
                                )}
                                {row.status === "Overdue" && (
                                  <button
                                    onClick={() => handleSendLocalNotice(row.key)}
                                    className="bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[8px] px-2 py-1 rounded active:-0 cursor-pointer uppercase transition-all"
                                  >
                                    Sollecita {hasSentNotice ? `Step ${hasSentNotice.step + 1}` : "Step 1"}
                                  </button>
                                )}
                                {row.status === "Paid" && (
                                  <span className="text-[10px] text-emerald-600 font-extrabold font-sans select-none">✓ RICONCILIATO</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* C. MASTRINO SPESE CONDOMINIALI SPREADSHEET */}
          {(activeDetailTab === "all" || activeDetailTab === "condo") && (
            <div className="bg-white rounded-3xl border-2 border-slate-150 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-base">🏢</span>
                  <h4 className="font-sans font-black text-xs text-slate-900 uppercase tracking-wide">
                    Mastrino Oneri Condominiali & Spese Amministrazione
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-sans text-slate-500 bg-slate-100 px-2 py-0.5 rounded border font-medium">
                    {condoConstituted ? "Studio Amministrazione Verdi" : "Nessun Amministratore (Spese a Zero)"}
                  </span>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-slate-600 text-[11px] leading-relaxed">
                  <thead>
                    <tr className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                      <th className="pb-2">Rata / Descrizione</th>
                      <th className="pb-2">Data Scadenza</th>
                      <th className="pb-2">Importo Rata</th>
                      <th className="pb-2">Quota Inquilino (90% o Fisso)</th>
                      <th className="pb-2">Quota Proprietà</th>
                      <th className="pb-2 text-center">Stato</th>
                      <th className="pb-2 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {condoRatesToShow.map((rate, index) => {
                      return (
                        <tr key={rate.key || index} className="hover:bg-slate-50/50">
                          <td className="py-3 font-sans font-black text-slate-900">{rate.title}</td>
                          <td className="py-3 text-slate-500">{new Date(rate.dueDate).toLocaleDateString("it-IT")}</td>
                          <td className="py-3 font-extrabold text-slate-800">€{rate.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 text-indigo-600 font-black">€{rate.tenantShare.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 text-slate-500">€{rate.ownerShare.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 text-center">
                            <span className={`text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                              rate.amount === 0
                                ? "bg-slate-100 text-slate-500"
                                : rate.status === "Paid" 
                                ? "bg-emerald-100 text-emerald-800" 
                                : rate.status === "Overdue" 
                                ? "bg-rose-100 text-rose-800 animate-pulse"
                                : "bg-amber-100 text-amber-800"
                            }`}>
                              {rate.amount === 0 ? "REGOLARE (0,00)" : rate.status === "Paid" ? "🟢 PAGATO" : rate.status === "Pending" ? "🟡 IN ATTESA" : "🔴 DA SALDARE"}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {rate.amount > 0 && rate.status !== "Paid" ? (
                              <button
                                onClick={() => handleRegisterLocalPayment(rate.key, "condo")}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[8px] px-2 py-1 rounded active:-0 cursor-pointer uppercase font-sans transition-all"
                              >
                                Salda Rata
                              </button>
                            ) : rate.amount > 0 ? (
                              <span className="text-[10px] text-emerald-600 font-extrabold font-sans">✓ SALDATA</span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-sans italic">Esente</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* D. MASTRINO MANUTENZIONI SPREADSHEET */}
          {(activeDetailTab === "all" || activeDetailTab === "maintenance") && (
            <div className="bg-white rounded-3xl border-2 border-slate-150 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-base">🛠️</span>
                  <h4 className="font-sans font-black text-xs text-slate-900 uppercase tracking-wide">
                    Mastrino Manutenzioni & Spese Tecniche Straordinarie
                  </h4>
                </div>
                <span className="text-[10px] text-slate-500">Spese deducibili fiscalmente al 100% per il proprietario</span>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-slate-600 text-[11px] leading-relaxed">
                  <thead>
                    <tr className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                      <th className="pb-2">Intervento / Descrizione</th>
                      <th className="pb-2">Tecnico / Ditta</th>
                      <th className="pb-2">Data Intervento</th>
                      <th className="pb-2">Costo Totale</th>
                      <th className="pb-2">Addebito A Carico</th>
                      <th className="pb-2 text-center">Stato Lavori</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {maintenanceToShow.map(m => {
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/50">
                          <td className="py-3 font-sans">
                            <span className="font-black text-slate-900 block">{m.title}</span>
                            {m.description && <span className="text-[9px] text-slate-400 block mt-0.5">{m.description}</span>}
                          </td>
                          <td className="py-3 text-slate-600 font-sans">{m.contractor || "N/A"}</td>
                          <td className="py-3 text-slate-500">{m.date ? new Date(m.date).toLocaleDateString("it-IT") : "—"}</td>
                          <td className="py-3 font-extrabold text-slate-800">€{(m.cost || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 font-sans">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              m.chargedTo === "tenant" ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-700"
                            }`}>
                              {m.chargedTo === "tenant" ? "Inquilino (Ordinario)" : "Proprietario (100%)"}
                            </span>
                          </td>
                          <td className="py-3 text-center font-sans">
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${
                              m.status === "Completed" 
                                ? "bg-emerald-100 text-emerald-800" 
                                : m.status === "In Progress"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}>
                              {m.status === "Completed" && "🟢 COMPLETATA"}
                              {m.status === "In Progress" && "🟡 IN CORSO"}
                              {m.status === "New" && "🔵 APERTA"}
                              {m.status === "Cancelled" && "⚪ ANNULLATA"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* E. MASTRINO IMPOSTA DI REGISTRO SPREADSHEET (4+4) */}
          {(activeDetailTab === "all" || activeDetailTab === "registration") && (
            <div className="bg-white rounded-3xl border-2 border-slate-150 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-base">📝</span>
                  <h4 className="font-sans font-black text-xs text-slate-900 uppercase tracking-wide">
                    Spreadsheet Registro F24 - Imposte di Registro (4+4)
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded border">
                  Regime Registrazione: Imposta di Registro Standard (2%)
                </span>
              </div>

              {!activeContract ? (
                <div className="py-8 text-center text-slate-400 text-xs mt-4">
                  📢 Carica un contratto attivo per visualizzare le imposte di registro annuali.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-slate-600 text-[11px] leading-relaxed">
                    <thead>
                      <tr className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                        <th className="pb-2">Annualità Contratto</th>
                        <th className="pb-2">Scadenza F24</th>
                        <th className="pb-2">Importo F24 dovuto (2%)</th>
                        <th className="pb-2">Codice Tributo</th>
                        <th className="pb-2 text-center">Stato F24</th>
                        <th className="pb-2 text-right">Azioni F24</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {generatedRegistration.map(row => {
                        return (
                          <tr key={row.key} className="hover:bg-slate-50/50">
                            <td className="py-3 font-sans font-black text-slate-900">{row.year}</td>
                            <td className="py-3 text-slate-500">{new Date(row.dueDate).toLocaleDateString("it-IT")}</td>
                            <td className="py-3 font-extrabold text-slate-800">€{row.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                            <td className="py-3 text-slate-500 font-bold">{row.f24Code}</td>
                            <td className="py-3 text-center">
                              <span className={`text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                                row.status === "Paid" 
                                  ? "bg-emerald-100 text-emerald-800" 
                                  : row.status === "Overdue" 
                                  ? "bg-rose-100 text-rose-800 animate-pulse"
                                  : "bg-amber-100 text-amber-800"
                              }`}>
                                {row.status === "Paid" && "🟢 SALDATO (REGOLARE)"}
                                {row.status === "Overdue" && "🔴 SCADUTO (DA SALDARE)"}
                                {row.status === "Pending" && "🟡 IN ATTESA"}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              {row.status !== "Paid" ? (
                                <button
                                  onClick={() => handleRegisterLocalRegistration(row.key)}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[8px] px-2.5 py-1.5 rounded -2 border-indigo-800 active:-0 cursor-pointer font-sans transition-all uppercase"
                                >
                                  Paga F24 (€{row.amount})
                                </button>
                              ) : (
                                <span className="text-[10px] text-emerald-600 font-extrabold font-sans">✓ RICEVUTA AG_ENTRATE</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* F. FAST CLOSING & REMINDERS ACTIVE STATUS */}
          {activeDetailTab === "all" && activeRemindersForProperty.length > 0 && (
            <div className="bg-white rounded-3xl border-2 border-slate-150 p-5 shadow-sm">
              <div className="flex items-center space-x-2 pb-3">
                <span className="text-base">⚠️</span>
                <h4 className="font-sans font-black text-xs text-slate-900 uppercase tracking-wide">
                  Solleciti di Pagamento & Pendenze Legali Attive per l'Inquilino
                </h4>
              </div>
              <div className="mt-4 space-y-3">
                {activeRemindersForProperty.map(r => {
                  const delayDays = r.dueDate ? Math.max(15, Math.ceil((new Date().getTime() - new Date(r.dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 15;
                  return (
                    <div key={r.id} className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[8px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-200">
                            🔴 SOLLECITO ATTIVO — STEP {r.step || 1}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">Creato il {new Date(r.createdAt).toLocaleDateString("it-IT")}</span>
                        </div>
                        <h5 className="font-extrabold text-rose-950 mt-1.5">Messa in Mora: {r.tenantName}</h5>
                        <p className="text-[10px] text-rose-800/80 mt-0.5 leading-relaxed">
                          La morosità persiste da oltre {delayDays} giorni. Stato dell'invio: <strong>{r.status}</strong>.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setCurrentSection("reminders");
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[9px] px-3 py-2 rounded-lg shrink-0 self-start sm:self-center transition-all cursor-pointer shadow-3xs"
                      >
                        Gestisci in Solleciti
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Dynamic Back to Dashboard Action Footer */}
        <div className="flex justify-center pt-4">
          <button
            onClick={() => setSelectedDashboardProperty(null)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-6 py-3.5 rounded-2xl active:transition-all cursor-pointer shadow-md hover:scale-[1.01] active:scale-[0.99]"
          >
            ← Torna al Portafoglio Immobili della Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" id="dashboard-view-container">
      
      {/* Welcome header with dynamic context & 3D Demo Seed Button */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-sans font-black text-slate-900 tracking-tight">
              Ciao, {userName}! 👋
            </h2>
            {totalProperties > 0 && (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200 flex items-center space-x-1 uppercase animate-pulse">
                <span>🟢</span> <span>Dati Demo Caricati</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Panoramica in tempo reale del tuo patrimonio immobiliare. Usa i tasti 3D per pilotare tutte le funzioni dell'applicazione.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {onSeedDemoData && (
            <button
              onClick={onSeedDemoData}
              id="seed-demo-data-btn"
              className="inline-flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-5 py-3.5 rounded-xl active:transition-all shadow-md active:shadow-xs"
            >
              <span>🚀</span>
              <span>Inietta Dati Demo</span>
            </button>
          )}

          {onSeedSimulationData && (
            <button
              onClick={onSeedSimulationData}
              id="seed-simulation-data-btn"
              className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 py-3.5 rounded-xl active:transition-all shadow-md active:shadow-xs hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              <span>🏟️</span>
              <span>Simula Locazione Meloni</span>
            </button>
          )}

          <button
            onClick={() => setCurrentSection("ai_area")}
            id="open-ai-area-btn"
            className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-5 py-3.5 rounded-xl active:transition-all shadow-md active:shadow-xs"
          >
            <Sparkles size={14} className="animate-spin text-amber-300" />
            <span>Apri Area AI</span>
          </button>

          <button
            onClick={() => setShowConsolidatedReport(true)}
            id="open-consolidated-report-btn"
            className="inline-flex items-center space-x-2 bg-violet-600 hover:bg-violet-500 text-white font-black text-xs px-5 py-3.5 rounded-xl active:transition-all shadow-md active:shadow-xs hover:scale-[1.02] cursor-pointer"
          >
            <span>📊</span>
            <span>Rendicontazione Consolidata</span>
          </button>
        </div>
      </div>

      {/* SEZIONE STATO SOGGETTI DEBITORI E PRATICHE APERTE */}
      <div className="bg-white rounded-3xl border-2 border-slate-150 p-6 shadow-md w-full" id="debtors-status-dashboard">
        <div className="flex items-center space-x-2.5 pb-4">
          <span className="text-xl">📊</span>
          <div>
            <h3 className="font-sans font-black text-slate-900 text-sm">
              Stato Soggetti Debitori & Pratiche Aperte
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Stato di adempimento in tempo reale e livello di criticità dei conduttori.</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {tenants.map(t => {
            // Compute classification
            const classif = getTenantClassification(t, properties, contracts, fastClosing, legalCases, reminders);
            
            // Check specifically if passed to legal case
            const hasLegal = legalCases.some(lc => {
              if (lc.status === "Closed") return false;
              const tName = (t.name || "").toLowerCase().trim();
              const lcTenant = (lc.tenantName || "").toLowerCase().trim();
              return lcTenant.includes(tName) || tName.includes(lcTenant);
            });

            let statusLabel = "Tutto Regolare";
            let badgeBg = "bg-emerald-50 border-emerald-200 text-emerald-700";
            let dotColor = "bg-emerald-500";
            let isBlinking = false;

            if (hasLegal) {
              statusLabel = "Pratica Passata al Legale";
              badgeBg = "bg-red-950 border-red-800 text-red-200 animate-pulse";
              dotColor = "bg-red-500";
              isBlinking = true;
            } else if (classif.status === "red" || classif.status === "critical") {
              statusLabel = "Seconda Fase / Criticità Forte";
              badgeBg = "bg-rose-100 border-rose-300 text-rose-800";
              dotColor = "bg-rose-600";
            } else if (classif.status === "orange") {
              statusLabel = "Arreatrato Iniziale";
              badgeBg = "bg-amber-100 border-amber-300 text-amber-800";
              dotColor = "bg-amber-500";
            }

            return (
              <div
                key={t.id}
                onClick={() => setCurrentSection("reminders")}
                className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer hover:border-slate-400 hover:shadow-xs flex flex-col justify-between ${
                  isBlinking ? "border-red-600 bg-red-50/20" : "border-slate-150 bg-slate-50/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Conduttore</span>
                    <span className={`flex h-2.5 w-2.5 rounded-full ${dotColor} ${isBlinking ? "animate-pulse" : ""}`}></span>
                  </div>
                  <h4 className="font-sans font-extrabold text-slate-800 text-xs mt-1.5 truncate">
                    {t.name}
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                    Immobile: {properties.find(p => p.id === t.propertyId)?.name || "N/A"}
                  </p>
                </div>
                
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center space-x-1 border text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${badgeBg}`}>
                    <span>{statusLabel}</span>
                  </span>
                  {!t.propertyId && (
                    <span
                      className="inline-flex items-center space-x-1 border border-amber-300 bg-amber-100 text-amber-800 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider"
                      title="Nessun immobile collegato a questo inquilino"
                    >
                      <span>🏠❗ Immobile da assegnare</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          
          {tenants.length === 0 && (
            <div className="col-span-full py-6 text-center text-slate-400 text-xs">
              Nessun inquilino presente nel sistema per visualizzare lo stato pendenze.
            </div>
          )}
        </div>
      </div>

      {/* HIGH-FIDELITY BULLETIN BOARD: BACHECA ATTIVITÀ IN SCADENZA SIGNIFICATIVA (AT THE TOP) */}
      <div className="bg-white rounded-3xl border-2 border-slate-150 p-6 shadow-md w-full" id="dashboard-activities-bar">
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">📌</span>
            <h3 className="font-sans font-black text-slate-900 text-base">
              Bacheca Attività in Scadenza Significativa
            </h3>
          </div>
          <button 
            onClick={() => setCurrentSection("fast_closing")}
            className={`text-xs font-black flex items-center space-x-1.5 px-4 py-2.5 rounded-xl transition-all ${
              hasOpenFastClosing
                ? "bg-rose-500 hover:bg-rose-400 text-white border-rose-700 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-200"
            }`}
          >
            {hasOpenFastClosing && <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>}
            <span>{hasOpenFastClosing ? "🔴 Fast Closing Aperto (Vedi)" : "Vedi Scadenza"}</span>
            <ArrowRight size={12} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          
          {isNotificationsSuspended ? (
            <div className="py-10 px-6 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center space-y-2" id="dashboard-notifications-suspended-box">
              <span className="text-2xl">🔕</span>
              <p className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Ricezione Notifiche Sospesa</p>
              <p className="max-w-md text-slate-500 leading-relaxed text-[10px]">
                In base alle tue impostazioni personalizzate (giorni, orari o intervalli di sospensione), la bacheca è attualmente silenziata. I solleciti, le scadenze e gli avvisi torneranno ad aggiornarsi negli orari e nei giorni lavorativi configurati.
              </p>
              <button 
                onClick={() => setCurrentSection("settings")}
                className="mt-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-500 underline flex items-center gap-1 cursor-pointer"
              >
                Configura Preferenze ⚙️
              </button>
            </div>
          ) : (
            <>
              {/* Inject Dynamic Alerts for Missing Rental Contracts */}
              {rentedPropertiesMissingContract.map(p => {
                const matchedTenantName = tenants.find(t => t.propertyId === p.id)?.name || "Nessun inquilino collegato";
                return (
                  <div 
                    key={`missing-contract-alert-${p.id}`}
                    className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50/70 transition-all duration-300 shadow-2xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl mt-0.5 shrink-0">⚠️</span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-extrabold text-xs text-amber-950 leading-snug">
                              Contratto d'Affitto Mancante: {p.name}
                            </h4>
                            <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase">
                              🔴 Registrazione Urgente
                            </span>
                          </div>
                          <p className="text-[10px] text-amber-900/80 mt-1 leading-relaxed">
                            L'immobile risulta locato a <strong>{matchedTenantName}</strong>, ma non è presente alcun contratto attivo caricato. È obbligatorio registrare un contratto per abilitare la contabilizzazione automatica.
                          </p>
                        </div>
                      </div>

                      <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pt-3 sm:pt-0 border-t sm:border-t-0 border-amber-200">
                        <button
                          onClick={() => setCurrentSection("contracts")}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] px-3.5 py-2 rounded-lg -2 border-indigo-800 active:-0 transition-all cursor-pointer"
                        >
                          Carica Ora
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* CORREZIONE F — Promemoria: inquilini creati senza un immobile collegato */}
              {tenants.filter(t => !t.propertyId).map(t => (
                <div
                  key={`tenant-missing-property-${t.id}`}
                  className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50/70 transition-all duration-300 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl mt-0.5 shrink-0">🏠❗</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-extrabold text-xs text-amber-950 leading-snug">
                            Immobile da Assegnare: {t.name}
                          </h4>
                          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase">
                            Promemoria
                          </span>
                        </div>
                        <p className="text-[10px] text-amber-900/80 mt-1 leading-relaxed">
                          Questo inquilino è stato registrato senza collegarlo a nessun immobile. Nessun problema se è intenzionale (es. immobile non ancora disponibile), ma finché non viene collegato non potrà avere un contratto né una posizione contabile.
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pt-3 sm:pt-0 border-t sm:border-t-0 border-amber-200">
                      <button
                        onClick={() => setCurrentSection("tenants")}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] px-3.5 py-2 rounded-lg -2 border-indigo-800 active:-0 transition-all cursor-pointer"
                      >
                        Assegna Ora
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* CORREZIONE Q — Promemoria: pratiche passate all'Area Legale ma non ancora affidate a uno studio */}
              {legalCases.filter(lc => !lc.assignedLawyerId && lc.status !== "Closed").map(lc => (
                <div
                  key={`legal-case-unassigned-${lc.id}`}
                  className="p-4 rounded-xl border-2 border-rose-300 bg-rose-50/70 transition-all duration-300 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl mt-0.5 shrink-0">⚖️❗</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-extrabold text-xs text-rose-950 leading-snug">
                            Pratica da Affidare: {lc.title}
                          </h4>
                          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 uppercase">
                            Recupero Legale
                          </span>
                        </div>
                        <p className="text-[10px] text-rose-900/80 mt-1 leading-relaxed">
                          Questa pratica è passata all'Area Legale ma non è ancora stata affidata a nessuno studio legale. Trascinala su uno studio per assegnarla.
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pt-3 sm:pt-0 border-t sm:border-t-0 border-rose-200">
                      <button
                        onClick={() => setCurrentSection("legal")}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] px-3.5 py-2 rounded-lg -2 border-indigo-800 active:-0 transition-all cursor-pointer"
                      >
                        Assegna Ora
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Multi-step Payment Request Sequence Alerts */}
              {sequenceAlerts.map((alert) => {
                const getStepDescription = (step: number) => {
                  if (step === 1) return "1° Sollecito inviato. Il sistema suggerisce di monitorare lo stato o procedere al 2° sollecito.";
                  if (step === 2) return "2° Sollecito inviato. Consigliata Messa in Mora formale (Diffida AR) per posta.";
                  if (step === 3) return "Messa in Mora inviata. In attesa di riscontro o caricamento della ricevuta AR firmata.";
                  if (step === 4) return "Tutti i tentativi bonari conclusi. Pratica idonea per l'ufficio legale.";
                  return "";
                };

                return (
                  <div 
                    key={`sequence-alert-${alert.id}`}
                    onClick={() => setCurrentSection("reminders")}
                    className="p-5 rounded-2xl border-2 border-rose-500 bg-rose-50/60 shadow-xs relative cursor-pointer hover:border-rose-600 hover:bg-rose-100/40 transition-all"
                  >
                    {/* Visual Progress Stepper for the Reminder sequence */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-[9px] text-rose-800 font-bold uppercase tracking-wider mb-2">
                        <span>Attività di Sollecito: {alert.tenantName}</span>
                        <span className="bg-rose-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                          Livello {alert.step} di 4
                        </span>
                      </div>
                      
                      {/* Stepper progress dots */}
                      <div className="grid grid-cols-4 gap-1.5 h-1.5 bg-rose-200/50 rounded-full overflow-hidden">
                        <div className={`rounded-full ${alert.step >= 1 ? "bg-rose-600" : "bg-slate-200"}`}></div>
                        <div className={`rounded-full ${alert.step >= 2 ? "bg-rose-600" : "bg-slate-200"}`}></div>
                        <div className={`rounded-full ${alert.step >= 3 ? "bg-rose-600" : "bg-slate-200"}`}></div>
                        <div className={`rounded-full ${alert.step >= 4 ? "bg-rose-600" : "bg-slate-200"}`}></div>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-start space-x-3">
                        <span className="text-xl mt-0.5 shrink-0">⏰</span>
                        <div>
                          <h4 className="font-extrabold text-xs text-rose-950">
                            Pendenza Amministrativa: {alert.tenantName}
                          </h4>
                          <p className="text-[10px] text-rose-900/80 mt-1 leading-relaxed">
                            {getStepDescription(alert.step)} 
                            {alert.daysPassed > 0 && ` Sono trascorsi ${alert.daysPassed} giorni dall'ultimo aggiornamento.`}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentSection("reminders");
                        }}
                        className="shrink-0 self-start md:self-center bg-rose-600 hover:bg-rose-500 text-white font-black text-[9px] py-2 px-3 rounded-lg -2 border-rose-800 active:-0 transition-all cursor-pointer shadow-xs"
                      >
                        Vedi in Solleciti
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Registration & Proroga Milestones Alerts (Bare Ownership / Standard) */}
              {pendingRegistrations.map((alert) => (
                <div 
                  key={`reg-milestone-alert-${alert.id}`}
                  className="p-4 rounded-xl border-2 border-amber-500 bg-amber-50/70 shadow-2xs animate-pulse duration-1000"
                  style={{ animationDuration: '2.5s' }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl mt-0.5 shrink-0">⏰</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-extrabold text-xs text-amber-950 leading-snug">
                            {alert.title}: {alert.propertyName}
                          </h4>
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase ${alert.daysRemaining <= 0 ? "bg-rose-200 text-rose-900" : "bg-amber-200 text-amber-900"}`}>
                            {alert.daysRemaining <= 0 ? "⚠️ Scaduto / Urgente" : `⏳ Scade tra ${alert.daysRemaining} gg`}
                          </span>
                        </div>
                        <p className="text-[10px] text-amber-900/80 mt-1 leading-relaxed">
                          {alert.description}
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pt-3 sm:pt-0 border-t sm:border-t-0 border-amber-200">
                      <button
                        onClick={() => {
                          localStorage.setItem("highlight_registration_contract_id", alert.contractId);
                          localStorage.setItem("highlight_registration_milestone_id", alert.id);
                          localStorage.setItem("highlight_registration_title", alert.title);
                          setCurrentSection("contracts");
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] px-3.5 py-2 rounded-lg -2 border-indigo-800 active:-0 transition-all cursor-pointer"
                      >
                        Risolvi & Carica Ricevuta
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Contracts close to expiration warnings */}
              {contractsCloseToExpiration.map((contract) => {
                const now = new Date();
                const end = new Date(contract.endDate);
                const diffTime = end.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                return (
                  <div 
                    key={`contract-exp-${contract.id}`}
                    className="p-5 rounded-2xl border-2 border-amber-400 bg-amber-50/65 transition-all duration-300 shadow-sm space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl mt-0.5 shrink-0">📄</span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-extrabold text-xs text-amber-950 leading-snug">
                              Contratto in Scadenza: {contract.propertyName}
                            </h4>
                            <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase">
                              ⏳ Mancano {diffDays} Giorni
                            </span>
                          </div>
                          <p className="text-[10px] text-amber-900/80 mt-1 leading-relaxed">
                            Il contratto stipulato con il conduttore <strong>{contract.tenantName}</strong> scadrà il <strong>{end.toLocaleDateString("it-IT")}</strong>. Valutare rinnovo o disdetta formale (allerta 7 mesi anticipo attiva).
                          </p>
                        </div>
                      </div>

                      <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pt-3 sm:pt-0 border-t sm:border-t-0 border-amber-300 gap-2 shrink-0">
                        <button
                          onClick={() => setCurrentSection("contracts")}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] px-3.5 py-2 rounded-lg -2 border-amber-700 active:-0 transition-all cursor-pointer"
                        >
                          Gestisci Contratto
                        </button>
                        
                        <button
                          disabled={syncingContractId === contract.id || calendarSyncSuccess[contract.id]}
                          onClick={() => handleSyncToGoogleCalendar(contract)}
                          className={`font-black text-[10px] px-3.5 py-2 rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                            calendarSyncSuccess[contract.id]
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-900 hover:bg-slate-800 text-white"
                          }`}
                        >
                          <span>{syncingContractId === contract.id ? "Sincronizzazione..." : calendarSyncSuccess[contract.id] ? "✓ Sincronizzato" : "🗓️ Sincronizza Google Calendar"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Google Calendar Authorization warning and success / failure messages */}
                    {!googleAccessToken && !calendarSyncSuccess[contract.id] && (
                      <div className="bg-amber-100/80 border border-amber-200 p-2.5 rounded-lg text-[10px] text-amber-900 flex items-center justify-between">
                        <span>⚠️ Google Calendar non connesso. Effettua il login per poter inserire la scadenza direttamente sul tuo calendario reale.</span>
                        <button
                          onClick={onConnectGoogleCalendar}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-black text-[9px] px-2.5 py-1 rounded-md cursor-pointer shrink-0 transition-all ml-2"
                        >
                          Connetti Calendar
                        </button>
                      </div>
                    )}

                    {calendarSyncErrors[contract.id] && (
                      <div className="bg-rose-100 border border-rose-200 p-2.5 rounded-lg text-[10px] text-rose-900 flex items-center justify-between">
                        <span>❌ {calendarSyncErrors[contract.id]}</span>
                        <button
                          onClick={onConnectGoogleCalendar}
                          className="bg-rose-900 hover:bg-rose-800 text-white font-black text-[9px] px-2 py-0.5 rounded-md cursor-pointer shrink-0 ml-2"
                        >
                          Riconnetti
                        </button>
                      </div>
                    )}

                    {calendarSyncSuccess[contract.id] && (
                      <div className="bg-emerald-100 border border-emerald-200 p-2.5 rounded-lg text-[10px] text-emerald-900">
                        ✓ Scadenza inserita con successo nel tuo account Google Calendar! Riceverai una notifica email 7 giorni prima.
                      </div>
                    )}
                  </div>
                );
              })}

              {/* New Notification 1: Initial Registration custom reminders (30 days term) */}
              {initialRegistrationContractReminders.map((rem) => (
                <div 
                  key={rem.id}
                  className="p-4 rounded-xl border-2 border-indigo-400 bg-indigo-50/50 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl mt-0.5 shrink-0">📄</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-extrabold text-xs text-indigo-950 leading-snug">
                            {rem.title}: {rem.propertyName}
                          </h4>
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase ${rem.daysRemaining <= 0 ? "bg-rose-200 text-rose-900" : "bg-indigo-200 text-indigo-900"}`}>
                            {rem.daysRemaining <= 0 ? "⚠️ Termine Scaduto" : `⏳ Scade tra ${rem.daysRemaining} gg`}
                          </span>
                        </div>
                        <p className="text-[10px] text-indigo-900/80 mt-1 leading-relaxed">
                          {rem.description}
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pt-3 sm:pt-0 border-t sm:border-t-0 border-indigo-200">
                      <button
                        onClick={() => {
                          localStorage.setItem("highlight_registration_contract_id", rem.contractId);
                          setCurrentSection("contracts");
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] px-3.5 py-2 rounded-lg -2 border-indigo-800 active:-0 transition-all cursor-pointer"
                      >
                        Registra e Carica Ricevuta
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* New Notification 2: Custom Contract Expiration pre-alert (8 months, monthly recurrence) */}
              {customContractExpiryReminders.map((rem) => (
                <div 
                  key={rem.id}
                  className="p-4 rounded-xl border-2 border-amber-400 bg-amber-50/50 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl mt-0.5 shrink-0">⏳</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-extrabold text-xs text-amber-950 leading-snug">
                            {rem.title}: {rem.propertyName}
                          </h4>
                          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase">
                            {rem.monthsRemaining} Mesi al Rinnovo
                          </span>
                        </div>
                        <p className="text-[10px] text-amber-900/80 mt-1 leading-relaxed">
                          {rem.description}
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pt-3 sm:pt-0 border-t sm:border-t-0 border-amber-200">
                      <button
                        onClick={() => setCurrentSection("contracts")}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] px-3.5 py-2 rounded-lg -2 border-amber-700 active:-0 transition-all cursor-pointer"
                      >
                        Gestisci Contratto
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* New Notification 3: Custom rent payment due alert (every 2 days) */}
              {customDueRentReminders.map((rem) => (
                <div 
                  key={rem.id}
                  className="p-4 rounded-xl border-2 border-rose-400 bg-rose-50/50 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl mt-0.5 shrink-0">💰</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-extrabold text-xs text-rose-950 leading-snug">
                            {rem.title}: {rem.propertyName}
                          </h4>
                          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 uppercase">
                            Scaduto
                          </span>
                        </div>
                        <p className="text-[10px] text-rose-900/80 mt-1 leading-relaxed font-semibold">
                          {rem.description}
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pt-3 sm:pt-0 border-t sm:border-t-0 border-rose-200">
                      <button
                        onClick={() => setCurrentSection("fast_closing")}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] px-3.5 py-2 rounded-lg -2 border-rose-800 active:-0 transition-all cursor-pointer"
                      >
                        Gestisci Canoni
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* New Notification 4: Insurance Policy Expiry warnings (within 30 days, no money amounts displayed) */}
              {insuranceExpiryAlerts.map((alert) => (
                <div 
                  key={alert.id}
                  className="p-4 rounded-xl border-2 border-indigo-500 bg-indigo-50/70 shadow-2xs animate-pulse duration-1000"
                  style={{ animationDuration: '3s' }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl mt-0.5 shrink-0">🛡️</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-extrabold text-xs text-indigo-950 leading-snug">
                            Scadenza Polizza Assicurativa: {alert.propertyName}
                          </h4>
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase ${alert.daysRemaining <= 0 ? "bg-rose-200 text-rose-900 animate-none" : "bg-indigo-200 text-indigo-900"}`}>
                            {alert.daysRemaining <= 0 ? "⚠️ Scaduta" : `⏳ Scade tra ${alert.daysRemaining} gg`}
                          </span>
                        </div>
                        <p className="text-[10px] text-indigo-900/80 mt-1 leading-relaxed">
                          La polizza n. <strong>{alert.policyNumber}</strong> stipulata con <strong>{alert.company}</strong> scade il {new Date(alert.expiryDate).toLocaleDateString("it-IT")}. Rinnova la copertura per tutelare l'immobile.
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pt-3 sm:pt-0 border-t sm:border-t-0 border-indigo-200">
                      <button
                        onClick={() => setCurrentSection("properties")}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] px-3.5 py-2 rounded-lg -2 border-indigo-800 active:-0 transition-all cursor-pointer"
                      >
                        Vedi Polizze
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Warnings and alerts only empty state checking */}
              {rentedPropertiesMissingContract.length === 0 && 
               contractsCloseToExpiration.length === 0 && 
               sequenceAlerts.length === 0 && 
               pendingRegistrations.length === 0 &&
               initialRegistrationContractReminders.length === 0 &&
               customContractExpiryReminders.length === 0 &&
               customDueRentReminders.length === 0 &&
               insuranceExpiryAlerts.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed">
                  📢 Nessun avviso o sollecito di pagamento in bacheca al momento. Il sistema è aggiornato!
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Countdown Widget Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5 text-amber-400">
            <Clock size={18} className="animate-pulse" />
            <span className="font-mono text-xs uppercase font-bold tracking-wider">Scadenza Fast Closing Mensile</span>
          </div>
          <h4 className="text-base font-sans font-black text-white mt-1.5">
            Chiusura Automatica Fine Mese
          </h4>
          <p className="text-[11px] text-slate-400 mt-1">
            Allo scadere di questo timer, tutte le posizioni non giustificate verranno consolidate e inserite negli Insoluti.
          </p>
          <div className="grid grid-cols-4 gap-2.5 mt-4">
            {[
              { label: "Giorni", val: timeLeftAuto.days },
              { label: "Ore", val: timeLeftAuto.hours },
              { label: "Minuti", val: timeLeftAuto.minutes },
              { label: "Secondi", val: timeLeftAuto.seconds },
            ].map((t, idx) => (
              <div key={idx} className="bg-slate-800 p-2.5 rounded-xl text-center border border-slate-700/80">
                <span className="block text-xl font-mono font-black text-white">{String(t.val).padStart(2, "0")}</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t md:border-t-0 md:border-l border-slate-800 pt-5 md:pt-0 md:pl-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 text-indigo-400">
                <CalendarClock size={18} />
                <span className="font-mono text-xs uppercase font-bold tracking-wider">Chiusura Manuale</span>
              </div>
              <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                timeLeftManual.unlocked 
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse" 
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}>
                {timeLeftManual.unlocked ? "🟢 SBLOCCATA" : "🔒 BLOCCATA FINO AL 20"}
              </span>
            </div>
            <h4 className="text-base font-sans font-black text-white mt-1.5">
              Abilitazione Chiusura Anticipata
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              La chiusura manuale del Fast Closing è consentita solo a partire dal ventesimo giorno del mese corrente.
            </p>
          </div>
          
          {timeLeftManual.unlocked ? (
            <div className="mt-4 flex items-center space-x-3 bg-emerald-950/40 border border-emerald-900/50 p-3 rounded-xl">
              <div className="bg-emerald-500 text-slate-950 p-1.5 rounded-lg shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-bold text-emerald-300">Fast Closing Chiusura Manuale Attiva!</p>
                <button
                  onClick={() => setCurrentSection("fast_closing")}
                  className="text-[10px] text-white hover:underline mt-0.5 flex items-center font-bold"
                >
                  Vai a Fast Closing per chiudere <ArrowRight size={10} className="ml-1" />
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-4 gap-2.5">
              {[
                { label: "Giorni", val: timeLeftManual.days },
                { label: "Ore", val: timeLeftManual.hours },
                { label: "Minuti", val: timeLeftManual.minutes },
                { label: "Secondi", val: timeLeftManual.seconds },
              ].map((t, idx) => (
                <div key={idx} className="bg-slate-850 p-2 rounded-xl text-center border border-slate-800">
                  <span className="block text-sm font-mono font-black text-indigo-300">{String(t.val).padStart(2, "0")}</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SEZIONE ALLERTE CRITICHE DISDETTE RACCOMANDATE OBBLIGATORIE */}
      {disdettaAlerts.length > 0 && (
        <div className="space-y-4">
          {disdettaAlerts.map(c => {
            const now = new Date();
            const end = new Date(c.endDate);
            const diffTime = end.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const sixMonthsDays = 6 * 30.4375;
            const daysRemaining = Math.ceil(diffDays - sixMonthsDays);
            const isPastHardDeadline = diffDays < sixMonthsDays;

            return (
              <div 
                key={c.id} 
                className="bg-red-950 border-2 border-red-600 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden animate-pulse"
                id={`disdetta-critical-alert-${c.id}`}
              >
                {/* Background decorative pulsing alert element */}
                <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-red-600/10 rounded-full blur-3xl"></div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2 text-left">
                    <span className="inline-flex items-center space-x-1.5 bg-red-600/30 text-red-200 border border-red-500/30 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                      <AlertTriangle size={11} className="text-red-400 animate-bounce" />
                      <span>Blocco Rapporto: Adempimento Legale Obbligatorio</span>
                    </span>
                    <h3 className="text-lg font-sans font-black text-white leading-tight">
                      Disdetta Contratto Necessaria ({c.propertyName})
                    </h3>
                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                      La legge impone di dare formale disdetta del contratto 4+4 ad uso abitativo tramite raccomandata con ricevuta di ritorno almeno 6 mesi prima della scadenza. 
                      Per sicurezza procedurale, il CRM richiede e blocca la pratica a 7 mesi dalla scadenza (<span className="text-red-300 font-extrabold">{new Date(c.endDate).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}</span>) fino al caricamento della ricevuta.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
                      <div className="bg-red-900/40 px-3 py-1 rounded-lg border border-red-700/50">
                        Conduttore: <span className="font-extrabold text-red-100">{c.tenantName}</span>
                      </div>
                      
                      {isPastHardDeadline ? (
                        <div className="bg-red-600 text-white font-extrabold px-3 py-1 rounded-lg animate-bounce flex items-center space-x-1 uppercase tracking-wider text-[10px]">
                          <span>⚠️ TERMINE LEGALE DI 6 MESI SCADUTO DA {Math.abs(daysRemaining)} GIORNI!</span>
                        </div>
                      ) : (
                        <div className="bg-amber-500 text-slate-950 font-extrabold px-3 py-1 rounded-lg flex items-center space-x-1 uppercase tracking-wider text-[10px]">
                          <span>⏳ Mancano {daysRemaining} giorni al limite legale dei 6 mesi</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Active Simulated / Real Post receipt loader inside the dashboard alert widget */}
                  <div className="shrink-0 bg-red-900/30 border border-red-800/40 p-4 rounded-2xl flex flex-col items-center justify-center min-w-[240px] text-center">
                    <span className="text-2xl mb-1.5">📮</span>
                    <span className="text-[10px] font-black uppercase text-red-200 tracking-wider">Ricevuta Raccomandata</span>
                    <p className="text-[9px] text-slate-400 mt-0.5 max-w-[180px] leading-tight">Traccia la spedizione postale caricando la ricevuta di ritorno.</p>
                    
                    <label className="mt-3.5 inline-flex items-center space-x-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs px-4 py-2.5 rounded-xl -2 border-red-800 hover:-0 transition-all cursor-pointer shadow-md">
                      <span>📤 Carica Ricevuta Postale</span>
                      <input 
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={async (e) => {
                          if (onEditContract) {
                            await onEditContract(c.id, {
                              disdettaReceiptUploaded: true,
                              disdettaReceiptDate: new Date().toISOString().split("T")[0],
                              disdettaReceiptFile: e.target.files?.[0]?.name || "ricevuta_disdetta_raccomandata_ar.pdf"
                            });
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* I TUOI IMMOBILI CON BADGE DINAMICI E FORME DIFFERENTI */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-slate-50">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">🔑</span>
            <h3 className="font-sans font-extrabold text-slate-900 text-base">
              I Tuoi Immobili nel Portafoglio ({totalProperties})
            </h3>
          </div>
          <button
            onClick={() => setCurrentSection("properties")}
            className="text-xs font-black text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 rounded-xl -2 border-indigo-200 active:-0 transition-all"
          >
            <span>Vedi Tutti</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {totalProperties === 0 ? (
          <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 mt-4">
            <p className="text-xs text-slate-500">Nessun immobile censito nel sistema.</p>
            <p className="text-[10px] text-slate-400 mt-1">Usa il tasto in alto per "Inietta Dati Demo" o aggiungine uno manuale.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
            {properties.map((p) => {
              // 1. Detect if Rented (compound activity)
              const isRented = p.status === "Rented";
              
              // 2. Active contract search
              const activeContract = contracts.find(c => c.propertyId === p.id && c.status === "Active");
              
              // 3. Associated tenant search
              const associatedTenant = tenants.find(t => t.propertyId === p.id || (activeContract && t.id === activeContract.tenantId));
              
              // 4. Overdue/Pending fast closing items for this property/contract
              const propertyClosingItems = fastClosing.filter(fc => {
                if (fc.status === "Paid" || fc.status === "Cancelled") return false;
                const matchesId = fc.sourceId === p.id || (activeContract && fc.sourceId === activeContract.id);
                const matchesTitle = (fc.title || "").toLowerCase().includes((p.name || "").toLowerCase());
                return matchesId || matchesTitle;
              });

              const hasOverdueRent = propertyClosingItems.some(item => 
                (item.status === "Overdue" || new Date(item.dueDate) < new Date()) && 
                (item.source === "contract" || (item.title || "").toLowerCase().includes("affitto") || (item.title || "").toLowerCase().includes("canone"))
              );

              const hasPendingOverdue = propertyClosingItems.some(item => 
                item.status === "Overdue" || new Date(item.dueDate) < new Date()
              );

              // 5. Reminders
              const associatedReminders = reminders.filter(r => 
                associatedTenant && r.tenantId === associatedTenant.id
              );

              const isMessaInMora = associatedReminders.some(r => r.status === "MessaInMora");
              const hasSentReminder = associatedReminders.some(r => r.status === "Sent");

              // 6. Active legal cases
              const activeLegal = legalCases.find(lc => 
                lc.propertyId === p.id && lc.status === "Active"
              );

              // 7. Condominium lookup
              const condoConstituted = condominiums.find(c => 
                (p.address || "").toLowerCase().includes((c.name || "").toLowerCase()) || 
                (c.name || "").toLowerCase().includes((p.name || "").toLowerCase()) ||
                (c.notes && (c.notes || "").toLowerCase().includes((p.name || "").toLowerCase()))
              );

              // ----------------------------------------------------
              // A. SHAPE 1: HOUSE SHAPE (NOT RENTED / SINGLE PROPERTY)
              // ----------------------------------------------------
              if (!activeContract) {
                const getIcon = (type: string) => {
                  if (type === "Monolocale") return "🏢";
                  if (type === "Ufficio") return "🏬";
                  if (type === "Garage/Box") return "🚗";
                  return "🏠";
                };

                return (
                  <div
                    key={p.id}
                    className="relative overflow-hidden bg-rose-50/25 hover:bg-rose-50/40 border-2 border-rose-300 rounded-b-2xl rounded-t-[2.5rem] p-5 shadow-xs transition-all hover:border-rose-400 group flex flex-col justify-between h-[255px] animate-pulse duration-3000"
                    id={`property-house-${p.id}`}
                  >
                    {/* Visual roof cap */}
                    <div className="absolute top-0 inset-x-0 h-2 bg-rose-500/80"></div>
                    
                    <div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="bg-white p-2 rounded-full border border-slate-200 text-lg shadow-2xs">
                          {getIcon(p.type)}
                        </div>
                        <span 
                          onClick={() => setSelectedDashboardProperty(p)}
                          className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 animate-pulse cursor-pointer hover:bg-rose-200 transition-colors"
                          title="Vedi Pratica di 2° Livello"
                        >
                          🔴 DA LOCARE / DISPONIBILE
                        </span>
                      </div>
                      
                      <h4 className="font-extrabold text-xs text-slate-900 mt-3.5 group-hover:text-rose-600 transition-colors line-clamp-1">
                        {p.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-1 truncate">{p.address}</p>
                    </div>

                    <div className="border-t border-slate-200/60 pt-3 flex flex-col space-y-1.5 mt-auto">
                      {p.owner && (
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span>Proprietario:</span>
                          <span className="font-semibold text-slate-700">{p.owner}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>Regime:</span>
                        <span className={`font-semibold text-[9px] px-1.5 py-0.5 rounded ${p.isBareOwnership ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                          {p.isBareOwnership ? "Nuda Proprietà" : "Piena Proprietà"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>Condominio:</span>
                        <span className={`font-semibold text-[9px] px-1.5 py-0.5 rounded truncate max-w-[120px] ${p.isCondoConstituted ? "bg-indigo-100 text-indigo-800" : "bg-rose-100 text-rose-800"}`}>
                          {p.isCondoConstituted ? "Costituito" : "Non Costituito / Assente"}
                        </span>
                      </div>
                      
                      {/* Interactive Button */}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-1">
                        <span className="text-[8px] text-rose-600 font-extrabold uppercase animate-pulse">Owner Pays 100%</span>
                        <button
                          onClick={() => setSelectedDashboardProperty(p)}
                          className="bg-rose-600 hover:bg-rose-500 text-white font-black text-[9px] py-1 px-2.5 rounded-lg -2 border-rose-800 active:-0 transition-all cursor-pointer shadow-2xs"
                        >
                          Apri Pratica
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // ----------------------------------------------------
              // B. SHAPE 2: SQUARE ACTIVE COMPOSITE BADGE (RENTED / RELATIONSHIP)
              // ----------------------------------------------------
              
              // Determine Dynamic Classification using the central helper!
              let borderClass = "border-amber-300 bg-amber-50/30 text-amber-950";
              let statusLabel = "👍 Relazione Regolare";
              let isMora = false;
              let isCritical = false;

              if (associatedTenant) {
                const cls = getTenantClassification(associatedTenant, properties, contracts, fastClosing, legalCases, reminders);
                statusLabel = `${cls.emoji} ${cls.label}`;
                if (cls.status === "critical") {
                  borderClass = "border-red-600 bg-red-50/15 text-red-950 shadow-[0_0_15px_rgba(220,38,38,0.25)]";
                  isCritical = true;
                } else if (cls.status === "red") {
                  borderClass = "border-rose-500 bg-rose-50/15 text-rose-950 animate-pulse";
                  isMora = cls.reason === "messa_in_mora";
                } else if (cls.status === "orange") {
                  borderClass = "border-amber-400 bg-amber-50/15 text-amber-950";
                } else {
                  borderClass = "border-amber-300 bg-amber-50/30 text-amber-950";
                }
              } else if (!activeContract) {
                borderClass = "border-amber-400 bg-amber-50/15 text-amber-950";
                statusLabel = "⚠️ Contratto Mancante";
              }

              return (
                <div
                  key={p.id}
                  className={`p-5 rounded-2xl border-2 transition-all duration-300 flex flex-col justify-between hover:scale-[1.02] shadow-sm relative h-[260px] ${borderClass}`}
                  id={`property-relation-${p.id}`}
                >
                  {/* Flashing Dot for critical alerts */}
                  {(isMora || isCritical) && (
                    <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                    </span>
                  )}

                  <div>
                    {/* Top status bar */}
                    <div className="flex items-center justify-between">
                      <span 
                        onClick={() => setSelectedDashboardProperty(p)}
                        className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/80 border border-slate-200 cursor-pointer hover:border-indigo-400 hover:bg-white transition-all shadow-3xs"
                        title="Vedi Pratica di 2° Livello"
                      >
                        {statusLabel}
                      </span>
                      {activeLegal && (
                        <div className="bg-violet-100 text-violet-800 p-1.5 rounded-lg border border-violet-200 shadow-2xs animate-pulse">
                          <Scale size={13} />
                        </div>
                      )}
                    </div>

                    {/* Title and location */}
                    <h4 className="font-black text-xs text-slate-900 mt-3 line-clamp-1">
                      {p.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-1 truncate">{p.address}</p>

                    {/* Associated Relationship Info */}
                    <div className="mt-3.5 space-y-1 bg-white/60 p-2.5 rounded-xl border border-slate-200/40 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Inquilino:</span>
                        <span className="font-extrabold text-slate-800">
                          {associatedTenant ? associatedTenant.name : "Associazione mancante"}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Contratto:</span>
                        {activeContract ? (
                          <span className="font-semibold text-indigo-700">
                            Attivo (€{activeContract.rentAmount}/m)
                          </span>
                        ) : (
                          <span className="font-black text-rose-600 uppercase tracking-tight flex items-center space-x-1 animate-pulse">
                            <span>❌ Mancante</span>
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-center pt-1 border-t border-slate-200/40">
                        <span className="text-slate-400 font-medium">Regime:</span>
                        <span className={`font-semibold text-[9px] px-1.5 py-0.5 rounded ${p.isBareOwnership ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                          {p.isBareOwnership ? "Nuda Proprietà" : "Piena Proprietà"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Condominio:</span>
                        <span className={`font-semibold text-[9px] px-1.5 py-0.5 rounded ${p.isCondoConstituted ? "bg-indigo-100 text-indigo-800" : "bg-rose-100 text-rose-800"}`}>
                          {p.isCondoConstituted ? "Costituito" : "Non Costituito / Assente"}
                        </span>
                      </div>

                      {condoConstituted && (
                        <div className="flex justify-between items-center text-[9px] text-slate-500 pt-1 border-t border-slate-200/50">
                          <span className="truncate max-w-[120px]">🏢 {condoConstituted.name}</span>
                          <span className="font-mono text-slate-400 shrink-0 text-[8px]">Amm: {condoConstituted.administrator?.split(" ").slice(-1)[0]}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions / Details Footer */}
                  <div className="mt-4 pt-2.5 border-t border-slate-200/40 flex justify-between items-center">
                    {!activeContract ? (
                      <button
                        onClick={() => setCurrentSection("contracts")}
                        className="w-full inline-flex items-center justify-center space-x-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] py-2 px-3 rounded-lg -2 border-rose-800 active:-0 transition-all"
                      >
                        <Plus size={12} />
                        <span>Carica Contratto d'Affitto</span>
                      </button>
                    ) : (
                      <div className="flex justify-between items-center w-full gap-2">
                        <span className="text-[9px] font-mono text-slate-400 shrink-0">
                          Scad. {new Date(activeContract.endDate).toLocaleDateString("it-IT", { year: "2-digit", month: "2-digit" })}
                        </span>
                        
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setSelectedDashboardProperty(p)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[9px] py-1 px-2.5 rounded-lg border border-indigo-200 transition-all cursor-pointer"
                          >
                            Dettagli
                          </button>
                          
                          <button
                            onClick={() => setSelectedDashboardProperty(p)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[9px] py-1 px-2.5 rounded-lg -2 border-indigo-800 active:-0 transition-all cursor-pointer"
                          >
                            Vedi Pratica
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid of 4 beautiful 3D-styled metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Metric 1 */}
        <div className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono tracking-wider text-slate-400 uppercase font-bold">🏢 Immobili</span>
              <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg">
                <Building2 size={16} />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-sans font-black text-slate-900">{totalProperties}</h3>
              <p className="text-[10px] text-slate-500 mt-1">
                <span className="font-bold text-indigo-600">{rentedProperties} locati</span> • {occupancyRate}% occupazione
              </p>
            </div>
          </div>
          <button 
            onClick={() => setCurrentSection("properties")}
            className="w-full mt-5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-black py-2 rounded-xl -2 border-slate-300 active:-0 transition-all flex items-center justify-center space-x-1"
          >
            <span>Gestisci</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono tracking-wider text-slate-400 uppercase font-bold">📄 Contratti Attivi</span>
              <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-sans font-black text-emerald-700">
                {activeContracts}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">
                Contratti di locazione regolarmente registrati
              </p>
            </div>
          </div>
          <button 
            onClick={() => setCurrentSection("contracts")}
            className="w-full mt-5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-black py-2 rounded-xl -2 border-slate-300 active:-0 transition-all flex items-center justify-center space-x-1"
          >
            <span>Gestisci Contratti</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono tracking-wider text-slate-400 uppercase font-bold">⚖️ Pratiche Legali</span>
              <div className="bg-amber-50 text-amber-600 p-2 rounded-lg">
                <CalendarClock size={16} />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-sans font-black text-amber-700">
                {legalCases.filter(lc => lc.status === "Active").length}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">
                Contenziosi e pratiche legali attive
              </p>
            </div>
          </div>
          <button 
            onClick={() => setCurrentSection("legal")}
            className="w-full mt-5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-black py-2 rounded-xl -2 border-slate-300 active:-0 transition-all flex items-center justify-center space-x-1"
          >
            <span>Dettaglio Legale</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono tracking-wider text-slate-400 uppercase font-bold">🚨 Solleciti Attivi</span>
              <div className="bg-rose-50 text-rose-600 p-2 rounded-lg">
                <AlertTriangle size={16} />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-sans font-black text-rose-600">{activeReminders}</h3>
              <p className="text-[10px] text-slate-500 mt-1">
                Richiedono intervento o invio email
              </p>
            </div>
          </div>
          <button 
            onClick={() => setCurrentSection("reminders")}
            className="w-full mt-5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-black py-2 rounded-xl -2 border-slate-300 active:-0 transition-all flex items-center justify-center space-x-1"
          >
            <span>Sollecita</span>
            <ArrowRight size={12} />
          </button>
        </div>

      </div>

      {/* Bottom Area with AI Shortcuts and Tip Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Quick actions box */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800">
          <h3 className="font-sans font-black text-white text-base">🪄 Operazioni Rapide AI</h3>
          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">Carica un documento per compilare o riconciliare istantaneamente.</p>
          
          <div className="mt-5 space-y-3">
            <button 
              onClick={() => setCurrentSection("ai_area")}
              className="w-full flex items-center justify-between p-3.5 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs rounded-xl active:transition-all text-left"
            >
              <div className="flex items-center space-x-3">
                <span className="text-sm">📄</span>
                <span>Estrai da Contratto PDF</span>
              </div>
              <ArrowRight size={12} className="text-slate-400" />
            </button>

            <button 
              onClick={() => setCurrentSection("ai_area")}
              className="w-full flex items-center justify-between p-3.5 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs rounded-xl active:transition-all text-left"
            >
              <div className="flex items-center space-x-3">
                <span className="text-sm">🏢</span>
                <span>Estrai Riparti Condominio</span>
              </div>
              <ArrowRight size={12} className="text-slate-400" />
            </button>

            <button 
              onClick={() => setCurrentSection("ai_area")}
              className="w-full flex items-center justify-between p-3.5 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs rounded-xl active:transition-all text-left"
            >
              <div className="flex items-center space-x-3">
                <span className="text-sm">💰</span>
                <span>Riconcilia Estratto Conto</span>
              </div>
              <ArrowRight size={12} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Tips card */}
        <div className="bg-indigo-950 text-slate-100 rounded-2xl p-6 border border-indigo-900 shadow-lg relative overflow-hidden flex flex-col justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
          <div className="flex items-start space-x-4 relative">
            <Sparkles size={24} className="text-amber-400 mt-0.5 shrink-0 animate-pulse" />
            <div>
              <h4 className="text-sm font-black text-white font-sans uppercase tracking-wider">Suggerimento AI 💡</h4>
              <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                Puoi trascinare o incollare contratti, preventivi o movimenti bancari nell'<strong>Area AI</strong>.
                La nostra intelligenza artificiale integrata estrarrà automaticamente i dati compilando gli immobili, i contratti, le anagrafiche e persino le scadenze del condominio in un click.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Toast notification */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white px-5 py-4 rounded-xl shadow-2xl border border-emerald-500 animate-bounce flex items-center space-x-3 text-xs max-w-sm">
          <CheckCircle2 size={18} className="shrink-0" />
          <div>
            <p className="font-extrabold">Operazione Riuscita</p>
            <p className="text-[10px] mt-0.5 text-emerald-100">{successToast}</p>
          </div>
        </div>
      )}

      {/* Interactive Modal: Associa Studio Legale & Sposta Fascicolo */}
      {transferringReminder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in animate-duration-300" id="legal-transfer-modal">
          <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xl">⚖️</span>
                <div>
                  <h3 className="font-sans font-black text-sm tracking-tight">Costituzione Fascicolo Legale</h3>
                  <p className="text-[9px] text-slate-400">Area Urgente → Area Legale</p>
                </div>
              </div>
              <button 
                onClick={() => setTransferringReminder(null)} 
                className="text-slate-400 hover:text-white text-xs cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl text-[10px] text-amber-900 leading-relaxed">
                <strong>Cartella di Pratica:</strong> Verrà creata una cartella denominata <strong>"{transferringReminder.tenantName}"</strong> in Area Legale contenente i seguenti allegati pre-compilati per lo studio:
                <ul className="list-disc pl-4 mt-1.5 space-y-1 text-slate-700 font-medium">
                  <li>Contratto di locazione registrato (.pdf)</li>
                  <li>Ricevuta di ritorno firmata della Messa in Mora (.pdf)</li>
                  <li>Registro storico dei solleciti 1 e 2 (.pdf)</li>
                  <li>Mastrino contabile delle morosità accumulate (€{transferringReminder.amount.toLocaleString("it-IT")})</li>
                </ul>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">
                  Seleziona Studio Legale Indicizzato:
                </label>
                <select
                  value={selectedLawyerId}
                  onChange={(e) => setSelectedLawyerId(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 text-xs rounded-xl p-2.5 font-bold text-slate-900 focus:outline-hidden focus:border-indigo-500"
                >
                  {lawyers.length === 0 ? (
                    <option value="">Nessuno Studio Legale caricato</option>
                  ) : (
                    lawyers.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.studioName} ({l.name}) — Sp. {l.specialization}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-[9px] text-slate-500 mt-1.5 leading-snug">
                  Lo studio legale selezionato riceverà la delega digitale della pratica di morosità grave con tutti gli allegati.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setTransferringReminder(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  Annulla
                </button>
                
                <button
                  onClick={handleConfirmLegalTransfer}
                  disabled={actionInProgress}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] px-4 py-2.5 rounded-xl -2 border-rose-800 active:-0 transition-all cursor-pointer shadow-xs"
                >
                  {actionInProgress ? "Generazione Cartella..." : "Associa Studio & Sposta Pratica"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

