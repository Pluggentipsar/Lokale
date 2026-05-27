# Arkitektur

## Mappning mot Khosravi et al. (2026)

Pappret formulerar tre fundament för en AI-läranderemskamrat. Här är hur
varje fundament konkretiseras i Lokale.

### 1. Pedagogiskt fundament — *students learn with AI*

| Princip | Implementation |
|---|---|
| **Djup & interaktiv inlärning** (generation/testing effect) | Modellen ber alltid eleven *försöka först*. Aldrig översätta on demand. Worked example först efter ett ärligt försök + diskussion. |
| **Guided scaffolding** (ZPD) | Hint-eskalering i `prompts/feedback_pattern.md`: 1) öppen fråga → 2) ledtråd om kategori → 3) ledtråd om form → 4) worked example. |
| **Learning to learn** (metakognition) | Session öppnas med målsättning, stängs med reflektion (`prompts/session_open_close.md`). LLM-noteringar synliga för eleven. |
| **Kontextuell inlärning** | Rollspelsscenarier är förstaklass-medborgare (`curriculum/scenarios/`). Vokabulär lärs alltid in i scen, aldrig som naken lista. |

### 2. Adaptivt fundament — *AI learns about students*

Pappret formaliserar fyra steg: **Capture → Model → Adapt → Evolve**.

| Steg | Implementation |
|---|---|
| **Capture** | Varje yttrande loggas i `encounters`. Engagemangsmått (svarslängd, latens, retries) räknas på klienten. |
| **Model** | `review_state` håller FSRS-tillstånd per item. `notes` är LLM-skriven prosa om eleven (uppdateras vid sessionsslut). |
| **Adapt** | Inför varje turn injicerar vi: due items, senaste 3 notes, aktuellt scenario, elevprofil. Modellen ser elevens tillstånd — *därför* känns den personlig trots små parametrar. |
| **Evolve** | M3+: A/B-tester på prompt-varianter, FSRS-parameteroptimering på elevens egen historik. |

### 3. Ansvarsfullt fundament — *AI acts with integrity*

| Åtagande | Implementation |
|---|---|
| **Säkerhet** | All data lokal. SQLite ligger i `~/.local/share/lokale/` (Linux) / motsvarande per OS. Export = en `.zip`. Inget telemetri. |
| **Transparens** | Open Learner Model-vyn (`/progress`) visar varje item, dess FSRS-tillstånd, och senaste notes. Eleven kan invända: "nej, jag kan det här." |
| **Ansvarstagande** | Lärar-/föräldraläge med PIN. Loggvy. Modell-version sparas per session (`sessions.model_version`) så att man kan förklara varför något skedde. |
| **Inkludering** | L1 är konfigurerbar (svenska default, men app är inte hårdkodad). Text/röstläge är valbart. Hög kontrast + stora typsnitt som inställning. |

## Komponentmodell

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri-skal (en process)                  │
│  ┌─────────────────────┐    ┌──────────────────────────┐    │
│  │ Svelte-frontend     │◄──►│ Rust-backend             │    │
│  │  - aktiv session    │    │  - SQLite (db.rs)        │    │
│  │  - OLM-vy           │    │  - sidecar-styrning      │    │
│  │  - inställningar    │    │  - Ollama-hälsa          │    │
│  └────────┬────────────┘    └──┬───────────┬───────────┘    │
│           │ (fetch localhost)     │           │              │
└───────────┼───────────────────────┼───────────┼──────────────┘
            ▼                       ▼           ▼
       ┌─────────┐            ┌──────────┐  ┌────────┐
       │ Ollama  │            │ whisper  │  │ piper  │
       │ :11434  │            │ (sidecar)│  │(sidec.)│
       └─────────┘            └──────────┘  └────────┘
```

Varför Ollama och inte llama.cpp direkt initialt: snabbare iteration på
modellbyte, stabilt HTTP-API. Vi byter till bundlad llama.cpp i M2 när
distributionsfriktionen blir flaskhalsen.

## Prompt-konstruktion (varje turn)

```
[system_tutor.md]                       ← persona + hårda regler
[feedback_pattern.md]                   ← hint-eskaleringsregler
---
SCENARIO: <scenarios/cafe_a1.json>
ELEVPROFIL: nivå=A1, L1=sv, intressen=[fotboll, musik]
DUE ITEMS IDAG: [ser/estar, beställa kaffe-vokab, presens av -ar verb]
SENASTE NOTERINGAR:
  - 2026-05-25: blandar ser/estar med plats vs tillstånd
  - 2026-05-23: stark på presens, osäker på preteritum
AKTUELLT MÅL: "öva på att beställa på café"
---
KONVERSATIONSHISTORIK (denna session):
<senaste 8 turns>
---
ELEVENS YTTRANDE: <text/transkriberat tal>
```

Modellen returnerar **både** ett yttrande *och* en strukturerad metadata-rad
(JSON i slutet) som backend parsar:
- `target_items`: vilka items detta turn jobbade på
- `observed_errors`: tagg-lista
- `engagement_estimate`: passive | active | constructive (ICAP)
- `next_move`: continue | hint | worked_example | check_understanding

Detta är hur LLM:en blir en *del av* modelleringen, inte bara en pratare.

## RAG

**Vad vi indexerar:** autentiska exempelmeningar (`curriculum/examples/`)
och längre grammatiknoteringar (`curriculum/grammar/`). Embedded med
`nomic-embed-text`, lagrat i `sqlite-vec`-tabellen `curriculum_chunks`.

**Vad vi *inte* indexerar:** elevhistorik. Den frågar vi strukturerat
mot — vektorsök är fel verktyg där.

**När vi söker:** vid prompt-konstruktion, top-3 chunks som matchar
aktuellt scenario + due items. Injiceras som "REFERENS"-block.

## Datalivscykel

- All data i en SQLite-fil. Inget externt.
- Export: knapp i inställningar → `.zip` (db + ev. ljudsnuttar).
- Radering: knapp som verkligen tar bort filen + alla sidecar-cacher.
- Skoldistribution: varje elevs data är *hens egen fil*. Lärarvy är en
  separat app som läser elevens exportzip.
