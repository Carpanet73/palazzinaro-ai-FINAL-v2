
import { jsPDF } from "jspdf";

interface MessaInMoraOwner {
  name: string;
  birthPlace?: string;
  birthDate?: string; // YYYY-MM-DD
  residenceAddress?: string; // stringa già formattata: via, civico, cap città (prov.)
  citta?: string; // per "Luogo e data"
  fiscalCode?: string;
  phone?: string;
  email?: string;
  pec?: string;
}

interface MessaInMoraOptions {
  tenantName: string;
  tenantAddress?: string; // indirizzo del debitore, se noto
  amount: number;
  description: string; // "descrizione del credito" — di cosa si tratta il dovuto
  owner: MessaInMoraOwner;
  propertyAddress?: string; // "immobile posto alla via ___"
  guarantor?: { name: string; fiscalCode?: string };
}

function formatItalianDate(dateStr?: string): string {
  if (!dateStr) return "___________";
  try {
    return new Date(dateStr).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
}

/**
 * Genera la Diffida e Messa in Mora seguendo la struttura formale classica di una lettera
 * legale (intestazione mittente, luogo/data, destinatario, oggetto in grassetto, riferimenti
 * normativi, corpo con premessa/intimazione/termine/avvertimento, modalità di invio, firma) —
 * MA con il proprietario come mittente e firmatario, mai un ufficio legale inesistente.
 * Rispetta il modello dettato dall'utente (formula "io sottoscritto", termine di 7 giorni) e
 * la dicitura di generazione AI a piè di pagina.
 */
export function generateMessaInMoraPDF(opts: MessaInMoraOptions) {
  const doc = new jsPDF();
  const margin = 20;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;
  const { tenantName, tenantAddress, amount, description, owner, propertyAddress, guarantor } = opts;
  const currentDate = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
  const luogoData = owner.citta ? `${owner.citta}, lì ${currentDate}` : currentDate;

  let y = 22;

  // ── Intestazione / Mittente (come una vera carta intestata) ──
  doc.setFont("Times", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(owner.name, margin, y);
  y += 5.5;
  doc.setFont("Times", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  if (owner.residenceAddress) {
    doc.text(owner.residenceAddress, margin, y);
    y += 4.5;
  }
  const mittenteContacts = [
    owner.fiscalCode ? `C.F.: ${owner.fiscalCode}` : null,
    owner.phone ? `Tel: ${owner.phone}` : null,
    owner.email ? `Email: ${owner.email}` : null,
    owner.pec ? `PEC: ${owner.pec}` : null
  ].filter(Boolean).join("   ");
  if (mittenteContacts) {
    doc.text(mittenteContacts, margin, y);
    y += 4.5;
  }

  // ── Luogo e data, in alto a destra ──
  doc.setFont("Times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(luogoData, pageWidth - margin, 22, { align: "right" });

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 2, pageWidth - margin, y + 2);
  y += 12;

  // ── Destinatario ──
  doc.setFont("Times", "bold");
  doc.setFontSize(11);
  doc.text(`Spett.le ${tenantName}`, margin, y);
  y += 6;
  doc.setFont("Times", "normal");
  doc.setFontSize(10);
  doc.text(tenantAddress || "Presso l'immobile condotto in locazione", margin, y);
  y += 6;

  if (guarantor?.name) {
    doc.setFont("Times", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `E, per conoscenza: ${guarantor.name}${guarantor.fiscalCode ? " (C.F. " + guarantor.fiscalCode + ")" : ""}, in qualità di garante`,
      margin,
      y
    );
    doc.setTextColor(15, 23, 42);
    y += 6;
  }

  y += 8;

  // ── Oggetto, in grassetto ──
  doc.setFont("Times", "bold");
  doc.setFontSize(10.5);
  doc.text(`Oggetto: Messa in mora e intimazione di pagamento — Euro ${amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`, margin, y, { maxWidth: contentWidth });
  y += 12;

  // ── Corpo della lettera, formula "io sottoscritto" ──
  doc.setFont("Times", "normal");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);

  const paragraph1 =
    `Io sottoscritto ${owner.name}, nato a ${owner.birthPlace || "___________"}, il ${formatItalianDate(owner.birthDate)}, ` +
    `residente in ${owner.residenceAddress || "___________"}, nella mia qualità di proprietario dell'immobile posto alla via ` +
    `${propertyAddress || "___________"},`;

  const paragraph2 =
    `con la presente, ai sensi e per gli effetti dell'art. 1219 del Codice Civile, intimo formalmente il pagamento della somma di € ${amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}, ` +
    `relativa a ${description}, entro e non oltre 7 (sette) giorni dal ricevimento della presente.`;

  const paragraph3 =
    `Decorso inutilmente tale termine, mi vedrò costretto ad adire le vie legali, con aggravio di costi a vostro carico.`;

  const paragraph4 =
    `La presente costituisce atto formale di costituzione in mora a tutti gli effetti di legge e verrà trasmessa a mezzo Raccomandata A/R e/o posta elettronica certificata (PEC), a garanzia della prova di ricezione.`;

  [paragraph1, paragraph2, paragraph3, paragraph4].forEach(paragraph => {
    const lines = doc.splitTextToSize(paragraph, contentWidth);
    doc.text(lines, margin, y, { align: "justify" });
    y += lines.length * 6 + 5;
  });

  y += 2;
  doc.text("Distinti saluti.", margin, y);
  y += 18;

  // ── Luogo e data (ripetuti prima della firma), poi Firma ──
  doc.setFont("Times", "normal");
  doc.setFontSize(10.5);
  doc.text(luogoData, margin, y);
  y += 14;
  doc.setFont("Times", "italic");
  doc.text("Firma: ______________________________", margin, y);
  y += 8;
  doc.setFont("Times", "bold");
  doc.setFontSize(9.5);
  doc.text(`(${owner.name})`, margin, y);

  // ── Piè di pagina — SOLO la dicitura richiesta, nient'altro ──
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Questa comunicazione è stata generata dall'intelligenza artificiale del sistema di gestione immobiliare Palazzinaro AI\u00AE",
    pageWidth / 2,
    285,
    { align: "center" }
  );

  // Trigger file download
  doc.save(`Diffida_Messa_In_Mora_${tenantName.replace(/\s+/g, "_")}.pdf`);
}

interface DisdettaAnticipataOptions {
  tenantName: string;
  tenantAddress?: string;
  propertyAddress?: string;
  owner: MessaInMoraOwner; // il Locatore/mittente è sempre firmatario, stesso schema della Messa in Mora
  party: "Locatore" | "Conduttore"; // chi ha dato la disdetta
  reasonLabel: string; // già risolta (etichetta + eventuale testo libero per "Altro")
  legalRef?: string;
  effectiveDate: string; // YYYY-MM-DD
  bodyText: string; // testo della comunicazione (bozza editabile confermata dall'utente)
}

/**
 * Genera il documento reale di Disdetta Anticipata del Contratto (CORREZIONE CL,
 * 05/08/2026), stesso stile formale e stesso schema mittente/firmatario/piè di pagina
 * AI della Messa in Mora — ma con testo del corpo passato dal chiamante (bozza già
 * rivista/modificata dall'utente nel wizard), non generato di nuovo qui.
 */
export function generateDisdettaAnticipataPDF(opts: DisdettaAnticipataOptions) {
  const doc = new jsPDF();
  const margin = 20;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;
  const { tenantName, tenantAddress, owner, party, reasonLabel, effectiveDate, bodyText } = opts;
  const currentDate = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
  const luogoData = owner.citta ? `${owner.citta}, lì ${currentDate}` : currentDate;

  let y = 22;

  // ── Intestazione / Mittente ──
  doc.setFont("Times", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(owner.name, margin, y);
  y += 5.5;
  doc.setFont("Times", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  if (owner.residenceAddress) {
    doc.text(owner.residenceAddress, margin, y);
    y += 4.5;
  }
  const mittenteContacts = [
    owner.fiscalCode ? `C.F.: ${owner.fiscalCode}` : null,
    owner.phone ? `Tel: ${owner.phone}` : null,
    owner.email ? `Email: ${owner.email}` : null,
    owner.pec ? `PEC: ${owner.pec}` : null
  ].filter(Boolean).join("   ");
  if (mittenteContacts) {
    doc.text(mittenteContacts, margin, y);
    y += 4.5;
  }

  doc.setFont("Times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(luogoData, pageWidth - margin, 22, { align: "right" });

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 2, pageWidth - margin, y + 2);
  y += 12;

  // ── Destinatario (sempre il Conduttore, anche quando è lui ad aver dato la disdetta:
  // il documento resta una comunicazione formale del sistema verso l'inquilino) ──
  doc.setFont("Times", "bold");
  doc.setFontSize(11);
  doc.text(`Spett.le ${tenantName}`, margin, y);
  y += 6;
  doc.setFont("Times", "normal");
  doc.setFontSize(10);
  doc.text(tenantAddress || "Presso l'immobile condotto in locazione", margin, y);
  y += 14;

  // ── Oggetto ──
  doc.setFont("Times", "bold");
  doc.setFontSize(10.5);
  doc.text(
    `Oggetto: Disdetta Anticipata del Contratto di Locazione — decorrenza ${formatItalianDate(effectiveDate)}`,
    margin, y, { maxWidth: contentWidth }
  );
  y += 8;
  doc.setFont("Times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Parte che ha comunicato la disdetta: ${party} — Causale: ${reasonLabel}`, margin, y, { maxWidth: contentWidth });
  doc.setTextColor(15, 23, 42);
  y += 10;

  // ── Corpo della lettera (bozza confermata dall'utente, un paragrafo per blocco \n\n) ──
  doc.setFont("Times", "normal");
  doc.setFontSize(11);
  const paragraphs = bodyText.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  paragraphs.forEach(paragraph => {
    const lines = doc.splitTextToSize(paragraph, contentWidth);
    doc.text(lines, margin, y, { align: "justify" });
    y += lines.length * 6 + 5;
  });

  y += 6;
  doc.setFont("Times", "normal");
  doc.setFontSize(10.5);
  doc.text(luogoData, margin, y);
  y += 14;
  doc.setFont("Times", "italic");
  doc.text("Firma: ______________________________", margin, y);
  y += 8;
  doc.setFont("Times", "bold");
  doc.setFontSize(9.5);
  doc.text(`(${owner.name})`, margin, y);

  // ── Piè di pagina — stessa dicitura obbligatoria della Messa in Mora ──
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Questa comunicazione è stata generata dall'intelligenza artificiale del sistema di gestione immobiliare Palazzinaro AI®",
    pageWidth / 2,
    285,
    { align: "center" }
  );

  doc.save(`Disdetta_Anticipata_${tenantName.replace(/\s+/g, "_")}.pdf`);
}
