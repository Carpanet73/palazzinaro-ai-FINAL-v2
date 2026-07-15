import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload size limit to accommodate base64 or large text uploads
app.use(express.json({ limit: "15mb" }));

// Initialize GoogleGenAI on the server side only (key is kept hidden)
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please add it in Settings > Secrets.");
    }
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

// REST API endpoint for document and text AI parsing
app.post("/api/extract", async (req, res) => {
  try {
    const { text, image, images, context, userPrompt } = req.body;
    
    if (!text && !image && (!images || images.length === 0)) {
      return res.status(400).json({ error: "No text, image, or images provided for extraction." });
    }

    const client = getGeminiClient();
    
    // Customize the system prompt and instructions based on context
    let systemInstruction = "";
    let responseSchema: any = undefined;

    switch (context) {
      case "contracts":
        systemInstruction = `Sei un assistente specializzato in gestione immobiliare. Estrai i dettagli di un contratto di locazione dal testo o immagine fornita.
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
Se un dato non è presente nel testo, lascia una stringa vuota o null. Non aggiungere testi esplicativi fuori dal JSON.`;
        responseSchema = {
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
            notes: { type: Type.STRING, description: "Eventuali note aggiuntive estratte (es: deposito cauzionale, spese incluse, cedolare secca)" }
          },
          required: ["propertyName", "ownerName", "tenantName", "startDate", "endDate", "rentAmount", "frequency", "status", "notes"]
        };
        break;

      case "condominiums":
        systemInstruction = `Sei un assistente specializzato in contabilità condominiale. Analizza il bilancio, preventivo, rendiconto o scadenziario fornito (testo o immagine) ed estrai i dati utili.
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
      "amount": 150.50, // Importo della rata come numero decimale
      "dueDate": "Scadenza nel formato YYYY-MM-DD",
      "notes": "Note specifiche per la rata"
    }
  ]
}
Estrai tutte le rate rilevate. Se non ci sono rate esplicite, creane una fittizia basandoti sui dati. Restituisci ESCLUSIVAMENTE il JSON.`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Nome del Condominio (es: Condominio Primavera)" },
            administrator: { type: Type.STRING, description: "Nome dell'amministratore" },
            phone: { type: Type.STRING, description: "Numero di telefono dell'amministratore o dello studio" },
            email: { type: Type.STRING, description: "Email dell'amministratore" },
            notes: { type: Type.STRING, description: "Riepilogo delle informazioni o note sul riparto" },
            rates: {
              type: Type.ARRAY,
              description: "Rate rilevate",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Nome della rata (es: Rata 1)" },
                  amount: { type: Type.NUMBER, description: "Importo della rata" },
                  dueDate: { type: Type.STRING, description: "Scadenza nel formato YYYY-MM-DD" },
                  notes: { type: Type.STRING, description: "Note specifiche per la rata" }
                },
                required: ["title", "amount", "dueDate", "notes"]
              }
            }
          },
          required: ["name", "administrator", "phone", "email", "notes", "rates"]
        };
        break;

      case "banks":
        systemInstruction = `Sei un assistente di riconciliazione bancaria. Analizza la lista di movimenti bancari forniti (estratti conto, righe incollate, tabelle, CSV o immagine di ricevute/estratti conto).
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "movements": [
    {
      "date": "Data operazione nel formato YYYY-MM-DD",
      "description": "Descrizione o causale del movimento bancario",
      "amount": 1500.00 // Importo positivo per entrate (es: canone ricevuto) o negativo per uscite (es: spese idraulico)
    }
  ]
}
Estrai tutti i movimenti trovati. Restituisci ESCLUSIVAMENTE il JSON.`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            movements: {
              type: Type.ARRAY,
              description: "Movimenti estratti",
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING, description: "Data nel formato YYYY-MM-DD" },
                  description: { type: Type.STRING, description: "Descrizione causale" },
                  amount: { type: Type.NUMBER, description: "Importo (positivo/negativo)" }
                },
                required: ["date", "description", "amount"]
              }
            }
          },
          required: ["movements"]
        };
        break;

      case "bank_account":
        systemInstruction = `Sei un assistente finanziario specializzato in gestione patrimoniale. Estrai le informazioni del conto corrente bancario da documenti, screenshot, o ricevute di attivazione.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "iban": "Codice IBAN completo (es: IT60X0123456789012345678901)",
  "holder": "Nome completo dell'intestatario del conto corrente"
}
Se non trovi l'intestatario o l'IBAN, inserisci una stringa vuota o null per quel campo. Non aggiungere testi esplicativi fuori dal JSON.`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            iban: { type: Type.STRING, description: "IBAN completo" },
            holder: { type: Type.STRING, description: "Intestatario" }
          },
          required: ["iban", "holder"]
        };
        break;

      case "tenants":
        systemInstruction = `Sei un assistente immobiliare. Estrai le informazioni anagrafiche dell'inquilino o degli inquilini da documenti, carte d'identità o moduli (testo o immagine).
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "name": "Nome e Cognome dell'inquilino",
  "email": "Indirizzo email",
  "phone": "Numero di telefono",
  "fiscalCode": "Codice Fiscale",
  "notes": "Note sull'inquilino (es: garante, occupazione, referenze)"
}
Restituisci ESCLUSIVAMENTE il JSON.`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Nome e Cognome" },
            email: { type: Type.STRING, description: "Email" },
            phone: { type: Type.STRING, description: "Telefono" },
            fiscalCode: { type: Type.STRING, description: "Codice Fiscale" },
            notes: { type: Type.STRING, description: "Note" }
          },
          required: ["name", "email", "phone", "fiscalCode", "notes"]
        };
        break;

      case "solleciti":
      case "reminders":
        systemInstruction = `Sei un assistente legale immobiliare. Analizza il ritardo di pagamento (da testo o ricevute fotografate) e redigi una lettera di sollecito formale ma cortese.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "tenantName": "Nome dell'inquilino moroso",
  "amount": 450.00, // Importo dovuto come numero
  "reason": "Descrizione del debito (es: Canone di locazione Giugno 2026)",
  "dueDate": "Scadenza originaria nel formato YYYY-MM-DD",
  "suggestedLetterBody": "Testo completo della lettera di sollecito formale pronta da inviare in italiano. Includi dettagli dell'immobile, l'importo arretrato, le coordinate per il pagamento e un termine di 7 giorni per adempiere.",
  "status": "Pending"
}
Restituisci ESCLUSIVAMENTE il JSON.`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            tenantName: { type: Type.STRING, description: "Nome inquilino" },
            amount: { type: Type.NUMBER, description: "Importo dovuto" },
            reason: { type: Type.STRING, description: "Causale debito" },
            dueDate: { type: Type.STRING, description: "Scadenza originaria" },
            suggestedLetterBody: { type: Type.STRING, description: "Lettera sollecito" },
            status: { type: Type.STRING, description: "Stato" }
          },
          required: ["tenantName", "amount", "reason", "dueDate", "suggestedLetterBody", "status"]
        };
        break;

      case "properties":
        systemInstruction = `Sei un assistente specializzato in gestione immobiliare. Estrai i dettagli di un immobile dal testo o immagine fornita.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "name": "Nome descrittivo dell'immobile (es: Bilocale Via Roma)",
  "address": "Indirizzo completo",
  "type": "Tipologia (es: Appartamento, Villa, Ufficio, Box)",
  "status": "Stato (es: Available, Rented, Maintenance)",
  "notes": "Eventuali note aggiuntive",
  "owner": "Nome completo del proprietario"
}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Nome descrittivo" },
            address: { type: Type.STRING, description: "Indirizzo completo" },
            type: { type: Type.STRING, description: "Tipologia" },
            status: { type: Type.STRING, description: "Stato dell'immobile" },
            notes: { type: Type.STRING, description: "Note aggiuntive" },
            owner: { type: Type.STRING, description: "Proprietario" }
          },
          required: ["name", "address", "type", "status", "notes", "owner"]
        };
        break;

      case "fast_closing":
        systemInstruction = `Sei un assistente specializzato in scadenze e adempimenti di chiusura. Estrai le informazioni necessarie per creare una scadenza o voce di chiusura.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "title": "Titolo o nome della scadenza (es: Tassa Rifiuti 2026)",
  "description": "Descrizione dei dettagli dell'adempimento",
  "amount": 150.00, // importo come numero decimale
  "dueDate": "Scadenza nel formato YYYY-MM-DD"
}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Titolo scadenza" },
            description: { type: Type.STRING, description: "Descrizione dettagliata" },
            amount: { type: Type.NUMBER, description: "Importo dovuto" },
            dueDate: { type: Type.STRING, description: "Scadenza" }
          },
          required: ["title", "description", "amount", "dueDate"]
        };
        break;

      default:
        systemInstruction = `Sei un assistente esperto di gestione immobiliare. Analizza il documento fornito (testo o immagine) ed esegui le seguenti istruzioni: ${userPrompt || "Estrai le informazioni chiave in formato strutturato"}.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura:
{
  "title": "Titolo riepilogativo",
  "description": "Descrizione o sintesi dei punti principali",
  "entities": [], // lista di entità trovate
  "estimatedAmount": 0, // importo totale stimato se presente
  "extractedData": {} // dati strutturati vari in formato chiave-valore
}
Restituisci ESCLUSIVAMENTE il JSON.`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Titolo riepilogativo" },
            description: { type: Type.STRING, description: "Descrizione o sintesi" },
            estimatedAmount: { type: Type.NUMBER, description: "Importo totale stimato" },
            entities: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Entità trovate"
            },
            extractedData: {
              type: Type.OBJECT,
              properties: {},
              description: "Dati aggiuntivi estratti"
            }
          },
          required: ["title", "description", "estimatedAmount"]
        };
        break;
    }

    // Incorporate any user custom request/prompt
    const contents: any[] = [];

    if (images && Array.isArray(images)) {
      images.forEach((img: string) => {
        if (!img) return;
        let base64Data = img;
        let mimeType = "image/jpeg";
        if (img.includes(";base64,")) {
          const parts = img.split(";base64,");
          mimeType = parts[0].replace("data:", "").split(";")[0];
          base64Data = parts[1];
        }
        contents.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
      });
    } else if (image) {
      let base64Data = image;
      let mimeType = "image/jpeg";
      if (image.includes(";base64,")) {
        const parts = image.split(";base64,");
        mimeType = parts[0].replace("data:", "").split(";")[0];
        base64Data = parts[1];
      }
      contents.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
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
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const parsedResponseText = response.text;
    if (!parsedResponseText) {
      throw new Error("L'AI ha risposto con un testo vuoto.");
    }

    // Parse the JSON securely on server side before sending it back
    // Strip any markdown fences just in case the model overrides responseMimeType (very rare, but good for defense-in-depth)
    let cleanJsonStr = parsedResponseText.trim();
    if (cleanJsonStr.startsWith("```json")) {
      cleanJsonStr = cleanJsonStr.substring(7);
    }
    if (cleanJsonStr.startsWith("```")) {
      cleanJsonStr = cleanJsonStr.substring(3);
    }
    if (cleanJsonStr.endsWith("```")) {
      cleanJsonStr = cleanJsonStr.substring(0, cleanJsonStr.length - 3);
    }
    cleanJsonStr = cleanJsonStr.trim();

    const extractedJson = JSON.parse(cleanJsonStr);
    return res.json({ success: true, data: extractedJson });
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Errore sconosciuto durante l'elaborazione del documento con Gemini.",
    });
  }
});

// Configure Vite or Static Assets serving depending on environment
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Mode: Mount Vite as middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server mounted as middleware.");
  } else {
    // Production Mode: Serve static files from the dist/ directory
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving production build from dist/ folder.");
  }

  // Start listening
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

setupServer();
