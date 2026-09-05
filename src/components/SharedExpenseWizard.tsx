/**
 * SharedExpenseWizard.tsx
 * ============================================================================
 * Wizard guidato per registrare una spesa comune di un Edificio Autogestito
 * (bolletta acqua, luce scale, giardinaggio, pozzi neri, ecc.), seguendo la
 * sequenza concordata con Massimo (29/08/2026):
 *
 *   1. Documento (opzionale: foto → OCR multi-voce) o inserimento manuale
 *   2. Natura (Ordinaria/Straordinaria) + categoria + a carico di chi (%)
 *   3. Voci della spesa (line items), ciascuna con il proprio criterio di
 *      ripartizione — la struttura ricalca il documento originale
 *   4. Scadenza/e (eventuale rateizzazione)
 *   5. Riepilogo con calcolo delle allocazioni per unità, conferma
 *
 * Nessun segnaposto: passo 5 calcola davvero le allocazioni tramite il
 * motore in lib/sharedExpensesEngine.ts prima del salvataggio.
 * ============================================================================
 */

import React, { useMemo, useState } from "react";
import { X, ChevronRight, ChevronLeft, Camera, Loader2, Plus, Trash2, Check, Sparkles } from "lucide-react";
import type { Property } from "../types";
import type {
  SharedExpenseCategory,
  SharedExpenseLineItem,
  SplitCriteria,
} from "../types-shared-expenses";
import { SHARED_EXPENSE_CATEGORY_LABELS, SPLIT_CRITERIA_LABELS } from "../types-shared-expenses";
import { allocateFullExpense, type PropertyConsumptionInput } from "../lib/sharedExpensesEngine";

export interface SharedExpenseWizardProps {
  isOpen: boolean;
  onClose: () => void;
  buildingId: string;
  properties: Property[]; // le unità dell'edificio
  consumptionByProperty?: PropertyConsumptionInput[]; // consumi acqua stimati nel periodo, se la categoria è acqua
  onSave: (payload: {
    buildingId: string;
    title: string;
    category: SharedExpenseCategory;
    isExtraordinary: boolean;
    chargedToTenantPct: number;
    billingPeriodStart?: string;
    billingPeriodEnd?: string;
    lineItems: SharedExpenseLineItem[];
    allocations: ReturnType<typeof allocateFullExpense>;
    // Scadenza unica (una data per l'intera spesa) oppure rate (array), mai entrambi.
    dueDate?: string;
    installments?: { dueDate: string; amount: number }[];
    sourceDocumentUrl?: string;
    sourceDocumentText?: string;
    status: "Confirmed";
  }) => Promise<void>;
}

let lineItemCounter = 0;
function newLineItemId() {
  lineItemCounter += 1;
  return `li-${Date.now()}-${lineItemCounter}`;
}

