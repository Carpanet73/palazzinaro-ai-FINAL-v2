
/**
 * Vercel Serverless Function — /api/extract
 *
 * Equivalent to the Express `POST /api/extract` endpoint in `server.ts`,
 * but adapted to Vercel's zero-config serverless model.
 *
 * The frontend calls this endpoint to ask Gemini to extract structured data
 * from text / images for various contexts (contracts, tenants, banks, etc.).
 *
 * Required environment variable (set in Vercel Project Settings → Environment Variables):
 *   - GEMINI_API_KEY
 */

import { GoogleGenAI, Type } from "@google/genai";

// ---------------------------------------------------------------------------
// Gemini client (lazy singleton, instantiated on first cold start)
// ---------------------------------------------------------------------------
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is missing. Add it in Vercel → Project Settings → Environment Variables."
      );
    }
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "palazzinaro-ai-vercel",
        },
      },
    });
  }
  return ai;
}

// ---------------------------------------------------------------------------
// Per-context system prompts and response schemas
// (Mirrors the switch/case in server.ts exactly)
// ---------------------------------------------------------------------------

interface ContextConfig {
  systemInstruction: string;
  responseSchema: any;
}

function buildContextConfig(context: string, userPrompt?: string): ContextConfig {
  switch (context) {
    case "contracts":
      return {
        systemInstruction: `Sei un assistente specializzato in gestione immobiliare. Estrai i dettagli di un contratto di locazione dal testo o immagine fornita.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "propertyName": "Nome o indirizzo dell'immobile (es: Monolocale Milano)",
  "ownerName": "Nome completo del locatore / proprietario",
  "tenantName": "Nome completo del conduttore / inquilino",
  "startDate": "Data di inizio contratto nel formato YYYY-MM-DD",
  "endDate": "Data di scadenza contratto nel formato YYYY-MM-DD",
  "rentAmount": 1200, // canone mensile come numero
  "frequency": "Mensile", // "Mensile", "Annuale", "Trimestrale"
  "status": "Active",
  "notes": "Eventuali note aggiuntive estratte (es: deposito cauzionale, spese incluse, cedolare secca)"
}
Se un dato non è presente nel testo, lascia una stringa vuota o null. Non aggiungere testi esplicativi fuori dal JSON.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            propertyName: { type: Type.STRING, description: "Nome o indirizzo dell'immobile (es: Monolocale Milano)" },
            ownerName: { type: Type.STRING, description: "Nome completo del locatore / proprietario" },
            tenantName: { type: Type.STRING, description: "Nome completo del conduttore / inquilino" },
            startDate: { type: Type.STRING, description: "Data di inizio contratto nel formato YYYY-MM-DD" },
            endDate: { type: Type.STRING, description: "Data di scadenza contratto nel formato YYYY-MM-DD" },
            rentAmount: { type: Type.NUMBER, description: "Canone mensile come numero" },
            frequency: { type: Type.STRING, description: "Frequenza (Mensile, Annuale, Trimestrale)" },
            status: { type: Type.STRING, description: "Stato (es: Active)" },
            notes: { type: Type.STRING, description: "Eventuali note aggiuntive estratte (es: deposito cauzionale, spese incluse, cedolare secca)" },
          },
          required: ["propertyName", "ownerName", "tenantName", "startDate", "endDate", "rentAmount", "frequency", "status", "notes"],
        },
      };

    case "condominiums":
      return {
        systemInstruction: `Sei un assistente specializzato in contabilità condominiale. Analizza il bilancio, preventivo, rendiconto o scadenziario fornito (testo o immagine) ed estrai i dati utili.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "name": "Nome del Condominio (es: Condominio Primavera)",
  "administrator": "Nome dell'amministratore",
  "phone": "Numero di telefono dell'amministratore o dello studio",
  "email": "Email dell'amministratore",
  "notes": "Riepilogo delle informazioni o note sul riparto",
  "rates": [
    {
      "title": "Nome della rata (es: Rata 1 Preventivo, Rata 2 Riscaldamento)",
      "amount": 150.50,
      "dueDate": "Scadenza nel formato YYYY-MM-DD",
      "notes": "Note specifiche per la rata"
    }
  ]
}
Estrai tutte le rate rilevate. Se non ci sono rate esplicite, creane una fittizia basandoti sui dati. Restituisci ESCLUSIVAMENTE il JSON.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Nome del Condominio" },
            administrator: { type: Type.STRING, description: "Nome dell'amministratore" },
            phone: { type: Type.STRING, description: "Telefono amministratore" },
            email: { type: Type.STRING, description: "Email amministratore" },
            notes: { type: Type.STRING, description: "Riepilogo / note sul riparto" },
            rates: {
              type: Type.ARRAY,
              description: "Rate rilevate",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Nome della rata" },
                  amount: { type: Type.NUMBER, description: "Importo della rata" },
                  dueDate: { type: Type.STRING, description: "Scadenza YYYY-MM-DD" },
                  notes: { type: Type.STRING, description: "Note specifiche" },
                },
                required: ["title", "amount", "dueDate", "notes"],
              },
            },
          },
          required: ["name", "administrator", "phone", "email", "notes", "rates"],
        },
      };

    case "condo_expenses":
      return {
        systemInstruction: `Sei un assistente specializzato in contabilità condominiale. Analizza il documento (rendiconto, bolletta comune, richiesta di pagamento) inviato dall'amministratore di condominio ed estrai UNA SOLA spesa/rata da ripartire.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "condoName": "Nome del Condominio se indicato sul documento (altrimenti stringa vuota)",
  "title": "Causale della spesa (es: Riscaldamento Centralizzato 1° Rata, Manutenzione Ascensore)",
  "amount": 350.00,
  "date": "Data del documento o scadenza, formato YYYY-MM-DD"
}
Se il documento contiene più voci, somma il totale complessivo in "amount" e riassumi le voci in "title". Restituisci ESCLUSIVAMENTE il JSON.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            condoName: { type: Type.STRING, description: "Nome del Condominio, se indicato" },
            title: { type: Type.STRING, description: "Causale della spesa" },
            amount: { type: Type.NUMBER, description: "Importo totale della spesa" },
            date: { type: Type.STRING, description: "Data del documento, YYYY-MM-DD" },
          },
          required: ["condoName", "title", "amount", "date"],
        },
      };

    case "identity_document":
      return {
        systemInstruction: `Sei un assistente specializzato nella lettura di documenti d'identità italiani (Carta d'Identità o Passaporto). Analizza la fotografia ed estrai i dati anagrafici.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "name": "Nome e Cognome completi",
  "gender": "M oppure F, dedotto dal documento (sesso/sex)",
  "birthPlace": "Comune (Provincia) di nascita, es: Prato (PO)",
  "birthDate": "Data di nascita nel formato GG.MM.AAAA",
  "fiscalCode": "Codice Fiscale se presente sul documento, altrimenti stringa vuota",
  "documentType": "Carta d'Identità oppure Passaporto",
  "documentNumber": "Numero del documento",
  "issuedDate": "Data di rilascio, formato YYYY-MM-DD",
  "expiryDate": "Data di scadenza, formato YYYY-MM-DD",
  "residenceAddress": "Indirizzo di residenza se presente sul documento, altrimenti stringa vuota"
}
Restituisci ESCLUSIVAMENTE il JSON.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            gender: { type: Type.STRING },
            birthPlace: { type: Type.STRING },
            birthDate: { type: Type.STRING },
            fiscalCode: { type: Type.STRING },
            documentType: { type: Type.STRING },
            documentNumber: { type: Type.STRING },
            issuedDate: { type: Type.STRING },
            expiryDate: { type: Type.STRING },
            residenceAddress: { type: Type.STRING },
          },
          required: ["name", "gender", "birthPlace", "birthDate", "fiscalCode", "documentType", "documentNumber", "issuedDate", "expiryDate", "residenceAddress"],
        },
      };

    case "residence_permit":
      return {
        systemInstruction: `Sei un assistente specializzato nella lettura di permessi di soggiorno italiani. Analizza la fotografia ed estrai i dati.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "number": "Numero del permesso di soggiorno",
  "issuedDate": "Data di rilascio, formato YYYY-MM-DD",
  "validity": "Se il permesso è a validità illimitata scrivi esattamente 'illimitata', altrimenti scrivi la data di scadenza nel formato YYYY-MM-DD"
}
Restituisci ESCLUSIVAMENTE il JSON.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            number: { type: Type.STRING },
            issuedDate: { type: Type.STRING },
            validity: { type: Type.STRING },
          },
          required: ["number", "issuedDate", "validity"],
        },
      };

    case "cadastral_data":
      return {
        systemInstruction: `Sei un assistente specializzato nella lettura di visure catastali italiane. Analizza il documento ed estrai i dati catastali dell'immobile.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "foglio": "Numero di Foglio",
  "particella": "Numero di Particella",
  "subalterno": "Numero di Subalterno",
  "categoria": "Categoria catastale, es: A/3",
  "vaniCatastali": "Numero di vani catastali",
  "classe": "Classe catastale",
  "renditaCatastale": "Rendita catastale in euro, solo il numero es: 387.34",
  "piano": "Piano dell'immobile, se indicato"
}
Restituisci ESCLUSIVAMENTE il JSON.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            foglio: { type: Type.STRING },
            particella: { type: Type.STRING },
            subalterno: { type: Type.STRING },
            categoria: { type: Type.STRING },
            vaniCatastali: { type: Type.STRING },
            classe: { type: Type.STRING },
            renditaCatastale: { type: Type.STRING },
            piano: { type: Type.STRING },
          },
          required: ["foglio", "particella", "subalterno", "categoria", "vaniCatastali", "classe", "renditaCatastale", "piano"],
        },
      };

    case "energy_certificate":
      return {
        systemInstruction: `Sei un assistente specializzato nella lettura di Attestati di Prestazione Energetica (APE) italiani. Analizza il documento ed estrai i dati.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "classe": "Classe energetica, es: F",
  "ipeGlobale": "Indice di Prestazione Energetica globale, con unità di misura, es: 201.48 KWh/mq anno",
  "issuedDate": "Data di emissione dell'attestato, formato YYYY-MM-DD",
  "expiryDate": "Data di scadenza dell'attestato (di norma 10 anni dopo l'emissione), formato YYYY-MM-DD"
}
Restituisci ESCLUSIVAMENTE il JSON.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            classe: { type: Type.STRING },
            ipeGlobale: { type: Type.STRING },
            issuedDate: { type: Type.STRING },
            expiryDate: { type: Type.STRING },
          },
          required: ["classe", "ipeGlobale", "issuedDate", "expiryDate"],
        },
      };

    case "banks":
      return {
        systemInstruction: `Sei un assistente di riconciliazione bancaria specializzato in entrate. Analizza la lista di movimenti bancari forniti (estratti conto, righe incollate, tabelle, CSV o immagine di ricevute/estratti conto).

REGOLA FONDAMENTALE: Estrai ESCLUSIVAMENTE le ENTRATE (movimenti POSITIVI con amount > 0).
Questi includono:
- Bonifici ricevuti (es. canoni affitto ricevuti dagli inquilini)
- Depositi di assegni
- Versamenti in contanti
- Accrediti di qualsiasi tipo
- Stipendi accreditati
- Rimborso spese

IGNORA COMPLETAMENTE (NON estrarre):
- Uscite / prelievi / pagamenti (amount negativo)
- Addebiti bollettte, commissioni, F24
- Bonifici inviati
- Prelievi bancomat
- Ogni altra uscita

Se un movimento è dubbio (es. importo misto), IGNORALO. Meglio perderlo che importare un'uscita per sbaglio.

Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "movements": [
    {
      "date": "Data operazione nel formato YYYY-MM-DD",
      "description": "Descrizione o causale del movimento bancario",
      "amount": 1500.00
    }
  ]
}
TUTTI gli amount DEVONO essere numeri POSITIVI (> 0). Se non trovi entrate, restituisci { "movements": [] }. Restituisci ESCLUSIVAMENTE il JSON.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            movements: {
              type: Type.ARRAY,
              description: "Solo movimenti di ENTRATA (amount > 0)",
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING, description: "Data YYYY-MM-DD" },
                  description: { type: Type.STRING, description: "Descrizione causale" },
                  amount: { type: Type.NUMBER, description: "Importo POSITIVO (> 0). Mai negativo." },
                },
                required: ["date", "description", "amount"],
              },
            },
          },
          required: ["movements"],
        },
      };

    case "bank_account":
      return {
        systemInstruction: `Sei un assistente finanziario specializzato in gestione patrimoniale. Estrai le informazioni del conto corrente bancario da documenti, screenshot, o ricevute di attivazione.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "iban": "Codice IBAN completo (es: IT60X0123456789012345678901)",
  "holder": "Nome completo dell'intestatario del conto corrente"
}
Se non trovi l'intestatario o l'IBAN, inserisci una stringa vuota o null per quel campo. Non aggiungere testi esplicativi fuori dal JSON.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            iban: { type: Type.STRING, description: "IBAN completo" },
            holder: { type: Type.STRING, description: "Intestatario" },
          },
          required: ["iban", "holder"],
        },
      };

    case "tenants":
      return {
        systemInstruction: `Sei un assistente immobiliare. Estrai le informazioni anagrafiche dell'inquilino o degli inquilini da documenti, carte d'identità o moduli (testo o immagine).
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "name": "Nome e Cognome dell'inquilino",
  "email": "Indirizzo email",
  "phone": "Numero di telefono",
  "fiscalCode": "Codice Fiscale",
  "notes": "Note sull'inquilino (es: garante, occupazione, referenze)"
}
Restituisci ESCLUSIVAMENTE il JSON.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Nome e Cognome" },
            email: { type: Type.STRING, description: "Email" },
            phone: { type: Type.STRING, description: "Telefono" },
            fiscalCode: { type: Type.STRING, description: "Codice Fiscale" },
            notes: { type: Type.STRING, description: "Note" },
          },
          required: ["name", "email", "phone", "fiscalCode", "notes"],
        },
      };

    case "solleciti":
    case "reminders":
      return {
        systemInstruction: `Sei un assistente legale immobiliare. Analizza il ritardo di pagamento (da testo o ricevute fotografate) e redigi una lettera di sollecito formale ma cortese.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "tenantName": "Nome dell'inquilino moroso",
  "amount": 450.00,
  "reason": "Descrizione del debito (es: Canone di locazione Giugno 2026)",
  "dueDate": "Scadenza originaria nel formato YYYY-MM-DD",
  "suggestedLetterBody": "Testo completo della lettera di sollecito formale pronta da inviare in italiano. Includi dettagli dell'immobile, l'importo arretrato, le coordinate per il pagamento e un termine di 7 giorni per adempiere.",
  "status": "Pending"
}
Restituisci ESCLUSIVAMENTE il JSON.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tenantName: { type: Type.STRING, description: "Nome inquilino" },
            amount: { type: Type.NUMBER, description: "Importo dovuto" },
            reason: { type: Type.STRING, description: "Causale debito" },
            dueDate: { type: Type.STRING, description: "Scadenza originaria" },
            suggestedLetterBody: { type: Type.STRING, description: "Lettera sollecito" },
            status: { type: Type.STRING, description: "Stato" },
          },
          required: ["tenantName", "amount", "reason", "dueDate", "suggestedLetterBody", "status"],
        },
      };

    case "properties":
      return {
        systemInstruction: `Sei un assistente specializzato in gestione immobiliare. Estrai i dettagli di un immobile dal testo o immagine fornita.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "name": "Nome descrittivo dell'immobile (es: Bilocale Via Roma)",
  "address": "Indirizzo completo",
  "type": "Tipologia (es: Appartamento, villa, Ufficio, Box)",
  "status": "Stato (es: Available, Rented, Maintenance)",
  "notes": "Eventuali note aggiuntive",
  "owner": "Nome completo del proprietario"
}`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Nome descrittivo" },
            address: { type: Type.STRING, description: "Indirizzo completo" },
            type: { type: Type.STRING, description: "Tipologia" },
            status: { type: Type.STRING, description: "Stato dell'immobile" },
            notes: { type: Type.STRING, description: "Note aggiuntive" },
            owner: { type: Type.STRING, description: "Proprietario" },
          },
          required: ["name", "address", "type", "status", "notes", "owner"],
        },
      };

    case "fast_closing":
      return {
        systemInstruction: `Sei un assistente specializzato in scadenze e adempimenti di chiusura. Estrai le informazioni necessarie per creare una scadenza o voce di chiusura.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "title": "Titolo o nome della scadenza (es: Tassa Rifiuti 2026)",
  "description": "Descrizione dei dettagli dell'adempimento",
  "amount": 150.00,
  "dueDate": "Scadenza nel formato YYYY-MM-DD"
}`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Titolo scadenza" },
            description: { type: Type.STRING, description: "Descrizione dettagliata" },
            amount: { type: Type.NUMBER, description: "Importo dovuto" },
            dueDate: { type: Type.STRING, description: "Scadenza" },
          },
          required: ["title", "description", "amount", "dueDate"],
        },
      };

    default:
      return {
        systemInstruction: `Sei un assistente esperto di gestione immobiliare. Analizza il documento fornito (testo o immagine) ed esegui le seguenti istruzioni: ${userPrompt || "Estrai le informazioni chiave in formato strutturato"}.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "title": "Titolo riepilogativo",
  "description": "Descrizione o sintesi dei punti principali",
  "entities": [],
  "estimatedAmount": 0,
  "extractedData": {}
}
Restituisci ESCLUSIVAMENTE il JSON.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Titolo riepilogativo" },
            description: { type: Type.STRING, description: "Descrizione o sintesi" },
            estimatedAmount: { type: Type.NUMBER, description: "Importo totale stimato" },
            entities: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Entità trovate",
            },
            extractedData: {
              type: Type.OBJECT,
              properties: {},
              description: "Dati aggiuntivi estratti",
            },
          },
          required: ["title", "description", "estimatedAmount"],
        },
      };
  }
}

