
/**
 * Vercel Serverless Function — /api/pcloud-upload
 *
 * Carica un file su pCloud (documenti fotografati: carte d'identità, permessi di
 * soggiorno, visure catastali, APE, ecc.) usando le credenziali del proprietario, MAI
 * esposte al browser. Il file arriva qui in base64, viene caricato su pCloud dentro una
 * struttura di cartelle organizzata, e la funzione restituisce solo il link/riferimento
 * pubblico da salvare nel database — mai il file stesso.
 *
 * Variabili d'ambiente richieste (Vercel → Project → Settings → Environment Variables):
 *   - PCLOUD_USERNAME  (l'email di login di pCloud)
 *   - PCLOUD_PASSWORD  (la password di login di pCloud)
 *
 * NOTA IMPORTANTE — pCloud ha due regioni con API diverse:
 *   - Stati Uniti: https://api.pcloud.com
 *   - Europa:      https://eapi.pcloud.com
 * Se le credenziali sono di un account europeo, l'endpoint USA risponde con un errore
 * "location" che indica dove reindirizzare — questa funzione gestisce automaticamente
 * il passaggio da un endpoint all'altro se necessario.
 *
 * Corpo della richiesta atteso (POST, JSON):
 * {
 *   "fileName": "documento_identita_song_zhen.pdf",
 *   "fileContentBase64": "....",
 *   "folderPath": "Inquilini/Song Zhen"   // sotto-cartelle create automaticamente se mancanti
 * }
 *
 * Risposta:
 * {
 *   "success": true,
 *   "publicLink": "https://...",
 *   "fileId": 12345678,
 *   "folderPath": "Inquilini/Song Zhen"
 * }
 */

import crypto from "crypto";

const ROOT_FOLDER_NAME = "Palazzinaro AI";

let cachedAuthToken: string | null = null;
let cachedApiHost: string = "api.pcloud.com";
let cachedTokenExpiresAt = 0;

async function pcloudRequest(host: string, method: string, params: Record<string, any>) {
  const url = new URL(`https://${host}/${method}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  const response = await fetch(url.toString());
  return response.json();
}

// CORREZIONE BK — Autenticazione "digest": pCloud non offre un token da copiare a mano
// nelle impostazioni dell'account (a differenza di Resend/Gemini) — il token va ottenuto
// trasformando username+password tramite questo scambio in due passaggi. Il token ottenuto
// dura fino a un anno (authexpire), quindi lo teniamo in cache tra una chiamata e l'altra
// finché la funzione resta "calda" — ma essendo una funzione serverless, viene comunque
// ricalcolato da zero ogni tanto: è un'operazione veloce, non un problema.
async function getPcloudAuthToken(): Promise<{ token: string; host: string }> {
  const now = Date.now();
  if (cachedAuthToken && now < cachedTokenExpiresAt) {
    return { token: cachedAuthToken, host: cachedApiHost };
  }

  const username = process.env.PCLOUD_USERNAME;
  const password = process.env.PCLOUD_PASSWORD;
  if (!username || !password) {
    throw new Error("PCLOUD_USERNAME o PCLOUD_PASSWORD mancanti nelle variabili d'ambiente di Vercel.");
  }

  let host = cachedApiHost;
  for (let attempt = 0; attempt < 2; attempt++) {
    const digestResp = await pcloudRequest(host, "getdigest", {});
    if (digestResp.result !== 0 || !digestResp.digest) {
      throw new Error(`pCloud /getdigest ha restituito un errore: ${JSON.stringify(digestResp)}`);
    }
    const digest: string = digestResp.digest;

    const usernameHash = crypto.createHash("sha1").update(username.toLowerCase()).digest("hex");
    const passworddigest = crypto
      .createHash("sha1")
      .update(password + usernameHash + digest)
      .digest("hex");

    const authResp = await pcloudRequest(host, "userinfo", {
      getauth: 1,
      username,
      digest,
      passworddigest,
      authexpire: 31536000 // 1 anno
    });

    // CORREZIONE BS — bug corretto: il codice 2000 di pCloud significa letteralmente
    // "Log in failed" (credenziali sbagliate), NON un problema di regione — riprovare su
    // un altro host con le STESSE credenziali sbagliate non avrebbe mai funzionato, e
    // mascherava l'errore vero con un messaggio fuorviante. Ora l'errore reale di pCloud
    // viene mostrato subito, così si capisce se il problema è davvero nelle credenziali.
    if (authResp.result === 2000) {
      throw new Error(
        `pCloud ha rifiutato le credenziali (Login failed). Controlla che PCLOUD_USERNAME e PCLOUD_PASSWORD su Vercel corrispondano esattamente alla tua email e password di pCloud (senza spazi involontari all'inizio o alla fine).`
      );
    }

    // Alcuni account (soprattutto quelli creati su server europei) richiedono l'host
    // eapi.pcloud.com — questo codice indica specificamente un problema di regione/host,
    // non di credenziali: in quel caso sì che ha senso riprovare sull'altro host.
    if (authResp.result === 4000 || authResp.result === 1000) {
      host = host === "api.pcloud.com" ? "eapi.pcloud.com" : "api.pcloud.com";
      continue;
    }

    if (authResp.result !== 0 || !authResp.auth) {
      throw new Error(`Autenticazione pCloud fallita: ${JSON.stringify(authResp)}`);
    }

    cachedAuthToken = authResp.auth;
    cachedApiHost = host;
    cachedTokenExpiresAt = now + 1000 * 60 * 60 * 24 * 300; // ricalcola comunque ogni ~300gg
    return { token: cachedAuthToken, host };
  }

  throw new Error("Impossibile completare l'autenticazione su pCloud dopo aver provato entrambi i server (USA/Europa) — riprova tra qualche minuto.");
}

