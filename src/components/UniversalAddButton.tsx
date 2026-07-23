
/**
 * UniversalAddButton — bottone flottante globale
 *
 * Sempre visibile in basso a destra dell'app (FAB - Floating Action Button).
 * Apre il MasterDataWizard da qualsiasi sezione.
 */


import React from "react";
import { Plus } from "lucide-react";

interface UniversalAddButtonProps {
  onClick: () => void;
  label?: string;
}

export default function UniversalAddButton({
  onClick,
  label = "Aggiungi",
}: UniversalAddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 group flex items-center gap-2 pl-4 pr-5 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95"
      title="Aggiungi nuovo immobile / inquilino / contratto"
    >
      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
        <Plus size={14} strokeWidth={3} />
      </div>
      <span className="text-[13px] font-semibold tracking-wide">{label}</span>
    </button>
  );
}

