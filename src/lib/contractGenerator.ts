/**
 * contractGenerator.ts
 *
 * CORREZIONE BN — Genera un contratto di locazione in formato .docx, identico nella forma
 * (stessa impaginazione, stessi grassetti/corsivi/sottolineature) al modello reale fornito
 * dall'utente il 27/07/2026, sostituendo i dati variabili con quelli veri presi dall'app
 * (Proprietario/i, Immobile, Inquilino, termini del Contratto).
 *
 * Le 15 clausole restano fisse (boilerplate legale) — cambia solo quello che deve
 * effettivamente cambiare da contratto a contratto.
 *
 * NOTA IMPORTANTE PER MASSIMO (da rivedere insieme): il modello originale usa le forme
 * femminili ("locatrice", "conduttrice", "nata") perché sia il proprietario che l'inquilina
 * di quell'esempio sono donne. Questo generatore sceglie automaticamente le forme corrette
 * (locatore/locatrice, nato/nata, ecc.) in base a un campo "gender" (M/F) — che però OGGI
 * NON esiste ancora nelle anagrafiche Owner/Tenant dell'app. Finché non lo aggiungiamo,
 * il generatore assume per default il maschile (locatore, conduttore, nato) quando il
 * genere non è specificato. Da correggere quando aggiungiamo il campo genere alle
 * anagrafiche — segnalato anche nel riepilogo finale.
 */

import {
  Document, Packer, Paragraph, TextRun, AlignmentType, UnderlineType, LevelFormat
} from "docx";

export interface ContractGenPerson {
  name: string;
  gender?: "M" | "F"; // vedi nota sopra — default M se assente
  // CORREZIONE CC — campo aggiunto per preparare un task dedicato futuro: quando la
  // persona è una società (isCompany true), le forme dovrebbero essere societarie
  // ("con sede in", "in persona del legale rappresentante") invece di "nato/a a" e
  // locatore/locatrice a seconda del genere. Il ramo di generazione per questo caso
  // NON è ancora implementato qui sotto — resta il limite noto finché non si fa
  // quel task specifico (richiede di rivedere tutta la logica testuale del contratto).
  isCompany?: boolean;
  birthPlace?: string;
  birthDate?: string; // formato leggibile, es. "03.03.1974" (già formattato, non YYYY-MM-DD)
  fiscalCode?: string;
  residenceAddressFormatted?: string; // es. "residente a Prato (PO), via X n. 31"
  isForeign?: boolean;
  residencePermit?: {
    number?: string;
    issuedDateFormatted?: string;
    validity?: string; // "illimitata" oppure una data
  };
}

export interface ContractGenData {
  owners: ContractGenPerson[]; // uno o più (comproprietà)
  tenant: ContractGenPerson;
  property: {
    fullAddressWithFloor: string; // es. "Prato, via dell'Alberaccio n. 31, piano primo lato destro..."
    comuneCatastale: string; // es. "Prato" — per "N.C.E.U. di ___"
    cadastral: {
      foglio?: string;
      particella?: string;
      subalterno?: string;
      categoria?: string;
      vaniCatastali?: string;
      classe?: string;
      renditaCatastale?: string;
    };
    energyClass?: {
      classe?: string;
      ipeGlobale?: string;
    };
  };
  contract: {
    durationYears: number;
    durationYearsWords: string; // es. "quattro"
    startDateFormatted: string; // es. "1° Maggio 2025"
    endDateFormatted: string; // es. "30 Aprile 2029"
    annualRent: string; // es. "7800.00"
    annualRentWords: string; // es. "settemilaottocento/00"
    monthlyRent: string; // es. "650.00"
    monthlyRentWords: string; // es. "seicentocinquanta/00"
    taxRegime: "CedolareSecca" | "Ordinaria";
    signPlace: string; // di norma la città di residenza del proprietario
    signDateFormatted: string; // es. "2 Maggio 2025"
  };
}

function centered(text: string, opts: { bold?: boolean; italics?: boolean } = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text, ...opts })]
  });
}

function bodyParagraph(text: string, opts: { spacingAfter?: number } = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: opts.spacingAfter ?? 200 },
    children: [new TextRun({ text })]
  });
}

