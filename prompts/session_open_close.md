# Session Open & Close — Metakognitiva ramar

Pappret är tydligt: produktivt lärande börjar med målsättning och
slutar med reflektion. Båda är *separata* turns från huvud-konversationen.

## Sessionsöppning

Visas innan scenariot startar. Två snabba frågor:

1. **Mål för sessionen** (fritext, max ~80 tecken)
   > Vad vill du öva idag? Det kan vara ett ord, en känsla, en situation.

2. **Självskattning** (slider 1–5)
   > Hur säker känner du dig på spanska just nu, *idag*?

Spara båda i `sessions.goal` resp. en `notes`-rad med tagg `self_rating`.

Inga AI-genererade förslag här — eleven ska formulera målet själv. Det
är poängen.

## Sessionsavslutning

När eleven trycker "klar" eller efter ~12 min:

1. **Reflektionsfråga** (LLM ställer en, anpassad till sessionen)
   > Möjliga varianter, LLM väljer en baserat på sessionens innehåll:
   > - "Vad var en sak du sa idag som du inte hade kunnat säga förra veckan?"
   > - "Vilken del kändes svårast? Berätta varför."
   > - "Om du var tvungen att förklara *ser vs estar* till en kompis nu, hur skulle du säga?"

2. **Spara svaret** i `sessions.closing_reflection`.

3. **LLM skriver en intern note** (osynlig för eleven i M0; synlig i OLM
   från M1). Prompt-skiss:

```
Sammanfatta denna session i 2–4 meningar för att hjälpa dig (en framtida
tutor-instans) komma ihåg vad eleven kunde och inte kunde. Var konkret.
Nämn specifika strukturer. Inkludera affektiva observationer om
relevant ("verkade frustrerad när...").

Skriv inte beröm. Skriv inte uppmuntran. Detta är en lärartidsbok,
inte en rapport.

SESSION: {transcript}
ELEV: {profile}
```

## Var detta INTE ska sitta

- Inte i huvudpromptens systemmeddelande — det blir kontextrus.
- Inte som extra turn i samma `encounters`-sekvens — separat tabell-
  beteende, eller åtminstone markerade som `speaker='system'` (lägg in
  i M1 om vi behöver det).

## Designprincip

Båda dessa moment är *snabba*. Om de tar mer än 20 sekunder vardera
kommer eleven hoppa över dem. Bygg UI:t så att de är hälften så stora
som huvudchatten — visuellt sekundära, kognitivt centrala.
