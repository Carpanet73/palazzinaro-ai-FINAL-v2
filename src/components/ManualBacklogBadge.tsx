import React from "react";

// CORREZIONE CQ (15/08/2026, seguito) — task #60: marcatura visiva PERMANENTE, sempre
// riconoscibile, delle righe create dalla procedura guidata di onboarding "Contratto Già in
// Essere" (PreExistingContractWizard.tsx), ovunque compaiano nei mastrini — mai
// indistinguibili dalle voci generate automaticamente dal normale ciclo contrattuale (vedi
// progettazione in STATO_E_PROSSIMI_PASSI.md). Un solo componente condiviso, riusato in ogni
// mastrino (Inquilini, Proprietari, Immobili, Condomini, Fast Closing, Solleciti) — mai una
// implementazione locale duplicata per pagina.
export default function ManualBacklogBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Voce inserita manualmente dalla procedura di onboarding Contratto Già in Essere (arretrato pregresso)"
      className={`inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700 ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Inserimento Manuale
    </span>
  );
}
