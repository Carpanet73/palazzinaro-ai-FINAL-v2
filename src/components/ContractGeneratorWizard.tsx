/**
 * ContractGeneratorWizard.tsx — CORREZIONE BQ
 *
 * Wizard guidato in Area Contratti: seleziona Immobile → Inquilino → termini del
 * contratto → anteprima e generazione vera del documento .docx (identico nella forma al
 * modello fornito dall'utente), con invio via Resend in allegato.
 *
 * CORREZIONE CC (29/07/2026): il campo "genere" (M/F) ora esiste stabilmente nelle
 * anagrafiche Owner/Tenant ed è precompilato qui automaticamente dal dato salvato. Il
 * toggle manuale resta comunque disponibile come stopgap per i record più vecchi senza
 * questo campo, e per poterlo comunque correggere al volo in caso di errore.
 */

import React, { useState, useMemo, useEffect } from "react";
import { Property, Tenant, Owner, Contract } from "../types";
import { generateContractDocx, ContractGenData } from "../lib/contractGenerator";
import { amountToItalianWords } from "../lib/numberToItalianWords";
import { uploadDocumentToStorage } from "../lib/documentUpload";
import GenderToggle from "./GenderToggle";

interface ContractGeneratorWizardProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  tenants: Tenant[];
  owners: Owner[];
  onAddContract: (contract: any) => Promise<void>;
}

const ITALIAN_MONTHS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

function formatDateItalian(isoDate: string): string {
  if (!isoDate) return "___________";
  const [y, m, d] = isoDate.split("-").map(Number);
  const dayLabel = d === 1 ? "1°" : String(d);
  return `${dayLabel} ${ITALIAN_MONTHS[m - 1]} ${y}`;
}