// ---------------------------------------------------------------------------
// Vercel serverless handler
// ---------------------------------------------------------------------------

export default async function handler(req: any, res: any) {
  // CORS — same-origin in production, permissive for local dev (vite preview on different port)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
  }

  try {
    const { text, image, images, context, userPrompt } = req.body || {};

    if (!text && !image && (!images || images.length === 0)) {
      return res.status(400).json({ error: "No text, image, or images provided for extraction." });
    }

    const client = getGeminiClient();
    const { systemInstruction, responseSchema } = buildContextConfig(context, userPrompt);

    // Build contents array (inline images + final prompt)
    const contents: any[] = [];

    if (Array.isArray(images)) {
      images.forEach((img: string) => {
        if (!img) return;
        let base64Data = img;
        let mimeType = "image/jpeg";
        if (img.includes(";base64,")) {
          const parts = img.split(";base64,");
          mimeType = parts[0].replace("data:", "").split(";")[0];
          base64Data = parts[1];
        }
        contents.push({ inlineData: { data: base64Data, mimeType } });
      });
    } else if (image) {
      let base64Data = image;
      let mimeType = "image/jpeg";
      if (image.includes(";base64,")) {
        const parts = image.split(";base64,");
        mimeType = parts[0].replace("data:", "").split(";")[0];
        base64Data = parts[1];
      }
      contents.push({ inlineData: { data: base64Data, mimeType } });
    }

    const hasAttachment = (images && images.length > 0) || !!image;
    const promptMessage = `
${text ? `Documento o testo fornito:\n"""\n${text}\n"""\n` : ""}
Analizza ${hasAttachment ? "i documenti/immagini forniti (eseguendo l'OCR se necessario)" : "il testo fornito"} e procedi secondo il tuo ruolo di assistente specializzato.

Istruzioni aggiuntive dell'utente:
"${userPrompt || "Estrai tutti i dati pertinenti secondo il tuo ruolo."}"

Segui rigorosamente le istruzioni di sistema per restituire solo JSON.`;

    contents.push(promptMessage);

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash", // CORREZIONE AR — "gemini-2.5-flash" dismesso da Google (luglio 2026), aggiornato al modello GA corrente
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const parsedResponseText = response.text;
    if (!parsedResponseText) {
      throw new Error("L'AI ha risposto con un testo vuoto.");
    }

    // Strip markdown fences (defense-in-depth)
    let cleanJsonStr = parsedResponseText.trim();
    if (cleanJsonStr.startsWith("```json")) cleanJsonStr = cleanJsonStr.substring(7);
    if (cleanJsonStr.startsWith("```")) cleanJsonStr = cleanJsonStr.substring(3);
    if (cleanJsonStr.endsWith("```")) cleanJsonStr = cleanJsonStr.substring(0, cleanJsonStr.length - 3);
    cleanJsonStr = cleanJsonStr.trim();

    const extractedJson = JSON.parse(cleanJsonStr);
    return res.status(200).json({ success: true, data: extractedJson });
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore sconosciuto durante l'elaborazione del documento con Gemini.",
    });
  }
}