export default function SharedExpenseWizard({ isOpen, onClose, buildingId, properties, consumptionByProperty, onSave }: SharedExpenseWizardProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — documento
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [sourceDocumentText, setSourceDocumentText] = useState<string>("");

  // Step 2 — natura
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<SharedExpenseCategory>("acqua_condivisa");
  const [isExtraordinary, setIsExtraordinary] = useState(false);
  const [chargedToTenantPct, setChargedToTenantPct] = useState(0);
  const [billingPeriodStart, setBillingPeriodStart] = useState("");
  const [billingPeriodEnd, setBillingPeriodEnd] = useState("");

  // Step 3 — voci
  const [lineItems, setLineItems] = useState<SharedExpenseLineItem[]>([
    { id: newLineItemId(), description: "", amount: 0, splitCriteria: "millesimi" },
  ]);

  // Step 4 — scadenza unica o rateizzazione (01/09/2026, su richiesta di Massimo): la quota
  // proprietario non è mai tracciata in Fast Closing (paga sempre lui il fornitore,
  // obbligazione solidale), quindi la rateizzazione si applica solo alla quota inquilino —
  // pura flessibilità di recupero verso inquilini meno abbienti, non un vincolo reale sul
  // pagamento effettivo della bolletta.
  const [paymentMode, setPaymentMode] = useState<"unica" | "rate">("unica");
  const [expenseDueDate, setExpenseDueDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [installmentFrequency, setInstallmentFrequency] = useState<"Mensile" | "Bimestrale" | "Trimestrale" | "Quadrimestrale" | "Semestrale" | "Annuale">("Mensile");
  const [installments, setInstallments] = useState<{ dueDate: string; amount: number }[]>([]);

  const FREQUENCY_MONTHS: Record<string, number> = { Mensile: 1, Bimestrale: 2, Trimestrale: 3, Quadrimestrale: 4, Semestrale: 6, Annuale: 12 };

  // Genera N rate in parti uguali, spaziate secondo la frequenza scelta, a partire da oggi
  // ("la prima rata nel primo fast disponibile"). Rimangono poi modificabili una per una,
  // sia nell'importo che nella data, esattamente come le rate del deposito cauzionale.
  const generateInstallments = () => {
    const n = Math.max(1, Number(installmentCount) || 1);
    const perInstallment = Number((totalAmount / n).toFixed(2));
    const months = FREQUENCY_MONTHS[installmentFrequency] || 1;
    const start = new Date();
    const rows: { dueDate: string; amount: number }[] = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i * months);
      // L'ultima rata assorbe l'eventuale arrotondamento residuo, così la somma delle rate
      // torna sempre esatta al totale bolletta (mai un centesimo perso o inventato).
      const amount = i === n - 1 ? Number((totalAmount - perInstallment * (n - 1)).toFixed(2)) : perInstallment;
      rows.push({ dueDate: d.toISOString().split("T")[0], amount });
    }
    setInstallments(rows);
  };

  if (!isOpen) return null;

  const totalAmount = lineItems.reduce((sum, li) => sum + (Number(li.amount) || 0), 0);

  const allocations = useMemo(() => {
    if (step < 5) return [];
    return allocateFullExpense(lineItems, properties, chargedToTenantPct, consumptionByProperty);
  }, [step, lineItems, properties, chargedToTenantPct, consumptionByProperty]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrError(null);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setPhotoPreview(base64);
      setOcrLoading(true);
      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64,
            context: "sharedExpenseBill",
            userPrompt: "Estrai tutte le singole voci di questa bolletta/fattura, con descrizione e importo esatti come nel documento originale.",
          }),
        });
        const json = await res.json();
        if (json?.success && Array.isArray(json?.data?.lineItems) && json.data.lineItems.length > 0) {
          setLineItems(
            json.data.lineItems.map((li: any) => ({
              id: newLineItemId(),
              description: String(li.description || "Voce senza descrizione"),
              amount: Number(li.amount) || 0,
              splitCriteria: "millesimi" as SplitCriteria,
            }))
          );
          if (json.data.title) setTitle(String(json.data.title));
          if (json.data.billingPeriodStart) setBillingPeriodStart(String(json.data.billingPeriodStart));
          if (json.data.billingPeriodEnd) setBillingPeriodEnd(String(json.data.billingPeriodEnd));
          // Scadenza estratta dall'OCR (03/09/2026): pre-compila la data allo step 4, così
          // non serve ridigitarla a mano se già leggibile sul documento originale.
          if (json.data.dueDate) setExpenseDueDate(String(json.data.dueDate));
          if (json.data.rawText) setSourceDocumentText(String(json.data.rawText));
        } else {
          setOcrError("Non sono riuscito a riconoscere le voci della bolletta. Inseriscile manualmente al passo successivo.");
        }
      } catch {
        setOcrError("Errore durante l'analisi del documento. Puoi comunque proseguire manualmente.");
      } finally {
        setOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const updateLineItem = (id: string, patch: Partial<SharedExpenseLineItem>) => {
    setLineItems((items) => items.map((li) => (li.id === id ? { ...li, ...patch } : li)));
  };
  const addLineItem = () => setLineItems((items) => [...items, { id: newLineItemId(), description: "", amount: 0, splitCriteria: "millesimi" }]);
  const removeLineItem = (id: string) => setLineItems((items) => items.filter((li) => li.id !== id));

  const addInstallment = () => setInstallments((arr) => [...arr, { dueDate: "", amount: 0 }]);
  const updateInstallment = (idx: number, patch: Partial<{ dueDate: string; amount: number }>) =>
    setInstallments((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeInstallment = (idx: number) => setInstallments((arr) => arr.filter((_, i) => i !== idx));

  const canGoNext = () => {
    if (step === 2) return title.trim() !== "";
    if (step === 3) return lineItems.length > 0 && lineItems.every((li) => li.description.trim() !== "" && li.amount > 0);
    if (step === 4) {
      if (paymentMode === "unica") return expenseDueDate.trim() !== "";
      // La somma delle rate deve tornare esatta al totale (tolleranza di un centesimo per
      // arrotondamenti) — altrimenti si perderebbe o inventerebbe denaro nei mastrini.
      const sum = installments.reduce((s, i) => s + (Number(i.amount) || 0), 0);
      return installments.length > 0 && installments.every((i) => i.dueDate.trim() !== "" && i.amount > 0) && Math.abs(sum - totalAmount) < 0.01;
    }
    return true;
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onSave({
        buildingId,
        title: title.trim(),
        category,
        isExtraordinary,
        chargedToTenantPct,
        billingPeriodStart: billingPeriodStart || undefined,
        billingPeriodEnd: billingPeriodEnd || undefined,
        lineItems,
        allocations,
        // Scadenza unica: un'unica data, nessuna rata. Rateizzata: solo l'array di rate,
        // già validato (somma = totale) al passo 4 — mai entrambi insieme.
        dueDate: paymentMode === "unica" ? expenseDueDate : undefined,
        installments: paymentMode === "rate" && installments.length > 0 ? installments : undefined,
        sourceDocumentUrl: photoPreview ?? undefined,
        sourceDocumentText: sourceDocumentText || undefined,
        status: "Confirmed",
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const stepTitles = ["Documento", "Natura Spesa", "Voci della Spesa", "Scadenze", "Riepilogo e Conferma"];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-sans font-bold text-base">Nuova Spesa Comune</h3>
            <p className="text-[11px] text-slate-400">Passo {step} di 5 — {stepTitles[step - 1]}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1 min-h-0">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Carica una foto della bolletta/fattura per estrarre automaticamente tutte le voci,
                oppure salta questo passo e inseriscile a mano al passo 3.
              </p>
              <label className="flex items-center justify-center space-x-2 border-2 border-dashed border-slate-200 rounded-xl py-8 cursor-pointer hover:border-indigo-300 transition-colors">
                <Camera size={20} className="text-slate-400" />
                <span className="text-xs text-slate-500">{photoPreview ? "Documento caricato — puoi sostituirlo" : "Carica foto della bolletta/fattura"}</span>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handlePhotoSelect} />
              </label>
              {ocrLoading && (
                <div className="flex items-center space-x-2 text-xs text-indigo-600">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Estrazione delle voci in corso (OCR)...</span>
                </div>
              )}
              {ocrError && <p className="text-xs text-amber-600">{ocrError}</p>}
              {!ocrLoading && lineItems.some((li) => li.description) && (
                <div className="flex items-center space-x-1.5 text-xs text-emerald-600">
                  <Sparkles size={13} />
                  <span>{lineItems.length} voci riconosciute — le verifichi al passo 3.</span>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">Titolo Spesa *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Bolletta Acqua 3° Bimestre 2026" className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">Categoria</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as SharedExpenseCategory)} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 font-bold text-slate-800">
                  {Object.entries(SHARED_EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-2.5">
                <input type="checkbox" id="isExtraordinary" checked={isExtraordinary} onChange={(e) => setIsExtraordinary(e.target.checked)} className="h-4 w-4 text-indigo-600 border-slate-300 rounded" />
                <label htmlFor="isExtraordinary" className="text-xs font-bold text-slate-700">Spesa Straordinaria (altrimenti Ordinaria)</label>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
                  Quota a Carico dell'Inquilino: <span className="font-mono">{chargedToTenantPct}%</span>
                </label>
                <input type="range" min={0} max={100} step={5} value={chargedToTenantPct} onChange={(e) => setChargedToTenantPct(Number(e.target.value))} className="w-full" />
                <p className="text-[10px] text-slate-500 mt-1">0% = interamente a carico del proprietario. 100% = interamente a carico dell'inquilino.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">Periodo Fatturato — Da</label>
                  <input type="date" value={billingPeriodStart} onChange={(e) => setBillingPeriodStart(e.target.value)} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">Periodo Fatturato — A</label>
                  <input type="date" value={billingPeriodEnd} onChange={(e) => setBillingPeriodEnd(e.target.value)} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 font-mono" />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Ogni voce ricalca la bolletta originale. Puoi assegnare un criterio di ripartizione diverso per ciascuna (es. quota fissa a millesimi, quota consumo a contatore).
              </p>
              {lineItems.map((li) => (
                <div key={li.id} className="p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-2">
                  <div className="flex items-start space-x-2">
                    <input
                      value={li.description}
                      onChange={(e) => updateLineItem(li.id, { description: e.target.value })}
                      placeholder="Descrizione voce (es. Quota Fissa, Fognatura, Depurazione)"
                      className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={li.amount || ""}
                      onChange={(e) => updateLineItem(li.id, { amount: Number(e.target.value) })}
                      placeholder="€"
                      className="w-28 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 font-mono text-right"
                    />
                    <button onClick={() => removeLineItem(li.id)} className="p-2 text-slate-400 hover:text-rose-600">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <select
                    value={li.splitCriteria}
                    onChange={(e) => updateLineItem(li.id, { splitCriteria: e.target.value as SplitCriteria })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-hidden focus:border-indigo-500 font-semibold text-slate-700"
                  >
                    {Object.entries(SPLIT_CRITERIA_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              ))}
              <button onClick={addLineItem} className="flex items-center space-x-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700">
                <Plus size={14} />
                <span>Aggiungi Voce</span>
              </button>
              <div className="pt-2 border-t border-slate-100 text-right">
                <span className="text-xs text-slate-500">Totale bolletta: </span>
                <span className="font-mono font-black text-slate-900">€ {totalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Come vuoi registrare la quota a carico dell'inquilino? La quota del proprietario
                non genera mai una voce da recuperare (paga sempre lui il fornitore).
              </p>

              <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPaymentMode("unica")}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${paymentMode === "unica" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                >
                  Scadenza Unica
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode("rate")}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${paymentMode === "rate" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                >
                  Rateizza
                </button>
              </div>

              {paymentMode === "unica" ? (
                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">Scadenza</label>
                  <input
                    type="date"
                    value={expenseDueDate}
                    onChange={(e) => setExpenseDueDate(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 font-mono"
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">Numero Rate</label>
                      <input
                        type="number"
                        min={2}
                        value={installmentCount}
                        onChange={(e) => setInstallmentCount(Number(e.target.value) || 1)}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">Frequenza</label>
                      <select
                        value={installmentFrequency}
                        onChange={(e) => setInstallmentFrequency(e.target.value as typeof installmentFrequency)}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 bg-white"
                      >
                        {Object.keys(FREQUENCY_MONTHS).map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={generateInstallments}
                    className="w-full py-2 text-xs font-bold text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                  >
                    Genera Rate in Parti Uguali
                  </button>

                  <p className="text-[11px] text-slate-500">
                    Puoi correggere ogni rata singolarmente (importo e data) dopo averle generate.
                  </p>
                  {installments.map((inst, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold text-slate-400 w-6">{idx + 1}ª</span>
                      <input type="date" value={inst.dueDate} onChange={(e) => updateInstallment(idx, { dueDate: e.target.value })} className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 font-mono" />
                      <input type="number" step="0.01" value={inst.amount || ""} onChange={(e) => updateInstallment(idx, { amount: Number(e.target.value) })} placeholder="€" className="w-28 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 font-mono text-right" />
                      <button onClick={() => removeInstallment(idx)} className="p-2 text-slate-400 hover:text-rose-600">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  <button onClick={addInstallment} className="flex items-center space-x-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700">
                    <Plus size={14} />
                    <span>Aggiungi Rata</span>
                  </button>
                  {installments.length > 0 && (
                    <p className={`text-[11px] font-semibold ${Math.abs(installments.reduce((s, i) => s + (Number(i.amount) || 0), 0) - totalAmount) < 0.01 ? "text-emerald-600" : "text-rose-600"}`}>
                      Somma rate: € {installments.reduce((s, i) => s + (Number(i.amount) || 0), 0).toFixed(2)} — Totale bolletta: € {totalAmount.toFixed(2)}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 text-xs text-slate-700 space-y-1">
                <p><strong>{title}</strong> — {SHARED_EXPENSE_CATEGORY_LABELS[category]} ({isExtraordinary ? "Straordinaria" : "Ordinaria"})</p>
                <p>Quota inquilino: <span className="font-mono">{chargedToTenantPct}%</span> — Totale: <span className="font-mono font-bold">€ {totalAmount.toFixed(2)}</span></p>
              </div>
              <div className="border border-slate-150 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900 text-slate-100">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Unità</th>
                      <th className="text-left px-3 py-2 font-semibold">Voce</th>
                      <th className="text-right px-3 py-2 font-semibold">Quota Inquilino</th>
                      <th className="text-right px-3 py-2 font-semibold">Quota Proprietario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((a, i) => {
                      const li = lineItems.find((l) => l.id === a.lineItemId);
                      return (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-bold text-slate-800">{a.propertyName}</td>
                          <td className="px-3 py-2 text-slate-500">{li?.description}</td>
                          <td className="px-3 py-2 text-right font-mono">€ {a.amountTenant.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono">€ {a.amountOwner.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-500">
                Confermando, il sistema crea le voci corrispondenti nel Fast Closing (una per
                unità/inquilino coinvolto) e rende disponibile la generazione del rendiconto.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between shrink-0">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            className="flex items-center space-x-1 px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft size={14} />
            <span>{step > 1 ? "Indietro" : "Annulla"}</span>
          </button>
          {step < 5 ? (
            <button
              onClick={() => canGoNext() && setStep(step + 1)}
              disabled={!canGoNext()}
              className="flex items-center space-x-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
            >
              <span>Avanti</span>
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
            >
              <Check size={14} />
              <span>{saving ? "Salvataggio..." : "Conferma e Sincronizza Fast Closing"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
