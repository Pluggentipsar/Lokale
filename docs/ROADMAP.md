# Roadmap

Milstolpar definierade efter vad eleven kan *göra*, inte efter teknisk
implementation. Varje milstolpe ska vara körbar end-to-end.

## M0 — "Hello, Compañero"
*Mål: en elev kan ha ett textsamtal i ett rollspel och får hint-eskalerande
feedback. Inga ljud, ingen SRS, ingen OLM.*

- [ ] Tauri-projekt + Svelte-skelett uppe
- [ ] SQLite via `tauri-plugin-sql`, `0001_initial.sql` körs
- [ ] Ollama-hälsokoll vid uppstart, instruktion om saknas
- [ ] Hårdkodat `cafe_a1.json`-scenario laddat
- [ ] Chat-UI: en pratbubbla i taget, push-to-send
- [ ] System-prompt + feedback-pattern injiceras
- [ ] Varje turn loggas i `encounters`
- [ ] Sessionsstart frågar "Vad vill du öva idag?", slut "Vad lärde du dig?"

Frågor M0 ska besvara: *känns interaktionen pedagogiskt rätt? vägrar
modellen översätta utan ansträngning? känns hint-eskaleringen naturlig?*

## M1 — "Den minns mig"
*Mål: appen kommer ihåg mellan sessioner och anpassar sig.*

- [ ] `notes`-generering vid sessionsslut (LLM skriver kort observation)
- [ ] Items-modellen: vokab + grammatik-koncept tagas på scenarion
- [ ] FSRS-state per item, due-beräkning
- [ ] Due items injiceras i prompten
- [ ] Open Learner Model-vy: lista över items, mastery-prickar, senaste notes
- [ ] Eleven kan klicka "jag kan det här redan" på en item → påverkar FSRS

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