// Crea (se non esiste già) la catena di sotto-cartelle indicata, partendo dalla cartella
// radice "Palazzinaro AI", e restituisce l'id della cartella finale.
async function ensureFolderPath(host: string, token: string, folderPath: string): Promise<number> {
  const segments = [ROOT_FOLDER_NAME, ...folderPath.split("/").filter(Boolean)];
  let parentFolderId = 0; // 0 = root di pCloud

  for (const segment of segments) {
    const listResp = await pcloudRequest(host, "listfolder", { auth: token, folderid: parentFolderId });
    if (listResp.result !== 0) {
      throw new Error(`Impossibile leggere la cartella su pCloud: ${JSON.stringify(listResp)}`);
    }
    const existing = (listResp.metadata?.contents || []).find(
      (item: any) => item.isfolder && item.name === segment
    );
    if (existing) {
      parentFolderId = existing.folderid;
    } else {
      const createResp = await pcloudRequest(host, "createfolder", {
        auth: token,
        folderid: parentFolderId,
        name: segment
      });
      if (createResp.result !== 0 || !createResp.metadata) {
        throw new Error(`Impossibile creare la cartella "${segment}" su pCloud: ${JSON.stringify(createResp)}`);
      }
      parentFolderId = createResp.metadata.folderid;
    }
  }

  return parentFolderId;
}

export default async function handler(req: any, res: any) {
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
    const { fileName, fileContentBase64, folderPath } = req.body || {};
    if (!fileName || !fileContentBase64) {
      return res.status(400).json({
        success: false,
        error: "Campi obbligatori mancanti: servono 'fileName' e 'fileContentBase64'."
      });
    }

    const { token, host } = await getPcloudAuthToken();
    const targetFolderId = await ensureFolderPath(host, token, folderPath || "Documenti Generici");

    // Upload vero e proprio: pCloud richiede multipart/form-data per /uploadfile
    const buffer = Buffer.from(fileContentBase64, "base64");
    const form = new FormData();
    form.append("file", new Blob([buffer]), fileName);

    const uploadUrl = `https://${host}/uploadfile?auth=${encodeURIComponent(token)}&folderid=${targetFolderId}&nopartial=1`;
    const uploadResponse = await fetch(uploadUrl, { method: "POST", body: form });
    const uploadData = await uploadResponse.json();

    if (uploadData.result !== 0 || !uploadData.metadata || uploadData.metadata.length === 0) {
      throw new Error(`Upload su pCloud fallito: ${JSON.stringify(uploadData)}`);
    }

    const fileId = uploadData.metadata[0].fileid;

    // Genera un link pubblico permanente per poter riaprire il documento dall'app
    const linkResp = await pcloudRequest(host, "getfilepublink", { auth: token, fileid: fileId });
    const publicLink = linkResp.result === 0 ? linkResp.link : null;

    return res.status(200).json({
      success: true,
      publicLink,
      fileId,
      folderPath: folderPath || "Documenti Generici"
    });
  } catch (error: any) {
    console.error("Errore /api/pcloud-upload:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno del server durante il caricamento su pCloud."
    });
  }
}
