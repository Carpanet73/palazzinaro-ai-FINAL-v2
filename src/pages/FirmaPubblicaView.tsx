import React, { useEffect, useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import emailjs from "@emailjs/browser";
import jsPDF from "jspdf";
import { auth } from "../firebase";
import { validaToken, registraFirma, mascheraTelefono, normalizzaTelefonoE164 } from "../lib/signature";
import { SignatureRequest } from "../types";
import logoIcon from "../assets/logo-icon.png";

const LABEL = "block text-[10px] font-black uppercase text-slate-600 mb-1";
const INPUT = "w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2.5 outline-hidden";
const BTN = "w-full rounded-lg bg-amber-500 px-5 py-3 text-sm font-black text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40";

type Fase = "loading" | "notfound" | "expired" | "signed" | "revoked" | "dichiara" | "otp" | "fatto";

// CORREZIONE CQ — BUG REALE: Shell era definito DENTRO FirmaPubblicaView. Ad
// ogni ri-render (es. ogni carattere digitato nel campo OTP, che aggiorna lo
// stato) React vedeva una NUOVA identità di componente e smontava/rimontava
// l'intero albero, distruggendo l'input col focus — risultato: si poteva
// digitare un solo carattere alla volta prima di perdere il focus. Spostato
// qui, a livello di modulo, identità stabile tra i render.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white px-5 py-4 flex items-center gap-2">
        <img src={logoIcon} alt="Palazzinaro AI" className="h-7 w-7 rounded" />
        <span className="text-sm font-black tracking-wide">PALAZZINARO AI · Firma Verbale</span>
      </header>
      <main className="flex-1 w-full max-w-md mx-auto px-5 py-6">{children}</main>
      <div id="recaptcha-container" />
    </div>
  );
}

