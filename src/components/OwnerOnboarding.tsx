
import React, { useState } from "react";
import { User, Shield, Mail, Phone, MapPin, CreditCard, Percent, ArrowRight, Bell, Clock, Coffee } from "lucide-react";
import Logo from "./Logo";

interface OwnerOnboardingProps {
  userEmail: string;
  onSave: (data: {
    name: string;
    fiscalCode: string;
    address: string;
    email: string;
    phone: string;
    iban: string;
    defaultQuota: number;
    notificationDays: string[];
    notificationHoursStart: string;
    notificationHoursEnd: string;
    pauseStartDate: string;
    pauseEndDate: string;
    pauseEnabled: boolean;
  }) => Promise<void>;
  onLogout: () => void;
}

export default function OwnerOnboarding({ userEmail, onSave, onLogout }: OwnerOnboardingProps) {
  const [name, setName] = useState("");
  const [fiscalCode, setFiscalCode] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState(userEmail || "");
  const [phone, setPhone] = useState("");
  const [iban, setIban] = useState("");
  const [defaultQuota, setDefaultQuota] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Notification states
  const [notificationDays, setNotificationDays] = useState<string[]>([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday"
  ]);
  const [notificationHoursStart, setNotificationHoursStart] = useState("09:00");
  const [notificationHoursEnd, setNotificationHoursEnd] = useState("18:00");
  const [pauseStartDate, setPauseStartDate] = useState("");
  const [pauseEndDate, setPauseEndDate] = useState("");
  const [pauseEnabled, setPauseEnabled] = useState(false);

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
      await onSave({
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
        pauseEnabled
      });
    } catch (err) {
      console.error("Onboarding save error", err);
      setError("Impossibile salvare il profilo proprietario. Riprova più tardi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 md:p-8" id="owner-onboarding-container">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header Decor */}
        <div className="px-6 py-6 bg-gradient-to-r from-indigo-950 to-slate-900 flex items-center justify-between" id="onboarding-header">
          <div className="flex items-center space-x-3">
            <div className="bg-slate-950 p-2 rounded-xl text-indigo-400 border border-indigo-500/20 shadow-inner flex items-center justify-center">
              <Logo size={28} />
            </div>
            <div>
              <h2 className="font-sans font-black text-sm tracking-tight text-white leading-none">Palazzinaro <span className="text-indigo-400">AI</span></h2>
              <p className="text-[9px] text-indigo-400 font-mono tracking-widest uppercase mt-1">Configurazione Iniziale</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            id="onboarding-logout-btn"
            className="text-xs text-slate-400 hover:text-rose-400 font-semibold transition-colors duration-250 cursor-pointer"
          >
            Esci dall'account
          </button>
        </div>

        {/* Content & Form */}
        <div className="p-6 sm:p-8 space-y-6" id="onboarding-form-body">
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-sans font-extrabold text-white tracking-tight">Completa il tuo profilo</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Benvenuto! Prima di accedere al CRM Palazzinaro AI, compila i dati anagrafici e bancari del proprietario. Questi dati saranno utilizzati per generare contratti, lettere di sollecito e addebiti contabili.
            </p>
          </div>

          {error && (
            <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3 text-rose-400 text-xs font-semibold animate-pulse" id="onboarding-error-box">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" id="onboarding-form">
            
            {/* Sezione Anagrafica */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest pb-1.5 flex items-center gap-1.5">
                <User size={13} />
                <span>Dati Anagrafici</span>
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
                    id="onboarding-input-name"
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
                    id="onboarding-input-fc"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Indirizzo di Residenza / Sede Legale *
                </label>
                <div className="relative">
                  <MapPin size={13} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Via Roma 123, 00100 Roma (RM)"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 outline-hidden focus:border-indigo-500 transition-colors"
                    id="onboarding-input-address"
                  />
                </div>
              </div>
            </div>

            {/* Sezione Contatti */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest pb-1.5 flex items-center gap-1.5">
                <Shield size={13} />
                <span>Recapiti & Contatti</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Indirizzo Email *
                  </label>
                  <div className="relative">
                    <Mail size={13} className="absolute left-3 top-3 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="proprietario@email.it"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 outline-hidden focus:border-indigo-500 transition-colors"
                      id="onboarding-input-email"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Telefono / WhatsApp *
                  </label>
                  <div className="relative">
                    <Phone size={13} className="absolute left-3 top-3 text-slate-500" />
                    <input
                      type="tel"
                      required
                      placeholder="+39 333 1234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 outline-hidden focus:border-indigo-500 transition-colors"
                      id="onboarding-input-phone"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sezione Amministrazione */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest pb-1.5 flex items-center gap-1.5">
                <CreditCard size={13} />
                <span>Amministrazione & Pagamenti</span>
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
                    id="onboarding-input-iban"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Quota Default (%) *
                  </label>
                  <div className="relative">
                    <Percent size={13} className="absolute right-3 top-3 text-slate-500" />
                    <input
                      type="number"
                      required
                      min={0}
                      max={100}
                      value={defaultQuota}
                      onChange={(e) => setDefaultQuota(Number(e.target.value))}
                      className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 transition-colors"
                      id="onboarding-input-quota"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sezione Notifiche */}
            <div className="space-y-4 pt-2" id="onboarding-notifications-section">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest pb-1.5 flex items-center gap-1.5">
                <Bell size={13} />
                <span>Preferenze Notifiche & Ricezione</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Giorni di Ricezione Notifiche (Default: Lunedì-Venerdì) *
                  </label>
                  <div className="flex flex-wrap gap-2" id="onboarding-days-container">
                    {weekdaysList.map((day) => {
                      const isSelected = notificationDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => handleDayToggle(day.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? "bg-indigo-600 text-white border border-indigo-500 shadow-md shadow-indigo-600/10"
                              : "bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Clock size={11} />
                      <span>Orario Inizio Notifiche *</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={notificationHoursStart}
                      onChange={(e) => setNotificationHoursStart(e.target.value)}
                      className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 transition-colors"
                      id="onboarding-input-hours-start"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Clock size={11} />
                      <span>Orario Fine Notifiche *</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={notificationHoursEnd}
                      onChange={(e) => setNotificationHoursEnd(e.target.value)}
                      className="w-full text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 outline-hidden focus:border-indigo-500 transition-colors"
                      id="onboarding-input-hours-end"
                    />
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Coffee size={14} className="text-amber-400" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-300">Sospensione Temporanea (Ferie / Pause)</h4>
                        <p className="text-[10px] text-slate-500">Metti in pausa la bacheca in periodi di ferie o assenza.</p>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-fadeIn">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Inizio Pausa
                        </label>
                        <input
                          type="date"
                          required={pauseEnabled}
                          value={pauseStartDate}
                          onChange={(e) => setPauseStartDate(e.target.value)}
                          className="w-full text-xs text-slate-200 bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-2 outline-hidden focus:border-indigo-500 transition-colors"
                          id="onboarding-input-pause-start"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Fine Pausa
                        </label>
                        <input
                          type="date"
                          required={pauseEnabled}
                          value={pauseEndDate}
                          onChange={(e) => setPauseEndDate(e.target.value)}
                          className="w-full text-xs text-slate-200 bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-2 outline-hidden focus:border-indigo-500 transition-colors"
                          id="onboarding-input-pause-end"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Bar */}
            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                id="onboarding-submit-btn"
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/40 text-white font-bold text-xs px-6 py-3 rounded-xl active:transition-all duration-200"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Salvataggio...</span>
                  </>
                ) : (
                  <>
                    <span>Attiva Account</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}

