import React, { useState } from "react";
import { X, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Contract, Property, Tenant, Reminder, LegalCase, FastClosingItem } from "../types";
import { formatLedgerLabel } from "../lib/ledgerLabel";

// CORREZIONE CQ (15/08/2026, seguito) — task #54: procedura guidata reale per l'onboarding
// di contratti già in essere con arretrati pregressi (canoni + spese accessorie), come
// concordato con Massimo e documentato in STATO_E_PROSSIMI_PASSI.md. Sostituisce il modale
// segnaposto usato finora.
//
// Principio guida (regola progetto "un solo flusso per ogni azione"): le voci create qui
// diventano vere righe `fastClosing` con `status: "Overdue"` fin da subito (stesso ciclo di
// vita di qualunque altra voce insoluta) e si agganciano al Sollecito del debitore con LO
// STESSO schema già usato da `FastClosingView.tsx` → `handleConfirmCloseFastClosing` (un
// solo passaggio raggruppato, non un loop del toggle "Segna Insoluto" singolo — quel loop
// soffrirebbe dello stesso bug già documentato e corretto in passato: lo stato React
// `reminders` letto da ogni chiamata non si aggiorna a metà di un ciclo sincrono, quindi un
// loop del toggle singolo creerebbe un Sollecito duplicato per ogni voce invece di uno solo
// per il debitore). Qui invece si crea prima ogni riga (tutte con lo stesso debitore, quindi
// un solo gruppo), poi si aggancia il gruppo intero al Sollecito con UNA sola lettura/scrittura.

function todayLocalISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function formatEuro(n: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);
}
function lastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}
/** Data "YYYY-MM-DD" per N mesi fa, mantenendo lo stesso giorno del mese del contratto
 *  (o di oggi se il contratto non ha una data di riferimento), con clamp a fine mese. */
