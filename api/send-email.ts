
/**
 * Vercel Serverless Function — /api/send-email
 *
 * Invia email REALI con allegati tramite Resend (a differenza di EmailJS, supporta
 * allegati fino a 10MB anche sul piano gratuito, ed è pensato per essere chiamato da un
 * server, non dal browser — la API Key non è mai esposta al client).
 *
 * USO PREVISTO: fascicoli legali, verbali di consegna/riconsegna, conteggi/estratti conto
 * ai comproprietari — qualunque invio che richieda un allegato vero. I Solleciti restano
 * su EmailJS (invio via browser, testo semplice, nessun allegato pesante).
 *
 * Variabile d'ambiente richiesta (Vercel → Project → Settings → Environment Variables):
 *   - RESEND_API_KEY
 *
 * Corpo della richiesta atteso (POST, JSON):
 * {
 *   "to": "destinatario@esempio.it",
 *   "subject": "Oggetto dell'email",
 *   "html": "<p>Corpo del messaggio in HTML</p>",
 *   "attachments": [
 *     { "filename": "documento.pdf", "content": "base64...." }
 *   ]
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
    const { to, subject, html, text, attachments, from } = req.body || {};

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({
        success: false,
        error: "Campi obbligatori mancanti: servono 'to', 'subject', e 'html' oppure 'text'."
      });
    }

    const payload: any = {
      // CORREZIONE AY — mittente di default: Resend richiede un dominio verificato per
      // mittenti personalizzati; onboarding@resend.dev funziona subito senza verifica,
      // ma è meglio configurare in futuro un dominio proprio per un mittente più professionale.
      from: from || "Palazzinaro AI <onboarding@resend.dev>",
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || undefined,
      text: text || undefined
    };

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      payload.attachments = attachments.map((a: any) => ({
        filename: a.filename,
        content: a.content // già in base64
      }));
    }

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
    console.error("Errore /api/send-email:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Errore interno del server durante l'invio dell'email."
    });
  }
}
