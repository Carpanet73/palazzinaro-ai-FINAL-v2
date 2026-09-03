import React, { useEffect, useMemo, useState } from "react";
import { collection, addDoc, updateDoc, doc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { X, Trash2, Mail, CheckCircle2 } from "lucide-react";
import { db } from "../firebase";
import { Contract, DeliveryReport, DeliveryReportItem, OwnerProfile } from "../types";
import { useOtpVerification, isEmailJsConfigured } from "../hooks/useOtpVerification";

// Data nel fuso locale (NO UTC: in Italia dopo le 22 darebbe il giorno prima).
function todayLocalISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function formatEuro(n: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);
}
// NOTA: non esiste una stripUndefined condivisa nel progetto (verificato — ogni handler
// in App.tsx la reimplementa localmente), quindi teniamo questa versione locale, coerente
// con il pattern già in uso ovunque altrove nel codice.
function stripUndef(obj: any): any {
  const out: any = {};
  Object.keys(obj).forEach((k) => { if (obj[k] !== undefined) out[k] = obj[k]; });
  return out;
}

const DEFAULT_CHECKLIST: Omit<DeliveryReportItem, "id">[] = [
  { item: "Stato pareti", status: "Buono", notes: "" },
  { item: "Pavimenti", status: "Buono", notes: "" },
  { item: "Elettrodomestici", status: "Buono", notes: "" },
  { item: "Infissi e serramenti", status: "Buono", notes: "" },
  { item: "Chiavi consegnate", status: "Ottimo", notes: "" },
  { item: "Letture contatori", status: "Buono", notes: "" },
];
const newChecklist = (): DeliveryReportItem[] =>
  DEFAULT_CHECKLIST.map((c, i) => ({ ...c, id: `item_${i}_${Date.now()}` }));

const LABEL = "block text-[10px] font-black uppercase text-slate-600 mb-1";
const INPUT = "w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden";

interface Props {
  mode: "consegna" | "riconsegna";
  contract: Contract;
  user: { uid: string } | null;
  showSuccess: (msg: string) => void;
  onClose: () => void;
  onSaved: (reportId: string) => void;
  // CORREZIONE CN (task #50/#57) — generalizzazione OTP: entrambi opzionali, per
  // compatibilità con eventuali altri chiamanti futuri che non li passano ancora.
  // Quando assenti/non configurati, il comportamento resta quello di sempre (nome
  // digitato + checkbox, nessuna verifica OTP) — nessuna regressione.
  ownerProfile?: OwnerProfile | null;
  tenantEmail?: string;
}