function formatDateDots(isoDate: string): string {
  if (!isoDate) return "___________";
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

const YEARS_WORDS: Record<number, string> = { 1: "uno", 2: "due", 3: "tre", 4: "quattro", 5: "cinque", 6: "sei", 8: "otto", 12: "dodici" };

export default function ContractGeneratorWizard({
  isOpen, onClose, properties, tenants, owners, onAddContract
}: ContractGeneratorWizardProps) {
  const [step, setStep] = useState(1);
  const [propertyId, setPropertyId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [ownerGenders, setOwnerGenders] = useState<Record<string, "M" | "F">>({});
  const [tenantGender, setTenantGender] = useState<"M" | "F">("M");

  const [durationYears, setDurationYears] = useState(4);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [monthlyRent, setMonthlyRent] = useState(0);
  const [taxRegime, setTaxRegime] = useState<"CedolareSecca" | "Ordinaria">("CedolareSecca");

  // CORREZIONE BU — Il regime fiscale è la prima domanda (non l'ultima): la cedolare secca
  // sui contratti liberi comporta di norma la durata 4+4 anni, proposta subito qui.
  const handleSelectRegime = (regime: "CedolareSecca" | "Ordinaria") => {
    setTaxRegime(regime);
    if (regime === "CedolareSecca") setDurationYears(4);
  };

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [sendEmail, setSendEmail] = useState("");

  // CORREZIONE BR — bug critico corretto: gli hook (useMemo) erano DOPO il controllo
  // "if (!isOpen) return null" — questo viola le Regole degli Hook di React (il numero di
  // hook chiamati deve essere sempre uguale ad ogni resa grafica) e mandava in crash
  // l'intera pagina (schermo bianco) non appena il Wizard veniva aperto per la prima volta.
  // Ora tutti gli hook vengono chiamati SEMPRE, prima di qualunque uscita anticipata.
  const selectedProperty = properties.find(p => p.id === propertyId);
  const selectedTenant = tenants.find(t => t.id === tenantId);
  const resolvedOwner = owners.find(o => o.id === selectedProperty?.ownerId || o.name === selectedProperty?.owner);
  const allOwnerPeople = useMemo(() => {
    if (!resolvedOwner) return [];
    const resolvedCoOwners = (resolvedOwner.coOwners || []).map(co => {
      // CORREZIONE BS — se il comproprietario è collegato a un'anagrafica Owner reale
      // già esistente, usa TUTTI i suoi dati (nascita, indirizzo) invece dei soli
      // nome/CF salvati sul comproprietario, che lasciavano il resto vuoto nel contratto.
      const linked = co.linkedOwnerId ? owners.find(ow => ow.id === co.linkedOwnerId) : undefined;
      return linked ? { ...linked, id: linked.id } : ({ ...co, id: co.linkedOwnerId || co.name } as any);
    });
    return [resolvedOwner, ...resolvedCoOwners];
  }, [resolvedOwner, owners]);

  const endDate = useMemo(() => {
    if (!startDate) return "";
    const d = new Date(startDate);
    d.setFullYear(d.getFullYear() + durationYears);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }, [startDate, durationYears]);

  // CORREZIONE CC — precompila il genere dal dato ora persistente in anagrafica
  // (Owner.gender / Tenant.gender), invece di partire sempre da "M" di default.
  // Precompila SOLO i valori non ancora impostati manualmente in questa sessione
  // del wizard (next[id] === undefined), per non pestare una scelta fatta a mano.
  useEffect(() => {
    setOwnerGenders((prev) => {
      const next = { ...prev };
      allOwnerPeople.forEach((o: any) => {
        if (!o.isCompany && o.gender && next[o.id] === undefined) next[o.id] = o.gender;
      });
      return next;
    });
    // Dipendenza su id+gender+isCompany stabili (stringa), non sul riferimento
    // dell'array: evita di rieseguire ad ogni render e di cancellare scelte manuali.
  }, [allOwnerPeople.map((o: any) => `${o.id}:${o.gender || ""}:${o.isCompany ? 1 : 0}`).join("|")]);

  useEffect(() => {
    if (!selectedTenant) return;
    if (selectedTenant.isCompany) return; // azienda: il toggle resta nascosto
    setTenantGender(selectedTenant.gender || "M");
  }, [selectedTenant?.id]);

  if (!isOpen) return null;

  const annualRent = monthlyRent * 12;

  const canGoToStep3 = !!propertyId;
  const canGoToStep4 = !!tenantId;
  const canGenerate = monthlyRent > 0 && startDate;

  const buildContractGenData = (): ContractGenData => ({
    owners: allOwnerPeople.map(o => {
      const owner = o as Owner;
      const sa = owner.structuredAddress;
      let residenceAddressFormatted: string | undefined;
      if (sa?.via) {
        // CORREZIONE BS — stesso formato pieno usato per l'inquilino ("residente a
        // Città (PROV), via X n. Y"), invece del formato ridotto precedente che ometteva
        // la provincia.
        residenceAddressFormatted = `residente a ${sa.citta || ""}${sa.provincia ? ` (${sa.provincia})` : ""}, via ${sa.via}${sa.civico ? ` n. ${sa.civico}` : ""}`;
      } else if (owner.address) {
        // Fallback al campo indirizzo libero (legacy) invece di lasciare un vuoto:
        // meglio un dato reale anche se non strutturato, che un trattino.
        residenceAddressFormatted = `residente in ${owner.address}`;
      }
      return {
        name: o.name,
        gender: owner.isCompany ? undefined : (ownerGenders[o.id] || owner.gender || "M"),
        isCompany: !!owner.isCompany,
        birthPlace: owner.birthPlace,
        birthDate: owner.birthDate ? formatDateDots(owner.birthDate) : undefined,
        fiscalCode: owner.fiscalCode,
        residenceAddressFormatted
      };
    }),
    tenant: {
      name: selectedTenant?.name || "",
      gender: selectedTenant?.isCompany ? undefined : tenantGender,
      isCompany: !!selectedTenant?.isCompany,
      birthPlace: selectedTenant?.birthPlace,
      birthDate: selectedTenant?.birthDate ? formatDateDots(selectedTenant.birthDate) : undefined,
      fiscalCode: selectedTenant?.fiscalCode,
      residenceAddressFormatted: selectedTenant?.address
        ? `residente a ${selectedTenant.address.citta || ""} (${selectedTenant.address.provincia || ""}), via ${selectedTenant.address.via || ""} n. ${selectedTenant.address.civico || ""}`
        : undefined,
      isForeign: selectedTenant?.isForeign,
      residencePermit: selectedTenant?.residencePermit ? {
        number: selectedTenant.residencePermit.number,
        issuedDateFormatted: selectedTenant.residencePermit.issuedDate ? formatDateDots(selectedTenant.residencePermit.issuedDate) : undefined,
        validity: selectedTenant.residencePermit.validity
      } : undefined
    },
    property: {
      fullAddressWithFloor: `${selectedProperty?.address || ""}${selectedProperty?.cadastralData?.piano ? `, piano ${selectedProperty.cadastralData.piano}` : ""}`,
      comuneCatastale: selectedProperty?.address?.split(",")[0]?.trim() || "",
      cadastral: selectedProperty?.cadastralData || {},
      energyClass: selectedProperty?.energyClass
    },
    contract: {
      durationYears,
      durationYearsWords: YEARS_WORDS[durationYears] || String(durationYears),
      startDateFormatted: formatDateItalian(startDate),
      endDateFormatted: formatDateItalian(endDate),
      annualRent: annualRent.toFixed(2),
      annualRentWords: amountToItalianWords(annualRent),
      monthlyRent: monthlyRent.toFixed(2),
      monthlyRentWords: amountToItalianWords(monthlyRent),
      taxRegime,
      signPlace: resolvedOwner?.structuredAddress?.citta || selectedProperty?.address?.split(",")[0]?.trim() || "___________",
      signDateFormatted: formatDateItalian(new Date().toISOString().split("T")[0])
    }
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const blob = await generateContractDocx(buildContractGenData());
      setGeneratedBlob(blob);
    } catch (err: any) {
      alert(`❌ Errore durante la generazione del contratto: ${err?.message || err}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedBlob) return;
    const url = URL.createObjectURL(generatedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Contratto_Locazione_${(selectedTenant?.name || "Inquilino").replace(/\s+/g, "_")}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveAndFinish = async () => {
    if (!generatedBlob || !selectedProperty || !selectedTenant) return;
    setSending(true);
    try {
      const storedDoc = await uploadDocumentToStorage(
        generatedBlob,
        `Contratto_${selectedTenant.name.replace(/\s+/g, "_")}.docx`,
        "Contratto di Locazione",
        `Contratti/${selectedTenant.name}`
      );

      if (sendEmail.trim()) {
        const base64: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(",")[1] || "");
          reader.onerror = reject;
          reader.readAsDataURL(generatedBlob);
        });
        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: sendEmail.trim(),
            subject: `Contratto di Locazione — ${selectedProperty.name}`,
            html: `<p>In allegato il contratto di locazione generato per ${selectedTenant.name}.</p><p style="font-size:10px;color:#94a3b8;">Generato automaticamente dal sistema Palazzinaro AI®.</p>`,
            attachments: [{ filename: `Contratto_${selectedTenant.name.replace(/\s+/g, "_")}.docx`, content: base64 }]
          })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Errore durante l'invio email.");
        }
      }

      await onAddContract({
        propertyId: selectedProperty.id,
        propertyName: selectedProperty.name,
        tenantId: selectedTenant.id,
        tenantName: selectedTenant.name,
        startDate,
        endDate,
        rentAmount: monthlyRent,
        frequency: "Mensile",
        status: "Active",
        ownerName: resolvedOwner?.name || selectedProperty.owner || "",
        taxRegime,
        documents: [storedDoc]
      });

      alert(`✅ Contratto generato, salvato agli atti${sendEmail.trim() ? " e inviato via email" : ""} con successo!`);
      onClose();
      setStep(1);
      setGeneratedBlob(null);
    } catch (err: any) {
      alert(`❌ Errore: ${err?.message || err}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <h3 className="font-sans font-bold text-base">🪄 Genera Contratto Guidato — Passo {step} di 5</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {step === 1 && (
            <>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">1. Regime Fiscale del Contratto</label>
              <p className="text-[11px] text-slate-500 mb-2">Prima cosa da scegliere: determina la durata standard e le clausole fiscali del contratto.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleSelectRegime("CedolareSecca")} className={`flex-1 py-3 rounded-xl text-xs font-bold ${taxRegime === "CedolareSecca" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                  Cedolare Secca<br /><span className="text-[9px] font-normal opacity-80">(propone 4+4 anni)</span>
                </button>
                <button type="button" onClick={() => handleSelectRegime("Ordinaria")} className={`flex-1 py-3 rounded-xl text-xs font-bold ${taxRegime === "Ordinaria" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                  Ordinaria<br /><span className="text-[9px] font-normal opacity-80">(registrazione + ISTAT)</span>
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">2. Seleziona l'Immobile</label>
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5">
                <option value="">-- Seleziona --</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name} — {p.address}</option>)}
              </select>

              {selectedProperty && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                  <p className="font-bold text-slate-700">Proprietario/i risolto/i: {allOwnerPeople.map(o => o.name).join(", ") || "Nessuno collegato"}</p>
                  {allOwnerPeople.map((o: any) => (
                    <div key={o.id} className="flex items-center gap-2">
                      <span className="text-slate-500">{o.name} è:</span>
                      <GenderToggle
                        value={ownerGenders[o.id] || (o.gender as "M" | "F") || undefined}
                        onChange={(g) => setOwnerGenders((prev) => ({ ...prev, [o.id]: (g as "M" | "F") || "M" }))}
                        isCompany={!!o.isCompany}
                        label=""
                      />
                    </div>
                  ))}
                  {(!selectedProperty.cadastralData?.foglio) && (
                    <p className="text-amber-600">⚠️ Mancano i dati catastali su questo immobile — fotografali dalla scheda Immobile prima di continuare, altrimenti il contratto avrà dei vuoti.</p>
                  )}
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">3. Seleziona l'Inquilino</label>
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5">
                <option value="">-- Seleziona --</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {selectedTenant && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">{selectedTenant.name} è:</span>
                    <GenderToggle
                      value={selectedTenant.isCompany ? undefined : tenantGender}
                      onChange={(g) => setTenantGender((g as "M" | "F") || "M")}
                      isCompany={!!selectedTenant.isCompany}
                      label=""
                    />
                  </div>
                  {selectedTenant.isForeign && !selectedTenant.residencePermit?.number && (
                    <p className="text-amber-600">⚠️ Risulta straniero ma manca il permesso di soggiorno — fotografalo dalla scheda Inquilino prima di continuare.</p>
                  )}
                  {!selectedTenant.fiscalCode && (
                    <p className="text-amber-600">⚠️ Manca il codice fiscale — fotografa il documento d'identità dalla scheda Inquilino.</p>
                  )}
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-[11px] text-indigo-700 font-bold">
                Regime scelto: {taxRegime === "CedolareSecca" ? "Cedolare Secca" : "Ordinaria"}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Durata (anni)</label>
                <input type="number" value={durationYears} onChange={(e) => setDurationYears(Number(e.target.value) || 4)} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5" />
                {taxRegime === "CedolareSecca" && <p className="text-[10px] text-slate-400 mt-1">Proposta automaticamente a 4 (contratto 4+4) — modificabile se serve.</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Data di Decorrenza</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5" />
                <p className="text-[10px] text-slate-400 mt-1">Fine calcolata: {formatDateItalian(endDate)}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Canone Mensile €</label>
                <input type="number" value={monthlyRent || ""} onChange={(e) => setMonthlyRent(Number(e.target.value) || 0)} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5" />
                <p className="text-[10px] text-slate-400 mt-1">Annuo calcolato: € {annualRent.toFixed(2)}</p>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Genera il documento e controllalo prima di salvarlo e inviarlo.</p>
              <button
                onClick={handleGenerate}
                disabled={generating || !canGenerate}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-sm font-bold"
              >
                {generating ? "⏳ Genero il documento..." : "📄 Genera Documento Contratto (.docx)"}
              </button>

              {generatedBlob && (
                <>
                  <button onClick={handleDownload} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">
                    ⬇️ Scarica per Controllare
                  </button>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Invia a (facoltativo, via Resend)</label>
                    <input type="email" placeholder="email@esempio.it" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5" />
                  </div>
                  <button
                    onClick={handleSaveAndFinish}
                    disabled={sending}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-sm font-bold"
                  >
                    {sending ? "⏳ Salvo e invio..." : ("✅ Salva agli Atti" + (sendEmail.trim() ? " e Invia" : ""))}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-between shrink-0">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-600 rounded-xl text-xs font-bold"
          >
            ← Indietro
          </button>
          {step < 5 && (
            <button
              onClick={() => setStep(s => Math.min(5, s + 1))}
              disabled={(step === 2 && !canGoToStep3) || (step === 3 && !canGoToStep4)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold"
            >
              Avanti →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
