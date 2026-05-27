# Roadmap

Milstolpar definierade efter vad eleven kan *göra*, inte efter teknisk
implementation. Varje milstolpe ska vara körbar end-to-end.

## M0 — "Hello, Compañero" ✅
*Mål: en elev kan ha ett textsamtal i ett rollspel och får hint-eskalerande
feedback. Inga ljud, ingen SRS, ingen OLM.*

- [x] Tauri-projekt + Svelte-skelett uppe
- [x] SQLite via `tauri-plugin-sql`, `0001_initial.sql` körs
- [x] Ollama-hälsokoll vid uppstart, instruktion om saknas
- [x] Hårdkodat `cafe_a1.json`-scenario laddat
- [x] Chat-UI: en pratbubbla i taget, push-to-send (med streaming)
- [x] System-prompt + feedback-pattern injiceras
- [x] Varje turn loggas i `encounters` (med strukturerad meta för tutor-turns)
- [x] Sessionsstart frågar mål + självskattning
- [x] Sessionsslut: LLM-genererad reflektionsfråga + lärartidsbok-note

Frågor M0 ska besvara: *känns interaktionen pedagogiskt rätt? vägrar
modellen översätta utan ansträngning? känns hint-eskaleringen naturlig?*

## M1 — "Den minns mig" ✅
*Mål: appen kommer ihåg mellan sessioner och anpassar sig.*

- [x] `notes`-generering vid sessionsslut (LLM skriver kort observation)
- [x] Items-modellen: vokab + grammatik-koncept tagas på scenarion
- [x] FSRS-state per item, due-beräkning (via ts-fsrs)
- [x] Due items injiceras i prompten
- [x] Open Learner Model-vy: lista över items grupperade på state, mastery-prickar, senaste notes
- [x] Eleven kan klicka "jag kan det här redan" på en item → påverkar FSRS
- [x] Scenariot väljs ur en lista (3 A1-scenarier seedade)
- [x] Inställningssida för namn/L1/nivå

Frågor M1 ska besvara: *känns det att modellen lärt sig något om eleven?
är OLM:en begriplig för en 14-åring?*

## M2 — "Tala till mig" 🟡 (scaffolding klar)
*Mål: röstinteraktion fungerar.*

- [x] Tauri-kommandon (`transcribe_audio`, `synthesize_speech`,
      `voice_availability`) som shellar ut till `whisper-cli` resp. `piper`
- [x] Push-to-talk-knapp i ChatView (MediaRecorder → base64 → Rust)
- [x] TTS-flöde med "läs upp tutorn"-toggle, filtrerar bort *kursiv*-coach-text
- [x] Settings-vy för whisper/piper-modellpaths + språk
- [x] Soft-fail om binärer saknas — text-flödet fungerar oberoende
- [ ] Uttalsfeedback (phoneme-distance vs målmening) — kräver phonemizer
- [ ] "Lyssnar"-visualisering (waveform/level meter)

Användaren installerar `whisper.cpp` och `piper` separat:
- macOS: `brew install whisper-cpp piper`
- Linux: bygg från källa eller använd Pakets från distron
- Windows: ladda ner releases från respektive GitHub

Frågor M2 ska besvara: *hur ofta gissar Whisper fel på elevens spanska?
hjälper Piper-rösten eller distraherar den?*

## M3 — "Bredd och RAG" ✅
*Mål: fler scenarier, riktig RAG.*

- [x] Lokal embedding via Ollama (`nomic-embed-text`)
- [x] Curriculum-chunkning + indexering (brute-force cosine, ej sqlite-vec)
- [x] Top-K-retrieval injiceras i prompten som REFERENS-block
- [x] Idempotent index-bygge (hash-baserad change detection)
- [x] 14 aktiviteter (11 rollspel + 3 skrivuppgifter): café, presentation,
      vägbeskrivning, marknad, familj, klockslag, hobbies, skola,
      restaurang, helgplaner, apotek, min dag (skriv), min stad (skriv),
      i helgen (skriv)
- [x] Fri skrivning med 1–2-fels-feedback (egen system_writing.md,
      activity_type="writing", egen feedback-disciplin)
- [ ] Meningsrekonstruktion som aktivitetstyp (skippad — drag-drop-UX för dyrt
      i förhållande till värdet just nu)

Vi valde brute-force cosine över sqlite-vec eftersom korpus är litet
(<500 chunks). När det växer förbi det byts ut.

## M3.5 — Polish (löpande) 🟡

- [x] Historikvy med session-detalj och radera-session
- [x] Statistik på OLM (sessioner, engagemang, vanligaste fel, hårdaste items)
- [x] Modellväljare i settings (gemma3:4b, qwen2.5, llama3.2)
- [x] "Rensa all data"-knapp
- [x] Tålig meta-extraktion (flera fallback-format)
- [x] "Noteringar"-band per tutor-bubbla för debug av prompt-följsamhet
- [x] Auto-växande textarea för längre skrivningar

## M4 — "Distribuerbart"
*Mål: en lärare kan installera utan teknisk hjälp.*

- [ ] Bundlad llama.cpp + modell (ingen Ollama-beroende)
- [ ] Single .dmg / .msi / .AppImage
- [ ] Export/import av elevens fil (`.zip` med db + ev. ljud)
- [ ] Lärarläge: aggregerad vy över flera elever (klassrum)

## Icke-mål (medvetet)

- Andra språk än spanska (replikera mönstret *senare*)
- Andra ämnen (samma)
- Molnsynk
- Konton, inloggning
- Gamification (poäng, streaks) — vi vill inte tävla med Duolingo på det
  spåret; vårt värde är *djup*, inte *engagement-loops*
