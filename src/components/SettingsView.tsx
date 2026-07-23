
import React, { useState, useEffect } from "react";
import { 
  User, 
  Shield, 
  Mail, 
  Phone, 
  MapPin, 
  CreditCard, 
  Percent, 
  Save, 
  Bell, 
  Clock, 
  Coffee,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { OwnerProfile } from "../types";

interface SettingsViewProps {
  ownerProfile: OwnerProfile | null;
  onSaveProfile: (data: Partial<OwnerProfile>) => Promise<void>;
}

export default function SettingsView({ ownerProfile, onSaveProfile }: SettingsViewProps) {
  // Profile fields
  const [name, setName] = useState(ownerProfile?.name || "");
  const [fiscalCode, setFiscalCode] = useState(ownerProfile?.fiscalCode || "");
  const [address, setAddress] = useState(ownerProfile?.address || "");
  const [email, setEmail] = useState(ownerProfile?.email || "");
  const [phone, setPhone] = useState(ownerProfile?.phone || "");
  const [iban, setIban] = useState(ownerProfile?.iban || "");
  const [defaultQuota, setDefaultQuota] = useState<number>(ownerProfile?.defaultQuota ?? 100);

  // Notification fields
  const [notificationDays, setNotificationDays] = useState<string[]>(
    ownerProfile?.notificationDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  );
  const [notificationHoursStart, setNotificationHoursStart] = useState(
    ownerProfile?.notificationHoursStart || "09:00"
  );
  const [notificationHoursEnd, setNotificationHoursEnd] = useState(
    ownerProfile?.notificationHoursEnd || "18:00"
  );
  const [pauseStartDate, setPauseStartDate] = useState(ownerProfile?.pauseStartDate || "");
  const [pauseEndDate, setPauseEndDate] = useState(ownerProfile?.pauseEndDate || "");
  const [pauseEnabled, setPauseEnabled] = useState(ownerProfile?.pauseEnabled || false);

  // EmailJS fields — empty by default; user must configure their own at https://emailjs.com
  const [emailServiceId, setEmailServiceId] = useState(ownerProfile?.emailServiceId || "");
  const [emailTemplateId, setEmailTemplateId] = useState(ownerProfile?.emailTemplateId || "");
  const [emailPublicKey, setEmailPublicKey] = useState(ownerProfile?.emailPublicKey || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (ownerProfile) {
      setName(ownerProfile.name || "");
      setFiscalCode(ownerProfile.fiscalCode || "");
      setAddress(ownerProfile.address || "");
      setEmail(ownerProfile.email || "");
      setPhone(ownerProfile.phone || "");
      setIban(ownerProfile.iban || "");
      setDefaultQuota(ownerProfile.defaultQuota ?? 100);
      setNotificationDays(ownerProfile.notificationDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
      setNotificationHoursStart(ownerProfile.notificationHoursStart || "09:00");
      setNotificationHoursEnd(ownerProfile.notificationHoursEnd || "18:00");
      setPauseStartDate(ownerProfile.pauseStartDate || "");
      setPauseEndDate(ownerProfile.pauseEndDate || "");
      setPauseEnabled(ownerProfile.pauseEnabled || false);
      setEmailServiceId(ownerProfile.emailServiceId || "");
      setEmailTemplateId(ownerProfile.emailTemplateId || "");
      setEmailPublicKey(ownerProfile.emailPublicKey || "");
    }
  }, [ownerProfile]);

  const weekdaysList = [
    { id: "Monday", label: "Lunedì" },
    { id: "Tuesday", label: "Martedì" },
    { id: "Wednesday", label: "Mercoledì" },
    { id: "Thursday", label: "Giovedì" },
    { id: "Friday", label: "Venerdì" },
    { id: "Saturday", label: "Sabato" },
    { id: "Sunday", label: "Domenica" }
  ];

  const handleDayToggle = (dayId: string) => {
    setNotificationDays(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Il nome del proprietario è obbligatorio.");
      return;
    }
    if (!fiscalCode.trim() || fiscalCode.length < 11) {
      setError("Inserisci un codice fiscale o partita IVA valido.");
      return;
    }
    if (!address.trim()) {
      setError("L'indirizzo di residenza è obbligatorio.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Inserisci un indirizzo email valido.");
      return;
    }
    if (!phone.trim()) {
      setError("Il numero di telefono/WhatsApp è obbligatorio.");
      return;
    }
    if (!iban.trim() || iban.length < 15) {
      setError("Inserisci un codice IBAN valido.");
      return;
    }
    if (defaultQuota < 0 || defaultQuota > 100) {
      setError("La quota di default deve essere compresa tra 0% e 100%.");
      return;
    }
    if (notificationDays.length === 0) {
      setError("Seleziona almeno un giorno per ricevere le notifiche.");
      return;
    }

    setLoading(true);
    try {
      await onSaveProfile({
        name: name.trim(),
        fiscalCode: fiscalCode.trim().toUpperCase(),
        address: address.trim(),
        email: email.trim(),
        phone: phone.trim(),
        iban: iban.trim().toUpperCase().replace(/\s+/g, ""),
        defaultQuota: Number(defaultQuota),
        notificationDays,
        notificationHoursStart,
        notificationHoursEnd,
        pauseStartDate,
        pauseEndDate,
        pauseEnabled,
        emailServiceId: emailServiceId.trim(),
        emailTemplateId: emailTemplateId.trim(),
        emailPublicKey: emailPublicKey.trim()
      });
      setSuccess("Impostazioni e profilo salvati con successo!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error("Error saving settings", err);
      setError("Impossibile salvare le modifiche. Riprova più tardi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" id="settings-view-root">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl gap-4">
        <div>
          <h1 className="font-sans font-black text-lg sm:text-xl text-white tracking-tight flex items-center gap-2">
            <span>⚙️</span> Impostazioni Account & Notifiche
          </h1>
          <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-1">Configura il tuo profilo e le regole di ricezione</p>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn" id="settings-success-box">
          <CheckCircle2 size={14} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn" id="settings-error-box">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="settings-form">
        {/* Sinistra: Dati Anagrafici e Pagamenti */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest pb-2 flex items-center gap-1.5">
              <User size={14} />
              <span>Dati Anagrafici del Proprietario</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Nome e Cognome / Ragione Sociale *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Esempio: Mario Rossi o Rossi S.r.l."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 transition-colors"
                  id="settings-input-name"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Codice Fiscale / Partita IVA *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Esempio: RSSMRA80A01H501Y"
                  value={fiscalCode}
                  onChange={(e) => setFiscalCode(e.target.value)}
                  className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 uppercase font-mono transition-colors"
                  id="settings-input-fc"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Indirizzo di Residenza / Sede Legale *
              </label>
              <div className="relative">
                <MapPin size={13} className="absolute left-3 top-3.5 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="Via Roma 123, 00100 Roma (RM)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 outline-hidden focus:border-indigo-500 transition-colors"
                  id="settings-input-address"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Indirizzo Email *
                </label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-3.5 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="proprietario@email.it"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 outline-hidden focus:border-indigo-500 transition-colors"
                    id="settings-input-email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Telefono / WhatsApp *
                </label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-3.5 text-slate-500" />
                  <input
                    type="tel"
                    required
                    placeholder="+39 333 1234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 outline-hidden focus:border-indigo-500 transition-colors"
                    id="settings-input-phone"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest pb-2 flex items-center gap-1.5">
              <CreditCard size={14} />
              <span>Contabilità & Coordinate Bancarie</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Codice IBAN di Accredito *
                </label>
                <input
                  type="text"
                  required
                  placeholder="IT60X0542403200000001234567"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 font-mono transition-colors"
                  id="settings-input-iban"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Quota di Ripartizione Default (%) *
                </label>
                <div className="relative">
                  <Percent size={13} className="absolute right-3 top-3.5 text-slate-500" />
                  <input
                    type="number"
                    required
                    min={0}
                    max={100}
                    value={defaultQuota}
                    onChange={(e) => setDefaultQuota(Number(e.target.value))}
                    className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 transition-colors"
                    id="settings-input-quota"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Destra: Configurazione Notifiche & Pausa */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest pb-2 flex items-center gap-1.5">
              <Bell size={14} />
              <span>Notifiche & Orari Ricezione</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Giorni Lavorativi di Notifica *
                </label>
                <div className="grid grid-cols-2 gap-2" id="settings-days-grid">
                  {weekdaysList.map((day) => {
                    const isSelected = notificationDays.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => handleDayToggle(day.id)}
                        className={`px-3 py-2 rounded-xl text-left text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/50"
                            : "bg-slate-950 text-slate-500 border border-slate-800 hover:border-slate-700 hover:text-slate-300"
                        }`}
                      >
                        <span>{day.label}</span>
                        {isSelected && <span className="text-indigo-400">●</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clock size={11} />
                  <span>Orario Fine/Inizio Ricezione *</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">Da</span>
                    <input
                      type="time"
                      required
                      value={notificationHoursStart}
                      onChange={(e) => setNotificationHoursStart(e.target.value)}
                      className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 outline-hidden focus:border-indigo-500 transition-colors"
                      id="settings-input-hours-start"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">A</span>
                    <input
                      type="time"
                      required
                      value={notificationHoursEnd}
                      onChange={(e) => setNotificationHoursEnd(e.target.value)}
                      className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 outline-hidden focus:border-indigo-500 transition-colors"
                      id="settings-input-hours-end"
                    />
                  </div>
                </div>
              </div>

              {/* Sezione Sospensione Notifiche */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Coffee size={14} className="text-amber-400" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-300">Pausa Temporanea</h4>
                      <p className="text-[9px] text-slate-500">Sospendi la bacheca (ferie).</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pauseEnabled}
                      onChange={(e) => setPauseEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
                  </label>
                </div>

                {pauseEnabled && (
                  <div className="space-y-2 pt-1 animate-fadeIn">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Inizio Sospensione
                      </label>
                      <input
                        type="date"
                        required={pauseEnabled}
                        value={pauseStartDate}
                        onChange={(e) => setPauseStartDate(e.target.value)}
                        className="w-full text-xs text-slate-200 bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1.5 outline-hidden focus:border-indigo-500 transition-colors"
                        id="settings-input-pause-start"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Fine Sospensione
                      </label>
                      <input
                        type="date"
                        required={pauseEnabled}
                        value={pauseEndDate}
                        onChange={(e) => setPauseEndDate(e.target.value)}
                        className="w-full text-xs text-slate-200 bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1.5 outline-hidden focus:border-indigo-500 transition-colors"
                        id="settings-input-pause-end"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* No save button here, closed the first card */}
          </div>

          {/* CARD 2: CONFIGURAZIONE EMAILJS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest pb-2 flex items-center gap-1.5">
              <Mail size={14} />
              <span>Integrazione EmailJS (Solleciti)</span>
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Configura le credenziali EmailJS per abilitare l'invio reale delle e-mail di sollecito dal pannello di controllo.
            </p>
            <div className="space-y-3.5">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Service ID
                </label>
                <input
                  type="text"
                  placeholder="es. service_xxxxxx"
                  value={emailServiceId}
                  onChange={(e) => setEmailServiceId(e.target.value)}
                  className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 font-mono transition-colors"
                  id="settings-input-emailjs-service"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Template ID
                </label>
                <input
                  type="text"
                  placeholder="es. template_xxxxxx"
                  value={emailTemplateId}
                  onChange={(e) => setEmailTemplateId(e.target.value)}
                  className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 font-mono transition-colors"
                  id="settings-input-emailjs-template"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Public Key
                </label>
                <input
                  type="text"
                  placeholder="es. xxxxxxxxxxxxxx"
                  value={emailPublicKey}
                  onChange={(e) => setEmailPublicKey(e.target.value)}
                  className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 font-mono transition-colors"
                  id="settings-input-emailjs-publickey"
                />
              </div>
            </div>
          </div>

          {/* BOTTONE SALVA TUTTO */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              id="settings-save-btn"
              className="w-full inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/40 text-white font-bold text-xs px-4 py-3 rounded-xl active:transition-all cursor-pointer"
            >
              <Save size={14} />
              <span>{loading ? "Salvataggio..." : "Salva Impostazioni"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