export default function FirmaPubblicaView({ token }: { token: string }) {
  const [fase, setFase] = useState<Fase>("loading");
  const [req, setReq] = useState<SignatureRequest | null>(null);
  const [declaration, setDeclaration] = useState<"conforme" | "problemi" | "">("");
  const [notes, setNotes] = useState("");
  const [canale, setCanale] = useState<"sms" | "email">("sms");
  const [codiceInviato, setCodiceInviato] = useState(false);
  const [codiceEmail, setCodiceEmail] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [accettoFirma, setAccettoFirma] = useState(false);
  const [accettoPrivacy, setAccettoPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [esitoFirma, setEsitoFirma] = useState<{ phone: string; at: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const v = await validaToken(token);
        if (!v.ok) { setFase(v.reason); return; }
        setReq(v.req);
        setFase("dichiara");
      } catch (e) { console.error(e); setFase("notfound"); }
    })();
  }, [token]);

  const setupRecaptcha = () => {
    if ((window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier.clear();
      delete (window as any).recaptchaVerifier;
    }
    (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
    return (window as any).recaptchaVerifier;
  };

  const inviaOTP = async () => {
    if (!req) return;
    setBusy(true); setErrore("");
    try {
      if (canale === "sms") {
        const verifier = setupRecaptcha();
        const numeroE164 = normalizzaTelefonoE164(req.tenantPhone);
        const conf = await signInWithPhoneNumber(auth, numeroE164, verifier);
        setConfirmation(conf);
      } else {
        // CORREZIONE CN — riallineato: il contenuto del template su EmailJS
        // (Template ID: template_g09b3yf) è stato sostituito per usare
        // {{otp_code}}, non più {{passcode}}/{{time}} del preset originale —
        // verificato in diretta sul template stesso prima di questa modifica.
        // Un'altra sessione aveva corretto il codice nella direzione opposta
        // (passcode/time) basandosi sul preset com'era PRIMA di quella
        // sostituzione: ora codice e template sono di nuovo allineati.
        if (!req.emailjsServiceId || !req.otpEmailTemplateId || !req.emailjsPublicKey) {
          setErrore("Fallback email non configurato per questo invito (manca il template OTP dedicato). Usa l'SMS.");
          setBusy(false); return;
        }
        const code = String(Math.floor(100000 + Math.random() * 900000));
        setCodiceEmail(code);
        await emailjs.send(
          req.emailjsServiceId,
          req.otpEmailTemplateId,
          { to_email: req.tenantEmail, otp_code: code, subject: "Codice firma verbale — Palazzinaro AI" },
          { publicKey: req.emailjsPublicKey }
        );
      }
      setCodiceInviato(true);
    } catch (e: any) {
      console.error(e);
      const codiceErrore = e?.code ? ` (${e.code})` : "";
      setErrore(`Invio codice non riuscito${codiceErrore}. Verifica il numero o usa l'email.`);
    } finally { setBusy(false); }
  };

  const firma = async () => {
    if (!req || !declaration) return;
    setBusy(true); setErrore("");
    try {
      if (canale === "sms") {
        if (!confirmation) { setErrore("Richiedi prima il codice SMS."); setBusy(false); return; }
        await confirmation.confirm(otpInput);
      } else {
        if (otpInput.trim() !== codiceEmail) { setErrore("Codice email non corretto."); setBusy(false); return; }
      }
      await registraFirma(token, {
        declaration,
        declarationNotes: declaration === "problemi" ? notes.trim() : undefined,
        otpChannel: canale,
        signedByPhone: normalizzaTelefonoE164(req.tenantPhone),
      });
      setEsitoFirma({ phone: req.tenantPhone, at: new Date().toLocaleString("it-IT") });
      setFase("fatto");
    } catch (e: any) {
      console.error(e);
      setErrore("Verifica fallita. Controlla il codice inserito.");
    } finally { setBusy(false); }
  };

  // CORREZIONE CR — BUG: i font standard di jsPDF (Helvetica ecc.) supportano solo
  // WinAnsi/Latin-1, non Unicode/emoji pieno. Un'emoji nel nome immobile (es. 🏠)
  // veniva trasformata in caratteri illeggibili tipo "Ø<ßâ". Le lettere accentate
  // italiane normali (à, è, ì, ò, ù) restano intatte, essendo dentro Latin-1.
  const pulisciTestoPdf = (testo: string) => testo.replace(/[^\x00-\xFF]/g, "").trim();

  const scaricaPDF = () => {
    if (!req || !esitoFirma) return;
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text(`Verbale di ${req.reportType === "consegna" ? "Consegna" : "Riconsegna"} — FIRMATO`, 14, 20);
    pdf.setFontSize(11);
    pdf.text(`Immobile: ${pulisciTestoPdf(req.propertyName || "-")}`, 14, 32);
    pdf.text(`Conduttore: ${pulisciTestoPdf(req.tenantName || "-")}`, 14, 40);
    pdf.text(`Dichiarazione: ${declaration === "conforme" ? "Tutto conforme" : "Segnalati problemi"}`, 14, 48);
    if (declaration === "problemi" && notes) pdf.text(`Note: ${pulisciTestoPdf(notes)}`, 14, 56, { maxWidth: 180 });
    pdf.text(`Firmato da: ${esitoFirma.phone}`, 14, 70);
    pdf.text(`Data firma: ${esitoFirma.at}`, 14, 78);
    pdf.text(`Canale OTP: ${canale.toUpperCase()} — verificato`, 14, 86);
    pdf.setFontSize(8);
    pdf.text("Firma elettronica ai sensi dell'art. 1 c.1 lett. q-bis CAD e art. 3 eIDAS.", 14, 100);
    pdf.text("Documento generato dalla procedura automatizzata Palazzinaro AI.", 14, 106);
    pdf.save(`Verbale_${req.reportType}_firmato_${pulisciTestoPdf(req.tenantName || "inquilino")}.pdf`);
  };

  if (fase === "loading") return <Shell><p className="text-sm text-slate-400">Verifica invito…</p></Shell>;
  if (fase === "notfound") return <Shell><h2 className="font-serif text-xl font-bold text-slate-800">Invito non valido</h2><p className="mt-2 text-sm text-slate-500">Il link non esiste o è stato revocato. Contatta l'amministratore.</p></Shell>;
  if (fase === "expired") return <Shell><h2 className="font-serif text-xl font-bold text-slate-800">Invito scaduto</h2><p className="mt-2 text-sm text-slate-500">Il link è scaduto (validità 7 giorni). Chiedi un nuovo invito.</p></Shell>;
  if (fase === "revoked") return <Shell><h2 className="font-serif text-xl font-bold text-slate-800">Invito annullato</h2><p className="mt-2 text-sm text-slate-500">Questo invito è stato annullato dall'amministratore.</p></Shell>;
  if (fase === "signed") return <Shell><h2 className="font-serif text-xl font-bold text-emerald-700">Già firmato</h2><p className="mt-2 text-sm text-slate-500">Questo verbale risulta già firmato.</p></Shell>;

  if (fase === "fatto") return (
    <Shell>
      <div className="text-center mt-8">
        <div className="text-5xl">✅</div>
        <h2 className="mt-3 font-serif text-2xl font-bold text-emerald-700">Verbale firmato</h2>
        <p className="mt-2 text-sm text-slate-600 font-mono">{esitoFirma?.phone}</p>
        <p className="text-sm text-slate-500 font-mono">{esitoFirma?.at}</p>
        <p className="mt-1 text-xs text-slate-400">Codice OTP verificato · firma registrata agli atti</p>
        <button onClick={scaricaPDF} className="mt-6 w-full rounded-lg border border-slate-300 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-100">Scarica PDF firmato</button>
        <p className="mt-4 text-xs text-slate-400">Puoi chiudere questa pagina.</p>
      </div>
    </Shell>
  );

  if (fase === "dichiara") return (
    <Shell>
      <h2 className="font-serif text-xl font-bold text-slate-800">Verbale di {req?.reportType === "consegna" ? "Consegna" : "Riconsegna"}</h2>
      <p className="mt-1 text-sm text-slate-500 font-mono">{req?.propertyName} · {req?.tenantName}</p>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500">Leggi il contenuto del verbale mostrato dall'amministratore, poi dichiara:</p>
        <label className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 cursor-pointer">
          <input type="radio" name="d" checked={declaration === "conforme"} onChange={() => setDeclaration("conforme")} />
          <span className="text-sm font-medium text-slate-700">Dichiaro che tutto è conforme</span>
        </label>
        <label className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 cursor-pointer">
          <input type="radio" name="d" checked={declaration === "problemi"} onChange={() => setDeclaration("problemi")} />
          <span className="text-sm font-medium text-slate-700">Segnalo problemi / danni</span>
        </label>
        {declaration === "problemi" && (
          <div className="mt-3">
            <label className={LABEL}>Descrivi i problemi</label>
            <textarea rows={3} className={INPUT} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Descrivi cosa non va…" />
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">La segnalazione sarà allegata agli atti e all'eventuale fascicolo legale.</div>
          </div>
        )}
      </div>
      <button disabled={!declaration} onClick={() => setFase("otp")} className={`mt-5 ${BTN}`}>Continua →</button>
    </Shell>
  );

  return (
    <Shell>
      <h2 className="font-serif text-xl font-bold text-slate-800">Firma elettronica</h2>
      <p className="mt-1 text-sm text-slate-500">Invieremo un codice di verifica per firmare.</p>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500">Numero destinatario:</p>
        <p className="font-mono text-sm text-slate-800">{req ? mascheraTelefono(req.tenantPhone) : ""}</p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => setCanale("sms")} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-black ${canale === "sms" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-300 text-slate-600"}`}>Codice via SMS</button>
          <button onClick={() => setCanale("email")} disabled={!req?.tenantEmail} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-black ${canale === "email" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-300 text-slate-600"} disabled:opacity-40`}>Codice via email</button>
        </div>
        {!codiceInviato ? (
          <button onClick={inviaOTP} disabled={busy} className={`mt-3 ${BTN}`}>{busy ? "Invio…" : canale === "sms" ? "Invia codice SMS" : "Invia codice email"}</button>
        ) : (
          <div className="mt-3">
            <label className={LABEL}>Inserisci il codice a 6 cifre</label>
            <input inputMode="numeric" maxLength={6} className={`${INPUT} text-center font-mono text-lg tracking-[0.5em]`} value={otpInput} onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))} placeholder="••••••" />
            <button onClick={inviaOTP} className="mt-1 text-[11px] text-amber-600 font-medium">Non l'ho ricevuto, invia di nuovo</button>
          </div>
        )}
        {errore && <p className="mt-2 text-xs text-rose-600">{errore}</p>}
      </div>
      <div className="mt-4 space-y-2 text-[11px] text-slate-600">
        <label className="flex items-start gap-2"><input type="checkbox" checked={accettoFirma} onChange={(e) => setAccettoFirma(e.target.checked)} className="mt-0.5" /><span>Accetto che il codice OTP inviato al mio numero costituisca la mia <b>firma elettronica</b> ai sensi dell'art. 1 c.1 lett. q-bis CAD e dell'art. 3 eIDAS, e riconosco il contenuto del verbale mostrato.</span></label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={accettoPrivacy} onChange={(e) => setAccettoPrivacy(e.target.checked)} className="mt-0.5" /><span>Ho letto l'informativa privacy (GDPR Reg. 679/2016): i miei dati sono trattati solo per la firma e la conservazione agli atti del verbale.</span></label>
      </div>
      <button onClick={firma} disabled={busy || otpInput.length !== 6 || !accettoFirma || !accettoPrivacy} className={`mt-5 ${BTN}`}>{busy ? "Verifica…" : "Firma il verbale"}</button>
      <button onClick={() => setFase("dichiara")} className="mt-2 w-full text-center text-xs text-slate-500">← Torna alla dichiarazione</button>
    </Shell>
  );
}
