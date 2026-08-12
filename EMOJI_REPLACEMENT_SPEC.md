# Sostituzione emoticon con segnalatori professionali — specifica per l'implementazione

Questo file è una specifica di lavoro temporanea (non fa parte del progetto, non va commitata
nel messaggio finale — l'ultimo agente a finire la può lasciare, verrà rimossa dopo la verifica
finale). Deciso con Massimo dopo aver mostrato mockup visivi con più alternative. Applicare
QUESTE regole esattamente, senza inventare varianti diverse, per garantire coerenza tra i file.

## Regola generale

- **Tutte** le emoji vanno sostituite, nessuna eccezione (incluso il bottone WhatsApp, i
  simboli ✓/✕, e le emoji puramente decorative). Le uniche eccezioni: emoji puramente
  decorative di saluto senza alcun significato di stato/funzione (es. "Ciao, {nome}! 👋") vanno
  semplicemente **rimosse**, non sostituite da un'icona a caso.
- Libreria icone: **lucide-react** (già dipendenza del progetto, già importata ovunque —
  vedi import in cima a ogni file `.tsx` esistente). Non aggiungere altre librerie.
- Import: aggiungere le icone usate all'import esistente da `"lucide-react"` in cima al file
  (named import, es. `import { Building2, Wrench, ... } from "lucide-react";`). Se il file non
  ha ancora un import da lucide-react, aggiungerlo. Non duplicare import già presenti.
- Palette colori: SOLO le classi Tailwind già usate nel progetto — `indigo-*` (blu navy,
  primario/neutro), `emerald-*` (verde, positivo/regolare), `amber-*` (oro, attenzione),
  `rose-*` (rosso mattone, criticità/errore), `slate-*` (grigio, neutro/disattivo). Mai
  colori fuori palette (niente blue-*, red-*, green-*, yellow-*, sky-*, purple-* letterali —
  se il codice li usa già in punti non toccati da questo lavoro, non serve correggerli, ma non
  introdurne di nuovi).
- Dimensioni icone tipiche: 12–16px nei badge/testo inline, 14–20px nei bottoni/toast, secondo
  il contesto (segui la dimensione del testo/font-size adiacente, un'icona troppo grande o
  piccola rispetto al testo è un errore).

## 1. Badge di stato (Pagato/In Attesa/Moroso/Annullato e simili — 🟢🟡🔴⚪🟠🔵)

Deciso: **pallino in pillola sobria** (non solo pallino nudo, non icona).

Pattern esatto (adattare colori/testo al caso):
```jsx
<span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border bg-emerald-50 border-emerald-100 text-emerald-800">
  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
  Pagato
</span>
```
Adatta le dimensioni font/padding al contesto esistente (badge già presenti nel codice hanno
spesso `text-[8px] px-2.5 py-0.5 rounded-full uppercase` — mantieni quelle dimensioni quando
sostituisci un badge esistente, cambia solo il MARKUP interno da emoji+testo a
pallino+testo, aggiungendo `inline-flex items-center gap-1.5`).

Mappa colori:
- 🟢 (verde/positivo/pagato/regolare) → dot `bg-emerald-600`, pill `bg-emerald-50 border-emerald-100 text-emerald-800`
- 🟡 🟠 (attesa/attenzione) → dot `bg-amber-600`, pill `bg-amber-50 border-amber-100 text-amber-800`
- 🔴 (critico/moroso/scaduto) → dot `bg-rose-600`, pill `bg-rose-50 border-rose-100 text-rose-800`
- ⚪ (neutro/annullato/esente) → dot `bg-slate-400`, pill `bg-slate-100 border-slate-150 text-slate-500`
- 🔵 (informativo) → dot `bg-indigo-600`, pill `bg-indigo-50 border-indigo-100 text-indigo-800`

## 2. Icone di intestazione pannelli/tab/sezioni (📊💰🏢🛠️📝👤👥⚖ ecc. come icona di apertura)

Deciso: **icona nuda, senza riquadro** (colore `text-indigo-700` di default salvo indicazione
diversa nella mappa sotto), stessa dimensione del testo/titolo adiacente (tipicamente 14–18px).

```jsx
<Euro size={16} className="text-indigo-700 shrink-0" />
```

## 3. Toast di conferma/errore/avviso (✨✅❌⚠️❗📢🚨)

