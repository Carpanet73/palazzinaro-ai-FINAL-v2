/**
 * SelfManagedBuildingsView.tsx
 * ============================================================================
 * Sezione autonoma: "Spese Comuni Senza Amministratore".
 * Segue lo stesso schema grafico/strutturale del resto dell'app (header
 * scuro, card bianche bordo sottile, badge a pallino, IBM Plex Mono per i
 * numeri, Source Serif per i titoli h2) — nessuno stile nuovo introdotto.
 *
 * Punti di integrazione con il resto dell'app (minimi, per non duplicare
 * flussi già esistenti):
 *  - Le allocazioni confermate generano voci reali in Fast Closing
 *    (source: "condominium") tramite handleAddClosingItem, già esistente.
 *  - Il rendiconto si invia con lo stesso motore EmailJS già in uso per i
 *    Solleciti (owner.emailServiceId / emailTemplateId / emailPublicKey).
 * ============================================================================
 */

import React, { useMemo, useState } from "react";
import { Plus, Building2, Droplet, FileText, Send, Download, Users, ChevronRight, X, MessageCircle, Printer } from "lucide-react";
import emailjs from "@emailjs/browser";
import type { Property, Tenant, OwnerProfile, Owner } from "../types";
import type {
  SelfManagedBuilding,
  MeterReading,
  SharedExpense,
} from "../types-shared-expenses";
import { SHARED_EXPENSE_CATEGORY_LABELS } from "../types-shared-expenses";
import MeterReadingWizard from "./MeterReadingWizard";
import SharedExpenseWizard from "./SharedExpenseWizard";
import { calculateDailyAverageConsumption, projectConsumptionOnBillingPeriod, type PropertyConsumptionInput } from "../lib/sharedExpensesEngine";
import { generateRendicontoPdf, generateRendicontoGeneralePdf, generateBachecaPdf } from "../lib/rendicontoPdf";

export interface SelfManagedBuildingsViewProps {
  buildings: SelfManagedBuilding[];
  properties: Property[]; // tutte le proprietà dell'utente (si filtrano per edificio)
  meterReadings: MeterReading[]; // tutte le letture dell'utente
  sharedExpenses: SharedExpense[]; // tutte le spese comuni dell'utente
  tenants: Tenant[];
  ownerProfile: OwnerProfile;
  // CORREZIONE (03/09/2026, su segnalazione di Massimo): serve l'anagrafica REALE dei
  // proprietari (collezione "owners", collegata a ogni immobile via property.ownerId) —
  // ownerProfile da solo è il profilo personale dell'utente loggato, sempre lo stesso per
  // ogni edificio. Se Massimo gestisce immobili di proprietari diversi da sé stesso (es.
  // "Grazia Maria Benelli" nella bolletta), serve pescare nome e IBAN da QUESTO elenco.
  owners: Owner[];
  onCreateBuilding: (data: { name: string; address?: string; notes?: string; propertyIds: string[] }) => Promise<void>;
  onAddMeterReading: (data: Omit<MeterReading, "id" | "userId" | "createdAt">) => Promise<void>;
  onAddSharedExpense: (data: any) => Promise<void>; // vedi SharedExpenseWizard onSave — sincronizza anche Fast Closing lato App.tsx
  onMarkRendicontoSent: (expenseId: string, sentTo: string[]) => Promise<void>;
  onUpdateResidentsCount: (propertyId: string, residentsCount: number) => Promise<void>;
}

