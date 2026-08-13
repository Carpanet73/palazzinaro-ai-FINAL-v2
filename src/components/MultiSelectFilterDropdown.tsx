import React, { useState, useRef, useEffect, useMemo } from "react";
import { Filter, Check, ChevronDown, Search } from "lucide-react";

// CORREZIONE CP (13/08/2026) — Fase 2 punto 2: componente UNICO e condiviso per ogni filtro
// "a bottone" dell'applicazione, sostituito con un menu a tendina multi-selezione stile
// Excel/Google Sheets (elenco dei valori con checkbox, ricerca, seleziona tutti/nessuno).
// Un solo componente per questa funzione in tutta l'app — mai una versione parallela
// duplicata per ogni pagina (regola "un solo flusso per ogni azione").

export interface MultiSelectFilterOption {
  value: string;
  label: string;
  count?: number;
}

interface MultiSelectFilterDropdownProps {
  /** Etichetta breve del filtro, es. "Stato", "Categoria". Mostrata come prefisso sul bottone. */
  label: string;
  options: MultiSelectFilterOption[];
  /** Valori attualmente selezionati (mostrati = inclusi nel risultato). */
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Sotto quale soglia di opzioni nascondere la barra di ricerca (di default 7). */
  searchThreshold?: number;
  className?: string;
}

export default function MultiSelectFilterDropdown({
  label,
  options,
  selected,
  onChange,
  searchThreshold = 7,
  className = ""
}: MultiSelectFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase().trim();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const allSelected = options.length > 0 && selected.length === options.length;
  const noneSelected = selected.length === 0;

  const toggleValue = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAll = () => onChange(options.map(o => o.value));
  const selectNone = () => onChange([]);

  let triggerText: string;
  if (allSelected || options.length === 0) {
    triggerText = `${label}: Tutti`;
  } else if (noneSelected) {
    triggerText = `${label}: Nessuno`;
  } else if (selected.length === 1) {
    const opt = options.find(o => o.value === selected[0]);
    triggerText = `${label}: ${opt ? opt.label : selected[0]}`;
  } else {
    triggerText = `${label}: ${selected.length} di ${options.length}`;
  }

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
          allSelected
            ? "text-slate-500 border-transparent hover:bg-slate-100"
            : "bg-indigo-600 text-white font-bold border-indigo-600"
        }`}
      >
        <Filter size={12} className="shrink-0" />
        <span className="whitespace-nowrap">{triggerText}</span>
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 w-64 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {options.length > searchThreshold && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cerca..."
                  autoFocus
                  className="w-full pl-6 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-slate-50">
            <button
              type="button"
              onClick={selectAll}
              className="text-[10px] font-bold text-indigo-700 hover:underline"
            >
              Seleziona tutti
            </button>
            <button
              type="button"
              onClick={selectNone}
              className="text-[10px] font-bold text-slate-500 hover:underline"
            >
              Deseleziona tutti
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400 text-center">Nessun valore trovato.</div>
            ) : (
              filteredOptions.map(opt => {
                const isChecked = selected.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs"
                  >
                    <span
                      className={`shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center ${
                        isChecked ? "bg-indigo-600 border-indigo-600" : "border-slate-300 bg-white"
                      }`}
                    >
                      {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                    </span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleValue(opt.value)}
                      className="sr-only"
                    />
                    <span className="flex-1 text-slate-700 truncate">{opt.label}</span>
                    {typeof opt.count === "number" && (
                      <span className="shrink-0 font-mono text-[10px] text-slate-400">{opt.count}</span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