Deciso: **icona dentro un pallino pieno colorato**, dentro il toast scuro esistente
(`bg-slate-900`, non cambiare lo sfondo del toast). Pattern:

```jsx
<span className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
  <Check size={11} className="text-white" />
</span>
<span>Pagamento registrato correttamente nel mastrino.</span>
```

Colori del pallino: `bg-emerald-600` successo (✨✅), `bg-rose-600` errore (❌🛑🚨),
`bg-amber-600` avviso (⚠️❗), `bg-indigo-600` informativo/stato vuoto (📢).

## 4. Pulsanti con emoji come prefisso/suffisso testuale (➕📄📧🔍🪄🤝✍️🔗💬📷 ecc.)

Deciso: **icona dentro un pallino traslucido bianco**, dentro il bottone colorato esistente
(non cambiare il colore di sfondo del bottone). Pattern:

```jsx
<button className="... bg-emerald-600 ...">
  <span className="w-[18px] h-[18px] rounded-full bg-white/20 flex items-center justify-center shrink-0">
    <Plus size={11} className="text-white" />
  </span>
  Aggiungi Proprietario
</button>
```
Se il bottone è piccolo/compatto (badge-like, es. filtri o azioni minori con testo <10px), è
accettabile l'icona nuda senza il pallino traslucido se il pallino non ci sta visivamente —
usa buon senso mantenendo la coerenza con bottoni simili nello stesso file.

## 5. Mappa emoji → icona lucide-react (usa questa, non inventarne altre)