export default function DeliveryReportWizard({ mode, contract, user, showSuccess, onClose, onSaved, ownerProfile, tenantEmail }: Props) {
  const isRiconsegna = mode === "riconsegna";
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [consegnaIniziale, setConsegnaIniziale] = useState<DeliveryReport | null>(null);
  const [loadingRef, setLoadingRef] = useState(isRiconsegna);
  const [reportDate, setReportDate] = useState<string>(todayLocalISO());
  const [checklist, setChecklist] = useState<DeliveryReportItem[]>(newChecklist());
  const [ownerName, setOwnerName] = useState(contract.ownerName || "");
  const [tenantName, setTenantName] = useState(contract.tenantName || "");
  const [ownerSigned, setOwnerSigned] = useState(false);
  const [tenantSigned, setTenantSigned] = useState(false);
  const [hasDamages, setHasDamages] = useState(false);
  const [damagesDescription, setDamagesDescription] = useState("");
  const [estimatedDamages, setEstimatedDamages] = useState<number>(0);
  const [closeContract, setCloseContract] = useState(true);
  // Compensazione deposito cauzionale (01/09/2026, su richiesta di Massimo): prima il
  // calcolo capienza/eccedenza era solo informativo ("gestite fuori dalla piattaforma").
  // Ora diventa operativo — ma la scelta se aprire comunque una pratica in Area Legale
  // resta SEMPRE una domanda esplicita all'utente (mai automatica, mai bloccata): utile
  // sia se i danni superano il deposito, sia se l'inquilino contesta un addebito che
  // rientra nella capienza.
  const [openLegalCase, setOpenLegalCase] = useState(true);

  // CORREZIONE CN (task #50/#57) — verifica OTP via email per le firme, stesso hook
  // condiviso già usato per la disdetta anticipata in ContractsView.tsx. Opzionale:
  // se email/credenziali EmailJS non sono disponibili per una parte, si procede come
  // sempre con solo nome + checkbox per quella parte (nessuna regressione).
  const emailCreds = { serviceId: ownerProfile?.emailServiceId, templateId: ownerProfile?.emailTemplateId, publicKey: ownerProfile?.emailPublicKey };
  const emailCredsConfigured = isEmailJsConfigured(emailCreds);
  const ownerOtp = useOtpVerification();
  const tenantOtp = useOtpVerification();
  const ownerEmailAvailable = emailCredsConfigured && !!ownerProfile?.email;
  const tenantEmailAvailable = emailCredsConfigured && !!tenantEmail;
  const ownerOtpOk = !ownerEmailAvailable || ownerOtp.verified;
  const tenantOtpOk = !tenantEmailAvailable || tenantOtp.verified;

  const sendOwnerOtp = async () => {
    if (!ownerProfile?.email) return;
    const result = await ownerOtp.sendOtp(emailCreds, { email: ownerProfile.email, name: ownerProfile.name || "Proprietario" }, {
      subject: `Codice di verifica — Verbale di ${isRiconsegna ? "Riconsegna" : "Consegna"} Immobile`,
      contextLine: `Codice di verifica per confermare la firma del Verbale di ${isRiconsegna ? "Riconsegna" : "Consegna"} per l'immobile ${contract.propertyName || ""}`,
    });
    if (result.ok) alert(`Codice di verifica inviato a ${ownerProfile.email}.`);
    else alert(`Errore nell'invio del codice via EmailJS:\n${result.error}`);
  };
  const verifyOwnerOtp = () => {
    const result = ownerOtp.verifyOtp();
    if (!result.ok) alert(result.error);
  };
  const sendTenantOtp = async () => {
    if (!tenantEmail) return;
    const result = await tenantOtp.sendOtp(emailCreds, { email: tenantEmail, name: tenantName || "Conduttore" }, {
      subject: `Codice di verifica — Verbale di ${isRiconsegna ? "Riconsegna" : "Consegna"} Immobile`,
      contextLine: `Codice di verifica per confermare la firma del Verbale di ${isRiconsegna ? "Riconsegna" : "Consegna"} per l'immobile ${contract.propertyName || ""}`,
    });
    if (result.ok) alert(`Codice di verifica inviato a ${tenantEmail}.`);
    else alert(`Errore nell'invio del codice via EmailJS:\n${result.error}`);
  };
  const verifyTenantOtp = () => {
    const result = tenantOtp.verifyOtp();
    if (!result.ok) alert(result.error);
  };

  // Recupero verbale di consegna iniziale (TASK 2a): prima contractId, fallback
  // propertyId (legacy). Filtro type client-side per evitare indici compositi.
  useEffect(() => {
    if (!isRiconsegna || !user) return;
    let cancelled = false;
    (async () => {
      try {
        // CORREZIONE CD — BUG REALE: Firestore rifiuta una query (list) se non può
        // verificare A PRIORI, dalla struttura stessa della query, che ogni possibile
        // risultato rispetti le regole di sicurezza (isOwner() controlla userId). Senza
        // il filtro esplicito su userId qui, Firestore nega l'intera query per prudenza
        // — anche se i dati in pratica sarebbero sempre e solo i tuoi. A differenza di
        // un get() su un documento noto (dove basta il controllo su resource.data), una
        // list query deve includere il filtro nella query stessa.
        let snap = await getDocs(query(
          collection(db, "deliveryReports"),
          where("userId", "==", user.uid),
          where("contractId", "==", contract.id)
        ));
        let found = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as DeliveryReport).find((r) => r.type === "consegna") || null;
        if (!found && contract.propertyId) {
          snap = await getDocs(query(
            collection(db, "deliveryReports"),
            where("userId", "==", user.uid),
            where("propertyId", "==", contract.propertyId)
          ));
          found = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as DeliveryReport).find((r) => r.type === "consegna") || null;
        }
        if (!cancelled) setConsegnaIniziale(found);
      } catch (e) { console.error("Errore recupero verbale di consegna:", e); }
      finally { if (!cancelled) setLoadingRef(false); }
    })();
    return () => { cancelled = true; };
  }, [isRiconsegna, contract.id, contract.propertyId, user?.uid]);

  // Calcolo deposito cauzionale (TASK 3b) — solo informativo
  const deposito = contract.securityDepositAmount || 0;
  const differenza = deposito - estimatedDamages;
  const calcoloDeposito = useMemo(() => {
    if (!hasDamages) return null;
    return differenza >= 0
      ? { tone: "restituire" as const, label: "Importo da restituire all'inquilino", value: differenza }
      : { tone: "debito" as const, label: "Differenza a debito dell'inquilino", value: Math.abs(differenza) };
  }, [hasDamages, differenza]);

  const updateItem = (id: string, patch: Partial<DeliveryReportItem>) =>
    setChecklist((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const addRow = () => setChecklist((prev) => [...prev, { id: `item_new_${Date.now()}`, item: "", status: "Buono", notes: "" }]);
  const removeRow = (id: string) => setChecklist((prev) => prev.filter((it) => it.id !== id));

  const firmeOk = !!(ownerSigned && tenantSigned && ownerName.trim() && tenantName.trim() && ownerOtpOk && tenantOtpOk);
  const danniOk = !hasDamages || damagesDescription.trim().length > 0;

  const handleConfirm = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();

      // 1) Verbale
      const reportRef = await addDoc(collection(db, "deliveryReports"), {
        ...stripUndef({
          userId: user.uid,
          propertyId: contract.propertyId,
          contractId: contract.id,
          tenantId: contract.tenantId,
          type: mode,
          date: reportDate,
          checklist,
          signatures: {
            ownerSigned, ownerSignatureData: ownerName.trim(), ownerSignedAt: ownerSigned ? nowIso : undefined,
            tenantSigned, tenantSignatureData: tenantName.trim(), tenantSignedAt: tenantSigned ? nowIso : undefined,
            ownerOtpVerifiedAt: ownerOtp.verified ? nowIso : undefined,
            tenantOtpVerifiedAt: tenantOtp.verified ? nowIso : undefined,
          },
          documentName: `Verbale_${mode}_${(contract.tenantName || "inquilino").replace(/\s+/g, "_")}_${reportDate}.pdf`,
          hasDamages: isRiconsegna ? hasDamages : undefined,
          damagesDescription: isRiconsegna && hasDamages ? damagesDescription.trim() : undefined,
          estimatedDamagesAmount: isRiconsegna && hasDamages ? estimatedDamages : undefined,
          // TODO: backup Drive quando l'integrazione sarà pronta
          // driveBackupUrl: <URL restituito da Google Drive>
        }),
        createdAt: serverTimestamp(),
      });

      // 2) Branching danni (TASK 2d): LegalCase solo se l'utente lo chiede esplicitamente
      // (01/09/2026: prima era automatico ad ogni danno, ora è sempre una scelta — vedi
      // checkbox "openLegalCase" al passo precedente).
      if (isRiconsegna && hasDamages && openLegalCase) {
        const legalRef = await addDoc(collection(db, "legalCases"), {
          ...stripUndef({
            userId: user.uid,
            propertyId: contract.propertyId,
            propertyName: contract.propertyName,
            contractId: contract.id,
            tenantName: contract.tenantName,
            title: `Recupero Danni - ${contract.tenantName || "Inquilino"} - ${contract.propertyName || "Immobile"}`,
            description:
              `Danni riscontrati alla riconsegna del ${reportDate}.\n\n` +
              `Descrizione danni: ${damagesDescription.trim()}\n` +
              `Stima danni: ${formatEuro(estimatedDamages)}\n` +
              `Deposito cauzionale: ${formatEuro(deposito)}\n` +
              `Verbale di consegna iniziale: ${consegnaIniziale?.id || "non presente"}\n` +
              `Verbale di riconsegna: ${reportRef.id}`,
            status: "Active",
            unpaidBalance: estimatedDamages > 0 ? estimatedDamages : undefined,
            relatedDeliveryReportIds: [...(consegnaIniziale?.id ? [consegnaIniziale.id] : []), reportRef.id],
          }),
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "deliveryReports", reportRef.id), { legalCaseId: legalRef.id });
      }

      // 2b) Compensazione e restituzione Deposito Cauzionale (01/09/2026, su richiesta di
      // Massimo): prima il calcolo era solo informativo. Ora, alla riconsegna, il deposito
      // viene sempre marcato come restituito (per intero se non ci sono danni, al netto
      // della compensazione se ce ne sono) — coerente con quanto poi mostrato nei mastrini
      // (vedi TenantsView.tsx, badge "Deposito Cauzionale (Restituito)"). Se i danni
      // superano il deposito, l'eccedenza diventa una nuova voce reale in Fast Closing a
      // carico dell'inquilino, con le stesse regole delle spese accessorie (mai un
      // Sollecito automatico, solo se marcata insoluta a mano).
      if (isRiconsegna && deposito > 0) {
        const damagesAmount = hasDamages ? estimatedDamages : 0;
        const returnedAmount = Math.max(0, deposito - damagesAmount);
        const excessAmount = Math.max(0, damagesAmount - deposito);
        await updateDoc(doc(db, "contracts", contract.id), {
          securityDepositReturned: true,
          securityDepositReturnedDate: reportDate,
          securityDepositReturnedAmount: returnedAmount,
        });
        if (excessAmount > 0) {
          await addDoc(collection(db, "fastClosing"), {
            userId: user.uid,
            title: `[Danni Riconsegna] Eccedenza su Deposito — ${contract.tenantName || ""} — ${contract.propertyName || ""}`,
            description: `Danni stimati ${formatEuro(damagesAmount)} superiori al deposito cauzionale di ${formatEuro(deposito)}. Verbale di riconsegna ${reportRef.id}.`,
            propertyId: contract.propertyId,
            amount: excessAmount,
            dueDate: reportDate,
            source: "condominium",
            sourceId: `deposit-excess-${contract.id}-${reportRef.id}`,
            status: "Pending",
            debtorId: contract.tenantId || null,
            debtorType: "tenant",
            createdAt: serverTimestamp(),
          });
        }
      }

      // 3) Chiusura contratto + STOP flussi economici (regola 5). Riusa il pattern
      //    di handleEarlyTerminateContract: cancella le righe fastClosing future
      //    (Pending/Overdue con dueDate oltre la riconsegna), Indennità incluse.
      if (isRiconsegna && closeContract) {
        // CORREZIONE CB — se il contratto era già stato chiuso in precedenza con una
        // causale REALE (es. Morosità/Sfratto tramite il wizard di Disdetta Anticipata),
        // non sovrascriverla qui con una causale generica: si perderebbe l'informazione
        // vera del perché il rapporto è finito. Valorizziamo le causali SOLO se il
        // contratto non aveva già una earlyTerminationDate registrata (tipicamente il
        // caso della sola scadenza naturale, dove queste righe non esistevano ancora).
        const alreadyHadTermination = !!contract.earlyTerminationDate;
        const contractPatch: any = alreadyHadTermination
          ? { status: "Terminated" }
          : {
              status: "Terminated",
              earlyTerminationDate: reportDate,
              earlyTerminationParty: "Locatore",
              earlyTerminationReason: hasDamages ? "GraveInadempimento" : "RisoluzioneConsensuale",
              earlyTerminationNotes: hasDamages
                ? `Riconsegna con danni (${formatEuro(estimatedDamages)} stimati). Verbale ${reportRef.id}.`
                : `Riconsegna senza danni. Verbale ${reportRef.id}.`,
            };
        await updateDoc(doc(db, "contracts", contract.id), stripUndef(contractPatch));
        // Data di riferimento per cancellare le righe future: usa la data di
        // terminazione REALE già esistente se c'era, altrimenti la data della riconsegna.
        const cutoffDate = contract.earlyTerminationDate || reportDate;
        const cancellationReason = alreadyHadTermination
          ? `Annullata per riconsegna dell'immobile del ${reportDate} (contratto già chiuso anticipatamente il ${contract.earlyTerminationDate}).`
          : `Annullata per chiusura contratto alla riconsegna del ${reportDate}${hasDamages ? " (con danni riscontrati)" : ""}.`;
        // CORREZIONE CD — stesso bug delle due query sopra: serve il filtro userId
        // nella query stessa, altrimenti Firestore nega l'intera list per prudenza.
        const fcSnap = await getDocs(query(
          collection(db, "fastClosing"),
          where("userId", "==", user.uid),
          where("sourceId", "==", contract.id)
        ));
        // CORREZIONE CL (05/08/2026) — le righe F24 collegate a questo contratto NON hanno
        // sourceId === contract.id (hanno "f24-{contractId}-yN"), quindi la query sopra non
        // le trova: serve una seconda query "a prefisso" (range su stringa, pattern standard
        // Firestore) per includerle e non lasciarle dovute su un contratto già chiuso.
        const f24Snap = await getDocs(query(
          collection(db, "fastClosing"),
          where("userId", "==", user.uid),
          where("sourceId", ">=", `f24-${contract.id}-`),
          where("sourceId", "<", `f24-${contract.id}-`)
        ));
        const rowsToCancel = [...fcSnap.docs, ...f24Snap.docs]
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((fc: any) => (fc.status === "Pending" || fc.status === "Overdue") && new Date(fc.dueDate) > new Date(cutoffDate));
        for (const row of rowsToCancel) {
          await updateDoc(doc(db, "fastClosing", row.id), { status: "Cancelled", cancellationReason });
        }
      }

      // 4) Se è CONSEGNA (TASK 1): contratto non più in attesa di verbale
      if (!isRiconsegna) {
        await updateDoc(doc(db, "contracts", contract.id), { deliveryReportPending: false });
      }

      showSuccess(isRiconsegna
        ? (hasDamages && openLegalCase ? "Verbale di riconsegna salvato, deposito compensato e fascicolo legale creato." : "Verbale di riconsegna salvato e deposito cauzionale aggiornato.")
        : "Verbale di consegna salvato. Relazione completa.");
      onSaved(reportRef.id);
      onClose();
    } catch (error) {
      console.error("Errore salvataggio verbale:", error);
      alert("Errore durante il salvataggio del verbale. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  const totalSteps = isRiconsegna ? 4 : 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">{isRiconsegna ? "Verbale di Riconsegna" : "Verbale di Consegna"}</h2>
            <p className="text-xs text-slate-500">{contract.propertyName || "Immobile"} · {contract.tenantName || "Inquilino"} · Step {step}/{totalSteps}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="px-6 py-5">
          {isRiconsegna && step === 1 && (
            <div>
              <h3 className="mb-1 text-sm font-black text-slate-800">Stato registrato alla Consegna iniziale</h3>
              <p className="mb-4 text-xs text-slate-500">Riferimento per valutare i danni alla riconsegna.</p>
              {loadingRef ? (
                <p className="text-xs text-slate-400">Caricamento verbale di consegna…</p>
              ) : consegnaIniziale ? (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-left text-[10px] font-black uppercase text-slate-500">
                      <tr><th className="px-3 py-2">Voce</th><th className="px-3 py-2">Stato</th><th className="px-3 py-2">Note</th></tr>
                    </thead>
                    <tbody>
                      {consegnaIniziale.checklist.map((it) => (
                        <tr key={it.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-700">{it.item}</td>
                          <td className="px-3 py-2 text-slate-600">{it.status}</td>
                          <td className="px-3 py-2 text-slate-500">{it.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-400">Verbale del {consegnaIniziale.date}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  Nessun verbale di consegna iniziale trovato. Puoi procedere, ma il confronto danni non avrà riferimento.
                </div>
              )}
            </div>
          )}

          {((!isRiconsegna && step === 1) || (isRiconsegna && step === 2)) && (
            <div>
              <div className="mb-4">
                <label className={LABEL}>Data verbale</label>
                <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className={INPUT} />
              </div>
              <h3 className="mb-2 text-sm font-black text-slate-800">Checklist stato immobile</h3>
              <div className="space-y-2">
                {checklist.map((it) => (
                  <div key={it.id} className="grid grid-cols-12 gap-2">
                    <input className="col-span-5 text-xs border border-slate-200 rounded-lg px-3 py-2.5 outline-hidden" placeholder="Voce (es. Stato pareti)" value={it.item} onChange={(e) => updateItem(it.id, { item: e.target.value })} />
                    <select className="col-span-3 text-xs border border-slate-200 rounded-lg px-2 py-2.5 outline-hidden" value={it.status} onChange={(e) => updateItem(it.id, { status: e.target.value })}>
                      <option>Ottimo</option><option>Buono</option><option>Da riparare</option><option>Danneggiato</option>
                    </select>
                    <input className="col-span-3 text-xs border border-slate-200 rounded-lg px-3 py-2.5 outline-hidden" placeholder="Note" value={it.notes || ""} onChange={(e) => updateItem(it.id, { notes: e.target.value })} />
                    <button onClick={() => removeRow(it.id)} className="col-span-1 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center" title="Rimuovi"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
              <button onClick={addRow} className="mt-3 text-xs font-black text-amber-600 hover:text-amber-700">+ Aggiungi voce</button>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Firma Locatore (nome e cognome)</label>
                  <input className={INPUT} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={ownerSigned} onChange={(e) => setOwnerSigned(e.target.checked)} />
                    Il locatore conferma e firma
                  </label>
                  {ownerEmailAvailable && (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <p className="mb-1 text-[10px] font-black uppercase text-slate-500">Verifica via codice email ({ownerProfile!.email})</p>
                      {!ownerOtp.sent ? (
                        <button type="button" disabled={ownerOtp.sending} onClick={sendOwnerOtp} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-indigo-700 disabled:opacity-40">
                          <Mail size={10} /> {ownerOtp.sending ? "Invio…" : "Invia codice"}
                        </button>
                      ) : ownerOtp.verified ? (
                        <p className="flex items-center gap-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 size={11} /> Codice verificato.</p>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input type="text" value={ownerOtp.input} onChange={(e) => ownerOtp.setInput(e.target.value)} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" placeholder="Codice" />
                          <button type="button" onClick={verifyOwnerOtp} className="rounded-lg bg-indigo-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-indigo-700">Verifica</button>
                          <button type="button" onClick={sendOwnerOtp} className="rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-100">Rinvia</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className={LABEL}>Firma Conduttore (nome e cognome)</label>
                  <input className={INPUT} value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={tenantSigned} onChange={(e) => setTenantSigned(e.target.checked)} />
                    Il conduttore conferma e firma
                  </label>
                  {tenantEmailAvailable && (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <p className="mb-1 text-[10px] font-black uppercase text-slate-500">Verifica via codice email ({tenantEmail})</p>
                      {!tenantOtp.sent ? (
                        <button type="button" disabled={tenantOtp.sending} onClick={sendTenantOtp} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-indigo-700 disabled:opacity-40">
                          <Mail size={10} /> {tenantOtp.sending ? "Invio…" : "Invia codice"}
                        </button>
                      ) : tenantOtp.verified ? (
                        <p className="flex items-center gap-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 size={11} /> Codice verificato.</p>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input type="text" value={tenantOtp.input} onChange={(e) => tenantOtp.setInput(e.target.value)} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" placeholder="Codice" />
                          <button type="button" onClick={verifyTenantOtp} className="rounded-lg bg-indigo-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-indigo-700">Verifica</button>
                          <button type="button" onClick={sendTenantOtp} className="rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-100">Rinvia</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {isRiconsegna && step === 3 && (
            <div>
              <h3 className="mb-3 text-sm font-black text-slate-800">Sono stati riscontrati danni rispetto alla Consegna iniziale?</h3>
              <div className="mb-4 flex gap-3">
                <button onClick={() => setHasDamages(false)} className={`flex-1 rounded-xl border px-4 py-3 text-xs font-black ${!hasDamages ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-300 text-slate-600"}`}>No, nessun danno</button>
                <button onClick={() => setHasDamages(true)} className={`flex-1 rounded-xl border px-4 py-3 text-xs font-black ${hasDamages ? "border-red-500 bg-red-50 text-red-700" : "border-slate-300 text-slate-600"}`}>Sì, ci sono danni</button>
              </div>
              {hasDamages && (
                <div className="space-y-4">
                  <div>
                    <label className={LABEL}>Descrizione dei danni</label>
                    <textarea rows={3} className={INPUT} value={damagesDescription} onChange={(e) => setDamagesDescription(e.target.value)} placeholder="Descrivi i danni riscontrati…" />
                  </div>
                  <div>
                    <label className={LABEL}>Stima danni (€) — solo informativa</label>
                    <input type="number" min={0} step="0.01" className={INPUT} value={estimatedDamages || ""} onChange={(e) => setEstimatedDamages(parseFloat(e.target.value) || 0)} />
                  </div>
                  {calcoloDeposito && (
                    <div className={`rounded-xl border px-4 py-3 text-xs ${calcoloDeposito.tone === "debito" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                      <div className="flex justify-between"><span>Deposito cauzionale</span><span className="font-black">{formatEuro(deposito)}</span></div>
                      <div className="flex justify-between"><span>Danni stimati</span><span className="font-black">{formatEuro(estimatedDamages)}</span></div>
                      <div className="mt-2 flex justify-between border-t border-current/20 pt-2 font-black"><span>{calcoloDeposito.label}</span><span>{formatEuro(calcoloDeposito.value)}</span></div>
                      <p className="mt-2 text-[10px] opacity-80">
                        {calcoloDeposito.tone === "restituire"
                          ? "Alla conferma, il deposito viene marcato come restituito per questo importo (compensato con i danni)."
                          : "Il deposito copre solo parzialmente i danni: alla conferma verrà creata una nuova voce in Fast Closing a carico dell'inquilino per la differenza."}
                      </p>
                    </div>
                  )}
                  <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 cursor-pointer">
                    <input type="checkbox" checked={openLegalCase} onChange={(e) => setOpenLegalCase(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-600" />
                    <span>
                      Apri comunque un fascicolo in Area Legale ("Recupero Danni"), collegato a questo contratto e a
                      entrambi i verbali — utile anche quando il deposito basta a coprire i danni, se prevedi che
                      l'inquilino possa contestarli.
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {((!isRiconsegna && step === 2) || (isRiconsegna && step === 4)) && (
            <div>
              <h3 className="mb-3 text-sm font-black text-slate-800">Conferma finale</h3>
              <ul className="space-y-2 text-xs text-slate-600">
                <li>• Data verbale: <b>{reportDate}</b></li>
                <li>• Voci checklist: <b>{checklist.length}</b></li>
                <li>• Firme: <b>{ownerSigned ? ownerName : "locatore mancante"} / {tenantSigned ? tenantName : "conduttore mancante"}</b></li>
                {isRiconsegna && (<li>• Danni: <b className={hasDamages ? "text-red-600" : "text-emerald-600"}>{hasDamages ? `Sì (${formatEuro(estimatedDamages)} stimati)` : "No"}</b></li>)}
              </ul>
              {isRiconsegna && (
                <label className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
                  <input type="checkbox" checked={closeContract} onChange={(e) => setCloseContract(e.target.checked)} className="mt-0.5" />
                  <span>Chiudi il contratto alla data di riconsegna (stato → <b>Terminated</b>) e cancella le rate future non scadute. Consigliato: evita righe contabili "fantasma" (regola 5).</span>
                </label>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <button onClick={step === 1 ? onClose : () => setStep((s) => s - 1)} className="rounded-lg px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-100">{step === 1 ? "Annulla" : "← Torna Indietro"}</button>
          {step < totalSteps ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={((!isRiconsegna && step === 1) || (isRiconsegna && step === 2)) && !firmeOk} className="rounded-lg bg-amber-500 px-5 py-2 text-xs font-black text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40">Continua</button>
          ) : (
            <button onClick={handleConfirm} disabled={saving || !firmeOk || !danniOk} className="rounded-lg bg-amber-500 px-5 py-2 text-xs font-black text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Salvataggio…" : isRiconsegna && hasDamages && openLegalCase ? "Conferma e crea fascicolo legale" : "Conferma e salva verbale"}</button>
          )}
        </div>
      </div>
    </div>
  );
}
