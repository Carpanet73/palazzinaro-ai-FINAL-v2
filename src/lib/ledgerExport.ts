// CORREZIONE CP (13/08/2026) — Fase 2 punto 3: modulo UNICO e condiviso per stampa ed
// esportazione di ogni mastrino/registro contabile dell'applicazione (Fast Closing, mastrino
// inquilino, mastrino proprietario, mastrino condominiale, movimenti bancari, ecc.).
//
// Prima di questa correzione esistevano 3 implementazioni di stampa diverse e incoerenti
// (FastClosingView, TenantsView, OwnersView), nessuna esportazione Excel, nessuna esportazione
// PDF tabellare. Questo file sostituisce tutte quelle logiche con un solo flusso, come
// richiesto dalla regola "un solo flusso per ogni azione" del progetto.
//
// Ogni funzione qui è generica: riceve colonne (chiave + etichetta + formattazione) e righe
// (oggetti qualsiasi), così può essere riusata identica su qualunque mastrino, indipendentemente
// dalla forma dei dati sottostanti.

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import * as XLSX from "xlsx";
import logoIcon from "../assets/logo-icon.png";

export interface LedgerColumn {
  /** Chiave del campo nell'oggetto riga (usata solo se `format` non è fornito). */
  key: string;
  /** Etichetta di intestazione colonna. */
  label: string;
  /** Allineamento colonna — le colonne di importi/date sono sempre a destra per convenzione. */
  align?: "left" | "right" | "center";
  /** Formattatore opzionale: se assente, viene usato semplicemente String(row[key]). */
  format?: (row: any) => string;
}

export interface LedgerExportOptions {
  /** Titolo del mastrino, es. "Mastrino Contabile — Mario Rossi". */
  title: string;
  /** Sottotitolo opzionale, es. indirizzo immobile o codice fiscale. */
  subtitle?: string;
  columns: LedgerColumn[];
  rows: any[];
  /** Riga di subtotale opzionale, già con valori pronti per la visualizzazione per ogni colonna. */
  totalsRow?: Record<string, string>;
  /** Base del nome file (senza estensione, senza data) — la data viene aggiunta automaticamente. */
  filenameBase: string;
}

const ITALIAN_DAYS = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const ITALIAN_MONTHS = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"
];

/**
 * Costruisce un nome file datato secondo la regola 6 del progetto:
 * `nome-progetto-giorno-settimana-DD-mese-AAAA`. Qui applicata al singolo export:
 * `{base}-{giorno}-{DD}-{mese}-{AAAA}.{ext}`, sempre calcolata da `new Date()` al momento
 * dell'esecuzione (mai una data fissa).
 */
function buildDatedFilename(base: string, ext: string): string {
  const d = new Date();
  const giorno = ITALIAN_DAYS[d.getDay()];
  const dd = String(d.getDate()).padStart(2, "0");
  const mese = ITALIAN_MONTHS[d.getMonth()];
  const aaaa = d.getFullYear();
  const safeBase = base.replace(/[^a-zA-Z0-9\-_ ]/g, "").trim().replace(/\s+/g, "-");
  return `${safeBase}-${giorno}-${dd}-${mese}-${aaaa}.${ext}`;
}

