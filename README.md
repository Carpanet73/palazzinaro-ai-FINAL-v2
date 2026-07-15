# 🏢 Palazzinaro AI

Gestionale immobiliare completo: immobili, inquilini, contratti, condomini, banca,
scadenze, solleciti (con invio email + WhatsApp reali), manutenzioni, pratiche legali —
con estrazione AI da documenti (contratti, estratti conto, documenti d'identità).

**Stack:** React + Vite + TypeScript + Tailwind CSS v4 + Firebase (Auth + Firestore) +
Google Gemini (AI) + EmailJS (invio email solleciti).

---

## 🎯 Pronto per il deploy

Il progetto è **già configurato per Vercel**:
- Frontend statico buildato con Vite in `dist/`
- Endpoint AI `/api/extract` come serverless function in `api/extract.ts`
- `vercel.json` già incluso con rewrite SPA + limiti function
- Build verificata ✅ — `npm run build` passa senza errori

Per partire da zero devi solo:
1. Creare 3 account gratuiti (Firebase, Google AI, EmailJS)
2. Spingere il codice su GitHub
3. Importare la repo su Vercel

**Tempo totale stimato: 25 minuti.**

---

## 📋 SETUP GUIDE PASSO-PASSO

### Step 1 — Firebase (Auth + Database) — 10 min

L'app usa Firebase per login Google + salvataggio dati. **Gratis** fino a ~50k letture/giorno.

1. Vai su **https://console.firebase.google.com** → **Aggiungi progetto**
   - Nome: `palazzinaro-ai` (o quello che vuoi)
   - Google Analytics: disabilita (non serve)
2. Una volta creato il progetto, nel menu laterale:
   - **Authentication → Sign-in method → Google → Abilita**
     - Email di supporto: la tua email
     - Salva
   - **Authentication → Impostazioni → Domini autorizzati**
     - Aggiungi: `localhost` (già presente) e il tuo futuro dominio Vercel `xxx.vercel.app`
     - Aggiungi anche eventuali domini personalizzati che userai
   - **Firestore Database → Crea database**
     - Modalità: **Produzione** (le regole di sicurezza sono già nel file `firestore.rules`)
     - Regione: `eur3` (Europa)
3. Crea l'app web:
   - **Impostazioni progetto → Generali → Le tue app → Web (`</>`)**
   - Nickname: `palazzinaro-web`
   - NON spuntare Firebase Hosting
   - Copia il blocco `const firebaseConfig = { ... }` che ti mostra
4. **Copia i valori** in un posto sicuro:
   - `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`
5. **(Opzionale ma consigliato)** Applica le regole di sicurezza:
   - **Firestore Database → Regole** → incolla il contenuto di `firestore.rules` di questo repo → **Pubblica**

### Step 2 — Google Gemini (AI extraction) — 3 min

L'app usa Gemini per estrarre dati strutturati da contratti, estratti conto, ecc. **Gratis** con quota abbondante.

1. Vai su **https://aistudio.google.com/apikey**
2. **Crea chiave API** → copia la stringa (inizia con `AIza...`)
3. Salvala da parte — la metterai su Vercel come `GEMINI_API_KEY`

### Step 3 — EmailJS (invio email solleciti) — 7 min

Permette di inviare email reali di sollecito direttamente dal browser. **Gratis** 200 email/mese.

1. Vai su **https://www.emailjs.com** → registrati
2. **Email Services → Add New Service**
   - Scegli il tuo provider (Gmail, Outlook, ecc.)
   - Service ID: annotatevelo (es. `service_xxxxx`)
   - Connect account → **Create Service**
3. **Email Templates → Create New Template**
   - Template ID: annotatevelo (es. `template_xxxxx`)
   - Imposta il template con queste variabili (usa la scheda "Settings" del template):
     ```
     To Email:    {{to_email}}
     Subject:     {{subject}}
     Content:     Ciao {{tenant_name}},

                  {{message}}

                  Totale dovuto: {{total_amount}}

                  Dettaglio:
                  {{items_list}}
     ```
   - Save
4. **Account → API Keys → Copy Public Key** (es. `xxxxxxxxxxx`)
5. Salva tutti e 3 i valori — li inserirai **dentro l'app** in **Impostazioni → Profilo Proprietario**.

### Step 4 — Pusha su GitHub — 2 min

```bash
# Dalla cartella del progetto
git init
git add .
git commit -m "Palazzinaro AI — pronto per Vercel"
git branch -M main
git remote add origin https://github.com/<tuo-utente>/palazzinaro-ai.git
git push -u origin main
```

### Step 5 — Deploy su Vercel — 3 min

1. Vai su **https://vercel.com/new**
2. **Importa** la repository GitHub appena creata
3. Vercel rileva automaticamente Vite. Verifica:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build` (predefinito)
   - **Output Directory:** `dist` (predefinito)
4. **Environment Variables** — aggiungi SOLO questa (le altre Firebase sono opzionali):
   - `GEMINI_API_KEY` = la chiave di Step 2
5. (Opzionale, consigliato per produzione) Aggiungi anche le variabili Firebase del tuo progetto:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIRESTORE_DATABASE_ID` = (stringa vuota) → usa il DB default
6. **Deploy** ✅
7. Dopo il deploy, **copia l'URL Vercel** (es. `https://palazzinaro-ai.vercel.app`)
8. Torna su **Firebase Console → Authentication → Settings → Authorized domains**
   e aggiungi il dominio Vercel appena ottenuto (senza `https://`)

### Step 6 — Prima esecuzione

1. Apri l'URL Vercel dell'app
2. **Login con Google** → usa il tuo account Google
3. **Completa il Profilo Proprietario** (onboarding automatico al primo login):
   - Nome, CF, indirizzo, email, telefono, IBAN
   - Inserisci i 3 valori EmailJS (Service ID, Template ID, Public Key)
4. **Inizia a usare l'app!** 🎉
   - Aggiungi immobili, inquilini, contratti
   - Carica un contratto in Area AI → l'AI estrae i dati automaticamente
   - Crea un sollecito → email reale all'inquilino + WhatsApp precompilato

---

## 💻 Sviluppo locale

```bash
# Installa dipendenze
npm install

# Crea .env.local
cp .env.example .env.local
# → edita .env.local inserendo GEMINI_API_KEY e (opzionali) VITE_FIREBASE_*

# Avvia in modalità dev (frontend + API su http://localhost:3000)
npm run dev

# Build di produzione
npm run build

# Anteprima build
npm run preview

# Type-check
npm run lint
```

In dev, l'endpoint `/api/extract` è servito dal file `server.ts` (Express + Vite middleware).
In produzione su Vercel, è gestito dalla serverless function `api/extract.ts`.

---

## 🧱 Struttura del progetto

```
palazzinaro-ai-restyled/
├── api/
│   └── extract.ts           # Vercel serverless fn — Gemini extraction endpoint
├── src/
│   ├── components/          # 17 viste (Dashboard, Properties, Tenants, Contracts, ...)
│   ├── lib/                 # Helpers (PDF generation, status helpers)
│   ├── App.tsx              # Root: auth + routing + data layer
│   ├── firebase.ts          # Init Firebase (env-driven, con fallback demo)
│   ├── types.ts             # Tipi TypeScript del dominio
│   ├── main.tsx             # Entry React
│   ├── index.css            # Tailwind v4 + tema Palazzinaro (navy/gold/emerald)
│   └── vite-env.d.ts        # Type declarations per import.meta.env
├── server.ts                # Server Express per dev locale
├── firestore.rules          # Regole sicurezza Firestore (da applicare in console)
├── vercel.json              # Config deploy Vercel
├── .env.example             # Template variabili d'ambiente
└── package.json
```

---

## 🔐 Variabili d'ambiente

| Variabile                        | Dove          | Required | Descrizione                          |
|----------------------------------|---------------|----------|--------------------------------------|
| `GEMINI_API_KEY`                 | Vercel        | ✅       | Chiave Gemini per /api/extract       |
| `VITE_FIREBASE_API_KEY`          | Vercel + .env | ⚠️ opt  | Firebase API key (fallback: demo)    |
| `VITE_FIREBASE_AUTH_DOMAIN`      | Vercel + .env | ⚠️ opt  | Firebase Auth domain                 |
| `VITE_FIREBASE_PROJECT_ID`       | Vercel + .env | ⚠️ opt  | Firebase project ID                  |
| `VITE_FIREBASE_STORAGE_BUCKET`   | Vercel + .env | ⚠️ opt  | Firebase Storage bucket              |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Vercel + .env | ⚠️ opt | Firebase sender ID                  |
| `VITE_FIREBASE_APP_ID`           | Vercel + .env | ⚠️ opt  | Firebase app ID                      |
| `VITE_FIRESTORE_DATABASE_ID`     | Vercel + .env | ⚠️ opt  | Firestore DB ID (vuoto = default)    |

⚠️ **opt** = se omesse, l'app usa un progetto Firebase demo condiviso. Va bene per
testare ma **non per produzione** — configurale sempre con il tuo progetto.

Le credenziali EmailJS NON vanno in env vars: si inseriscono dentro l'app
(**Impostazioni → Profilo Proprietario**) e vengono salvate per-utente in Firestore.

---

## 🛠️ Scripts

| Comando            | Descrizione                                              |
|--------------------|----------------------------------------------------------|
| `npm run dev`      | Server dev locale (frontend + API Gemini) su porta 3000 |
| `npm run build`    | Build di produzione frontend in `dist/`                  |
| `npm run preview`  | Anteprima statica della build di produzione              |
| `npm run lint`     | Type-check TypeScript senza emit                         |

---

## 🎨 Caratteristiche

- **17 sezioni**: Dashboard, Immobili, Area Proprietari, Contratti, Inquilini, Condomini,
  Banche, Fast Closing, Solleciti, Manutenzioni, Legale, Area AI, Impostazioni
- **Login Google** con onboarding proprietario
- **Persistenza real-time** su Firestore (sync multi-dispositivo)
- **AI extraction** da testo/foto/documenti per 8 contesti (contratti, inquilini,
  banche, condomini, solleciti, immobili, scadenze, bank account)
- **Solleciti automatici** con escalation a 3 step:
  - Step 1: primo sollecito formale
  - Step 2: secondo sollecito
  - Step 3: messa in mora (genera PDF legale)
- **Invio email reali** via EmailJS + apertura WhatsApp con messaggio precompilato
- **PDF generation** per messa in mora e report
- **Riconciliazione bancaria** automatica con matching movimenti vs scadenze
- **Co-proprietà** con suddivisione quote millesimali
- **Manutenzioni** con split proprietario/conduttore
- **Pratiche legali** con avvocati e istituti di credito
- **Style "Palazzinaro"**: navy + oro + verde registro, tipografia serif per titoli
  (Source Serif 4), font monospace per importi (IBM Plex Mono)

---

## 🆘 Troubleshooting

**Login Google non funziona su Vercel**
→ Aggiungi il dominio Vercel in Firebase Console → Authentication → Settings → Authorized domains

**L'AI non estrae nulla / errore 500 su /api/extract**
→ Verifica che `GEMINI_API_KEY` sia impostata in Vercel → Settings → Environment Variables
→ Verifica che la variabile sia disponibile per l'ambiente "Production"

**Le email di sollecito non partono**
→ Configura EmailJS in Impostazioni → Profilo Proprietario (Service ID, Template ID, Public Key)
→ Verifica che l'inquilino abbia un'email valida in anagrafica

**I dati non si salvano**
→ Verifica le regole Firestore: copia `firestore.rules` in Firebase Console → Firestore → Regole → Pubblica

**Voglio usare il mio progetto Firebase**
→ Imposta le variabili `VITE_FIREBASE_*` in `.env.local` (dev) o Vercel (prod).
→ Importante: imposta `VITE_FIRESTORE_DATABASE_ID=""` per usare il DB default del tuo progetto.

---

## 📄 Licenza

Codice proprietario. Tutti i diritti riservati.