// CORREZIONE BS — bug reale: la versione precedente inseriva un tab letterale
// (`${num})\t${text}`) senza un tabStop coerente con l'hanging indent del paragrafo,
// quindi Word usava il suo tab di default (in genere 720 twips) invece dei 400 twips
// dell'indentatura: risultato, spaziatura incoerente tra il numero e il testo e a
// capo che non si allineava sotto il testo (non sotto il numero) come nel modello
// originale. Qui si usa invece il motore di numerazione nativo di Word — lo stesso
// che genera "1)  Testo" nel file Word fornito dall'utente — che calcola da solo la
// posizione del tab in base alla larghezza del numero.
const CLAUSES_NUMBERING_REFERENCE = "contract-clauses";

function numberedClause(text: string) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 200 },
    numbering: { reference: CLAUSES_NUMBERING_REFERENCE, level: 0 },
    children: [new TextRun({ text })]
  });
}

/**
 * Genera il documento .docx del contratto e restituisce un Blob pronto da scaricare o
 * inviare come allegato (es. tramite Resend).
 */
export async function generateContractDocx(data: ContractGenData): Promise<Blob> {
  const owners = data.owners;
  const isPlural = owners.length > 1;

  const ownerGenderIsF = (o: ContractGenPerson) => o.gender === "F";
  const singleOwnerIsF = !isPlural && ownerGenderIsF(owners[0]);

  const locatoreLabel = isPlural ? "locatori" : (singleOwnerIsF ? "locatrice" : "locatore");
  const conduttoreLabel = ownerGenderIsF(data.tenant) ? "conduttrice" : "conduttore";
  const proprietariVerbo = isPlural
    ? "I nominati locatori sono proprietari"
    : (singleOwnerIsF ? "La nominata locatrice è proprietaria" : "Il nominato locatore è proprietario");

  // Blocco anagrafico proprietario/i — supporta comproprietà (più nominativi)
  const ownerBlockText = owners
    .map((o, idx) => {
      const natoNata = ownerGenderIsF(o) ? "nata" : "nato";
      const connector = idx === 0 ? "" : (idx === owners.length - 1 ? "e " : "");
      return `${connector}${o.name}, ${natoNata} a ${o.birthPlace || "___________"} il ${o.birthDate || "___________"}, ${o.residenceAddressFormatted || "residente in ___________"}, C.F. ${o.fiscalCode || "___________"}`;
    })
    .join(", ");

  // Blocco inquilino, con permesso di soggiorno se straniero
  const tenantNatoNata = ownerGenderIsF(data.tenant) ? "nata" : "nato";
  const permitText = data.tenant.isForeign && data.tenant.residencePermit
    ? `, munita di permesso di soggiorno${data.tenant.residencePermit.validity === "illimitata" ? " permanente" : ""} n. ${data.tenant.residencePermit.number || "___________"}, rilasciato il ${data.tenant.residencePermit.issuedDateFormatted || "___________"}, con validità ${data.tenant.residencePermit.validity === "illimitata" ? "illimitata" : (data.tenant.residencePermit.validity || "___________")}`
    : "";
  const tenantBlockText = `${data.tenant.name}, ${tenantNatoNata} a ${data.tenant.birthPlace || "___________"} il ${data.tenant.birthDate || "___________"}, C.F. ${data.tenant.fiscalCode || "___________"}, ${data.tenant.residenceAddressFormatted || "residente in ___________"}${permitText}`;

  const c = data.property.cadastral || {};
  const cadastralText = `descritto al N.C.E.U. di ${data.property.comuneCatastale}, Foglio ${c.foglio || "___"}, particella Sub. ${c.particella || "___"}, sub. ${c.subalterno || "___"}, categoria ${c.categoria || "___"}, vani catastali ${c.vaniCatastali || "___"}, Classe ${c.classe || "___"}, rendita catastale € ${c.renditaCatastale || "___"}`;

  // Clausola 3 — cambia in base al regime fiscale
  const clause3Text = data.contract.taxRegime === "CedolareSecca"
    ? `Il presente contratto di locazione è, come formalmente comunicato alla ${conduttoreLabel}, soggetto all'opzione della ${locatoreLabel} per la tassazione fatta ad imposta sostitutiva (c.d. cedolare secca) del canone di locazione. Per effetto di tale opzione non è più dovuto il pagamento dell'imposta annuale di registro, né l'aggiornamento del canone secondo gli indici ISTAT.`
    : `Il presente contratto è soggetto a registrazione ordinaria presso l'Agenzia delle Entrate, con imposta di registro a carico delle parti nella misura di legge. Il canone di locazione sarà aggiornato annualmente secondo la variazione dell'indice ISTAT dei prezzi al consumo per le famiglie di operai e impiegati, con preavviso scritto alla ${conduttoreLabel} prima dell'applicazione del nuovo importo.`;

  const energyClause = data.property.energyClass?.classe
    ? `Le parti danno atto che alla ${conduttoreLabel} è stata consegnata la certificazione energetica (APE) come per legge, relativa all'immobile locato, il quale si trova in classe energetica "${data.property.energyClass.classe}"${data.property.energyClass.ipeGlobale ? `, con I.P.E. globale ${data.property.energyClass.ipeGlobale}` : ""}.`
    : `Le parti danno atto che alla ${conduttoreLabel} è stata consegnata la certificazione energetica (APE) come per legge, relativa all'immobile locato.`;

  const doc = new Document({
    numbering: {
      config: [{
        reference: CLAUSES_NUMBERING_REFERENCE,
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1)",
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: {
              indent: { left: 420, hanging: 420 }
            }
          }
        }]
      }]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
        }
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [new TextRun({
            text: "SCRITTURA PRIVATA DI LOCAZIONE ABITATIVA AI SENSI DELLA LEGGE 9.12.1998 N. 431 ART. 2 COMMA 1°",
            bold: true,
            underline: { type: UnderlineType.SINGLE }
          })]
        }),

        bodyParagraph(`${ownerBlockText},`, { spacingAfter: 100 }),
        centered(locatoreLabel, { italics: true }),
        centered("E", { bold: true }),
        bodyParagraph(`${tenantBlockText},`, { spacingAfter: 100 }),
        centered(conduttoreLabel, { italics: true }),
        centered("convengono e stipulano quanto segue", { bold: true }),

        numberedClause(`${proprietariVerbo} di un quartiere per uso di civile abitazione posto in ${data.property.fullAddressWithFloor}, ${cadastralText} che, a norma dell'art. 2 comma 1° L. 431/98, concede in locazione alla nominata ${conduttoreLabel}, affinchè lo adibisca ad esclusivo uso abitativo per la durata di ${data.contract.durationYears} (${data.contract.durationYearsWords}) anni a decorrere dal ${data.contract.startDateFormatted} e fino al ${data.contract.endDateFormatted}, al canone annuo di € ${data.contract.annualRent} (${data.contract.annualRentWords}), da corrispondersi in rate mensili anticipate di € ${data.contract.monthlyRent} (${data.contract.monthlyRentWords}) ciascuna, al domicilio della ${locatoreLabel} il giorno primo di ogni mese.`
        ),
        numberedClause(`Il contratto verrà tacitamente rinnovato per uguale periodo, in caso di mancata disdetta, da inviarsi sei mesi prima della scadenza del ${data.contract.endDateFormatted}, mediante lettera raccomandata, soltanto ed esclusivamente in presenza di uno dei motivi di cui all'art. 3 comma 1° L431/98 lettere a-b-c-d-e-f-g. La ${conduttoreLabel} potrà recedere anticipatamente, con preavviso di almeno sei mesi, ove ricorrano gravi motivi. In occasione della seconda scadenza quadriennale il contratto potrà essere risolto con semplice disdetta, da inviarsi sei mesi prima, mediante lettera raccomandata, nel caso che lo stesso non sia rinegoziato a nuove condizioni. In proposito, le parti si richiamano alla normativa contenuta nella parte finale del 1° comma dell'art. 2 L. 431/98.`
        ),
        numberedClause(clause3Text),
        numberedClause(`Il ritardo superiore a 20 (venti) giorni nel pagamento anche di una sola rata mensile, comporterà la risoluzione del contratto per grave inadempimento della ${conduttoreLabel}.`
        ),
        numberedClause(`In caso di ritardo nel pagamento del canone, la ${conduttoreLabel} dovrà corrispondere gli interessi moratori al tasso annuo del 5%.`
        ),
        numberedClause(`La sublocazione e la cessione del contratto sono vietate sotto pena di risoluzione immediata del contratto.`
        ),
        numberedClause(`Nel caso che la ${conduttoreLabel} non rispetti la scadenza del contratto, ritardando il rilascio dell'immobile, sarà obbligata al risarcimento del danno.`
        ),
        numberedClause(`Le spese occorrenti per l'ordinaria manutenzione, amministrazione e assicurazione dell'immobile sono a carico della ${conduttoreLabel}. Manutenzioni e interventi straordinari sono a carico della ${locatoreLabel}, la quale potrà richiedere un aumento del canone pari al tasso legale del capitale impiegato; se non corrisposto da parte della ${locatoreLabel}, sarà considerato inadempimento di gravità tale da giustificare la risoluzione del contratto.`
        ),
        numberedClause(`La ${conduttoreLabel} è obbligata a pagare le spese per la luce e la pulizia delle scale, per il riscaldamento ed ogni utenza da essa goduta, oltre alla vuotatura delle fosse biologiche.`
        ),
        numberedClause(`Ogni eventuale lavoro, modifica e/o addizione che la ${conduttoreLabel} riterrà di eseguire, dovrà essere autorizzato dalla proprietaria e sarà ad esclusivo onere e spesa degli stessi esecutori, con totale esonero della ${locatoreLabel}. Migliorie e addizioni, al rilascio, rimarranno acquisite all'immobile, senza alcun compenso.`
        ),
        numberedClause(`La ${conduttoreLabel} è custode dell'immobile, per cui dovrà essere prudente e diligente, evitando che siano causati danni a terzi, siano essi vicini o abitanti nello stesso stabile, evitando che il quartiere da essa abitato sia danneggiato o distrutto, evitando di portare e/o installare in casa materiali o congegni, che possano dar luogo a esplosione e/o incendio.`
        ),
        numberedClause(`La ${conduttoreLabel} è obbligata a mantenere l'impianto elettrico, l'impianto di riscaldamento ed ogni altro a norma di legge e, comunque, in efficienza tale da garantire la sicurezza assoluta.`
        ),
        numberedClause(`Vale tra le parti la clausola "solve et repete", ovvero, la ${conduttoreLabel} non potrà in alcun caso sottrarsi all'obbligo di pagamento mensile del canone di locazione come previsto nel presente contratto. Eventuali eccezioni e/o contestazioni dovranno essere fatte valere in separata sede e non potranno legittimare la sospensione del pagamento del citato canone di locazione.`
        ),
        numberedClause(`L'immobile è dotato di ogni impianto a norma di legge.`),
        numberedClause(energyClause),

        new Paragraph({ spacing: { before: 400, after: 200 }, children: [new TextRun({ text: `${data.contract.signPlace}, lì ${data.contract.signDateFormatted},` })] }),

        new Paragraph({
          spacing: { before: 300, after: 400 },
          tabStops: [{ type: "right" as any, position: 9000 }],
          children: [
            new TextRun({ text: `LA ${locatoreLabel.toUpperCase()}` }),
            new TextRun({ text: `\t\tLA ${conduttoreLabel.toUpperCase()}` })
          ]
        }),

        bodyParagraph(`Ricevono separata e specifica approvazione le seguenti clausole:\n4-5-6-7-8-10-13`, { spacingAfter: 300 }),

        new Paragraph({
          spacing: { before: 300 },
          tabStops: [{ type: "right" as any, position: 9000 }],
          children: [
            new TextRun({ text: `LA ${locatoreLabel.toUpperCase()}` }),
            new TextRun({ text: `\t\tLA ${conduttoreLabel.toUpperCase()}` })
          ]
        }),
      ]
    }]
  });

  return Packer.toBlob(doc);
}