export default function SelfManagedBuildingsView({
  buildings,
  properties,
  meterReadings,
  sharedExpenses,
  tenants,
  ownerProfile,
  owners,
  onCreateBuilding,
  onAddMeterReading,
  onAddSharedExpense,
  onMarkRendicontoSent,
  onUpdateResidentsCount,
}: SelfManagedBuildingsViewProps) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(buildings[0]?.id ?? null);
  const [showBuildingForm, setShowBuildingForm] = useState(false);
  const [showExpenseWizard, setShowExpenseWizard] = useState(false);
  const [meterWizardProperty, setMeterWizardProperty] = useState<Property | null>(null);
  const [sendingRendicontoId, setSendingRendicontoId] = useState<string | null>(null);
  // Scelta esplicita del proprietario da mostrare nelle stampe (03/09/2026, su richiesta
  // di Massimo): la risoluzione automatica tramite property.ownerId resta il default, ma
  // se un edificio ha unità di proprietari diversi (o comproprietà), la scelta finale
  // spetta sempre a Massimo — mai imposta in automatico senza possibilità di cambiarla.
  const [selectedPrintOwnerId, setSelectedPrintOwnerId] = useState<string | "auto">("auto");
  // Riscossione a mano da parte di un condomino incaricato (03/09/2026, su richiesta di
  // Massimo): alternativa al bonifico IBAN — cambia solo il testo di pagamento nel PDF
  // particolare, mai la riga "Proprietario" (che resta sempre quella reale).
  const [collectionMode, setCollectionMode] = useState<"iban" | "hand">("iban");
  const [selectedCollectorTenantId, setSelectedCollectorTenantId] = useState<string>("");

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId) ?? null;
  const buildingProperties = useMemo(
    () => (selectedBuilding ? properties.filter((p) => selectedBuilding.propertyIds.includes(p.id)) : []),
    [selectedBuilding, properties]
  );
  // Elenco dei proprietari realmente collegati a una o più unità di questo edificio
  // (deduplicati) — sono le uniche scelte sensate da offrire nel selettore.
  const buildingOwnerOptions = useMemo(() => {
    const ids = new Set(buildingProperties.map((p) => p.ownerId).filter((id): id is string => !!id));
    return owners.filter((o) => ids.has(o.id));
  }, [buildingProperties, owners]);
  // Inquilini disponibili come possibili incaricati alla raccolta (solo quelli delle
  // unità di questo edificio — mai un inquilino estraneo all'edificio).
  const buildingTenantOptions = useMemo(
    () => tenants.filter((t) => buildingProperties.some((p) => p.id === t.propertyId)),
    [buildingProperties, tenants]
  );
  // Helper: Firestore Timestamp, Date o stringa — mai un confronto diretto con
  // localeCompare, che esiste solo sulle stringhe (causa reale del crash del 03/09/2026:
  // createdAt è un Timestamp, non una stringa, essendo scritto con serverTimestamp()).
  const toComparableMillis = (val: any): number => {
    if (val && typeof val === "object" && "seconds" in val) return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
    if (val instanceof Date) return val.getTime();
    if (typeof val === "string") { const p = Date.parse(val); return isNaN(p) ? 0 : p; }
    return 0;
  };

  const buildingExpenses = useMemo(
    () => sharedExpenses.filter((e) => e.buildingId === selectedBuildingId).sort((a, b) => toComparableMillis(b.createdAt) - toComparableMillis(a.createdAt)),
    [sharedExpenses, selectedBuildingId]
  );

  const latestReadingByProperty = (propertyId: string): MeterReading | null => {
    const readings = meterReadings
      .filter((r) => r.propertyId === propertyId && r.meterType === "acqua")
      .sort((a, b) => b.readingDate.localeCompare(a.readingDate));
    return readings[0] ?? null;
  };
  const previousReadingBefore = (propertyId: string, before: MeterReading | null): MeterReading | null => {
    const readings = meterReadings
      .filter((r) => r.propertyId === propertyId && r.meterType === "acqua" && (!before || r.readingDate < before.readingDate))
      .sort((a, b) => b.readingDate.localeCompare(a.readingDate));
    return readings[0] ?? null;
  };

  // Stima dei consumi per proprietà nel periodo fatturato più recente, da passare al wizard spesa
  // quando la categoria è acqua (criterio "consumption")
  const consumptionByProperty: PropertyConsumptionInput[] = useMemo(() => {
    if (!selectedBuilding) return [];
    return buildingProperties.map((p) => {
      const latest = latestReadingByProperty(p.id);
      const previous = latest ? previousReadingBefore(p.id, latest) : null;
      if (!latest || !previous) return { propertyId: p.id, consumptionInPeriod: 0 };
      const dailyAvg = calculateDailyAverageConsumption(previous, latest);
      if (dailyAvg === null) return { propertyId: p.id, consumptionInPeriod: 0 };
      // Se non è impostato un periodo di fatturazione specifico, usa il periodo tra le due letture
      const consumption = projectConsumptionOnBillingPeriod(dailyAvg, previous.readingDate, latest.readingDate);
      return { propertyId: p.id, consumptionInPeriod: consumption };
    });
  }, [selectedBuilding, buildingProperties, meterReadings]);

  // CORREZIONE (03/09/2026, su segnalazione di Massimo): risolve il proprietario REALE
  // dell'unità (tramite property.ownerId → anagrafica "owners"), con fallback al profilo
  // personale dell'utente loggato solo se quel campo non è stato compilato — mai il
  // contrario, altrimenti un edificio di un proprietario diverso da te mostrerebbe
  // comunque il tuo nome e il tuo IBAN nei rendiconti.
  const resolveOwnerForProperty = (property?: Property): { name: string; iban?: string } => {
    // Scelta manuale di Massimo: ha sempre priorità, per tutte le unità dell'edificio.
    if (selectedPrintOwnerId !== "auto") {
      const chosen = owners.find((o) => o.id === selectedPrintOwnerId);
      if (chosen) return { name: chosen.name, iban: chosen.iban };
    }
    if (property?.ownerId) {
      const real = owners.find((o) => o.id === property.ownerId);
      if (real) return { name: real.name, iban: real.iban };
    }
    if (property?.owner) return { name: property.owner, iban: ownerProfile.iban };
    return { name: ownerProfile.name, iban: ownerProfile.iban };
  };

  // Riscossore effettivo per la stampa particolare: bonifico al proprietario (default) o
  // condomino incaricato della raccolta a mano (03/09/2026, su richiesta di Massimo).
  const resolveCollector = (): { mode: "iban" } | { mode: "hand"; name: string; phone?: string } => {
    if (collectionMode === "hand" && selectedCollectorTenantId) {
      const t = tenants.find((tt) => tt.id === selectedCollectorTenantId);
      if (t) return { mode: "hand", name: t.name, phone: t.phone };
    }
    return { mode: "iban" };
  };

  // Stampa Riepilogo Generale (03/09/2026, su richiesta di Massimo): un solo PDF con la
  // ripartizione su TUTTE le unità dell'edificio, per uso interno o invio cumulativo —
  // distinto dal rendiconto per singola unità già esistente (handleSendRendiconto sotto).
  const handlePrintGenerale = (expense: SharedExpense) => {
    const tenantNamesByPropertyId: Record<string, string> = {};
    buildingProperties.forEach((p) => {
      const t = tenants.find((tt) => tt.propertyId === p.id);
      tenantNamesByPropertyId[p.id] = t?.name ?? "Non Specificato";
    });
    // Un edificio autogestito ha tipicamente un solo proprietario: si usa quello della
    // prima unità come intestatario del documento cumulativo.
    const owner = resolveOwnerForProperty(buildingProperties[0]);
    const doc = generateRendicontoGeneralePdf(expense, buildingProperties, tenantNamesByPropertyId, owner, selectedBuilding?.name ?? "");
    doc.save(`riepilogo-generale-${expense.title.replace(/\s+/g, "-")}.pdf`);
  };

  // Stampa da Affiggere (03/09/2026, su richiesta di Massimo): un foglio essenziale con
  // "Unità — Inquilino — Importo", pensato per essere appeso al portone d'ingresso.
  const handlePrintBacheca = (expense: SharedExpense) => {
    const tenantNamesByPropertyId: Record<string, string> = {};
    buildingProperties.forEach((p) => {
      const t = tenants.find((tt) => tt.propertyId === p.id);
      tenantNamesByPropertyId[p.id] = t?.name ?? "Non Specificato";
    });
    const doc = generateBachecaPdf(expense, buildingProperties, tenantNamesByPropertyId, selectedBuilding?.name ?? "");
    doc.save(`avviso-bacheca-${expense.title.replace(/\s+/g, "-")}.pdf`);
  };

  // Invio WhatsApp per singolo inquilino (03/09/2026): stesso schema già in uso nei
  // Solleciti (wa.me con testo precompilato) — un messaggio a testo con la quota dovuta,
  // il PDF resta comunque scaricato localmente da allegare a mano se serve.
  const handleSendWhatsApp = (expense: SharedExpense, propertyId: string) => {
    const property = buildingProperties.find((p) => p.id === propertyId);
    const tenant = tenants.find((t) => t.propertyId === propertyId);
    if (!tenant?.phone || !tenant.phone.trim()) {
      alert(`"${tenant?.name ?? "Questo inquilino"}" non ha un numero di telefono salvato in anagrafica. Impossibile inviare tramite WhatsApp.`);
      return;
    }
    const allocs = expense.allocations.filter((a) => a.propertyId === propertyId);
    const amount = allocs.reduce((s, a) => s + a.amountTenant, 0);
    if (amount <= 0) return;
    const message =
      `Gentile ${tenant.name},\n\n` +
      `Le comunichiamo la Sua quota per la spesa comune "${expense.title}" (${property?.name ?? ""}):\n` +
      `Importo dovuto: € ${amount.toFixed(2)}\n\n` +
      `Messaggio inviato mediante procedura automatizzata del sistema, in nome e per conto del proprietario, con supporto dell'intelligenza artificiale.`;
    const phoneClean = tenant.phone.replace(/[^0-9+]/g, "");
    window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleSendRendiconto = async (expense: SharedExpense) => {
    setSendingRendicontoId(expense.id);
    try {
      const sentTo: string[] = [];
      for (const alloc of groupAllocationsByProperty(expense)) {
        const property = properties.find((p) => p.id === alloc.propertyId);
        if (!property) continue;
        const tenant = tenants.find((t) => t.propertyId === property.id);
        const doc = generateRendicontoPdf(expense, property, tenant?.name ?? "Non Specificato", resolveOwnerForProperty(property), selectedBuilding?.name ?? "", resolveCollector());

        // Scarico sempre il PDF (disponibile comunque, anche senza invio email)
        doc.save(`rendiconto-${expense.title.replace(/\s+/g, "-")}-${property.name.replace(/\s+/g, "-")}.pdf`);

        // Invio email reale se il proprietario ha configurato EmailJS e il tenant ha un'email
        if (tenant?.email && ownerProfile.emailServiceId && ownerProfile.emailTemplateId && ownerProfile.emailPublicKey) {
          await emailjs.send(
            ownerProfile.emailServiceId,
            ownerProfile.emailTemplateId,
            {
              to_email: tenant.email,
              to_name: tenant.name,
              subject: `Rendiconto Spese Comuni — ${expense.title}`,
              message: `Le inviamo il rendiconto delle spese comuni "${expense.title}" per l'unità ${property.name}. Messaggio inviato mediante procedura automatizzata del sistema, in nome e per conto del proprietario, con supporto dell'intelligenza artificiale.`,
            },
            ownerProfile.emailPublicKey
          );
          sentTo.push(tenant.email);
        }
      }
      if (sentTo.length > 0) {
        await onMarkRendicontoSent(expense.id, sentTo);
      }
      alert(sentTo.length > 0 ? `Rendiconto scaricato e inviato via email a: ${sentTo.join(", ")}` : "Rendiconto scaricato (nessuna email inviata: configura EmailJS in Impostazioni e l'email dell'inquilino per l'invio automatico).");
    } catch (err) {
      console.error("Errore invio rendiconto", err);
      alert("Il PDF è stato scaricato, ma l'invio email non è riuscito. Verifica la configurazione EmailJS in Impostazioni.");
    } finally {
      setSendingRendicontoId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-slate-900">Spese Comuni Senza Amministratore</h2>
          <p className="text-xs text-slate-500 mt-1">Edifici interamente di un solo proprietario, senza condominio costituito.</p>
        </div>
        <button
          onClick={() => setShowBuildingForm(true)}
          className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
        >
          <Plus size={14} />
          <span>Nuovo Edificio</span>
        </button>
      </div>

      {buildings.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          📢 Nessun edificio autogestito registrato. Crea il primo con "Nuovo Edificio".
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Colonna edifici */}
          <div className="space-y-2">
            {buildings.map((b) => (
              <button
                key={b.id}
                onClick={() => { setSelectedBuildingId(b.id); setSelectedPrintOwnerId("auto"); setCollectionMode("iban"); setSelectedCollectorTenantId(""); }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selectedBuildingId === b.id ? "border-indigo-300 bg-indigo-50/50" : "border-slate-150 bg-white hover:border-slate-250"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Building2 size={15} className="text-indigo-600 shrink-0" />
                  <span className="font-bold text-xs text-slate-800">{b.name}</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{b.propertyIds.length} unità</p>
              </button>
            ))}
          </div>

          {/* Dettaglio edificio selezionato */}
          <div className="lg:col-span-3 space-y-5">
            {selectedBuilding && (
              <>
                {/* Unità e contatori */}
                <div className="bg-white rounded-2xl border-2 border-slate-100 p-5 shadow-sm">
                  <h3 className="font-sans font-bold text-slate-900 text-sm flex items-center space-x-1.5 pb-3">
                    <Droplet size={15} className="text-indigo-500" />
                    <span>Unità e Contatori Acqua</span>
                  </h3>
                  <div className="space-y-2">
                    {buildingProperties.map((p) => {
                      const latest = latestReadingByProperty(p.id);
                      // Su richiesta di Massimo (01/09/2026): il nome dell'inquilino deve
                      // comparire ben visibile nel badge dell'unità, non solo l'indirizzo.
                      const occupant = tenants.find((t) => t.propertyId === p.id);
                      return (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-150">
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="text-xs font-bold text-slate-800">{p.name}</p>
                              {occupant ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-150 text-[10px] font-bold text-indigo-700">
                                  {occupant.name}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-400">
                                  Sfitto
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500">
                              {latest ? `Ultima lettura: ${latest.value} m³ (${latest.readingDate})` : "Nessuna lettura — punto zero da registrare"}
                            </p>
                            <div className="flex items-center space-x-1.5 mt-1">
                              <Users size={11} className="text-slate-400" />
                              <input
                                type="number"
                                min={0}
                                defaultValue={p.residentsCount ?? 0}
                                onBlur={(e) => onUpdateResidentsCount(p.id, Number(e.target.value))}
                                className="w-14 text-[10px] border border-slate-200 rounded px-1.5 py-0.5 font-mono"
                              />
                              <span className="text-[10px] text-slate-400">abitanti</span>
                            </div>
                          </div>
                          <button
                            onClick={() => setMeterWizardProperty(p)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-lg border border-indigo-200"
                          >
                            Nuova Lettura
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selettore proprietario per le stampe (03/09/2026, su richiesta di Massimo):
                    compare solo se l'edificio ha più di un proprietario collegato — altrimenti
                    non ha senso scegliere. */}
                {buildingOwnerOptions.length > 1 && (
                  <div className="bg-white rounded-2xl border-2 border-amber-150 bg-amber-50/30 p-4 shadow-sm">
                    <label className="block text-[11px] font-black text-slate-800 uppercase tracking-wider mb-1.5">
                      Proprietario da indicare nelle stampe
                    </label>
                    <select
                      value={selectedPrintOwnerId}
                      onChange={(e) => setSelectedPrintOwnerId(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 bg-white font-semibold text-slate-800"
                    >
                      <option value="auto">Automatico (in base all'unità collegata a ciascun proprietario)</option>
                      {buildingOwnerOptions.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}{o.iban ? ` — IBAN presente` : " — IBAN mancante"}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1.5">
                      Questo edificio ha unità di più proprietari. Con "Automatico" ogni stampa userà il proprietario collegato alla singola unità; scegliendone uno qui, verrà usato per tutte le stampe di questo edificio finché non lo cambi.
                    </p>
                  </div>
                )}

                {/* Modalità di riscossione (03/09/2026, su richiesta di Massimo): bonifico
                    al proprietario oppure raccolta a mano da parte di un condomino
                    incaricato — cambia solo il testo del PDF particolare inviato
                    all'inquilino, mai la riga "Proprietario". */}
                <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 shadow-sm">
                  <label className="block text-[11px] font-black text-slate-800 uppercase tracking-wider mb-1.5">
                    Chi riscuote le quote inquilini
                  </label>
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-lg mb-2">
                    <button
                      type="button"
                      onClick={() => setCollectionMode("iban")}
                      className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${collectionMode === "iban" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                    >
                      Proprietario (bonifico IBAN)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCollectionMode("hand")}
                      className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${collectionMode === "hand" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                    >
                      Un condomino (raccolta a mano)
                    </button>
                  </div>
                  {collectionMode === "hand" && (
                    <select
                      value={selectedCollectorTenantId}
                      onChange={(e) => setSelectedCollectorTenantId(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 bg-white font-semibold text-slate-800"
                    >
                      <option value="">— Seleziona l'inquilino incaricato —</option>
                      {buildingTenantOptions.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}{t.phone ? ` — ${t.phone}` : ""}</option>
                      ))}
                    </select>
                  )}
                  {collectionMode === "hand" && !selectedCollectorTenantId && (
                    <p className="text-[10px] text-amber-600 mt-1.5">Seleziona un inquilino, altrimenti le stampe useranno comunque il bonifico al proprietario.</p>
                  )}
                </div>

                {/* Spese comuni */}
                <div className="bg-white rounded-2xl border-2 border-slate-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between pb-3">
                    <h3 className="font-sans font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                      <FileText size={15} className="text-indigo-500" />
                      <span>Spese Comuni Registrate</span>
                    </h3>
                    <button
                      onClick={() => setShowExpenseWizard(true)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold"
                    >
                      <Plus size={12} />
                      <span>Nuova Spesa</span>
                    </button>
                  </div>

                  {buildingExpenses.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      Nessuna spesa comune registrata per questo edificio.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {buildingExpenses.map((exp) => (
                        <div key={exp.id} className="p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${exp.isExtraordinary ? "bg-amber-500" : "bg-emerald-500"}`} />
                                <p className="text-xs font-bold text-slate-800">{exp.title}</p>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {SHARED_EXPENSE_CATEGORY_LABELS[exp.category]} · Quota inquilino {exp.chargedToTenantPct}%
                                {exp.rendicontoSentAt && ` · Rendiconto inviato il ${exp.rendicontoSentAt.split("T")[0]}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono font-black text-sm text-slate-900">
                                € {exp.lineItems.reduce((s, li) => s + li.amount, 0).toFixed(2)}
                              </p>
                              <button
                                onClick={() => handlePrintBacheca(exp)}
                                className="mt-1 flex items-center space-x-1 text-[10px] font-bold text-slate-500 hover:text-slate-800"
                                title="Foglio essenziale da appendere al portone d'ingresso, con l'importo dovuto da ogni unità"
                              >
                                <Printer size={11} />
                                <span>Stampa da Affiggere</span>
                              </button>
                              <button
                                onClick={() => handlePrintGenerale(exp)}
                                className="mt-1 flex items-center space-x-1 text-[10px] font-bold text-slate-500 hover:text-slate-800"
                                title="Scarica il riepilogo generale con la ripartizione su tutte le unità"
                              >
                                <FileText size={11} />
                                <span>Stampa Generale</span>
                              </button>
                              <button
                                onClick={() => handleSendRendiconto(exp)}
                                disabled={sendingRendicontoId === exp.id}
                                className="mt-1 flex items-center space-x-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                                title="Genera e invia il rendiconto con un click"
                              >
                                <Send size={11} />
                                <span>{sendingRendicontoId === exp.id ? "Invio..." : "Invia Rendiconto"}</span>
                              </button>
                            </div>
                          </div>

                          {/* Elenco per unità con invio WhatsApp diretto al singolo inquilino
                              (03/09/2026, su richiesta di Massimo: "esportare e inviare
                              eventualmente e-mail o WhatsApp ai referenti di ogni appartamento"). */}
                          <div className="pt-2 border-t border-slate-200 space-y-1">
                            {Array.from(new Set(exp.allocations.map((a) => a.propertyId))).map((propertyId) => {
                              const property = buildingProperties.find((p) => p.id === propertyId);
                              const tenant = tenants.find((t) => t.propertyId === propertyId);
                              const amount = exp.allocations.filter((a) => a.propertyId === propertyId).reduce((s, a) => s + a.amountTenant, 0);
                              if (amount <= 0) return null;
                              return (
                                <div key={propertyId} className="flex items-center justify-between text-[10px]">
                                  <span className="text-slate-600">{property?.name ?? propertyId} — {tenant?.name ?? "Non Specificato"}</span>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono font-bold text-slate-800">€ {amount.toFixed(2)}</span>
                                    <button
                                      onClick={() => handleSendWhatsApp(exp, propertyId)}
                                      className="text-emerald-600 hover:text-emerald-800"
                                      title={`Invia via WhatsApp a ${tenant?.name ?? "questo inquilino"}`}
                                    >
                                      <MessageCircle size={13} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showBuildingForm && (
        <BuildingFormModal
          properties={properties.filter((p) => !p.selfManagedBuildingId)}
          onClose={() => setShowBuildingForm(false)}
          onSave={async (data) => {
            await onCreateBuilding(data);
            setShowBuildingForm(false);
          }}
        />
      )}

      {meterWizardProperty && selectedBuilding && (
        <MeterReadingWizard
          isOpen={true}
          onClose={() => setMeterWizardProperty(null)}
          property={meterWizardProperty}
          buildingId={selectedBuilding.id}
          previousReading={latestReadingByProperty(meterWizardProperty.id)}
          onSave={async (data) => {
            await onAddMeterReading(data);
          }}
        />
      )}

      {showExpenseWizard && selectedBuilding && (
        <SharedExpenseWizard
          isOpen={true}
          onClose={() => setShowExpenseWizard(false)}
          buildingId={selectedBuilding.id}
          properties={buildingProperties}
          consumptionByProperty={consumptionByProperty}
          onSave={async (payload) => {
            await onAddSharedExpense(payload);
          }}
        />
      )}
    </div>
  );
}

function groupAllocationsByProperty(expense: SharedExpense): { propertyId: string }[] {
  const seen = new Set<string>();
  const result: { propertyId: string }[] = [];
  expense.allocations.forEach((a) => {
    if (!seen.has(a.propertyId)) {
      seen.add(a.propertyId);
      result.push({ propertyId: a.propertyId });
    }
  });
  return result;
}

// ----------------------------------------------------------------------------
// Modale di creazione Edificio Autogestito (hub semplice: nome + unità collegate)
// ----------------------------------------------------------------------------
function BuildingFormModal({
  properties,
  onClose,
  onSave,
}: {
  properties: Property[];
  onClose: () => void;
  onSave: (data: { name: string; address?: string; notes?: string; propertyIds: string[] }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => setSelectedIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));

  const handleSubmit = async () => {
    if (!name.trim() || selectedIds.length === 0) {
      alert("Nome edificio e almeno un'unità collegata sono obbligatori.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), address: address.trim() || undefined, propertyIds: selectedIds });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-sans font-bold text-base">Nuovo Edificio Autogestito</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">Nome Edificio *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Via Roma 12" className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">Indirizzo</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">Unità Immobiliari Collegate *</label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {properties.length === 0 && <p className="text-xs text-slate-400">Nessuna unità disponibile (non ancora collegata a un altro edificio/condominio).</p>}
              {properties.map((p) => (
                <label key={p.id} className="flex items-center space-x-2 p-2 bg-slate-50 rounded-lg border border-slate-150 cursor-pointer">
                  <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 text-indigo-600 border-slate-300 rounded" />
                  <span className="text-xs text-slate-700">{p.name} — {p.address}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-50 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50">Annulla</button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm">
            {saving ? "Salvataggio..." : "Crea Edificio"}
          </button>
        </div>
      </div>
    </div>
  );
}
