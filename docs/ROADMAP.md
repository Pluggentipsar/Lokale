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

## M2 — "Tala till mig"
*Mål: röstinteraktion fungerar.*

- [ ] Whisper.cpp som Tauri-sidecar, push-to-talk-knapp
- [ ] Piper som sidecar, tutorn talar tillbaka (kan stängas av)
- [ ] Uttalsfeedback v0: phoneme-distance vs målmening (förlåtande)
- [ ] "Lyssnar"-visualisering

Frågor M2 ska besvara: *hur ofta gissar Whisper fel på elevens spanska?
hjälper Piper-rösten eller distraherar den?*

## M3 — "Bredd och RAG"
*Mål: fler scenarier, riktig RAG.*

- [ ] 10+ scenarion (A1 + A2)
- [ ] Curriculum-embeddings i `sqlite-vec`
- [ ] Top-K-retrieval injiceras i prompten
- [ ] Meningsrekonstruktion som aktivitetstyp
- [ ] Fri skrivning med 1–2-fels-feedback

## M4 — "Distribuerbart"
*Mål: en lärare kan installera utan teknisk hjälp.*

- [ ] Bundlad llama.cpp + modell (ingen Ollama-beroende)
- [ ] Single .dmg / .msi / .AppImage
- [ ] Export/import av elevens fil
- [ ] Lärarläge med PIN: läs noteringar, se progress, men inte fulltranskript

## Icke-mål (medvetet)

- Andra språk än spanska (replikera mönstret *senare*)
- Andra ämnen (samma)
- Molnsynk
- Konton, inloggning
- Gamification (poäng, streaks) — vi vill inte tävla med Duolingo på det
  spåret; vårt värde är *djup*, inte *engagement-loops*
