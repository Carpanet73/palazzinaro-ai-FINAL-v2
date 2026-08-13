import React, { useState } from "react";
import { Printer, FileSpreadsheet, FileText, MessageCircle, Loader2 } from "lucide-react";
import {
  LedgerColumn,
  printLedgerTable,
  exportLedgerToExcel,
  exportLedgerToPDF,
  shareLedgerViaWhatsApp
} from "../lib/ledgerExport";

// CORREZIONE CP (13/08/2026) — Fase 2 punto 3: barra azioni UNICA e condivisa per stampa ed
// esportazione di un mastrino, riusata identica su ogni pagina dell'app (Fast Closing,
// mastrino inquilino, mastrino proprietario, mastrino condominiale, movimenti bancari, ecc.),
// come richiesto dalla regola "un solo flusso per ogni azione". Non crea MAI una logica di
// stampa/esportazione parallela: delega sempre a src/lib/ledgerExport.ts.

interface LedgerExportToolbarProps {
  title: string;
  subtitle?: string;
  columns: LedgerColumn[];
  rows: any[];
  totalsRow?: Record<string, string>;
  filenameBase: string;
  /** Se fornito, mostra anche il pulsante di condivisione WhatsApp con un riepilogo testuale.
   * Da omettere quando la pagina ha già un proprio flusso di condivisione più curato (es.
   * TenantsView, che invia messaggi personalizzati a inquilino/proprietari). */
  whatsappPhone?: string;
  showWhatsApp?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export default function LedgerExportToolbar({
  title,
  subtitle,
  columns,
  rows,
  totalsRow,
  filenameBase,
  whatsappPhone,
  showWhatsApp = false,
  className = "",
  size = "sm"
}: LedgerExportToolbarProps) {
  const [pdfLoading, setPdfLoading] = useState(false);

  const opts = { title, subtitle, columns, rows, totalsRow, filenameBase };

  const handlePdf = async () => {
    setPdfLoading(true);
    try {
      await exportLedgerToPDF(opts);
    } finally {
      setPdfLoading(false);
    }
  };

  const btnBase = size === "sm"
    ? "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all"
    : "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all";
  const btnStyle = "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100";
  const iconSize = size === "sm" ? 11 : 13;

  return (
    <div className={`flex flex-wrap gap-1.5 no-print ${className}`}>
      <button type="button" onClick={() => printLedgerTable(opts)} className={`${btnBase} ${btnStyle}`}>
        <Printer size={iconSize} />
        <span>Stampa</span>
      </button>
      <button type="button" onClick={() => exportLedgerToExcel(opts)} className={`${btnBase} ${btnStyle}`}>
        <FileSpreadsheet size={iconSize} />
        <span>Excel</span>
      </button>
      <button type="button" onClick={handlePdf} disabled={pdfLoading} className={`${btnBase} ${btnStyle} disabled:opacity-60`}>
        {pdfLoading ? <Loader2 size={iconSize} className="animate-spin" /> : <FileText size={iconSize} />}
        <span>PDF</span>
      </button>
      {showWhatsApp && (
        <button
          type="button"
          onClick={() => shareLedgerViaWhatsApp(opts, whatsappPhone)}
          className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600`}
        >
          <MessageCircle size={iconSize} />
          <span>WhatsApp</span>
        </button>
      )}
    </div>
  );
}
