
import { jsPDF } from "jspdf";

/**
 * Generates a professional PDF document for the "Diffida e Messa in Mora" letter.
 */
export function generateMessaInMoraPDF(tenantName: string, amount: number, dueDate: string) {
  const doc = new jsPDF();
  
  // Border decoration
  doc.setDrawColor(220, 38, 38); // Red border highlight
  doc.setLineWidth(1.5);
  doc.line(15, 12, 195, 12);
  
  // Brand Header
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("PALAZZINARO AI", 15, 22);
  
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("Servizio Legale & Gestione Crediti Integrato • Ufficio Pre-Contenzioso", 15, 27);
  doc.line(15, 30, 195, 30);
  
  // Letter Date
  const currentDate = new Date().toLocaleDateString("it-IT");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85); // slate-700
  doc.text(`Data di emissione: ${currentDate}`, 15, 38);
  
  // Sender and Recipient info cards
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(10);
  doc.text("MITTENTE (Locatore / Amministratore):", 15, 48);
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Ufficio Legale Palazzinaro AI\nStudio Amministratore Associato\nEmail: legale@palazzinaro.ai", 15, 53);
  
  doc.setFont("Helvetica", "bold");
  doc.text("DESTINATARIO (Inquilino Moroso):", 115, 48);
  doc.setFont("Helvetica", "normal");
  doc.text(`Spett.le ${tenantName}\nPresso l'immobile in locazione\nCodice Pratica: PM-${Math.floor(100000 + Math.random() * 900000)}`, 115, 53);
  
  // Subject Block
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(153, 27, 27); // red-800
  doc.text("OGGETTO: DIFFIDA AD ADEMPIERE E FORMALE MESSA IN MORA AI SENSI DELL'ART. 1219 C.C.", 15, 78);
  doc.line(15, 81, 195, 81);
  
  // Letter Body
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42); // slate-900
  
  const bodyText = `La presente in nome e per conto della proprietà dell'immobile da Lei condotto in locazione.

Con la presente si riscontra e si contesta formalmente il mancato pagamento delle scadenze contabili pattuite nel Suo contratto di locazione. Ad oggi, la Sua posizione debitoria registra scadenze insolute per un importo totale dovuto pari a complessivi Euro ${amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}.

Tale morosità persiste infruttuosamente nonostante i precedenti solleciti di pagamento già trasmessi, i quali sono rimasti privi di riscontro concreto o di pagamento satisfattivo delle spettanze.

Pertanto, con la presente, ai sensi e per gli effetti dell'art. 1219 del Codice Civile italiano,

                                               SI INTIMA E DIFFIDA FORMALMENTE

la S.V. a provvedere all'integrale saldo della somma sopra indicata (Euro ${amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}) entro e non oltre il termine perentorio di 15 (quindici) giorni dal ricevimento della presente, a mezzo bonifico bancario sulle coordinate fornite dall'amministrazione di questo studio.

La avvertiamo che, decorso inutilmente tale termine di 15 giorni senza che si sia provveduto all'accredito dei fondi, saremo costretti, senza alcun ulteriore preavviso o sollecito, ad adire le vie legali con aggravio di tutte le spese a Suo esclusivo carico, procedendo giudizialmente per la risoluzione del contratto di locazione per inadempimento e lo sfratto per morosità con decreto ingiuntivo immediatamente esecutivo.

La presente costituisce atto formale di costituzione in mora e vale ad ogni effetto di legge, in particolare ai fini dell'interruzione dei termini di prescrizione e del computo degli interessi legali e di mora dovuti.`;

  const splitText = doc.splitTextToSize(bodyText, 180);
  doc.text(splitText, 15, 88);
  
  // Footnote and Signature
  doc.line(15, 235, 195, 235);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text("Ufficio Legale Palazzinaro AI", 15, 243);
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Documento firmato digitalmente e archiviato elettronicamente a norma di legge.\nLa notifica cartacea ufficiale avverrà tramite Raccomandata A/R.", 15, 248);
  
  // Trigger file download
  doc.save(`Diffida_Messa_In_Mora_${tenantName.replace(/\s+/g, "_")}.pdf`);
}

