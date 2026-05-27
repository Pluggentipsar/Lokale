/**
 * Sammanställer den fullständiga systemprompten för en turn.
 *
 * Designen är medveten: tutor-persona och feedback-mönster är *statisk*
 * text (laddas vid bygget). Allt elev-specifikt (scenario, mål, due
 * items, notes) klistras in i ett "RUNTIME"-block. Modellen ser alltid
 * båda lagren.
 */

import type { Scenario } from '$lib/types';

import systemTutor from '../../../prompts/system_tutor.md?raw';
import feedbackPattern from '../../../prompts/feedback_pattern.md?raw';

export interface PromptInputs {
  scenario: Scenario;
  l1: string;
  targetLevel: string;
  goal: string;
  dueItems: string[];     // M0: tom array tills M1
  recentNotes: string[];  // M0: tom array tills M1
}

function fillVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export function buildSystemPrompt(inputs: PromptInputs): string {
  const persona = fillVariables(systemTutor, {
    l1: inputs.l1,
    target_level: inputs.targetLevel
  });

  const dueBlock =
    inputs.dueItems.length === 0
      ? '(inga ackumulerade än — detta är en tidig session)'
      : inputs.dueItems.map((s) => `  - ${s}`).join('\n');

  const notesBlock =
    inputs.recentNotes.length === 0
      ? '(inga än)'
      : inputs.recentNotes.map((s) => `  - ${s}`).join('\n');

  const runtime = `
---
# RUNTIME-KONTEXT

## SCENARIO
- id: ${inputs.scenario.id}
- titel: ${inputs.scenario.title}
- miljö: ${inputs.scenario.setting}
- din roll: ${inputs.scenario.tutor_role}
- öppningsreplik (säg denna ordagrant först): "${inputs.scenario.opening_line}"
- exit-signaler: ${inputs.scenario.exit_signals.join('; ')}
- pedagogisk anmärkning: ${inputs.scenario.notes_for_tutor}

## TARGET ITEMS DENNA SESSION
${inputs.scenario.target_items.map((t) => `  - ${t.ref}${t.lemmas ? ` (${t.lemmas.join(', ')})` : ''}`).join('\n')}

## ELEVENS MÅL FÖR SESSIONEN
"${inputs.goal}"

## DUE ITEMS (från spaced repetition)
${dueBlock}

## SENASTE NOTERINGAR OM ELEVEN
${notesBlock}
---
`.trim();

  return [persona, '\n\n---\n# FEEDBACK-MÖNSTER\n', feedbackPattern, '\n\n', runtime].join('');
}

export function buildClosingReflectionPrompt(transcript: string): string {
  return `Du har just avslutat en spansklektion med en elev.

Ställ EN reflektionsfråga som passar just denna session. Välj utifrån vad
som faktiskt hände i transkriptet nedan. Frågan ska:
- vara kort (max två meningar)
- vara på ${'sv'} (elevens modersmål) så att eleven svarar fritt
- inte vara generisk ("vad lärde du dig?") utan kopplad till något specifikt

Svara med ENDAST frågan, ingen inramning.

TRANSKRIPT:
${transcript}`;
}

export function buildSessionNotePrompt(transcript: string, goal: string): string {
  return `Du skriver i en lärartidsbok om en elev efter en spanskalektion.

Skriv 2–4 meningar på svenska som hjälper en framtida tutor-instans
komma ihåg vad eleven kunde och inte kunde. Var konkret, nämn specifika
strukturer. Inkludera affektiva observationer om relevant.

Skriv INTE beröm. Skriv INTE uppmuntran. Detta är en intern anteckning.

ELEVENS MÅL: ${goal}

TRANSKRIPT:
${transcript}`;
}