function cellText(col: LedgerColumn, row: any): string {
  if (col.format) return col.format(row);
  const v = row?.[col.key];
  return v === undefined || v === null ? "" : String(v);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let cachedLogoImg: HTMLImageElement | null = null;
function loadLogoImage(): Promise<HTMLImageElement> {
  if (cachedLogoImg) return Promise.resolve(cachedLogoImg);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      cachedLogoImg = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = logoIcon;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// STAMPA — un solo meccanismo per tutta l'app (sostituisce le 3 implementazioni
// precedenti). Costruisce un'area di stampa dedicata, la inietta temporaneamente nel DOM,
// stampa, e la rimuove — indipendentemente dal layout della pagina che lo invoca. La regola
// CSS globale che isola questa area durante la stampa è definita una sola volta in
// `src/index.css` (`#universal-print-area`).
// ─────────────────────────────────────────────────────────────────────────────
export function printLedgerTable(opts: LedgerExportOptions): void {
  const { title, subtitle, columns, rows, totalsRow } = opts;

  const existing = document.getElementById("universal-print-area");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.id = "universal-print-area";

  const headCells = columns
    .map(c => `<th style="text-align:${c.align === "right" ? "right" : c.align === "center" ? "center" : "left"};padding:6px 8px;">${escapeHtml(c.label)}</th>`)
    .join("");

  const bodyRows = rows
    .map(r => `<tr>${columns
      .map(c => `<td style="text-align:${c.align === "right" ? "right" : c.align === "center" ? "center" : "left"};padding:5px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(cellText(c, r))}</td>`)
      .join("")}</tr>`)
    .join("");

  const totalsHtml = totalsRow
    ? `<tr style="font-weight:700;background:#f1f5f9;">${columns
        .map(c => `<td style="text-align:${c.align === "right" ? "right" : c.align === "center" ? "center" : "left"};padding:6px 8px;">${escapeHtml(totalsRow[c.key] ?? "")}</td>`)
        .join("")}</tr>`
    : "";

  container.innerHTML = `
    <div style="font-family: Inter, Helvetica, Arial, sans-serif; color:#1c2530; padding: 28px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom: 2px solid #1c2530; padding-bottom: 12px; margin-bottom: 18px;">
        <div>
          <h1 style="font-size:16px; margin:0; text-transform:uppercase; letter-spacing:0.02em;">Palazzinaro AI — ${escapeHtml(title)}</h1>
          ${subtitle ? `<p style="font-size:11px; color:#64748b; margin:4px 0 0;">${escapeHtml(subtitle)}</p>` : ""}
        </div>
        <span style="font-size:10px; color:#64748b; white-space:nowrap;">Generato il ${new Date().toLocaleDateString("it-IT")}</span>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:11px;">
        <thead><tr style="background:#1c2530; color:#fff; font-size:9px; text-transform:uppercase; letter-spacing:0.03em;">${headCells}</tr></thead>
        <tbody>${bodyRows || `<tr><td style="padding:16px 8px;color:#94a3b8;font-style:italic;">Nessuna voce da mostrare.</td></tr>`}${totalsHtml}</tbody>
      </table>
      <p style="font-size:9px; color:#94a3b8; font-style:italic; margin-top:28px;">Documento generato automaticamente da Palazzinaro AI.</p>
    </div>
  `;

  document.body.appendChild(container);

  const cleanup = () => {
    if (document.body.contains(container)) container.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  // Rete di sicurezza nel caso "afterprint" non scatti in qualche browser/flusso di stampa.
  setTimeout(cleanup, 60000);

  window.print();
}

// ─────────────────────────────────────────────────────────────────────────────
// ESPORTAZIONE EXCEL — compatibile con Excel/Google Sheets reale (libreria xlsx),
// mai un CSV improvvisato.
// ─────────────────────────────────────────────────────────────────────────────
export function exportLedgerToExcel(opts: LedgerExportOptions): void {
  const { title, subtitle, columns, rows, totalsRow, filenameBase } = opts;

  const aoa: any[][] = [];
  aoa.push([`Palazzinaro AI — ${title}`]);
  if (subtitle) aoa.push([subtitle]);
  aoa.push([`Generato il ${new Date().toLocaleDateString("it-IT")}`]);
  aoa.push([]);
  aoa.push(columns.map(c => c.label));
  rows.forEach(r => aoa.push(columns.map(c => cellText(c, r))));
  if (totalsRow) {
    aoa.push(columns.map(c => totalsRow[c.key] ?? ""));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = columns.map(c => ({ wch: Math.max(c.label.length + 4, 16) }));
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(columns.length - 1, 0) } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mastrino");
  XLSX.writeFile(wb, buildDatedFilename(filenameBase, "xlsx"));
}

// ─────────────────────────────────────────────────────────────────────────────
// ESPORTAZIONE PDF — tabella reale con TUTTE le colonne (jspdf-autotable), logo reale in
// intestazione come richiesto dall'identità visiva del progetto (regola 11: il logo va
// applicato ovunque compaia il brand, PDF incluso).
// ─────────────────────────────────────────────────────────────────────────────
export async function exportLedgerToPDF(opts: LedgerExportOptions): Promise<void> {
  const { title, subtitle, columns, rows, totalsRow, filenameBase } = opts;

  const orientation = columns.length > 5 ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let textStartX = margin;

  try {
    const img = await loadLogoImage();
    doc.addImage(img, "PNG", margin, 9, 12, 12);
    textStartX = margin + 16;
  } catch {
    // Logo non bloccante: se non si carica, l'esportazione procede comunque.
  }

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 32, 43);
  doc.text(`Palazzinaro AI — ${title}`, textStartX, 15, { maxWidth: pageWidth - textStartX - margin - 40 });

  if (subtitle) {
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, textStartX, 20.5, { maxWidth: pageWidth - textStartX - margin - 40 });
  }

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generato il ${new Date().toLocaleDateString("it-IT")}`, pageWidth - margin, 12, { align: "right" });

  const head = [columns.map(c => c.label)];
  const body = rows.map(r => columns.map(c => cellText(c, r)));
  const totalsBodyRow = totalsRow ? columns.map(c => totalsRow[c.key] ?? "") : null;
  const fullBody = totalsBodyRow ? [...body, totalsBodyRow] : body;

  const columnStyles: Record<number, any> = {};
  columns.forEach((c, i) => {
    if (c.align === "right") columnStyles[i] = { halign: "right" };
    else if (c.align === "center") columnStyles[i] = { halign: "center" };
  });

  autoTable(doc, {
    head,
    body: fullBody,
    startY: 26,
    styles: { font: "Helvetica", fontSize: 8, cellPadding: 2.2, textColor: [28, 37, 48], lineColor: [226, 232, 240], lineWidth: 0.1 },
    headStyles: { fillColor: [20, 32, 43], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles,
    margin: { left: margin, right: margin },
    didParseCell: (data: any) => {
      if (totalsBodyRow && data.section === "body" && data.row.index === fullBody.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [241, 245, 249];
      }
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 26;
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont("Helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Documento generato automaticamente da Palazzinaro AI.",
    margin,
    Math.min(finalY + 10, pageHeight - 10)
  );

  doc.save(buildDatedFilename(filenameBase, "pdf"));
}

// ─────────────────────────────────────────────────────────────────────────────
// CONDIVISIONE WHATSAPP — riepilogo testuale del mastrino, stesso schema wa.me già in uso
// nel resto dell'app (regola: pulizia numero mantenendo il "+").
// ─────────────────────────────────────────────────────────────────────────────
export function shareLedgerViaWhatsApp(opts: LedgerExportOptions, phone?: string): void {
  const { title, subtitle, columns, rows, totalsRow } = opts;

  const amountCol = columns.find(c => c.align === "right") || columns[columns.length - 1];
  const labelCol = columns.find(c => c !== amountCol) || columns[0];

  const lines = rows.map(r => `• ${cellText(labelCol, r)}: ${cellText(amountCol, r)}`);
  const totalLine = totalsRow ? `\nTotale: ${totalsRow[amountCol.key] ?? ""}` : "";

  const message = `*Palazzinaro AI — ${title}*${subtitle ? `\n${subtitle}` : ""}\nGenerato il ${new Date().toLocaleDateString("it-IT")}\n\n${lines.join("\n")}${totalLine}\n\n_Messaggio generato automaticamente dal sistema Palazzinaro AI._`;

  const cleanPhone = phone ? phone.replace(/[^0-9+]/g, "") : "";
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank");
}
