
import { jsPDF } from "jspdf";

interface MessaInMoraOwner {
  name: string;
  birthPlace?: string;
  birthDate?: string; // YYYY-MM-DD
  residenceAddress?: string; // stringa già formattata: via, civico, cap città (prov.)
  citta?: string; // per "Luogo e data" finale
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
 * Genera la Diffida e Messa in Mora esattamente nel formato richiesto: una lettera diretta
 * "io sottoscritto", con il proprietario come mittente e firmatario (mai un ufficio legale
 * inesistente), termine di 7 giorni, e la dicitura di generazione AI a piè di pagina.
 */
export function generateMessaInMoraPDF(opts: MessaInMoraOptions) {
  const doc = new jsPDF();
  const margin = 20;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;
  const { tenantName, tenantAddress, amount, description, owner, propertyAddress, guarantor } = opts;

  let y = 25;

  // ── Destinatario ──
  doc.setFont("Times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
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
    `con la presente intimo formalmente il pagamento della somma di € ${amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}, ` +
    `relativa a ${description}, entro e non oltre 7 (sette) giorni dal ricevimento della presente.`;

  const paragraph3 =
    `Decorso inutilmente tale termine, mi vedrò costretto ad adire le vie legali, con aggravio di costi a vostro carico.`;

  [paragraph1, paragraph2, paragraph3].forEach(paragraph => {
    const lines = doc.splitTextToSize(paragraph, contentWidth);
    doc.text(lines, margin, y, { align: "justify" });
    y += lines.length * 6 + 5;
  });

  y += 4;
  doc.text("Distinti saluti.", margin, y);
  y += 20;

  // ── Luogo e data di residenza del proprietario, poi Firma ──
  const currentDate = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
  const luogoData = owner.citta ? `${owner.citta}, ${currentDate}` : currentDate;
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

  // ── Contatti del proprietario ──
  y += 14;
  doc.setFont("Times", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const contactsLine = [
    owner.phone ? `Tel: ${owner.phone}` : null,
    owner.email ? `Email: ${owner.email}` : null,
    owner.pec ? `PEC: ${owner.pec}` : null
  ].filter(Boolean).join("   —   ");
  if (contactsLine) {
    doc.text(contactsLine, margin, y);
  }

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
