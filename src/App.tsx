import React, { useState, useEffect } from "react";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User,
  GoogleAuthProvider
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  serverTimestamp,
  getDocs,
  setDoc
} from "firebase/firestore";
import { auth, googleProvider, db } from "./firebase";
import { 
  AppSection, 
  Property, 
  Tenant, 
  Contract, 
  Condominium, 
  BankMovement, 
  Reminder, 
  FastClosingItem, 
  Maintenance, 
  LegalCase,
  Communication,
  Lawyer,
  CreditInstitution,
  BankAccount,
  OwnerProfile,
  InsurancePolicy,
  DeliveryReport
} from "./types";

// Component imports
import Sidebar from "./components/Sidebar";
import Logo from "./components/Logo";
import DashboardView from "./components/DashboardView";
import PropertiesView from "./components/PropertiesView";
import TenantsView from "./components/TenantsView";
import ContractsView from "./components/ContractsView";
import CondominiumsView from "./components/CondominiumsView";
import BanksView from "./components/BanksView";
import FastClosingView from "./components/FastClosingView";
import RemindersView from "./components/RemindersView";
import MaintenanceView from "./components/MaintenanceView";
import LegalView from "./components/LegalView";
import AIAreaView from "./components/AIAreaView";
import OwnersView from "./components/OwnersView";
import OwnerOnboarding from "./components/OwnerOnboarding";
import SettingsView from "./components/SettingsView";

// Lucide Icons for Landing Page and Alerts
import { Sparkles, CheckCircle2, ShieldCheck, Database, FileText, Menu, Building2, AlertCircle } from "lucide-react";

