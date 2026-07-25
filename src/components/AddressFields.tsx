import React from "react";
import { guessProvinceFromCity } from "../lib/italianCities";

export interface AddressValue {
  via?: string;
  civico?: string;
  interno?: string;
  citta?: string;
  provincia?: string;
  cap?: string;
}

interface AddressFieldsProps {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
}

// CORREZIONE AA — Indirizzo strutturato riutilizzabile (Inquilini, Proprietari, e altre
// anagrafiche in futuro): mai più un campo unico "indirizzo" libero. La provincia si
// propone da sola in base alla città digitata, ma resta sempre modificabile a mano.
export default function AddressFields({ value, onChange }: AddressFieldsProps) {
  const update = (field: keyof AddressValue, val: string) => {
    const next = { ...value, [field]: val };
    if (field === "citta") {
      const guessed = guessProvinceFromCity(val);
      if (guessed && !value.provincia) {
        next.provincia = guessed;
      }
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
        Indirizzo
      </label>
      <div className="grid grid-cols-3 gap-2">
        <input
          type="text"
          placeholder="Via / Piazza"
          value={value.via || ""}
          onChange={(e) => update("via", e.target.value)}
          className="col-span-2 text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
        />
        <input
          type="text"
          placeholder="N. Civico"
          value={value.civico || ""}
          onChange={(e) => update("civico", e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
        />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <input
          type="text"
          placeholder="Interno (facolt.)"
          value={value.interno || ""}
          onChange={(e) => update("interno", e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
        />
        <input
          type="text"
          placeholder="Città"
          value={value.citta || ""}
          onChange={(e) => update("citta", e.target.value)}
          className="col-span-2 text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500"
        />
        <input
          type="text"
          placeholder="Prov."
          maxLength={2}
          value={value.provincia || ""}
          onChange={(e) => update("provincia", e.target.value.toUpperCase())}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 uppercase text-center font-mono"
        />
      </div>
      <input
        type="text"
        placeholder="CAP"
        value={value.cap || ""}
        onChange={(e) => update("cap", e.target.value)}
        className="w-32 text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 font-mono"
      />
      <p className="text-[9px] text-slate-400">
        La provincia si propone da sola in base alla città (se riconosciuta) — resta comunque modificabile.
      </p>
    </div>
  );
}