| Emoji | Icona lucide | Colore tipico | Note |
|---|---|---|---|
| 🟢 | (pallino, vedi §1) | emerald-600 | |
| 🟡 🟠 | (pallino, vedi §1) | amber-600 | |
| 🔴 | (pallino, vedi §1) | rose-600 | |
| ⚪ | (pallino, vedi §1) | slate-400 | |
| 🔵 | (pallino, vedi §1) | indigo-600 | |
| ⚠️ ❗ | `AlertTriangle` | amber-600 (rose-600 se il testo adiacente è un blocco/errore grave, es. "TELEFONO ASSENTE", "CONFIGURAZIONE MANCANTE") | |
| ❌ | `XCircle` | rose-600 | |
| ✅ | `CheckCircle2` | emerald-600 | |
| ✓ | `Check` | emerald-600 | conferme inline piccole |
| ✕ | `X` | rose-600 (o slate-500 se è solo un tasto "chiudi/rimuovi" neutro, non un errore) | |
| ✨ | `CheckCircle2` | emerald-600 | successo |
| 📢 | `Info` | indigo-600 | stati vuoti/informativi |
| 🚨 🛑 | `AlertTriangle` | rose-600 | |
| 🎉 🥂 | `PartyPopper` | emerald-600 | |
| 😐 | `Meh` | slate-500 | |
| 👤 | `User` | indigo-700 | |
| 👥 | `Users` | indigo-700 | |
| 👨 👩 | `User` | indigo-700 | generico, non specificare genere con l'icona |
| 💼 | `Briefcase` | amber-700 | ruolo Proprietario |
| 🎓 | `GraduationCap` | indigo-700 | |
| 🏢 | `Building2` | indigo-700 | condominio/edificio generico |
| 🏠 | `Home` | indigo-700 | |
| 🏬 | `Building` | indigo-700 | ufficio |
| 🏦 | `Landmark` | indigo-700 | banca |
| 🚗 | `Car` | indigo-700 | garage/box |
| 🏗️ | `HardHat` (o `Construction` se disponibile) | amber-700 | raro, valuta dal contesto |
| 🏟️ | `Building2` | indigo-700 | raro |
| 💰 | `Euro` | emerald-700 | voci economiche generiche |
| 💸 | `Euro` | rose-700 | uscita/costo |
| 💶 | `Euro` | indigo-700 | |
| 📄 | `FileText` | indigo-700 | |
| 📋 | `ClipboardList` | indigo-700 | |
| 📝 | `FileText` | indigo-700 | (coerente con §2, registrazione/nota) |
| 📑 | `Files` | indigo-700 | |
| 📌 | `Pin` | amber-700 | |
| 📎 | `Paperclip` | slate-600 | |
| 📮 | `Mail` | indigo-700 | |
| 🗓️ 📅 | `Calendar` | indigo-700 | |
| 📂 | `FolderOpen` | amber-700 | |
| 📤 | `Upload` | indigo-700 | |
| 📥 | `Download` | indigo-700 | (o `Inbox` se è una ricezione, non un download attivo) |
| 💾 | `Save` | indigo-700 | |
| 🖨️ | `Printer` | slate-600 | |
| 🖼️ | `Image` | slate-600 | |
| 🧮 | `Calculator` | indigo-700 | |
| 📧 ✉️ | `Mail` | indigo-700 (bianco se dentro bottone colorato, vedi §4) | |
| 💬 | `MessageCircle` | (bianco dentro bottone WhatsApp esistente, vedi §4) | mai icona/colore "brand" WhatsApp — resta neutro |
| 📞 | `Phone` | indigo-700 | |
| 👋 | — | — | RIMUOVI, non sostituire (emoji di saluto puramente decorativa) |
| 🔥 | `Flame` | amber-700 | gas |
| 💧 | `Droplets` | indigo-700 | acqua |
| ⚡ | `Zap` | amber-700 | elettricità |
| 🛠️ 🛠 | `Wrench` | slate-600 | manutenzioni |
| 🔍 | `Search` | indigo-700 | |
| 🪄 | `Wand2` | indigo-700 | azioni assistite/AI |
| 🤝 | `Handshake` | indigo-700 | |
| ✍️ | `PenLine` | indigo-700 | firma |
| ✏️ | `Pencil` | slate-600 | modifica generica (diversa da firma) |
| 🔗 | `Link2` | emerald-700 | riferimento incrociato ad anagrafica esistente |
| ⚙️ | `Settings` | slate-600 | |
| 🔒 | `Lock` | slate-600 | |
| 🔓 | `Unlock` | slate-600 | |
| 🔑 | `Key` | amber-700 | |
| 🛡️ | `Shield` | indigo-700 | |
| 💡 | `Lightbulb` | amber-700 | |
| 🗑️ | `Trash2` | rose-700 | |
| 🧹 | `Eraser` | slate-600 | |
| 🔄 | `RefreshCw` | indigo-700 | |
| 🎚️ | `SlidersHorizontal` | slate-600 | |
| 🧪 | `FlaskConical` | slate-600 | dati di test/simulazione |
| 🗺️ | `Map` | indigo-700 | |
| ➕ | `Plus` | (bianco dentro bottone, vedi §4) | |
| 🚀 | `Rocket` | indigo-700 | |
| 📷 | `Camera` | indigo-700 | |
| 🎂 | `Gift` | rose-700 | promemoria compleanno |
| ⚖️ | `Scale` | indigo-700 | Area Legale (icona già importata così in alcuni file) |
| ⚕️ | `Stethoscope` | rose-700 | raro |
| 📍 | `MapPin` | rose-700 | |
| 🔕 | `BellOff` | slate-500 | |
| 👍 | `CheckCircle2` | emerald-700 | "in regola"/"relazione regolare" |
| 👎 | `AlertTriangle` | rose-700 | "pendenze"/problema |

Se incontri un'emoji NON in questa tabella, scegli l'icona lucide-react semanticamente più
vicina, riusando lo stile di colore già usato per casi simili in QUESTO STESSO file (guarda
come sono già colorate le icone lucide esistenti nel file per restare coerente), e segnala nel
tuo riepilogo finale quale emoji non mappata hai trovato e quale icona hai scelto.

## Cosa NON toccare

- Non modificare nessuna logica applicativa, calcolo, chiamata Firestore, validazione, o testo
  che non sia l'emoji stessa. Se un'emoji fa parte di una stringa di dato reale salvata su
  Firestore (es. un `title` già scritto in passato con emoji dentro il testo salvato), NON
  toccarla — questa specifica riguarda SOLO markup JSX visualizzato nell'interfaccia, non dati.
- Non toccare i colori/classi Tailwind non collegati a emoji.
- Non introdurre `console.log` o commenti superflui.

## Verifica finale (obbligatoria per ogni file toccato)

1. Nessuna emoji deve restare nel file (puoi verificare con una ricerca visiva o con un
   comando che cerchi caratteri Unicode fuori dall'intervallo ASCII/Latino standard nei
   template JSX — non serve un tool specifico, basta rileggere il file con attenzione).
2. Il file deve continuare a fare `import` corretto di tutte le icone lucide-react usate.
3. Non lasciare import inutilizzati.