// Firebase error instrumentation declarations
enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  return errInfo;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentSection, setCurrentSection] = useState<AppSection>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Premium transient notifications
  const [dbError, setDbError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg((current) => current === msg ? null : current);
    }, 4000);
  };

  const showError = (msg: string) => {
    setDbError(msg);
    setTimeout(() => {
      setDbError((current) => current === msg ? null : current);
    }, 6000);
  };

  // Real-time Firestore States
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [movements, setMovements] = useState<BankMovement[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [fastClosing, setFastClosing] = useState<FastClosingItem[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [legalCases, setLegalCases] = useState<LegalCase[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [creditInstitutions, setCreditInstitutions] = useState<CreditInstitution[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [insurancePolicies, setInsurancePolicies] = useState<InsurancePolicy[]>([]);
  const [deliveryReports, setDeliveryReports] = useState<DeliveryReport[]>([]);
  const [selectedTenantIdForLedger, setSelectedTenantIdForLedger] = useState<string | null>(null);

  // Owner profile for onboarding flow
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(null);
  const [ownerProfileLoading, setOwnerProfileLoading] = useState(true);

  // 1. Firebase Authentication State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 1.5 Owner Profile State Listener (Onboarding validation)
  useEffect(() => {
    if (!user) {
      setOwnerProfile(null);
      setOwnerProfileLoading(false);
      return;
    }

    setOwnerProfileLoading(true);
    const docRef = doc(db, "ownerProfiles", user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setOwnerProfile({ id: docSnap.id, ...docSnap.data() } as OwnerProfile);
      } else {
        setOwnerProfile(null);
      }
      setOwnerProfileLoading(false);
    }, (error) => {
      console.error("Error loading owner profile:", error);
      setOwnerProfileLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 2. Real-time Database Listeners (Filtered by Auth User)
  useEffect(() => {
    if (!user) return;

    const queryConstraints = [where("userId", "==", user.uid)];

    // Listeners definition helper
    const listenToCollection = (colName: string, stateSetter: any, sortField?: string) => {
      const colRef = collection(db, colName);
      // Query is formulated purely with filter (where) to avoid requiring composite indexes in Firestore
      const q = query(colRef, ...queryConstraints);

      return onSnapshot(q, (snapshot) => {
        const items: any[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Client-side sorting for optimal performance and no index limits
        if (sortField) {
          items.sort((a, b) => {
            const valA = a[sortField];
            const valB = b[sortField];

            const getComparableValue = (val: any) => {
              if (val && typeof val === "object" && "seconds" in val) {
                // Firestore Timestamp
                return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
              }
              if (val instanceof Date) {
                return val.getTime();
              }
              if (typeof val === "string") {
                const parsed = Date.parse(val);
                return isNaN(parsed) ? val : parsed;
              }
              return val;
            };

            const compA = getComparableValue(valA);
            const compB = getComparableValue(valB);

            if (compA === undefined || compA === null) return 1;
            if (compB === undefined || compB === null) return -1;

            if (compA < compB) return 1; // "desc" order by default
            if (compA > compB) return -1;
            return 0;
          });
        }

        stateSetter(items);
      }, (error) => {
        console.error(`Error loading collection: ${colName}`, error);
        const errInfo = handleFirestoreError(error, OperationType.LIST, colName);
        showError(`Errore nel caricamento dei dati di "${colName}": ${errInfo.error}`);
      });
    };

    // Initialize all reactive subscriptions
    const unsubProperties = listenToCollection("properties", setProperties, "createdAt");
    const unsubTenants = listenToCollection("tenants", setTenants, "createdAt");
    const unsubContracts = listenToCollection("contracts", setContracts, "createdAt");
    const unsubCondominiums = listenToCollection("condominiums", setCondominiums, "createdAt");
    const unsubMovements = listenToCollection("movements", setMovements, "createdAt");
    const unsubReminders = listenToCollection("reminders", setReminders, "createdAt");
    const unsubFastClosing = listenToCollection("fastClosing", setFastClosing, "dueDate");
    const unsubMaintenance = listenToCollection("maintenance", setMaintenance, "createdAt");
    const unsubLegal = listenToCollection("legalCases", setLegalCases, "createdAt");
    const unsubCommunications = listenToCollection("communications", setCommunications, "sentAt");
    const unsubLawyers = listenToCollection("lawyers", setLawyers, "createdAt");
    const unsubInstitutions = listenToCollection("creditInstitutions", setCreditInstitutions, "createdAt");
    const unsubAccounts = listenToCollection("bankAccounts", setBankAccounts, "createdAt");
    const unsubInsurancePolicies = listenToCollection("insurancePolicies", setInsurancePolicies, "createdAt");
    const unsubDeliveryReports = listenToCollection("deliveryReports", setDeliveryReports, "createdAt");

    // Cleanups
    return () => {
      unsubProperties();
      unsubTenants();
      unsubContracts();
      unsubCondominiums();
      unsubMovements();
      unsubReminders();
      unsubFastClosing();
      unsubMaintenance();
      unsubLegal();
      unsubCommunications();
      unsubLawyers();
      unsubInstitutions();
      unsubAccounts();
      unsubInsurancePolicies();
      unsubDeliveryReports();
    };
  }, [user]);

  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  // Auth Procedures
  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        showSuccess("Accesso con Google completato e token Calendar sincronizzato!");
      }
    } catch (error) {
      console.error("Login failed:", error);
      alert("Autenticazione Fallita. Riprova più tardi.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentSection("dashboard");
    } catch (error) {
      console.error("Sign-out failed:", error);
    }
  };

  // Self-Healing Auto-Deduplication of Properties
  const hasDeduplicatedRef = React.useRef(false);
  useEffect(() => {
    if (!user || properties.length === 0 || hasDeduplicatedRef.current) return;

    const runDeduplication = async () => {
      hasDeduplicatedRef.current = true;
      
      // Group properties by owner and lowercased prefix of name/address to find duplicates
      const duplicatesGrouped = new Map<string, Property[]>();
      
      properties.forEach(p => {
        if (!p.owner) return;
        const ownerNorm = (p.owner || "").trim().toLowerCase();
        // Extract a simplified key (e.g. "giulia bianchi_trilocale navigli")
        const nameClean = (p.name || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().substring(0, 15);
        const key = `${ownerNorm}_${nameClean}`;
        
        if (!duplicatesGrouped.has(key)) {
          duplicatesGrouped.set(key, []);
        }
        duplicatesGrouped.get(key)!.push(p);
      });

      for (const [key, group] of duplicatesGrouped.entries()) {
        if (group.length > 1) {
          console.log(`Auto-Deduplication: found duplicates for group key "${key}":`, group);
          
          // Select which one to keep
          // 1. One with active contract
          // 2. One with isCondoConstituted === true
          // 3. First one
          let bestProp = group[0];
          let bestScore = -1;
          
          for (const p of group) {
            let score = 0;
            const hasContract = contracts.some(c => c.propertyId === p.id && c.status === "Active");
            if (hasContract) score += 10;
            if (p.isCondoConstituted) score += 5;
            if (score > bestScore) {
              bestScore = score;
              bestProp = p;
            }
          }

          const keepId = bestProp.id;
          const toDelete = group.filter(p => p.id !== keepId);

          for (const delProp of toDelete) {
            console.log(`Auto-Deduplication: deleting duplicate property ${delProp.id} ("${delProp.name}") and preserving ${keepId}`);
            
            try {
              // Delete the duplicate document
              await deleteDoc(doc(db, "properties", delProp.id));

              // Re-link contracts
              const relatedContracts = contracts.filter(c => c.propertyId === delProp.id);
              for (const c of relatedContracts) {
                await updateDoc(doc(db, "contracts", c.id), { propertyId: keepId });
              }

              // Re-link maintenance
              const relatedMaint = maintenance.filter(m => m.propertyId === delProp.id);
              for (const m of relatedMaint) {
                await updateDoc(doc(db, "maintenance", m.id), { propertyId: keepId });
              }

              // Re-link legal cases
              const relatedLegal = legalCases.filter(l => l.propertyId === delProp.id);
              for (const l of relatedLegal) {
                await updateDoc(doc(db, "legalCases", l.id), { propertyId: keepId });
              }

              // Re-link reminders
              const relatedReminders = reminders.filter(r => r.propertyId === delProp.id);
              for (const r of relatedReminders) {
                await updateDoc(doc(db, "reminders", r.id), { propertyId: keepId });
              }

              showSuccess(`Auto-Risoluzione: rimosso immobile duplicato "${delProp.name}" di ${delProp.owner}.`);
            } catch (err) {
              console.error(`Auto-Deduplication: error resolving property ${delProp.id}`, err);
            }
          }
        }
      }
    };

    // Delay slightly to ensure related states are fully loaded and synced
    const timer = setTimeout(() => {
      runDeduplication();
    }, 1000);

    return () => clearTimeout(timer);
  }, [user, properties, contracts, maintenance, legalCases, reminders]);

  // ==========================================
  // DATABASE MUTATION CALLBACKS (CRUD)
  // ==========================================

  const handleSeedSimulationData = async () => {
    if (!user) return;
    try {
      showSuccess("Inizializzazione simulazione co-proprietà... 🚀");

      // 1. Create Property co-owned by Bobo Vieri and Massimo Laucci
      const propDoc = await addDoc(collection(db, "properties"), {
        userId: user.uid,
        name: "🏢 Attico Bifamiliare Centro (Simulazione)",
        address: "Via del Corso 123, 00186 Roma (RM)",
        type: "Appartamento",
        status: "Rented",
        owner: "Bobo Vieri, Massimo Laucci",
        notes: "Splendido attico in co-proprietà al 50% tra Bobo Vieri e Massimo Laucci, con locazione attiva.",
        createdAt: serverTimestamp()
      });

      // 2. Create Tenant (Giorgia Meloni)
      const tenantDoc = await addDoc(collection(db, "tenants"), {
        userId: user.uid,
        name: "Giorgia Meloni",
        email: "giorgia.meloni.sim@example.com",
        phone: "+39 06 67791",
        fiscalCode: "MLNGRG77A41H501Z",
        propertyId: propDoc.id,
        notes: "Conduttrice simulata per test di locazione ed estratti conto.",
        createdAt: serverTimestamp()
      });

      // 3. Create Contract
      const contractDoc = await addDoc(collection(db, "contracts"), {
        userId: user.uid,
        propertyId: propDoc.id,
        propertyName: "🏢 Attico Bifamiliare Centro (Simulazione)",
        tenantId: tenantDoc.id,
        tenantName: "Giorgia Meloni",
        startDate: "2026-07-01",
        endDate: "2030-06-30",
        rentAmount: 800,
        paymentFrequency: "Mensile",
        status: "Active",
        ownerName: "Bobo Vieri, Massimo Laucci",
        createdAt: serverTimestamp()
      });

      // 4. Generate 6 rent installments in fastClosing
      const rentAmount = 800;
      let currentDueDate = new Date("2026-07-01");
      const end = new Date("2030-06-30");
      let monthIndex = 1;

      while (currentDueDate <= end && monthIndex <= 6) {
        const dueDateStr = currentDueDate.toISOString().split("T")[0];
        await addDoc(collection(db, "fastClosing"), {
          userId: user.uid,
          title: `Canone Affitto Mese ${monthIndex} - Giorgia Meloni`,
          description: `Riferimento Contratto Locazione su 🏢 Attico Bifamiliare Centro (Simulazione)`,
          amount: rentAmount,
          dueDate: dueDateStr,
          source: "contract",
          sourceId: contractDoc.id,
          status: "Pending",
          createdAt: serverTimestamp()
        });

        // Add 1 month
        currentDueDate.setMonth(currentDueDate.getMonth() + 1);
        monthIndex++;
      }

      // 5. Create Maintenance Ticket for simulation property
      const maintDoc = await addDoc(collection(db, "maintenance"), {
        userId: user.uid,
        propertyId: propDoc.id,
        propertyName: "🏢 Attico Bifamiliare Centro (Simulazione)",
        title: "🛠️ Manutenzione Straordinaria Caldaia",
        description: "Risoluzione guasto termico e sostituzione filtri. Ripartizione costi 50/50 tra Proprietari e Conduttore.",
        status: "Completed",
        cost: 300,
        contractor: "Termoidraulica Roma S.r.l.",
        date: "2026-07-05",
        splits: [
          { debtorName: "Bobo Vieri, Massimo Laucci", type: "owner", amount: 150 },
          { debtorName: "Giorgia Meloni", type: "tenant", amount: 150 }
        ],
        createdAt: serverTimestamp()
      });

      // 6. Create two fastClosing ledger lines for maintenance split
      await addDoc(collection(db, "fastClosing"), {
        userId: user.uid,
        propertyId: propDoc.id,
        title: `Quota Proprietari (Bobo Vieri, Massimo Laucci) - Manutenzione: 🛠️ Manutenzione Straordinaria Caldaia`,
        description: `Quota a carico dei proprietari (50%). Intervento ditta Termoidraulica Roma S.r.l.`,
        amount: 150,
        dueDate: "2026-07-05",
        source: "maintenance",
        sourceId: maintDoc.id,
        status: "Pending",
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "fastClosing"), {
        userId: user.uid,
        propertyId: propDoc.id,
        title: `Quota Inquilina (Giorgia Meloni) - Manutenzione: 🛠️ Manutenzione Straordinaria Caldaia`,
        description: `Quota a carico del conduttore (50%). Intervento ditta Termoidraulica Roma S.r.l.`,
        amount: 150,
        dueDate: "2026-07-05",
        source: "maintenance",
        sourceId: maintDoc.id,
        status: "Pending",
        createdAt: serverTimestamp()
      });

      showSuccess("Simulazione creata con successo! Creato immobile, inquilina (Giorgia Meloni), contratto (800€/mese), 6 scadenze di canone e manutenzione caldaia con ripartizione quote (150€ Proprietari, 150€ Inquilino).");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.CREATE, "properties");
      showError("Impossibile caricare la simulazione: " + errInfo.error);
    }
  };

  const handleSeedDemoData = async () => {
    if (!user) return;
    try {
      showSuccess("Iniezione dati demo in corso... 🚀");
      
      // 0. Purge existing user-specific data to avoid duplicate records!
      const deleteCollectionDocs = async (collectionName: string) => {
        try {
          const colRef = collection(db, collectionName);
          const q = query(colRef, where("userId", "==", user.uid));
          const querySnapshot = await getDocs(q);
          for (const docSnap of querySnapshot.docs) {
            await deleteDoc(doc(db, collectionName, docSnap.id));
          }
        } catch (e) {
          console.error(`Error purging collection ${collectionName}:`, e);
        }
      };

      await deleteCollectionDocs("properties");
      await deleteCollectionDocs("tenants");
      await deleteCollectionDocs("contracts");
      await deleteCollectionDocs("condominiums");
      await deleteCollectionDocs("fastClosing");
      await deleteCollectionDocs("movements");
      await deleteCollectionDocs("reminders");
      await deleteCollectionDocs("maintenance");
      await deleteCollectionDocs("legalCases");
      await deleteCollectionDocs("communications");
      await deleteCollectionDocs("lawyers");

      // 1. Properties
      const p1 = await addDoc(collection(db, "properties"), {
        userId: user.uid,
        name: "🏢 Monolocale Vista Duomo",
        address: "Piazza del Duomo 20, 20121 Milano (MI)",
        type: "Monolocale",
        status: "Rented",
        owner: "Mario Rossi",
        notes: "Splendido monolocale completamente arredato e climatizzato, vista Duomo. Dotato di lavatrice, asciugatrice e caldaia a condensazione autonoma.",
        createdAt: serverTimestamp()
      });

      const p2 = await addDoc(collection(db, "properties"), {
        userId: user.uid,
        name: "🏠 Trilocale Navigli con Terrazzo",
        address: "Alzaia Naviglio Grande 48, 20144 Milano (MI)",
        type: "Appartamento",
        status: "Rented",
        owner: "Giulia Bianchi",
        notes: "Ampio trilocale con cucina abitabile, riscaldamento centralizzato a valvole termostatiche e condizionatore autonomo.",
        createdAt: serverTimestamp()
      });

      const p3 = await addDoc(collection(db, "properties"), {
        userId: user.uid,
        name: "🏬 Ufficio Hub Porta Romana",
        address: "Corso di Porta Romana 88, 20122 Milano (MI)",
        type: "Ufficio",
        status: "Available",
        owner: "Immobiliare Milano SRL",
        notes: "Prestigioso ufficio cablato in fibra ottica 10G, reception comune, climatizzazione caldo/freddo centralizzata.",
        createdAt: serverTimestamp()
      });

      const p4 = await addDoc(collection(db, "properties"), {
        userId: user.uid,
        name: "🚗 Box Auto Duomo Parking",
        address: "Via Torino 18, 20123 Milano (MI)",
        type: "Garage/Box",
        status: "Maintenance",
        owner: "Mario Rossi",
        notes: "Serranda elettrica telecomandata difettosa. Manutenzione in corso con sostituzione scheda logica.",
        createdAt: serverTimestamp()
      });

      // 2. Tenants
      const t1 = await addDoc(collection(db, "tenants"), {
        userId: user.uid,
        name: "👨‍🎓 Mario Rossi",
        email: "mario.rossi.demo@example.com",
        phone: "+39 347 1234567",
        fiscalCode: "RSSMRA95A01F205X",
        notes: "Inquilino modello, studente universitario fuori sede. Pagamenti regolari con bonifico bancario.",
        createdAt: serverTimestamp()
      });

      const t2 = await addDoc(collection(db, "tenants"), {
        userId: user.uid,
        name: "👩‍⚕️ Giulia Bianchi",
        email: "giulia.bianchi.demo@example.com",
        phone: "+39 335 9876543",
        fiscalCode: "BNCGLI88H41H501Z",
        notes: "Medico specializzando. Richiesta manutenzione rubinetto bagno principale.",
        createdAt: serverTimestamp()
      });

      // 3. Contracts
      const c1 = await addDoc(collection(db, "contracts"), {
        userId: user.uid,
        propertyId: p1.id,
        propertyName: "🏢 Monolocale Vista Duomo",
        tenantId: t1.id,
        tenantName: "👨‍🎓 Mario Rossi",
        rentAmount: 1200,
        depositAmount: 3600,
        startDate: "2025-01-01",
        endDate: "2028-12-31",
        paymentFrequency: "Mensile",
        status: "Active",
        createdAt: serverTimestamp()
      });

      const c2 = await addDoc(collection(db, "contracts"), {
        userId: user.uid,
        propertyId: p2.id,
        propertyName: "🏠 Trilocale Navigli con Terrazzo",
        tenantId: t2.id,
        tenantName: "👩‍⚕️ Giulia Bianchi",
        rentAmount: 1850,
        depositAmount: 5550,
        startDate: "2024-06-01",
        endDate: "2027-01-15", // Exactly in the 7-month disdetta window relative to July 5th, 2026!
        paymentFrequency: "Mensile",
        status: "Active",
        createdAt: serverTimestamp()
      });

      // 4. Condominiums
      const condo1 = await addDoc(collection(db, "condominiums"), {
        userId: user.uid,
        name: "🏢 Condominio Navigli Grande",
        address: "Alzaia Naviglio Grande 48, Milano",
        administrator: "Studio Geom. Antonio Verdi",
        email: "antonio.verdi.amministratore@example.com",
        phone: "02 88776655",
        annualBudget: 4500,
        notes: "Include riscaldamento centralizzato e pulizia scale. Lavori straordinari facciata previsti nel 2027.",
        rates: [
          { title: "Rata I Spese Generali 2026", amount: 120, dueDate: "2026-01-15", notes: "Ordinaria esercizio" },
          { title: "Rata II Spese Generali 2026", amount: 120, dueDate: "2026-04-15", notes: "Ordinaria esercizio" },
          { title: "Rata III Spese Generali 2026", amount: 120, dueDate: "2026-07-15", notes: "Riscaldamento centralizzato" },
          { title: "Rata IV Spese Generali 2026", amount: 450, dueDate: "2026-10-15", notes: "Straordinaria tetto" }
        ],
        createdAt: serverTimestamp()
      });

      // 5. Fast Closing (Payments / Expiring activities)
      await addDoc(collection(db, "fastClosing"), {
        userId: user.uid,
        title: "⚡ Bolletta Luce Scale Condominio",
        description: "Addebito automatico per consumi elettricità parti communes",
        amount: 85.50,
        dueDate: "2026-07-10",
        source: "condominium",
        sourceId: condo1.id,
        status: "Pending",
        createdAt: serverTimestamp()
      });

      const fc2 = await addDoc(collection(db, "fastClosing"), {
        userId: user.uid,
        title: "🏠 Canone Affitto Luglio - Vista Duomo",
        description: "Canone locazione mensile concordato da contratto",
        amount: 1200.00,
        dueDate: "2026-07-05",
        source: "contract",
        sourceId: c1.id,
        status: "Pending",
        createdAt: serverTimestamp()
      });

      const fc3 = await addDoc(collection(db, "fastClosing"), {
        userId: user.uid,
        title: "💸 F24 Imposta di Registro Rinnovo annuale",
        description: "Rinnovo annuale imposta registro Duomo",
        amount: 67.00,
        dueDate: "2026-06-30",
        source: "other",
        sourceId: "f24_duomo",
        status: "Pending", // This will be overdue on July 4th, 2026
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "fastClosing"), {
        userId: user.uid,
        title: "🛠️ Fattura Manutenzione Caldaia",
        description: "Intervento tecnico per sostituzione sonda termica",
        amount: 250.00,
        dueDate: "2026-06-15",
        source: "other",
        sourceId: "fact_idraulico",
        status: "Paid",
        createdAt: serverTimestamp()
      });

      // 6. Bank Movements
      await addDoc(collection(db, "movements"), {
        userId: user.uid,
        date: "2026-07-02",
        amount: 1200.00,
        description: "BONIFICO DA ROSSI MARIO CAUSALE CANONE LUGLIO DUOMO",
        sender: "Rossi Mario",
        reconciled: false,
        reconciledWith: null,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "movements"), {
        userId: user.uid,
        date: "2026-06-28",
        amount: -250.00,
        description: "PAGAMENTO SEDA FATTURA 122 IDRAULICA MILANESE",
        sender: "Banca Intesa S.p.A.",
        reconciled: true,
        reconciledWith: {
          id: "temp_idraulico",
          title: "🛠️ Fattura Manutenzione Caldaia",
          amount: 250.00
        },
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "movements"), {
        userId: user.uid,
        date: "2026-07-03",
        amount: 1850.00,
        description: "PAGAMENTO CANONE BIANCHI GIULIA LUGLIO 2026",
        sender: "Bianchi Giulia",
        reconciled: false,
        reconciledWith: null,
        createdAt: serverTimestamp()
      });

      // 7. Reminders
      const rem1 = await addDoc(collection(db, "reminders"), {
        userId: user.uid,
        tenantId: t1.id,
        tenantName: "👨‍🎓 Mario Rossi",
        propertyId: p1.id,
        propertyName: "🏢 Monolocale Vista Duomo",
        amount: 1200,
        dueDate: "2026-06-05",
        status: "Sent",
        reason: "Mancato accredito canone mese di Giugno 2026",
        followUpNotes: "Inviato sollecito formale via email certificata e raccomandata A/R in data 12/06/2026.",
        isSequence: true,
        step: 1,
        firstRequestDate: "2026-06-15",
        createdAt: serverTimestamp()
      });

      // Linked Fast Closing Overdue
      await addDoc(collection(db, "fastClosing"), {
        userId: user.uid,
        title: "⚠️ Sollecito Canone Giugno: Rossi",
        description: "Mancato accredito canone mese di Giugno 2026 (Insoluto)",
        amount: 1200,
        dueDate: "2026-06-05",
        source: "reminder",
        sourceId: rem1.id,
        status: "Overdue",
        createdAt: serverTimestamp()
      });

      // 8. Maintenance
      await addDoc(collection(db, "maintenance"), {
        userId: user.uid,
        propertyId: p2.id,
        propertyName: "🏠 Trilocale Navigli con Terrazzo",
        title: "💧 Perdita d'Acqua Sotto il Lavandino Bagno",
        description: "L'inquilina Giulia segnala perdita d'acqua cospicua dal flessibile del lavandino principale.",
        priority: "High",
        status: "In Progress",
        cost: 110,
        assignedTo: "Pronto Intervento Idraulica S.r.l.",
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "maintenance"), {
        userId: user.uid,
        propertyId: p1.id,
        propertyName: "🏢 Monolocale Vista Duomo",
        title: "🔑 Sostituzione Cilindro Porta Blindata",
        description: "Molla cilindro difettosa, chiave bloccata all'interno.",
        priority: "Urgent",
        status: "Completed",
        cost: 280,
        assignedTo: "Fabbro Serrature Milano 24h",
        createdAt: serverTimestamp()
      });

      // 9. Legal Cases
      await addDoc(collection(db, "legalCases"), {
        userId: user.uid,
        propertyId: p1.id,
        propertyName: "🏢 Monolocale Vista Duomo",
        tenantName: "👨‍🎓 Mario Rossi", // Link explicitly to Mario Rossi
        title: "⚖️ Sfratto per Morosità Mario Rossi",
        description: "Disputa legale avviata per canoni insoluti reiterati e indennità di occupazione.",
        lawyerName: "Avv. Francesca Esposito",
        court: "Tribunale Ordinario di Milano - Sezione Civile",
        status: "Active",
        cost: 1500,
        notes: "Ufficiale giudiziario notificato. Prima udienza di convalida sfratto fissata per Ottobre 2026.",
        createdAt: serverTimestamp()
      });

      // 10. Lawyers (Studi Legali)
      await addDoc(collection(db, "lawyers"), {
        userId: user.uid,
        name: "Avv. Elena Greco",
        studioName: "Studio Legale Greco & Associati",
        email: "elena.greco@studiolegalegreco.it",
        phone: "+39 02 876543",
        address: "Via della Moscova 12, 20121 Milano (MI)",
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "lawyers"), {
        userId: user.uid,
        name: "Avv. Marco Seta",
        studioName: "Seta & Partners",
        email: "m.seta@setapartners.it",
        phone: "+39 02 543210",
        address: "Corso di Porta Romana 85, 20122 Milano (MI)",
        createdAt: serverTimestamp()
      });

      showSuccess("Dati demo caricati con successo su tutte le pagine! Emojis e indicatori pronti! 🎉");
    } catch (error) {
      console.error("Seeding failed", error);
      showError("Errore durante il caricamento dei dati demo: " + String(error));
    }
  };

  // Properties CRUD
  const handleAddProperty = async (data: any) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "properties"), {
        ...data,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      showSuccess("Immobile aggiunto con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.CREATE, "properties");
      showError("Impossibile salvare l'immobile: " + errInfo.error);
    }
  };

  const handleEditProperty = async (id: string, data: any) => {
    try {
      await updateDoc(doc(db, "properties", id), data);
      showSuccess("Immobile aggiornato con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.UPDATE, `properties/${id}`);
      showError("Impossibile aggiornare l'immobile: " + errInfo.error);
    }
  };

  const handleDeleteProperty = async (id: string) => {
    try {
      await deleteDoc(doc(db, "properties", id));
      showSuccess("Immobile eliminato con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.DELETE, `properties/${id}`);
      showError("Impossibile eliminare l'immobile: " + errInfo.error);
    }
  };

  // Owner Onboarding saving handler
  const handleSaveOwnerProfile = async (profileData: Partial<OwnerProfile>) => {
    if (!user) return;
    try {
      const docRef = doc(db, "ownerProfiles", user.uid);
      await setDoc(docRef, {
        ...profileData,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      showSuccess("Profilo proprietario salvato con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.CREATE, "ownerProfiles");
      showError("Impossibile salvare il profilo proprietario: " + errInfo.error);
      throw error;
    }
  };

  // Owner settings update handler
  const handleUpdateOwnerProfile = async (profileData: Partial<OwnerProfile>) => {
    if (!user) return;
    try {
      const docRef = doc(db, "ownerProfiles", user.uid);
      await updateDoc(docRef, {
        ...profileData,
        updatedAt: serverTimestamp()
      });
      showSuccess("Profilo e impostazioni aggiornati con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.UPDATE, `ownerProfiles/${user.uid}`);
      showError("Impossibile salvare le modifiche: " + errInfo.error);
      throw error;
    }
  };

  // Tenants CRUD
  const handleAddTenant = async (data: any) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "tenants"), {
        ...data,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      showSuccess("Inquilino aggiunto con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.CREATE, "tenants");
      showError("Impossibile salvare l'inquilino: " + errInfo.error);
    }
  };

  const handleEditTenant = async (id: string, data: any) => {
    try {
      await updateDoc(doc(db, "tenants", id), data);
      showSuccess("Inquilino aggiornato con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.UPDATE, `tenants/${id}`);
      showError("Impossibile aggiornare l'inquilino: " + errInfo.error);
    }
  };

  const handleDeleteTenant = async (id: string) => {
    try {
      await deleteDoc(doc(db, "tenants", id));
      showSuccess("Inquilino eliminato con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.DELETE, `tenants/${id}`);
      showError("Impossibile eliminare l'inquilino: " + errInfo.error);
    }
  };

  // Contracts CRUD & Rent Dues Auto Generation!
  const handleAddContract = async (data: any) => {
    if (!user) return;
    try {
      let finalPropertyId = data.propertyId;
      let finalPropertyName = data.propertyName;
      let finalTenantId = data.tenantId;
      let finalTenantName = data.tenantName;
      let finalOwnerName = data.ownerName;

      // 1. Create Property inline if requested by the guided relationship flow
      if (data.newProperty) {
        const propDoc = await addDoc(collection(db, "properties"), {
          ...data.newProperty,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
        finalPropertyId = propDoc.id;
        finalPropertyName = data.newProperty.name;
        finalOwnerName = data.newProperty.owner || finalOwnerName;
      }

      // 2. Create Tenant inline if requested by the guided relationship flow
      if (data.newTenant) {
        const tenantDoc = await addDoc(collection(db, "tenants"), {
          ...data.newTenant,
          propertyId: finalPropertyId, // link newly created property
          userId: user.uid,
          createdAt: serverTimestamp()
        });
        finalTenantId = tenantDoc.id;
        finalTenantName = data.newTenant.name;
      }

      // 3. Create Contract
      const contractDoc = await addDoc(collection(db, "contracts"), {
        propertyId: finalPropertyId,
        propertyName: finalPropertyName,
        tenantId: finalTenantId,
        tenantName: finalTenantName,
        startDate: data.startDate,
        endDate: data.endDate,
        rentAmount: Number(data.rentAmount),
        frequency: data.frequency,
        status: data.status,
        notes: data.notes,
        ownerName: finalOwnerName || "Proprietario",
        isBareOwnership: data.isBareOwnership || false,
        userId: user.uid,
        createdAt: serverTimestamp()
      });

      // Auto-generate rental installments inside Fast Closing!
      const rentAmount = Number(data.rentAmount);
      if (rentAmount > 0 && data.startDate) {
        const start = new Date(data.startDate);
        const end = data.endDate ? new Date(data.endDate) : new Date(start.getTime() + 365*24*3600*1000);
        
        let currentDueDate = new Date(start);
        let monthIndex = 1;

        // Generate first 6 rent dues monthly for scheduling convenience
        while (currentDueDate <= end && monthIndex <= 6) {
          await addDoc(collection(db, "fastClosing"), {
            userId: user.uid,
            title: `Canone Affitto Mese ${monthIndex} - ${finalTenantName}`,
            description: `Riferimento Contratto Locazione su ${finalPropertyName}`,
            amount: rentAmount,
            dueDate: currentDueDate.toISOString().split("T")[0],
            source: "contract",
            sourceId: contractDoc.id,
            status: "Pending",
            createdAt: serverTimestamp()
          });

          // Add 1 month
          currentDueDate.setMonth(currentDueDate.getMonth() + 1);
          monthIndex++;
        }
      }
      showSuccess("Relazione contrattuale e scadenze create con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.CREATE, "contracts");
      showError("Impossibile salvare la relazione: " + errInfo.error);
    }
  };

  const handleEditContract = async (id: string, data: any) => {
    try {
      await updateDoc(doc(db, "contracts", id), data);
      showSuccess("Contratto aggiornato con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.UPDATE, `contracts/${id}`);
      showError("Impossibile aggiornare il contratto: " + errInfo.error);
    }
  };

  const handleDeleteContract = async (id: string) => {
    try {
      await deleteDoc(doc(db, "contracts", id));
      showSuccess("Contratto eliminato con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.DELETE, `contracts/${id}`);
      showError("Impossibile eliminare il contratto: " + errInfo.error);
    }
  };

  // Condominiums CRUD & Rate Installments Sync!
  const handleAddCondominium = async (data: any) => {
    if (!user) return;
    try {
      const condoDoc = await addDoc(collection(db, "condominiums"), {
        ...data,
        userId: user.uid,
        createdAt: serverTimestamp()
      });

      // Sync generated rates to Fast Closing
      if (data.rates && Array.isArray(data.rates)) {
        for (const rate of data.rates) {
          await addDoc(collection(db, "fastClosing"), {
            userId: user.uid,
            title: `${rate.title} - ${data.name}`,
            description: rate.notes || `Rata condominio Amministratore: ${data.administrator}`,
            amount: Number(rate.amount) || 0,
            dueDate: rate.dueDate || new Date().toISOString().split("T")[0],
            source: "condominium",
            sourceId: condoDoc.id,
            status: "Pending",
            createdAt: serverTimestamp()
          });
        }
      }
      showSuccess("Condominio aggiunto e rate sincronizzate!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.CREATE, "condominiums");
      showError("Impossibile salvare il condominio: " + errInfo.error);
    }
  };

  const handleEditCondominium = async (id: string, data: any) => {
    try {
      await updateDoc(doc(db, "condominiums", id), data);
      showSuccess("Condominio modificato con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.UPDATE, `condominiums/${id}`);
      showError("Impossibile aggiornare il condominio: " + errInfo.error);
    }
  };

  const handleDeleteCondominium = async (id: string) => {
    try {
      await deleteDoc(doc(db, "condominiums", id));
      showSuccess("Condominio eliminato con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.DELETE, `condominiums/${id}`);
      showError("Impossibile eliminare il condominio: " + errInfo.error);
    }
  };

  // Bank Movements & AI Reconciliation
  const handleAddCreditInstitution = async (data: any) => {
    if (!user) return;
    try {
      const cleanData: any = {};
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined) {
          cleanData[key] = data[key];
        }
      });
      await addDoc(collection(db, "creditInstitutions"), {
        ...cleanData,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      showSuccess("Istituto di credito aggiunto con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.CREATE, "creditInstitutions");
      showError("Impossibile salvare l'istituto di credito: " + errInfo.error);
    }
  };

  const handleAddBankAccount = async (data: any) => {
    if (!user) return;
    try {
      const cleanData: any = {};
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined) {
          cleanData[key] = data[key];
        }
      });
      await addDoc(collection(db, "bankAccounts"), {
        ...cleanData,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      showSuccess("Conto corrente aggiunto con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.CREATE, "bankAccounts");
      showError("Impossibile salvare il conto corrente: " + errInfo.error);
    }
  };

  const handleAddMovement = async (data: any) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "movements"), {
        ...data,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      showSuccess("Movimento bancario aggiunto!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.CREATE, "movements");
      showError("Impossibile salvare il movimento: " + errInfo.error);
    }
  };

  const handleReconcileMovement = async (movementId: string, closingItemId: string) => {
    try {
      // 1. Get reference to closing item and update to Paid
      const closingRef = doc(db, "fastClosing", closingItemId);
      await updateDoc(closingRef, { status: "Paid" });

      // 2. Find if this closing item is linked to a reminder, if so update the reminder to Paid
      const targetItem = fastClosing.find(item => item.id === closingItemId);
      if (targetItem && targetItem.source === "reminder" && targetItem.sourceId) {
        try {
          await updateDoc(doc(db, "reminders", targetItem.sourceId), { 
            status: "Paid",
            followUpNotes: "Saldato tramite riconciliazione automatica con bonifico."
          });
        } catch (e) {
          console.error("Non-fatal error updating linked reminder status:", e);
        }
      }

      // 3. Update movement
      const movementRef = doc(db, "movements", movementId);
      await updateDoc(movementRef, {
        reconciled: true,
        reconciledWith: targetItem ? {
          id: targetItem.id,
          title: targetItem.title,
          amount: targetItem.amount
        } : null
      });
      showSuccess("Movimento riconciliato con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.UPDATE, `movements/${movementId}`);
      showError("Errore durante la riconciliazione: " + errInfo.error);
    }
  };

  const handleDeleteMovement = async (id: string) => {
    try {
      await deleteDoc(doc(db, "movements", id));
      showSuccess("Movimento eliminato!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.DELETE, `movements/${id}`);
      showError("Impossibile eliminare il movimento: " + errInfo.error);
    }
  };

  // Reminders CRUD & Sync as "Overdue" or "Pending" to Fast Closing
  const handleAddReminder = async (data: any) => {
    if (!user) return;
    try {
      const cleanData: any = {};
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined) {
          cleanData[key] = data[key];
        }
      });
      const reminderDoc = await addDoc(collection(db, "reminders"), {
        ...cleanData,
        userId: user.uid,
        createdAt: serverTimestamp()
      });

      // Also inject into Fast Closing as an active Overdue alert item!
      await addDoc(collection(db, "fastClosing"), {
        userId: user.uid,
        title: `Sollecito Insoluto: ${data.tenantName}`,
        description: `Insoluto per causale: ${data.reason}`,
        amount: data.amount,
        dueDate: data.dueDate,
        source: "reminder",
        sourceId: reminderDoc.id,
        status: "Overdue",
        createdAt: serverTimestamp()
      });
      showSuccess("Sollecito aggiunto e scadenziario sincronizzato!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.CREATE, "reminders");
      showError("Impossibile salvare il sollecito: " + errInfo.error);
    }
  };

  const handleUpdateReminderStatus = async (id: string, status: string, notes?: string, extraFields?: any) => {
    try {
      const payload: any = { status, ...extraFields };
      if (notes) payload.followUpNotes = notes;
      await updateDoc(doc(db, "reminders", id), payload);
      
      // If marked as Paid, bidirectionally update all associated Fast Closing items to Paid!
      if (status === "Paid") {
        const currentReminder = reminders.find(r => r.id === id);
        const itemIdsToMarkPaid = new Set<string>();

        if (currentReminder) {
          // 1. Add all IDs listed in associatedItemsIds
          if (currentReminder.associatedItemsIds && currentReminder.associatedItemsIds.length > 0) {
            currentReminder.associatedItemsIds.forEach(itemId => itemIdsToMarkPaid.add(itemId));
          }
        }

        // 2. Add single linked fast closing item if present
        const linkedFastClosing = fastClosing.find(item => item.source === "reminder" && item.sourceId === id);
        if (linkedFastClosing) {
          itemIdsToMarkPaid.add(linkedFastClosing.id);
        }

        // 3. Perform batch/sequential updates in Firestore for all collected items
        for (const itemId of Array.from(itemIdsToMarkPaid)) {
          await updateDoc(doc(db, "fastClosing", itemId), { status: "Paid" });
        }
      }
      
      showSuccess("Stato sollecito aggiornato!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.UPDATE, `reminders/${id}`);
      showError("Impossibile aggiornare lo stato del sollecito: " + errInfo.error);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await deleteDoc(doc(db, "reminders", id));
      showSuccess("Sollecito eliminato!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.DELETE, `reminders/${id}`);
      showError("Impossibile eliminare il sollecito: " + errInfo.error);
    }
  };

  // Fast Closing direct updates
  const handleAddClosingItem = async (data: any) => {
    if (!user) return;
    try {
      const cleanData: any = {};
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined) {
          cleanData[key] = data[key];
        }
      });
      await addDoc(collection(db, "fastClosing"), {
        ...cleanData,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      showSuccess("Scadenza aggiunta con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.CREATE, "fastClosing");
      showError("Impossibile salvare la scadenza: " + errInfo.error);
    }
  };

  const handleUpdateClosingItemStatus = async (id: string, status: "Pending" | "Paid" | "Overdue" | "Cancelled") => {
    try {
      await updateDoc(doc(db, "fastClosing", id), { status });
      showSuccess("Stato scadenza aggiornato!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.UPDATE, `fastClosing/${id}`);
      showError("Impossibile aggiornare la scadenza: " + errInfo.error);
    }
  };

  const handleDeleteClosingItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, "fastClosing", id));
      showSuccess("Scadenza eliminata dallo scadenziario!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.DELETE, `fastClosing/${id}`);
      showError("Impossibile eliminare la scadenza: " + errInfo.error);
    }
  };

  const handlePostponeClosingItem = async (id: string, newDueDate: string) => {
    try {
      await updateDoc(doc(db, "fastClosing", id), {
        dueDate: newDueDate,
        status: "Pending"
      });
      showSuccess("Scadenza posticipata con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.UPDATE, `fastClosing/${id}`);
      showError("Impossibile rinviare la scadenza: " + errInfo.error);
    }
  };

  // Maintenance Ticket CRUD
  const handleAddMaintenance = async (data: any) => {
    if (!user) return;
    try {
      // Clean undefined fields so Firestore doesn't crash on standard optional fields (e.g. cost: undefined, contractor: undefined, date: undefined)
      const cleanData: any = {};
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && key !== "splits") {
          cleanData[key] = data[key];
        }
      });

      if (data.splits) {
        cleanData.splits = data.splits;
      }

      const maintDoc = await addDoc(collection(db, "maintenance"), {
        ...cleanData,
        userId: user.uid,
        createdAt: serverTimestamp()
      });

      // Synchronize cost as multiple Fast Closing items if splits are provided, or fallback to single
      if (data.splits && data.splits.length > 0) {
        let dueDate = new Date().toISOString().split("T")[0];
        if (data.esigibilita === "Differita" && data.esigibilitaData) {
          dueDate = data.esigibilitaData;
        }

        for (const split of data.splits) {
          if (Number(split.amount) > 0) {
            await addDoc(collection(db, "fastClosing"), {
              userId: user.uid,
              propertyId: data.propertyId,
              title: `Quota ${split.debtorName} - Manutenzione: ${data.title} (${data.propertyName})`,
              description: data.description || `Quota a carico del debitore. Manutenzione: ${data.title}. Ditta: ${data.contractor || "N/A"}`,
              amount: Number(split.amount),
              dueDate: dueDate,
              source: "maintenance",
              sourceId: maintDoc.id,
              status: "Pending",
              createdAt: serverTimestamp()
            });
          }
        }
      } else if (Number(data.cost) > 0) {
        let dueDate = new Date().toISOString().split("T")[0];
        if (data.esigibilita === "Differita" && data.esigibilitaData) {
          dueDate = data.esigibilitaData;
        }

        await addDoc(collection(db, "fastClosing"), {
          userId: user.uid,
          propertyId: data.propertyId,
          title: `Manutenzione: ${data.title} - ${data.propertyName} (${data.chargedTo === "tenant" ? "Inquilino" : "Proprietario"})`,
          description: data.description || `Lavoro di manutenzione a carico del ${data.chargedTo === "tenant" ? "Conduttore" : "Locatore"}. Ditta: ${data.contractor || "N/A"}`,
          amount: Number(data.cost),
          dueDate: dueDate,
          source: "maintenance",
          sourceId: maintDoc.id,
          status: "Pending",
          createdAt: serverTimestamp()
        });
      }
      showSuccess("Ticket manutenzione aperto e scadenziario Fast Closing aggiornato con le quote ripartite!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.CREATE, "maintenance");
      showError("Impossibile registrare la manutenzione: " + errInfo.error);
    }
  };

  const handleUpdateMaintenanceStatus = async (id: string, status: "New" | "In Progress" | "Completed" | "Cancelled") => {
    try {
      await updateDoc(doc(db, "maintenance", id), { status });
      showSuccess("Stato manutenzione aggiornato!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.UPDATE, `maintenance/${id}`);
      showError("Impossibile aggiornare lo stato: " + errInfo.error);
    }
  };

  const handleDeleteMaintenance = async (id: string) => {
    try {
      await deleteDoc(doc(db, "maintenance", id));
      
      // Also delete any associated fastClosing items
      const relatedClosing = fastClosing.filter(fc => fc.source === "maintenance" && fc.sourceId === id);
      for (const fcItem of relatedClosing) {
        await deleteDoc(doc(db, "fastClosing", fcItem.id));
      }

      showSuccess("Ticket manutenzione e scadenze collegate eliminate!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.DELETE, `maintenance/${id}`);
      showError("Impossibile eliminare il ticket: " + errInfo.error);
    }
  };

  // Legal Cases CRUD
  const handleAddLegalCase = async (data: any) => {
    if (!user) return;
    try {
      const cleanData: any = {};
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined) {
          cleanData[key] = data[key];
        }
      });
      await addDoc(collection(db, "legalCases"), {
        ...cleanData,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      showSuccess("Pratica legale creata con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.CREATE, "legalCases");
      showError("Impossibile salvare la pratica: " + errInfo.error);
    }
  };

  const handleUpdateLegalCaseStatus = async (id: string, status: "Active" | "Pending" | "Closed") => {
    try {
      await updateDoc(doc(db, "legalCases", id), { status });
      showSuccess("Stato pratica legale modificato!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.UPDATE, `legalCases/${id}`);
      showError("Impossibile aggiornare lo stato della pratica: " + errInfo.error);
    }
  };

  const handleUpdateLegalCase = async (id: string, updates: any) => {
    try {
      await updateDoc(doc(db, "legalCases", id), updates);
      showSuccess("Pratica legale aggiornata con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.UPDATE, `legalCases/${id}`);
      showError("Impossibile aggiornare la pratica: " + errInfo.error);
    }
  };

  const handleDeleteLegalCase = async (id: string) => {
    try {
      await deleteDoc(doc(db, "legalCases", id));
      showSuccess("Pratica legale eliminata!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.DELETE, `legalCases/${id}`);
      showError("Impossibile eliminare la pratica: " + errInfo.error);
    }
  };

  const handleAddLawyer = async (data: Omit<Lawyer, "id" | "userId" | "createdAt">) => {
    try {
      if (!user) return;
      const cleanData: any = {};
      Object.keys(data).forEach(key => {
        const val = data[key as keyof typeof data];
        if (val !== undefined) {
          cleanData[key] = val;
        }
      });
      await addDoc(collection(db, "lawyers"), {
        ...cleanData,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      showSuccess("Studio Legale registrato con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.CREATE, "lawyers");
      showError("Impossibile salvare lo studio legale: " + errInfo.error);
    }
  };

  // Insurance Policies CRUD
  const handleAddInsurancePolicy = async (data: any) => {
    if (!user) return;
    try {
      const cleanData: any = {};
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined) {
          cleanData[key] = data[key];
        }
      });
      await addDoc(collection(db, "insurancePolicies"), {
        ...cleanData,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      showSuccess("Polizza assicurativa registrata con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.CREATE, "insurancePolicies");
      showError("Impossibile salvare la polizza: " + errInfo.error);
    }
  };

  const handleEditInsurancePolicy = async (id: string, data: any) => {
    try {
      const cleanData: any = {};
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined) {
          cleanData[key] = data[key];
        }
      });
      await updateDoc(doc(db, "insurancePolicies", id), cleanData);
      showSuccess("Polizza assicurativa aggiornata con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.UPDATE, `insurancePolicies/${id}`);
      showError("Impossibile aggiornare la polizza: " + errInfo.error);
    }
  };

  const handleDeleteInsurancePolicy = async (id: string) => {
    try {
      await deleteDoc(doc(db, "insurancePolicies", id));
      showSuccess("Polizza assicurativa eliminata con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.DELETE, `insurancePolicies/${id}`);
      showError("Impossibile eliminare la polizza: " + errInfo.error);
    }
  };

  // Handover Delivery Reports CRUD
  const handleAddDeliveryReport = async (data: any) => {
    if (!user) return;
    try {
      const cleanData: any = {};
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined) {
          cleanData[key] = data[key];
        }
      });
      await addDoc(collection(db, "deliveryReports"), {
        ...cleanData,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      showSuccess("Verbale di consegna registrato con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.CREATE, "deliveryReports");
      showError("Impossibile salvare il verbale: " + errInfo.error);
    }
  };

  const handleEditDeliveryReport = async (id: string, data: any) => {
    try {
      const cleanData: any = {};
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined) {
          cleanData[key] = data[key];
        }
      });
      await updateDoc(doc(db, "deliveryReports", id), cleanData);
      showSuccess("Verbale di consegna aggiornato con successo!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.UPDATE, `deliveryReports/${id}`);
      showError("Impossibile aggiornare il verbale: " + errInfo.error);
    }
  };

  const handleDeleteDeliveryReport = async (id: string) => {
    try {
      await deleteDoc(doc(db, "deliveryReports", id));
      showSuccess("Verbale di consegna eliminato!");
    } catch (error) {
      const errInfo = handleFirestoreError(error, OperationType.DELETE, `deliveryReports/${id}`);
      showError("Impossibile eliminare il verbale: " + errInfo.error);
    }
  };

  // Rendering Loader State
  if (authLoading || (user && ownerProfileLoading)) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 text-xs tracking-wider uppercase font-semibold">Caricamento CRM Property...</p>
      </div>
    );
  }

  // ==========================================
  // LANDING PAGE (NOT AUTHENTICATED)
  // ==========================================
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-between" id="landing-page">
        {/* Header decoration */}
        <header className="px-6 py-4 flex justify-between items-center max-w-7xl mx-auto w-full">
          <div className="flex items-center space-x-2.5">
            <Logo size={28} />
            <span className="font-sans font-bold text-white text-base tracking-tight">Palazzinaro AI</span>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex items-center justify-center p-6 max-w-4xl mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
            
            {/* Slogans and details */}
            <div className="md:col-span-7 space-y-6 text-left">
              <span className="inline-flex items-center space-x-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                <Sparkles size={11} className="text-amber-400" />
                <span>Powered by Google AI Studio</span>
              </span>
              <h1 className="text-3xl sm:text-4xl font-sans font-extrabold text-white tracking-tight leading-none">
                Il Futuro del <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                  Property Management
                </span>
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed font-normal max-w-md">
                Un gestionale immobiliare modulare con intelligenza artificiale integrata. Carica contratti, estratti conto e bilanci con un semplice copia-incolla: Gemini strutturerà le anagrafiche, compilerà le scadenze e redigerà solleciti legali formali.
              </p>

              <div className="space-y-3.5 text-xs text-slate-400">
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Google Sign-In integrato e sessione persistente.</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Lettore OCR intelligente per preventivi di condominio.</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Riconciliazione AI automatizzata degli estratti conto.</span>
                </div>
              </div>
            </div>

            {/* Login Card */}
            <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[300px]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl"></div>
              
              <div className="space-y-2">
                <h3 className="font-sans font-bold text-white text-lg">Inizia subito</h3>
                <p className="text-xs text-slate-400">Accedi in sicurezza utilizzando il tuo account Google per avviare il CRM.</p>
              </div>

              <div className="space-y-4 my-8">
                <button
                  onClick={handleGoogleLogin}
                  id="google-signin-btn"
                  className="w-full bg-white hover:bg-slate-50 text-slate-900 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-3 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.415 0-6.19-2.774-6.19-6.19s2.775-6.19 6.19-6.19c1.455 0 2.802.502 3.863 1.34l3.175-3.175C18.995 2.128 15.82 1 12.24 1c-6.075 0-11 4.925-11 11s4.925 11 11 11c5.78 0 10.82-4.14 10.82-11 0-.756-.08-1.485-.22-2.185l-10.6 1.47z"
                    />
                  </svg>
                  <span>Accedi con Google</span>
                </button>
              </div>

              <div className="border-t border-slate-800 pt-4 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span className="flex items-center space-x-1">
                  <ShieldCheck size={12} className="text-indigo-400" />
                  <span>Dati Persistenti Firestore</span>
                </span>
                <span>v1.2.0</span>
              </div>
            </div>

          </div>
        </main>

        {/* Footer */}
        <footer className="text-center py-6 text-[10px] text-slate-600 font-mono max-w-7xl mx-auto w-full border-t border-slate-900/40">
          <span>Copyright © 2026 Palazzinaro AI. Tutti i diritti riservati.</span>
        </footer>
      </div>
    );
  }

  // ==========================================
  // MANDATORY OWNER ONBOARDING Check
  // ==========================================
  if (!ownerProfile) {
    return (
      <OwnerOnboarding
        userEmail={user.email || ""}
        onSave={handleSaveOwnerProfile}
        onLogout={handleLogout}
      />
    );
  }

  // ==========================================
  // CORE CRM BOARD (AUTHENTICATED)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row" id="core-crm-root">
      
      {/* Global Success / Database Error Alerts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none">
        {dbError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-4 shadow-xl flex items-start space-x-3 pointer-events-auto transition-all duration-300">
            <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Errore di Sincronizzazione</p>
              <p className="mt-0.5 font-medium leading-relaxed">{dbError}</p>
            </div>
            <button 
              onClick={() => setDbError(null)} 
              className="text-rose-400 hover:text-rose-600 font-bold shrink-0 text-sm cursor-pointer"
            >
              ×
            </button>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-4 shadow-xl flex items-start space-x-3 pointer-events-auto transition-all duration-300">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Operazione Completata</p>
              <p className="mt-0.5 font-medium leading-relaxed">{successMsg}</p>
            </div>
            <button 
              onClick={() => setSuccessMsg(null)} 
              className="text-emerald-400 hover:text-emerald-600 font-bold shrink-0 text-sm cursor-pointer"
            >
              ×
            </button>
          </div>
        )}
      </div>
      
      {/* Sidebar Navigation */}
      <Sidebar 
        currentSection={currentSection} 
        setCurrentSection={setCurrentSection} 
        user={user}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
      />

      {/* Content wrapper to handle mobile header and main panel correctly */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top-bar bar */}
        <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0 sticky top-0 z-30">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            id="mobile-menu-toggle"
          >
            <Menu size={20} />
          </button>
          
          <div className="flex items-center space-x-2">
            <Logo size={24} />
            <span className="font-sans font-bold text-sm tracking-tight">Palazzinaro AI</span>
          </div>

          <div className="w-8 h-8"></div> {/* Visual balance spacer */}
        </header>

        {/* Main Panel Content Area */}
        <main className="flex-1 p-2 md:p-4 max-w-full w-full overflow-y-auto">
        
        {/* Render Sections Dynamically */}
        {currentSection === "dashboard" && (
          <DashboardView 
            properties={properties} 
            tenants={tenants} 
            contracts={contracts} 
            fastClosing={fastClosing}
            reminders={reminders}
            condominiums={condominiums}
            legalCases={legalCases}
            communications={communications}
            lawyers={lawyers}
            maintenance={maintenance}
            insurancePolicies={insurancePolicies}
            setCurrentSection={setCurrentSection}
            userName={user?.displayName || "Gestore Immobili"}
            onSeedDemoData={handleSeedDemoData}
            onSeedSimulationData={handleSeedSimulationData}
            onEditContract={handleEditContract}
            onUpdateReminderStatus={handleUpdateReminderStatus}
            onAddLegalCase={handleAddLegalCase}
            googleAccessToken={googleAccessToken}
            onConnectGoogleCalendar={handleGoogleLogin}
            ownerProfile={ownerProfile}
          />
        )}

        {currentSection === "properties" && (
          <PropertiesView 
            properties={properties}
            tenants={tenants}
            contracts={contracts}
            fastClosing={fastClosing}
            reminders={reminders}
            legalCases={legalCases}
            condominiums={condominiums}
            insurancePolicies={insurancePolicies}
            deliveryReports={deliveryReports}
            onAddInsurancePolicy={handleAddInsurancePolicy}
            onEditInsurancePolicy={handleEditInsurancePolicy}
            onDeleteInsurancePolicy={handleDeleteInsurancePolicy}
            onAddDeliveryReport={handleAddDeliveryReport}
            onEditDeliveryReport={handleEditDeliveryReport}
            onDeleteDeliveryReport={handleDeleteDeliveryReport}
            setCurrentSection={setCurrentSection}
            setSelectedTenantIdForLedger={setSelectedTenantIdForLedger}
            onAddProperty={handleAddProperty}
            onEditProperty={handleEditProperty}
            onDeleteProperty={handleDeleteProperty}
            maintenance={maintenance}
          />
        )}

        {currentSection === "tenants" && (
          <TenantsView 
            tenants={tenants}
            properties={properties}
            fastClosing={fastClosing}
            contracts={contracts}
            maintenance={maintenance}
            legalCases={legalCases}
            reminders={reminders}
            initialSelectedTenantId={selectedTenantIdForLedger}
            onClearInitialSelectedTenantId={() => setSelectedTenantIdForLedger(null)}
            onAddTenant={handleAddTenant}
            onEditTenant={handleEditTenant}
            onDeleteTenant={handleDeleteTenant}
          />
        )}

        {currentSection === "contracts" && (
          <ContractsView 
            contracts={contracts}
            properties={properties}
            tenants={tenants}
            condominiums={condominiums}
            deliveryReports={deliveryReports}
            onAddDeliveryReport={handleAddDeliveryReport}
            onEditDeliveryReport={handleEditDeliveryReport}
            onDeleteDeliveryReport={handleDeleteDeliveryReport}
            onAddContract={handleAddContract}
            onEditContract={handleEditContract}
            onDeleteContract={handleDeleteContract}
            onAddProperty={handleAddProperty}
            onAddTenant={handleAddTenant}
            setCurrentSection={setCurrentSection}
            setSelectedTenantIdForLedger={setSelectedTenantIdForLedger}
          />
        )}

        {currentSection === "condominiums" && (
          <CondominiumsView 
            condominiums={condominiums}
            properties={properties}
            tenants={tenants}
            fastClosing={fastClosing}
            onAddCondominium={handleAddCondominium}
            onEditCondominium={handleEditCondominium}
            onDeleteCondominium={handleDeleteCondominium}
            onAddClosingItem={handleAddClosingItem}
            setCurrentSection={setCurrentSection}
            setSelectedTenantIdForLedger={setSelectedTenantIdForLedger}
          />
        )}

        {currentSection === "banks" && (
          <BanksView 
            movements={movements}
            fastClosing={fastClosing}
            creditInstitutions={creditInstitutions}
            bankAccounts={bankAccounts}
            onAddMovement={handleAddMovement}
            onReconcileMovement={handleReconcileMovement}
            onDeleteMovement={handleDeleteMovement}
            onAddCreditInstitution={handleAddCreditInstitution}
            onAddBankAccount={handleAddBankAccount}
          />
        )}

        {currentSection === "fast_closing" && (
          <FastClosingView 
            fastClosing={fastClosing}
            movements={movements}
            tenants={tenants}
            properties={properties}
            legalCases={legalCases}
            reminders={reminders}
            onAddClosingItem={handleAddClosingItem}
            onUpdateClosingItemStatus={handleUpdateClosingItemStatus}
            onPostponeClosingItem={handlePostponeClosingItem}
            onReconcileMovement={handleReconcileMovement}
            onDeleteClosingItem={handleDeleteClosingItem}
            onAddMovement={handleAddMovement}
            onAddReminder={handleAddReminder}
          />
        )}

        {currentSection === "reminders" && (
          <RemindersView 
            reminders={reminders}
            tenants={tenants}
            movements={movements}
            fastClosing={fastClosing}
            properties={properties}
            communications={communications}
            ownerProfile={ownerProfile}
            onAddReminder={handleAddReminder}
            onUpdateReminderStatus={handleUpdateReminderStatus}
            onReconcileMovement={handleReconcileMovement}
            onAddLegalCase={handleAddLegalCase}
            onDeleteReminder={handleDeleteReminder}
            onAddMovement={handleAddMovement}
          />
        )}

        {currentSection === "maintenance" && (
          <MaintenanceView 
            maintenance={maintenance}
            properties={properties}
            fastClosing={fastClosing}
            contracts={contracts}
            tenants={tenants}
            onAddMaintenance={handleAddMaintenance}
            onUpdateMaintenanceStatus={handleUpdateMaintenanceStatus}
            onDeleteMaintenance={handleDeleteMaintenance}
          />
        )}

        {currentSection === "legal" && (
          <LegalView 
            legalCases={legalCases}
            properties={properties}
            lawyers={lawyers}
            onAddLegalCase={handleAddLegalCase}
            onUpdateLegalCaseStatus={handleUpdateLegalCaseStatus}
            onUpdateLegalCase={handleUpdateLegalCase}
            onDeleteLegalCase={handleDeleteLegalCase}
            onAddLawyer={handleAddLawyer}
          />
        )}

        {currentSection === "owners" && (
          <OwnersView 
            properties={properties}
            tenants={tenants}
            contracts={contracts}
            fastClosing={fastClosing}
            reminders={reminders}
            condominiums={condominiums}
            legalCases={legalCases}
            movements={movements}
            maintenance={maintenance}
            setCurrentSection={setCurrentSection}
            onViewTenantLedger={(tenantId) => {
              setSelectedTenantIdForLedger(tenantId);
              setCurrentSection("tenants");
            }}
          />
        )}

        {currentSection === "ai_area" && (
          <AIAreaView 
            onAddProperty={handleAddProperty}
            onAddContract={handleAddContract}
            onAddTenant={handleAddTenant}
            onAddCondominium={handleAddCondominium}
            onAddMovement={handleAddMovement}
            onAddReminder={handleAddReminder}
            onAddClosingItem={handleAddClosingItem}
            setCurrentSection={setCurrentSection}
          />
        )}

        {currentSection === "settings" && (
          <SettingsView 
            ownerProfile={ownerProfile}
            onSaveProfile={handleUpdateOwnerProfile}
          />
        )}

      </main>
      </div>
    </div>
  );
}