function monthsAgoDate(monthsAgo: number, referenceDay: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const clampedDay = Math.min(referenceDay, lastDayOfMonth(d.getFullYear(), d.getMonth()));
  d.setDate(clampedDay);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function newRowId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

interface RentRow {
  id: string;
  dueDate: string;
  amountDue: number;
  alreadyPaid: number;
}
type ExpenseCategory = "Condominio" | "Manutenzione" | "Registrazione" | "Altro";
interface ExpenseRow {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  dueDate: string;
}

const LABEL = "block text-[10px] font-black uppercase text-slate-600 mb-1";
const INPUT = "w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2 outline-hidden";

interface Props {
  contract: Contract;
  property?: Property;
  tenant?: Tenant;
  reminders?: Reminder[];
  legalCases?: LegalCase[];
  user: { uid: string } | null;
  showSuccess: (msg: string) => void;
  onClose: () => void;
  onAddClosingItem: (item: Omit<FastClosingItem, "id" | "userId" | "createdAt">, silent?: boolean) => Promise<string | void>;
  onAddReminder?: (data: any) => Promise<void>;
  onUpdateReminderStatus?: (id: string, status: string, notes?: string, extraFields?: any) => Promise<void>;
  onSaved: () => void;
}

export default function PreExistingContractWizard({
  contract, property, tenant, reminders = [], legalCases = [], user,
  showSuccess, onClose, onAddClosingItem, onAddReminder, onUpdateReminderStatus, onSaved,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const referenceDay = contract.startDate ? new Date(contract.startDate).getDate() : new Date().getDate();

  const [rentRows, setRentRows] = useState<RentRow[]>([]);
  const [monthsToGenerate, setMonthsToGenerate] = useState<number>(3);
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([]);
  const [newExpenseCategory, setNewExpenseCategory] = useState<ExpenseCategory>("Condominio");

  const debtorName = tenant?.name || contract.tenantName || "Inquilino";
  const propertyAddress = property?.address;

  const residuo = (r: RentRow) => Math.max(0, (Number(r.amountDue) || 0) - (Number(r.alreadyPaid) || 0));
  const totalRent = rentRows.reduce((sum, r) => sum + residuo(r), 0);
  const totalExpenses = expenseRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const grandTotal = totalRent + totalExpenses;

  const generateMonths = () => {
    const n = Math.max(1, Math.min(60, Math.floor(monthsToGenerate) || 0));
    const rows: RentRow[] = [];
    for (let i = n; i >= 1; i--) {
      rows.push({
        id: newRowId("rent"),
        dueDate: monthsAgoDate(i, referenceDay),
        amountDue: contract.rentAmount || 0,
        alreadyPaid: 0,
      });
    }
    setRentRows((prev) => [...prev, ...rows]);
  };
  const addRentRowManual = () => {
    setRentRows((prev) => [...prev, { id: newRowId("rent"), dueDate: todayLocalISO(), amountDue: contract.rentAmount || 0, alreadyPaid: 0 }]);
  };
  const updateRentRow = (id: string, patch: Partial<RentRow>) =>
    setRentRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRentRow = (id: string) => setRentRows((prev) => prev.filter((r) => r.id !== id));

  const addExpenseRow = () => {
    setExpenseRows((prev) => [...prev, { id: newRowId("exp"), category: newExpenseCategory, description: "", amount: 0, dueDate: todayLocalISO() }]);
  };
  const updateExpenseRow = (id: string, patch: Partial<ExpenseRow>) =>
    setExpenseRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeExpenseRow = (id: string) => setExpenseRows((prev) => prev.filter((r) => r.id !== id));

  const expenseSourceMap: Record<ExpenseCategory, FastClosingItem["source"]> = {
    Condominio: "condominium",
    Manutenzione: "maintenance",
    Registrazione: "manual",
    Altro: "manual",
  };

  const buildRentItem = (r: RentRow): Omit<FastClosingItem, "id" | "userId" | "createdAt"> => {
    const amt = residuo(r);
    return {
      propertyId: contract.propertyId,
      title: formatLedgerLabel({ debtorName, isCompany: tenant?.isCompany, propertyAddress, tipologia: "Affitto", dateForPeriod: r.dueDate }),
      description:
        `Canone arretrato inserito manualmente (Onboarding Contratto Già in Essere).` +
        (r.alreadyPaid > 0 ? ` Acconto già incassato: ${formatEuro(r.alreadyPaid)} su ${formatEuro(r.amountDue)} dovuti — residuo ${formatEuro(amt)}.` : ""),
      amount: amt,
      dueDate: r.dueDate,
      source: "contract",
      sourceId: contract.id,
      status: "Overdue",
      debtorId: contract.tenantId,
      debtorType: "tenant",
      isManualBacklogEntry: true,
    };
  };
  const buildExpenseItem = (r: ExpenseRow): Omit<FastClosingItem, "id" | "userId" | "createdAt"> => ({
    propertyId: contract.propertyId,
    title: formatLedgerLabel({ debtorName, isCompany: tenant?.isCompany, propertyAddress, tipologia: r.category, dateForPeriod: r.dueDate }),
    description: r.description.trim()
      ? `${r.description.trim()} (arretrato pregresso inserito manualmente — Onboarding Contratto Già in Essere).`
      : `Spesa accessoria arretrata inserita manualmente (Onboarding Contratto Già in Essere).`,
    amount: Number(r.amount) || 0,
    dueDate: r.dueDate,
    source: expenseSourceMap[r.category],
    sourceId: `backlog-${contract.id}-${r.category.toLowerCase()}-${r.id}`,
    status: "Overdue",
    debtorId: contract.tenantId,
    debtorType: "tenant",
    isManualBacklogEntry: true,
  });

  const canConfirm = grandTotal > 0 && !submitting;

  const handleConfirm = async () => {
    if (!user || !canConfirm) return;
    setSubmitting(true);
    try {
      const itemsData = [
        ...rentRows.filter((r) => residuo(r) > 0).map(buildRentItem),
        ...expenseRows.filter((r) => (Number(r.amount) || 0) > 0).map(buildExpenseItem),
      ];
      if (itemsData.length === 0) {
        alert("Nessuna voce da inserire.");
        return;
      }

      const createdIds: string[] = [];
      let createdTotal = 0;
      for (const itemData of itemsData) {
        const id = await onAddClosingItem(itemData, true);
        if (id) {
          createdIds.push(id);
          createdTotal += itemData.amount;
        }
      }

      if (createdIds.length === 0) {
        showSuccess("Nessuna voce è stata salvata correttamente: riprova.");
        return;
      }

      // Stesso identico principio del pulsante "Insoluto"/della chiusura Fast Closing:
      // i proprietari non generano mai Solleciti, e chi ha già una pratica legale attiva
      // affidata a un avvocato non riparte da zero con i Solleciti.
      const activeLegalCase = legalCases.find((lc) => lc.tenantName === debtorName && lc.status !== "Closed" && !!lc.assignedLawyerId);
      if (activeLegalCase) {
        showSuccess(
          `${createdIds.length} voci arretrate inserite (${formatEuro(createdTotal)}). "${debtorName}" ha già una pratica affidata all'avvocato: usa il tasto dedicato in Fast Closing per inviargliela, senza rifare i Solleciti.`
        );
      } else if (onAddReminder && onUpdateReminderStatus) {
        const existingActiveReminder = reminders.find(
          (r) => r.tenantName === debtorName && r.status !== "Closed" && (r.status as any) !== "Cancelled" && r.status !== "Paid"
        );
        const itemsListText = itemsData.map((it) => `${it.title} (${formatEuro(it.amount)})`).join(", ");
        if (existingActiveReminder) {
          const updatedIds = Array.from(new Set([...(existingActiveReminder.associatedItemsIds || []), ...createdIds]));
          const updatedAmount = (existingActiveReminder.amount || 0) + createdTotal;
          const updatedReason = existingActiveReminder.reason
            ? `${existingActiveReminder.reason} + Arretrati pregressi: ${itemsListText}`
            : `Sollecito automatico: ${itemsListText}`;
          await onUpdateReminderStatus(existingActiveReminder.id, existingActiveReminder.status, existingActiveReminder.followUpNotes, {
            associatedItemsIds: updatedIds,
            amount: updatedAmount,
            reason: updatedReason,
          });
        } else {
          await onAddReminder({
            tenantId: contract.tenantId,
            tenantName: debtorName,
            debtorType: "tenant",
            amount: createdTotal,
            reason: `Sollecito automatico Arretrati Pregressi: ${itemsListText}`,
            dueDate: itemsData[0]?.dueDate || todayLocalISO(),
            status: "Pending",
            isSequence: true,
            step: 1,
            associatedItemsIds: createdIds,
            propertyId: contract.propertyId,
            notes: `Sollecito generato dalla procedura guidata di onboarding "Contratto Già in Essere" in data ${new Date().toLocaleDateString("it-IT")}.`,
          });
        }
        showSuccess(`Inserite ${createdIds.length} voci arretrate per un totale di ${formatEuro(createdTotal)}, agganciate al Sollecito di ${debtorName}.`);
      } else {
        showSuccess(`Inserite ${createdIds.length} voci arretrate per un totale di ${formatEuro(createdTotal)} in Fast Closing.`);
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error("Errore inserimento arretrati pregressi:", error);
      alert("Errore durante il salvataggio degli arretrati. Riprova.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">Onboarding Contratto Già in Essere — Arretrati Pregressi</h2>
            <p className="text-xs text-slate-500">{contract.propertyName || "Immobile"} · {debtorName} · Step {step}/3</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="px-6 py-5">
          {step === 1 && (
            <div>
              <h3 className="mb-1 text-sm font-black text-slate-800">1. Canoni Arretrati</h3>
              <p className="mb-4 text-xs text-slate-500">
                Inserisci i mesi di canone non ancora versati prima dell'inserimento a sistema. Ogni riga usa la
                vera data di scadenza storica (mai la data di oggi) e supporta un acconto già incassato in parte.
              </p>

              <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div>
                  <label className={LABEL}>Genera N mesi consecutivi</label>
                  <input type="number" min={1} max={60} value={monthsToGenerate} onChange={(e) => setMonthsToGenerate(parseInt(e.target.value) || 1)} className="w-24 text-xs border border-slate-200 rounded-lg px-3 py-2" />
                </div>
                <button onClick={generateMonths} className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-black text-white hover:bg-amber-600">Genera</button>
                <button onClick={addRentRowManual} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"><Plus size={12} /> Riga singola</button>
                <p className="text-[10px] text-slate-500">Canone mensile di riferimento: <b>{formatEuro(contract.rentAmount || 0)}</b> (modificabile per riga).</p>
              </div>

              {rentRows.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">Nessun canone arretrato inserito. Se non ci sono arretrati sui canoni, passa pure oltre.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800 text-left text-[10px] font-black uppercase text-slate-100">
                      <tr><th className="px-3 py-2">Scadenza</th><th className="px-3 py-2">Dovuto</th><th className="px-3 py-2">Acconto Incassato</th><th className="px-3 py-2 text-right">Residuo</th><th className="px-3 py-2"></th></tr>
                    </thead>
                    <tbody>
                      {rentRows.map((r) => (
                        <tr key={r.id} className="border-t border-slate-100">
                          <td className="px-3 py-2"><input type="date" value={r.dueDate} onChange={(e) => updateRentRow(r.id, { dueDate: e.target.value })} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5" /></td>
                          <td className="px-3 py-2"><input type="number" min={0} step="0.01" value={r.amountDue || ""} onChange={(e) => updateRentRow(r.id, { amountDue: parseFloat(e.target.value) || 0 })} className="w-24 text-xs border border-slate-200 rounded-lg px-2 py-1.5" /></td>
                          <td className="px-3 py-2"><input type="number" min={0} step="0.01" value={r.alreadyPaid || ""} onChange={(e) => updateRentRow(r.id, { alreadyPaid: parseFloat(e.target.value) || 0 })} className="w-24 text-xs border border-slate-200 rounded-lg px-2 py-1.5" /></td>
                          <td className="px-3 py-2 text-right font-mono font-black text-rose-700">{formatEuro(residuo(r))}</td>
                          <td className="px-3 py-2"><button onClick={() => removeRentRow(r.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={13} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-slate-50 font-black">
                        <td colSpan={3} className="px-3 py-2 text-right">Totale Canoni Arretrati</td>
                        <td className="px-3 py-2 text-right font-mono text-rose-800">{formatEuro(totalRent)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="mb-1 text-sm font-black text-slate-800">2. Spese Accessorie Arretrate</h3>
              <p className="mb-4 text-xs text-slate-500">Condominio, manutenzioni, registrazione o altro — inserimento libero per importo, senza struttura mese-per-mese.</p>

              <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div>
                  <label className={LABEL}>Tipologia nuova riga</label>
                  <select value={newExpenseCategory} onChange={(e) => setNewExpenseCategory(e.target.value as ExpenseCategory)} className="text-xs border border-slate-200 rounded-lg px-3 py-2">
                    <option>Condominio</option><option>Manutenzione</option><option>Registrazione</option><option>Altro</option>
                  </select>
                </div>
                <button onClick={addExpenseRow} className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-4 py-2 text-xs font-black text-white hover:bg-amber-600"><Plus size={12} /> Aggiungi riga</button>
              </div>

              {expenseRows.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">Nessuna spesa accessoria arretrata inserita. Se non ce ne sono, passa pure oltre.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800 text-left text-[10px] font-black uppercase text-slate-100">
                      <tr><th className="px-3 py-2">Tipologia</th><th className="px-3 py-2">Descrizione</th><th className="px-3 py-2">Scadenza</th><th className="px-3 py-2 text-right">Importo</th><th className="px-3 py-2"></th></tr>
                    </thead>
                    <tbody>
                      {expenseRows.map((r) => (
                        <tr key={r.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            <select value={r.category} onChange={(e) => updateExpenseRow(r.id, { category: e.target.value as ExpenseCategory })} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
                              <option>Condominio</option><option>Manutenzione</option><option>Registrazione</option><option>Altro</option>
                            </select>
                          </td>
                          <td className="px-3 py-2"><input value={r.description} onChange={(e) => updateExpenseRow(r.id, { description: e.target.value })} placeholder="Descrizione libera" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5" /></td>
                          <td className="px-3 py-2"><input type="date" value={r.dueDate} onChange={(e) => updateExpenseRow(r.id, { dueDate: e.target.value })} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5" /></td>
                          <td className="px-3 py-2"><input type="number" min={0} step="0.01" value={r.amount || ""} onChange={(e) => updateExpenseRow(r.id, { amount: parseFloat(e.target.value) || 0 })} className="w-24 text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-right" /></td>
                          <td className="px-3 py-2"><button onClick={() => removeExpenseRow(r.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={13} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-slate-50 font-black">
                        <td colSpan={3} className="px-3 py-2 text-right">Totale Spese Accessorie Arretrate</td>
                        <td className="px-3 py-2 text-right font-mono text-rose-800">{formatEuro(totalExpenses)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="mb-3 text-sm font-black text-slate-800">3. Riepilogo e Conferma</h3>
              <div className="mb-4 space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
                <div className="flex justify-between"><span>Canoni arretrati ({rentRows.filter((r) => residuo(r) > 0).length} voci)</span><span className="font-mono font-black">{formatEuro(totalRent)}</span></div>
                <div className="flex justify-between"><span>Spese accessorie arretrate ({expenseRows.filter((r) => (Number(r.amount) || 0) > 0).length} voci)</span><span className="font-mono font-black">{formatEuro(totalExpenses)}</span></div>
                <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-black"><span>Totale complessivo</span><span className="font-mono text-rose-800">{formatEuro(grandTotal)}</span></div>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                <span>
                  Confermando, tutte le voci sopra entrano subito in Fast Closing con lo stato "Insoluto" e con la
                  vera data di scadenza storica, contrassegnate con il badge "Inserimento Manuale". Confluiscono
                  immediatamente nel Sollecito di <b>{debtorName}</b> (o si aggiungono a quello già attivo, se esiste
                  — mai un secondo Sollecito per lo stesso debitore).
                </span>
              </div>

              {grandTotal === 0 && (
                <p className="mt-3 text-xs text-slate-400">Nessuna voce con importo maggiore di zero: torna indietro per aggiungerne almeno una, oppure chiudi se non ci sono arretrati reali da registrare.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <button onClick={step === 1 ? onClose : () => setStep((s) => (s - 1) as 1 | 2)} className="rounded-lg px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-100">{step === 1 ? "Annulla" : "← Indietro"}</button>
          {step < 3 ? (
            <button onClick={() => setStep((s) => (s + 1) as 2 | 3)} className="rounded-lg bg-amber-500 px-5 py-2 text-xs font-black text-white hover:bg-amber-600">Continua →</button>
          ) : (
            <button onClick={handleConfirm} disabled={!canConfirm} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-5 py-2 text-xs font-black text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-40">
              <CheckCircle2 size={14} /> {submitting ? "Salvataggio…" : "Conferma e Registra Arretrati"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
