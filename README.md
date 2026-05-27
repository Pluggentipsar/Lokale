# Lokale

En lokal, offline AI-läranderemskamrat (*learning companion*) för spanska
A1–B1 i svensk skolmiljö. All inferens körs på elevens eller skolans
hårdvara — ingen data lämnar maskinen.

> Designad efter principerna i Khosravi et al. (2026), *Building AI
> Companions that Prioritise Learning over Performance* — se
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) för hur de tre fundamenten
> (pedagogiskt, adaptivt, ansvarsfullt) avbildas i koden.

## Komma igång

### 1. Installera förutsättningar

- **Node 22+** och **npm**
- **Rust stable** (`rustup install stable`)
- **[Ollama](https://ollama.com)** — installera och starta så att
  `localhost:11434` svarar
- **Linux:** dessutom GTK/WebKit-byggberoenden:
  ```
  sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev \
       libayatana-appindicator3-dev librsvg2-dev libssl-dev
  ```

### 2. Hämta modellerna

```bash
ollama pull gemma3:4b           # chat-modellen (obligatorisk)
ollama pull nomic-embed-text    # för RAG (rekommenderas, frivillig)
```

### 3. Bygg och starta

```bash
npm install
npm run tauri:dev
```

Första bygget tar några minuter (Rust kompileras). Efter det är
varmstart ~5 sek. Tauri-fönstret poppar upp och du landar på Ollama-
status-skärmen — om allt funkar går den vidare till scenariolistan.

### Frivilliga röstberoenden

Installera om du vill ha tal in/ut:

- **whisper.cpp** för STT. `whisper-cli` på PATH + en spansk modell
  (t.ex. `ggml-small.bin`).
- **piper** för TTS. `piper` på PATH + en spansk röst (t.ex.
  `es_ES-davefx-medium.onnx`).

Peka ut modell-filerna i appens *Inställningar*-flik. Utan dessa fungerar
textläget oförändrat — röstknappen visar bara att binären saknas.

## Vad du kan göra just nu

- **14 aktiviteter** — 11 rollspel (café, presentation, vägbeskrivning,
  marknad, familj, klockslag, hobbies, skola, restaurang, helgplaner,
  apotek) + 3 skrivuppgifter (min dag, min stad, i helgen). 11 på A1,
  3 på A2.
- **Två aktivitetstyper med egna pedagogik-paket**:
  *Rollspel* = hint-eskalerande tutorn som spelar en karaktär.
  *Skrivning* = strikt skrivcoach som väljer 1–2 saker att jobba med.
- **Spaced repetition** (FSRS): varje vokabord och grammatik-koncept
  schemaläggs individuellt baserat på hur sessionen gick.
- **Open Learner Model** (`/progress`): se vad systemet tror om dig,
  invänd med "jag kan"-knappen. Stats över sessioner, engagemangs-
  fördelning, vanligaste felmönster och hårdaste items.
- **Lokal RAG** över 8 grammatikkällor — tutorn citerar curriculum-
  utdrag när det passar (ser/estar, artiklar, presens, gustar,
  preteritum, reflexiverben, futuro próximo, räkneord/klockslag).
- **Historik** (`/history`): bläddra och radera sessioner, se hela
  transkript inklusive vad tutorn "noterade" per turn.
- **Modellväljare**: byt Ollama-modell utan kodredigering.
- **Röst** (om binärer finns): push-to-talk + "läs upp tutorn"-toggle.

## Designaxiom

1. **Lokalt först.** Whisper/Piper/Gemma/embeddings kör allt på CPU/GPU
   lokalt. Ingen extern API-anrop ens som fallback.
2. **Smal scope.** En målgrupp (svenska elever som lär sig spanska
   A1–B1). Säg nej till resten.
3. **Productive struggle.** Modellen översätter inte och ger inte svar
   utan ett försök först — det är inte en begränsning, det är *poängen*.
4. **Adaptivitet via state, inte via stor modell.** Allt vi vet om eleven
   ligger i SQLite och pumpas in i prompten. En 4B-modell räcker när
   kontexten är rik.
5. **Open Learner Model.** Eleven kan alltid se och invända mot vad
   systemet tror om dem.

## Stack

| Lager | Val | Varför |
|---|---|---|
| Skal | Tauri 2 + SvelteKit + Svelte 5 | Single-click installer, liten binär, riktiga OS-API:er |
| Styling | Tailwind v4 | Snabb iteration, OKLCH-färger med dark mode |
| LLM | Ollama (initialt) → bundlad llama.cpp (M4) | Snabb iteration nu, bundling när vi distribuerar |
| Modell | `gemma3:4b` (default, utbytbart) | Tillräcklig för A1–B1 spanska |
| STT | whisper.cpp via PATH | Lokal, snabb på CPU |
| TTS | piper via PATH | ~60MB röster, realtid på CPU |
| Embeddings | `nomic-embed-text` via Ollama | Återanvänder befintlig runtime |
| Lagring | SQLite via tauri-plugin-sql | En fil per elev, allt på ett ställe |
| Vektor-sök | Brute-force cosine i TS (inte sqlite-vec) | Korpus litet, < 500 chunks |
| SRS | ts-fsrs | Modernare än SM-2, datadriven |

## Mappstruktur

```
Lokale/
├── README.md
├── docs/
│   ├── ARCHITECTURE.md     mappning mot pappret + komponentbeskrivning
│   └── ROADMAP.md          milstolpar M0..M4
├── prompts/                statiska prompt-template (bundlas i appen)
│   ├── system_tutor.md
│   ├── feedback_pattern.md
│   └── session_open_close.md
├── curriculum/             statiskt innehåll (bundlas i appen)
│   ├── scenarios/*.json    rollspels-scenarier
│   ├── grammar/*.md        grammatik-utdrag för RAG
│   └── vocab/*.json        vokabulärfrön
├── migrations/             SQLite-schema, körs av tauri-plugin-sql
│   ├── 0001_initial.sql
│   └── 0002_curriculum_index.sql
├── src/                    SvelteKit-frontend
│   ├── routes/
│   │   ├── +page.svelte             aktiv session (state machine)
│   │   ├── progress/+page.svelte    Open Learner Model
│   │   ├── history/+page.svelte     sessionslista
│   │   ├── history/[id]/+page.svelte  session-detalj
│   │   └── settings/+page.svelte    profil + röstinställningar
│   └── lib/
│       ├── components/   ChatTurn, ChatView, SessionOpen/Close,
│       │                  ScenarioPicker, PushToTalk, OllamaGate
│       ├── api/          ollama (chat+stream), embed, voice (invoke)
│       ├── pedagogy/     prompts.ts (assemble), fsrs.ts, rating.ts
│       ├── db.ts         alla SQLite-frågor
│       ├── curriculum.ts scenarier + item-derivering
│       ├── rag.ts        embedding-index + cosine-retrieval
│       └── state.svelte.ts  Svelte 5 runes-baserad app-state
└── src-tauri/             Rust-backend
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── src/
    │   ├── main.rs
    │   ├── lib.rs        SQL-plugin + invoke handlers
    │   └── voice.rs      whisper/piper subprocess-bryggor
    ├── capabilities/default.json
    └── icons/
```

## Utveckling

### Type-check och bygg

```bash
npm run check           # svelte-check (TS + Svelte)
npm run build           # frontend-bygge (statiska filer i build/)
npm run tauri:dev       # hela appen i dev-läge
npm run tauri:build     # produktions-bundle (.dmg/.msi/.AppImage)
```

### Bara frontend (utan Tauri)

```bash
npm run dev
```
Öppna `http://localhost:1420`. SQLite/röst fungerar inte utan Tauri,
men UI-iteration går snabbare.

### Lägga till ett scenario

1. Skapa `curriculum/scenarios/min_scen.json` enligt mönster från
   befintliga.
2. Importera och registrera i `src/lib/curriculum.ts`.
3. (Inga andra ändringar behövs — items deriveras automatiskt.)

### Lägga till ett grammatikutdrag för RAG

1. Skapa `curriculum/grammar/mitt_amne.md`.
2. Importera och lägg till i `SOURCES`-arrayen i `src/lib/rag.ts`.
3. Vid nästa start re-indexeras filen (hash skiljer).

### Justera tutor-prompten

`prompts/system_tutor.md` och `prompts/feedback_pattern.md` är de
viktigaste filerna. De bundlas vid bygget via `?raw`-import — efter
ändring krävs `npm run tauri:dev`-omstart för att Vite ska plocka upp
dem.

### Felsökning

- **"Kan inte nå Ollama"**: kör `ollama serve` i en annan terminal, eller
  starta Ollama-appen.
- **"Modellen saknas"**: `ollama pull gemma3:4b`.
- **Långsamma svar**: testa en mindre modell, t.ex. `qwen2.5:3b`.
  Ändra `MODEL_NAME` i `src/lib/state.svelte.ts`.
- **Tutorn glömmer meta-blocket**: minskar med större modell.
  `extractMeta` har fallback för flera format men inte alla. Se chat-
  bubblans "noteringar"-band — om det saknas helt ger den ingen FSRS-
  uppdatering, vilket är okej men suboptimalt.
- **Vill börja om från noll**: `Inställningar → Rensa all data` (eller
  ta bort `lokale.db` från app-data-mappen).

## Status

**M0, M1, M3 klara. M2 (röst) scaffold-klar, behöver binärer för full
funktionalitet. M4 (distribution) ej påbörjad.**

Se [`docs/ROADMAP.md`](docs/ROADMAP.md) för detaljerad status.
