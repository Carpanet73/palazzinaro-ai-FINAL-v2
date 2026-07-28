
/**
 * Vercel Serverless Function — /api/send-stored-document
 *
 * CORREZIONE BV — invia via Resend, con allegato vero, un documento già salvato su Firebase
 * Storage (es. un contratto generato in precedenza). Il recupero del file avviene lato server
 * (mai dal browser, per evitare blocchi di sicurezza incrociati tra siti diversi), poi viene
 * allegato all'email esattamente come un file nuovo.
 *
 * Sostituisce la precedente /api/send-pcloud-document (stessa logica, solo la fonte del file
 * è cambiata da pCloud a Firebase Storage).
 *
 * Corpo della richiesta atteso (POST, JSON):
 * {
 *   "documentLink": "https://firebasestorage.googleapis.com/...",
 *   "fileName": "Contratto_Mario_Rossi.docx",
 *   "to": "destinatario@esempio.it",
 *   "subject": "Oggetto dell'email",
 *   "html": "<p>Corpo del messaggio</p>"
 * }
 */

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

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({
      success: false,
      error: "RESEND_API_KEY environment variable is missing. Configurala su Vercel → Settings → Environment Variables."
    });
  }

  try {
    const { documentLink, fileName, to, subject, html } = req.body || {};
    if (!documentLink || !fileName || !to || !subject) {
      return res.status(400).json({
        success: false,
        error: "Campi obbligatori mancanti: servono 'documentLink', 'fileName', 'to', 'subject'."
      });
    }

    // Recupera il file direttamente dal server (mai dal browser dell'utente)
    const fileResponse = await fetch(documentLink);
    if (!fileResponse.ok) {
      throw new Error(`Impossibile recuperare il documento da Firebase Storage (status ${fileResponse.status}).`);
    }
    const arrayBuffer = await fileResponse.arrayBuffer();
    const base64Content = Buffer.from(arrayBuffer).toString("base64");

    const payload = {
      from: "Palazzinaro AI <onboarding@resend.dev>",
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || "<p>In allegato il documento richiesto.</p>",
      attachments: [{ filename: fileName, content: base64Content }]
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data?.message || "Errore nell'invio tramite Resend.",
        details: data
      });
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (error: any) {
    console.error("Errore /api/send-stored-document:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno del server durante l'invio del documento."
    });
  }
}
