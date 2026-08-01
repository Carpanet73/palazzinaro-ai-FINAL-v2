import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { SignatureRequest } from "../types";

// Pattern identico a stripUndefined del progetto (non esiste ancora condivisa:
// vedi nota FILE 6 punto 3).
function stripUndef(obj: any): any {
  const out: any = {};
  Object.keys(obj).forEach((k) => { if (obj[k] !== undefined) out[k] = obj[k]; });
  return out;
}

// Token crittograficamente sicuro (64 char esadecimali): è l'UNICO segreto che
// protegge la pagina pubblica.
export function generaToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Data ISO nel fuso locale (NO UTC: in Italia dopo le 22 darebbe il giorno prima).
export function isoLocale(d: Date = new Date()): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}

export function scadenzaToken(giorni = 7): string {
  return isoLocale(new Date(Date.now() + giorni * 24 * 60 * 60 * 1000));
}

// Normalizza un telefono in E.164 per Firebase Phone Auth (punto 5 verifica).
// "3331234567" -> "+393331234567"; "+39333..." resta; "0039333..." -> "+39333...".
export function normalizzaTelefonoE164(tel: string, prefissoDefault = "39"): string {
  const cifre = (tel || "").replace(/\D/g, "");
  if (!cifre) return "";
  if ((tel || "").trim().startsWith("+")) return "+" + cifre;
  if (cifre.startsWith("00")) return "+" + cifre.slice(2);
  if (cifre.startsWith(prefissoDefault)) return "+" + cifre;
  return "+" + prefissoDefault + cifre;
}

// Solo cifre (per wa.me, che vuole il numero senza "+").
export function soloCifre(tel: string): string {
  return (tel || "").replace(/\D/g, "");
}

// Crea l'invito di firma. L'id del documento È il token (recupero con getDoc
// secca, senza query). Salva ANCHE la config EmailJS dell'admin per il fallback.
export async function creaSignatureRequest(data: {
  userId: string;
  contractId: string;
  propertyId: string;
  propertyName?: string;
  tenantId?: string;
  tenantName?: string;
  tenantPhone: string;        // già normalizzato E.164 dal chiamante
  tenantEmail?: string;
  reportId: string;
  reportType: "consegna" | "riconsegna";
  emailjsServiceId?: string;
  emailjsTemplateId?: string;
  emailjsPublicKey?: string;
  // CORREZIONE CL — template dedicato per l'OTP, diverso da quello dei Solleciti
  otpEmailTemplateId?: string;
  // CORREZIONE CS — snapshot del contenuto reale del verbale, da mostrare al
  // firmatario prima della firma (mai più una firma "a scatola chiusa")
  reportDate?: string;
  checklist?: { id: string; item: string; status: string; notes?: string }[];
  hasDamages?: boolean;
  damagesDescription?: string;
}): Promise<{ token: string }> {
  const token = generaToken();
  const now = isoLocale();
  const payload: any = {
    userId: data.userId,
    contractId: data.contractId,
    propertyId: data.propertyId,
    propertyName: data.propertyName ?? null,
    tenantId: data.tenantId ?? null,
    tenantName: data.tenantName ?? null,
    tenantPhone: data.tenantPhone,
    tenantEmail: data.tenantEmail ?? null,
    reportId: data.reportId,
    reportType: data.reportType,
    status: "pending",
    createdAt: now,
    expiresAt: scadenzaToken(7),
    emailjsServiceId: data.emailjsServiceId ?? null,
    emailjsTemplateId: data.emailjsTemplateId ?? null,
    emailjsPublicKey: data.emailjsPublicKey ?? null,
    otpEmailTemplateId: data.otpEmailTemplateId ?? null,
    reportDate: data.reportDate ?? null,
    // CORREZIONE CS — pulizia esplicita: stripUndef (sotto) non pulisce dentro
    // gli oggetti di un array, e Firestore rifiuta undefined a qualunque
    // profondità (stesso bug già visto altrove nel progetto).
    checklist: (data.checklist ?? []).map((voce) => ({
      id: voce.id,
      item: voce.item,
      status: voce.status,
      notes: voce.notes ?? null,
    })),
    hasDamages: data.hasDamages ?? false,
    damagesDescription: data.damagesDescription ?? null,
  };
  await setDoc(doc(db, "signatureRequests", token), stripUndef(payload));
  return { token };
}

// Valida un token all'apertura della pagina pubblica.
export async function validaToken(token: string): Promise<
  | { ok: true; req: SignatureRequest }
  | { ok: false; reason: "notfound" | "expired" | "signed" | "revoked" }
> {
  if (!token) return { ok: false, reason: "notfound" };
  const snap = await getDoc(doc(db, "signatureRequests", token));
  if (!snap.exists()) return { ok: false, reason: "notfound" };
  const req = { id: snap.id, ...(snap.data() as any) } as SignatureRequest;
  if (req.status === "signed") return { ok: false, reason: "signed" };
  if (req.status === "revoked") return { ok: false, reason: "revoked" };
  if (new Date(req.expiresAt) < new Date()) return { ok: false, reason: "expired" };
  return { ok: true, req };
}

// Marca firmato + aggiorna il DeliveryReport (tutto ripulito dagli undefined).
export async function registraFirma(token: string, esito: {
  declaration: "conforme" | "problemi";
  declarationNotes?: string;
  declarationPhotos?: string[];
  otpChannel: "sms" | "email";
  signedByPhone: string;
}): Promise<void> {
  const now = isoLocale();
  const reqSnap = await getDoc(doc(db, "signatureRequests", token));
  const req = { id: reqSnap.id, ...(reqSnap.data() as any) } as SignatureRequest;

  await updateDoc(doc(db, "signatureRequests", token), stripUndef({
    status: "signed",
    signedAt: now,
    signedByPhone: esito.signedByPhone,
    otpChannel: esito.otpChannel,
    otpVerified: true,
    declaration: esito.declaration,
    declarationNotes: esito.declarationNotes ?? null,
    declarationPhotos: esito.declarationPhotos ?? null,
  }));

  const firmaTesto =
    `Firma elettronica via OTP ${esito.otpChannel.toUpperCase()} al numero ` +
    `${esito.signedByPhone}, verificata il ${now}. Dichiarazione: ` +
    `${esito.declaration === "conforme" ? "tutto conforme" : "segnalati problemi"}.`;

  await updateDoc(doc(db, "deliveryReports", req.reportId), stripUndef({
    "signatures.tenantSigned": true,
    "signatures.tenantSignatureData": firmaTesto,
    "signatures.tenantSignedAt": now,
    remoteSigned: true,
    signatureRequestId: token,
    hasDamages: esito.declaration === "problemi" ? true : undefined,
    damagesDescription: esito.declaration === "problemi" ? (esito.declarationNotes ?? null) : undefined,
  }));
}

// Maschera un telefono per la UI: +39 ••• ••• 4821
export function mascheraTelefono(tel: string): string {
  const cifre = soloCifre(tel);
  if (cifre.length < 4) return tel;
  const pref = cifre.length > 10 ? cifre.slice(0, cifre.length - 10) : "39";
  return `+${pref} ••• ••• ${cifre.slice(-4)}`;
}
