/**
 * Sammanställer den fullständiga systemprompten för en turn.
 *
 * Designen är medveten: tutor-persona och feedback-mönster är *statisk*
 * text (laddas vid bygget). Allt elev-specifikt (scenario, mål, due
 * items, notes) klistras in i ett "RUNTIME"-block. Modellen ser alltid
 * båda lagren.
 */

import type { ItemWithState, NoteRecord, Scenario } from '$lib/types';
import type { RetrievedChunk } from '$lib/rag';

import systemTutor from '../../../prompts/system_tutor.md?raw';
import systemWriting from '../../../prompts/system_writing.md?raw';
import feedbackPattern from '../../../prompts/feedback_pattern.md?raw';

export interface PromptInputs {
  scenario: Scenario;
  l1: string;
  targetLevel: string;
  goal: string;
  sessionItems: ItemWithState[];
  recentNotes: NoteRecord[];
  references?: RetrievedChunk[];
}

function fillVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

function describeItem(iws: ItemWithState): string {
  const ref = (iws.item.payload['ref'] as string) ?? `item:${iws.item.id}`;
  const state = iws.state.state;
  const reps = iws.state.reps;
  const lapses = iws.state.lapses;
  let detail = '';
  if (iws.item.item_type === 'vocab') {
    detail = ` "${iws.item.payload['lemma']}"`;
  } else if (iws.item.item_type === 'grammar' && iws.item.payload['note']) {
    detail = ` — ${iws.item.payload['note']}`;
  }
  const stats =
    state === 'new'
      ? ' (ny)'
      : ` (${state}, ${reps} reps${lapses ? `, ${lapses} lapses` : ''})`;
  return `  - ${ref}${detail}${stats}`;
}

export function buildSystemPrompt(inputs: PromptInputs): string {
  const isWriting = inputs.scenario.activity_type === 'writing';
  const personaTemplate = isWriting ? systemWriting : systemTutor;
  const persona = fillVariables(personaTemplate, {
    l1: inputs.l1,
    target_level: inputs.targetLevel
  });

  const itemsBlock =
    inputs.sessionItems.length === 0
      ? '(inga ackumulerade än — detta är en tidig session)'
      : inputs.sessionItems.map(describeItem).join('\n');

  const notesBlock =
    inputs.recentNotes.length === 0
      ? '(inga än)'
      : inputs.recentNotes
          .slice(0, 5)
          .map((n) => `  - [${n.created_at.slice(0, 10)}] ${n.body}`)
          .join('\n');

  const referencesBlock =
    !inputs.references || inputs.references.length === 0
      ? ''
      : `

## REFERENS FRÅN CURRICULUM (faktautdrag — citera bara om relevant)
${inputs.references.map((r) => `  > ${r.content}  \n    [källa: ${r.source_path}, similarity ${r.similarity.toFixed(2)}]`).join('\n')}`;

  const activityHeader = isWriting ? 'SKRIVUPPGIFT' : 'SCENARIO';
  const runtime = `
---
# RUNTIME-KONTEXT

## ${activityHeader}
- id: ${inputs.scenario.id}
- titel: ${inputs.scenario.title}
- ${isWriting ? 'sammanhang' : 'miljö'}: ${inputs.scenario.setting}
- din roll: ${inputs.scenario.tutor_role}
- öppningsreplik (säg denna ordagrant först): "${inputs.scenario.opening_line}"
- exit-signaler: ${inputs.scenario.exit_signals.join('; ')}
- pedagogisk anmärkning: ${inputs.scenario.notes_for_tutor}

## ITEMS I FOKUS DENNA SESSION
Returnera dessa refs i \`target_items\` när du arbetar med dem.
${itemsBlock}

## ELEVENS MÅL FÖR SESSIONEN
"${inputs.goal}"

## SENASTE NOTERINGAR OM ELEVEN (kronologiskt, nyast först)
${notesBlock}${referencesBlock}
---
`.trim();

  if (isWriting) {
    // Skrivcoachen har sin egen feedback-disciplin i system_writing.md;
    // hint-eskaleringen från feedback_pattern.md hör till rollspel.
    return [persona, '\n\n', runtime].join('');
  }
  return [persona, '\n\n---\n# FEEDBACK-MÖNSTER\n', feedbackPattern, '\n\n', runtime].join('');
}

export function buildClosingReflectionPrompt(transcript: string, l1: string): string {
  return `Du har just avslutat en spansklektion med en elev.

Ställ EN reflektionsfråga som passar just denna session. Välj utifrån vad
som faktiskt hände i transkriptet nedan. Frågan ska:
- vara kort (max två meningar)
- vara på ${l1} (elevens modersmål) så att eleven svarar fritt
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
