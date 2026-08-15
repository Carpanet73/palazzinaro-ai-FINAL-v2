import { useCallback, useState } from "react";
// @ts-ignore - stessa libreria già usata altrove nel progetto (EmailJS, non Resend)
import emailjs from "@emailjs/browser";

// CORREZIONE CN — generalizzazione OTP (task #50/#57): questo hook estrae la logica
// sendOtp/verifyOtp che prima era cablata SOLO dentro ContractsView.tsx (flusso di
// disdetta anticipata, invio sempre e solo all'email del proprietario stesso). Ora è
// riusabile con un destinatario arbitrario (email/nome), così può essere usata anche
// per la firma del Verbale di Consegna/Riconsegna (owner E tenant) o in futuri punti
// dell'app che necessitano di una conferma via codice email — un solo flusso OTP per
// tutta l'applicazione, mai una seconda implementazione parallela (regola progetto
// "un solo flusso per ogni azione").

export interface EmailJsCredentials {
  serviceId?: string;
  templateId?: string;
  publicKey?: string;
}

export interface OtpTarget {
  email: string;
  name?: string;
}

export interface OtpPurpose {
  subject: string;
  contextLine: string; // es. "Codice di verifica per confermare la disdetta anticipata del contratto con Mario Rossi"
}

interface OtpState {
  code: string;
  expiresAt: number;
  sent: boolean;
  verified: boolean;
  input: string;
  sending: boolean;
}

const EMPTY_STATE: OtpState = { code: "", expiresAt: 0, sent: false, verified: false, input: "", sending: false };

export function isEmailJsConfigured(creds?: EmailJsCredentials | null): boolean {
  return !!(creds?.serviceId && creds?.templateId && creds?.publicKey);
}

/**
 * Hook condiviso per l'invio/verifica di un codice OTP a 6 cifre via EmailJS.
 * Nessuna logica di business qui dentro: il chiamante decide destinatario, oggetto,
 * testo del contesto e cosa fare del risultato (`verified`).
 */
export function useOtpVerification() {
  const [state, setState] = useState<OtpState>(EMPTY_STATE);

  const sendOtp = useCallback(async (creds: EmailJsCredentials, target: OtpTarget, purpose: OtpPurpose) => {
    if (!isEmailJsConfigured(creds) || !target.email) {
      return { ok: false as const, error: "Email o credenziali EmailJS non configurate." };
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000;
    setState((s) => ({ ...s, sending: true }));
    try {
      await emailjs.send(
        creds.serviceId!,
        creds.templateId!,
        {
          to_email: target.email,
          tenant_name: target.name || "Utente",
          subject: purpose.subject,
          message: `${purpose.contextLine}: ${code}\n\nIl codice è valido per 10 minuti. Se non hai richiesto questa operazione, ignora questa email.`,
          message_content: `Codice di verifica: ${code} (valido 10 minuti)`,
          total_amount: "",
          items_list: "",
        },
        creds.publicKey!
      );
      setState({ code, expiresAt, sent: true, verified: false, input: "", sending: false });
      return { ok: true as const, email: target.email };
    } catch (err: any) {
      setState((s) => ({ ...s, sending: false }));
      return { ok: false as const, error: err?.text || err?.message || JSON.stringify(err) };
    }
  }, []);

  const setInput = useCallback((input: string) => setState((s) => ({ ...s, input })), []);

  // Stessa logica, stesso stile del codice originale in ContractsView (chiusura sullo
  // stato corrente via closure, nessun aggiornamento funzionale) — evita di mescolare
  // un side-effect di lettura del risultato dentro un updater funzionale di setState.
  const verifyOtp = useCallback((): { ok: true } | { ok: false; error: string } => {
    if (Date.now() > state.expiresAt) {
      return { ok: false, error: "Il codice è scaduto. Richiedine uno nuovo." };
    }
    if (state.input.trim() !== state.code) {
      return { ok: false, error: "Codice non corretto. Riprova o richiedine uno nuovo." };
    }
    setState((s) => ({ ...s, verified: true }));
    return { ok: true };
  }, [state]);

  const reset = useCallback(() => setState(EMPTY_STATE), []);

  return {
    sent: state.sent,
    verified: state.verified,
    sending: state.sending,
    input: state.input,
    setInput,
    sendOtp,
    verifyOtp,
    reset,
  };
}
