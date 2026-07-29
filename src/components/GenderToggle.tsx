import React from "react";

interface Props {
  value?: "M" | "F";
  onChange: (g: "M" | "F" | undefined) => void;
  /** true -> la persona è azienda/ente: niente genere, mostra nota neutra */
  isCompany?: boolean;
  label?: string;
  className?: string;
}

export default function GenderToggle({ value, onChange, isCompany, label = "Genere", className = "" }: Props) {
  if (isCompany) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-[10px] font-black uppercase text-slate-500">{label}:</span>
        <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">Azienda / ente — N/A</span>
      </div>
    );
  }
  const base = "px-2.5 py-1 rounded-md text-[10px] font-black transition-colors duration-150 select-none";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-[10px] font-black uppercase text-slate-500">{label}:</span>
      <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
        <button type="button" aria-pressed={value === "M"} onClick={() => onChange("M")}
          className={`${base} ${value === "M" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200"}`}>
          Uomo
        </button>
        <button type="button" aria-pressed={value === "F"} onClick={() => onChange("F")}
          className={`${base} ${value === "F" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200"}`}>
          Donna
        </button>
      </div>
      {value && (
        <button type="button" onClick={() => onChange(undefined)} title="Rimuovi selezione"
          className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors">✕</button>
      )}
    </div>
  );
}
