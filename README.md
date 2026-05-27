# Lokale

En lokal, offline AI-läranderemskamrat (*learning companion*) för spanska
A1–B1 i svensk skolmiljö. All inferens körs på elevens eller skolans
hårdvara — ingen data lämnar maskinen.

> Designad efter principerna i Khosravi et al. (2026), *Building AI
> Companions that Prioritise Learning over Performance* — se
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) för hur de tre fundamenten
> (pedagogiskt, adaptivt, ansvarsfullt) avbildas i koden.

## Designaxiom

1. **Lokalt först.** Whisper/Piper/Gemma/embeddings kör allt på CPU/GPU
   lokalt. Ingen extern API-anrop ens som fallback.
2. **Smal scope.** En målgrupp (svenska elever som lär sig spanska
   A1–B1), några få aktiviteter (rollspel, meningsrekonstruktion,
   högläsning, fri skrivning). Säg nej till resten.
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
| Skal | Tauri + Svelte | Single-click installer, liten binär, riktiga OS-API:er |
| LLM | Ollama (initialt) → llama.cpp sidecar (senare) | Ollama först för snabb iteration; sidecar för att slippa beroenden vid skoldistribution |
| Modell | `gemma3:4b` / `qwen2.5:3b` (utbytbart) | Tillräcklig för A1–B1 spanska |
| STT | whisper.cpp (`small` ES) | CPU-realtid |
| TTS | Piper (es_ES) | ~60MB, CPU-realtid |
| Embeddings | `nomic-embed-text` via Ollama | Återanvänder befintlig runtime |
| Lagring | SQLite + `sqlite-vec` | En fil, allt på ett ställe |
| SRS | FSRS (öppen impl., ts/rust) | Modernare än SM-2, datadriven |

## Mappstruktur (planerad)

```
Lokale/
├── README.md                         ← du är här
├── docs/
│   ├── ARCHITECTURE.md               ← mappning mot pappret + komponentbeskrivning
│   └── ROADMAP.md                    ← milstolpar M0..M3
├── prompts/
│   ├── system_tutor.md               ← persona, hårda regler, beteende
│   ├── feedback_pattern.md           ← attempt → hint → worked example
│   └── session_open_close.md         ← goal-setting & reflektion
├── curriculum/                       ← statiskt innehåll, packas med appen
│   ├── scenarios/
│   │   └── cafe_a1.json
│   ├── grammar/
│   │   └── ser_estar.md
│   └── vocab/
│       └── a1_core.json
├── migrations/
│   └── 0001_initial.sql              ← DB-schema (källan till sanning)
├── src/                              ← Svelte-frontend (skapas i M0)
│   ├── routes/
│   │   ├── +page.svelte              ← aktiv session
│   │   ├── progress/+page.svelte     ← Open Learner Model
│   │   └── settings/+page.svelte
│   └── lib/
│       ├── components/               ← ChatTurn, DueItemsPanel, PushToTalk, OLM
│       ├── stores/                   ← session, learner
│       ├── api/                      ← ollama, whisper, piper (via Tauri)
│       └── pedagogy/                 ← prompts.ts, fsrs.ts, engagement.ts
├── src-tauri/                        ← Rust-backend (skapas i M0)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs
│   │   ├── db.rs                     ← SQLite + migrations
│   │   ├── sidecar.rs                ← whisper/piper subprocess
│   │   └── ollama.rs                 ← health check, modell-pull
│   └── binaries/                     ← whisper, piper-binärer per OS
└── .gitignore
```

## Köra

Förutsättningar:
- Node 22+, Rust stable, npm
- [Ollama](https://ollama.com) installerat och igång
- Linux-byggberoenden (bara på Linux):
  `apt install libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev`

```bash
# 1. Hämta modellerna
ollama pull gemma3:4b           # chat-modellen (krävs)
ollama pull nomic-embed-text    # för RAG (rekommenderas)

# 2. Installera frontend-deps
npm install

# 3. Starta appen i dev-läge (Tauri öppnar ett fönster)
npm run tauri:dev
```

Utan `nomic-embed-text` fungerar appen ändå — RAG-blocket utelämnas tyst
ur prompten.

Första körningen tar några minuter (Rust-kompilering). Efter det är
varmstart ~5 sek.

### Bara frontend (utan Tauri-fönstret)

Om du vill iterera snabbt på UI utan att starta Tauri:
```bash
npm run dev
```
Öppna `http://localhost:1420`. SQLite kommer inte fungera utan Tauri,
men UI:t laddar.

## Status

**M0 klar.** En elev kan starta en session, ange mål + självskattning,
ha ett textsamtal med en lokal modell i ett café-rollspel, avsluta med
en reflektionsfråga som modellen formulerar utifrån just denna session,
och få sin progress sparad i SQLite. Hint-eskalering, "vägrar översätta
utan försök" och strukturerad metadata-extraktion fungerar.

Saknas (kommer i M1+): OLM-vy, FSRS-schemaläggning, fler scenarion,
röst, bundlad llama.cpp för installation utan Ollama. Se
[`docs/ROADMAP.md`](docs/ROADMAP.md).
