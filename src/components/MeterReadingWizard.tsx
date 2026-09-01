/**
 * MeterReadingWizard.tsx
 * ============================================================================
 * Inserimento di una lettura contatore (acqua) per un'unità immobiliare di un
 * Edificio Autogestito. Sempre inserita da Massimo (nessun upload diretto
 * lato inquilino): la foto arriva fuori sistema (es. WhatsApp), qui si carica
 * l'immagine per l'OCR oppure si digita il numero manualmente.
 *
 * Stile coerente con il resto dell'app: header scuro, bordi sottili, pulsanti
 * piatti, badge a pallino, IBM Plex Mono per i numeri.
 * ============================================================================
 */

import React, { useState } from "react";
import { X, Camera, Loader2, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import type { Property } from "../types";
import type { MeterReading } from "../types-shared-expenses";
import { checkReadingCongruity } from "../lib/sharedExpensesEngine";

export interface MeterReadingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property;
  buildingId: string;
  previousReading: MeterReading | null; // l'ultima lettura nota per questo contatore, o null se è la prima (punto zero)
  onSave: (data: {
    propertyId: string;
    buildingId: string;
    meterType: "acqua";
    value: number;
    readingDate: string;
    isZeroPoint: boolean;
    source: "ocr" | "manual";
    photoUrl?: string;
    flaggedAnomaly?: boolean;
    anomalyNote?: string;
  }) => Promise<void>;
}

export default function MeterReadingWizard({ isOpen, onClose, property, buildingId, previousReading, onSave }: MeterReadingWizardProps) {
  const [readingDate, setReadingDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [value, setValue] = useState<string>("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [source, setSource] = useState<"ocr" | "manual">("manual");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const isZeroPoint = previousReading === null;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
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
            context: "meterReading",
            userPrompt: "Leggi il numero visualizzato sul contatore dell'acqua nella foto.",
          }),
        });
        const json = await res.json();
        if (json?.success && json?.data?.readingValue !== undefined && json.data.readingValue !== null) {
          setValue(String(json.data.readingValue));
          setSource("ocr");
        } else {
          setOcrError("Non sono riuscito a leggere chiaramente il numero. Inseriscilo manualmente qui sotto.");
        }
      } catch (err) {
        setOcrError("Errore durante l'analisi della foto. Inserisci il numero manualmente.");
      } finally {
        setOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const numericValue = Number(value);
  const congruity = value.trim() !== "" && !isNaN(numericValue) ? checkReadingCongruity(numericValue, previousReading) : { isValid: true };

  const handleSubmit = async () => {
    if (value.trim() === "" || isNaN(numericValue)) {
      alert("Inserisci un valore numerico valido per la lettura.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        propertyId: property.id,
        buildingId,
        meterType: "acqua",
        value: numericValue,
        readingDate,
        isZeroPoint,
        source: photoFile ? source : "manual",
        photoUrl: photoPreview ?? undefined,
        flaggedAnomaly: !congruity.isValid,
        anomalyNote: congruity.anomalyNote,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-sans font-bold text-base">
            Lettura Contatore Acqua — {property.name}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {isZeroPoint && (
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800">
              <strong>Punto Zero.</strong> Nessuna lettura precedente registrata per questo
              contatore: questa diventerà la lettura di partenza. Da qui in poi il sistema misura
              solo il consumo successivo a questa data.
            </div>
          )}

          {previousReading && (
            <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-xs text-slate-600">
              Ultima lettura registrata: <span className="font-mono font-bold">{previousReading.value}</span> il {previousReading.readingDate}
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
              Foto del Contatore (opzionale — attiva la lettura automatica OCR)
            </label>
            <label className="flex items-center justify-center space-x-2 border-2 border-dashed border-slate-200 rounded-xl py-6 cursor-pointer hover:border-indigo-300 transition-colors">
              <Camera size={18} className="text-slate-400" />
              <span className="text-xs text-slate-500">{photoFile ? photoFile.name : "Carica foto del contatore"}</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
            </label>
            {ocrLoading && (
              <div className="flex items-center space-x-2 mt-2 text-xs text-indigo-600">
                <Loader2 size={14} className="animate-spin" />
                <span>Lettura del contatore in corso (OCR)...</span>
              </div>
            )}
            {ocrError && <p className="text-xs text-amber-600 mt-2">{ocrError}</p>}
            {source === "ocr" && !ocrLoading && value && (
              <div className="flex items-center space-x-1.5 mt-2 text-xs text-emerald-600">
                <Sparkles size={13} />
                <span>Numero riconosciuto automaticamente — verifica prima di salvare.</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
              Numero Letto (m³) *
            </label>
            <input
              type="number"
              step="0.001"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setSource("manual");
              }}
              placeholder="Es. 1234.567"
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5">
              Data della Lettura *
            </label>
            <input
              type="date"
              value={readingDate}
              onChange={(e) => setReadingDate(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 transition-all font-mono"
            />
          </div>

          {!congruity.isValid && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2">
              <AlertTriangle size={15} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700">{congruity.anomalyNote}</p>
            </div>
          )}
          {congruity.isValid && !isZeroPoint && value.trim() !== "" && (
            <div className="flex items-center space-x-1.5 text-xs text-emerald-600">
              <CheckCircle2 size={14} />
              <span>Lettura congrua con la precedente.</span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-50 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors">
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || value.trim() === ""}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
          >
            {saving ? "Salvataggio..." : congruity.isValid ? "Salva Lettura" : "Salva Comunque (verificata manualmente)"}
          </button>
        </div>
      </div>
    </div>
  );
}
