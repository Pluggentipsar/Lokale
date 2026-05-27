/**
 * Curriculum-laddning + seed.
 *
 * Tanken: vi har statiska JSON/MD-filer i curriculum/. Vid första
 * användning av varje scenario säkerställer vi att alla items det
 * refererar till finns i DB:n med en initial review_state. Idempotent.
 *
 * Detta är den enklaste vägen till en fungerande "items finns" — vi
 * ackumulerar items i takt med att de behövs istället för en gigantisk
 * seed-allt-vid-installation.
 */

import type { Scenario } from '$lib/types';

// Hårdkodad katalog över vilka scenarier som finns. Senare auto-genererad.
import cafeA1 from '../../curriculum/scenarios/cafe_a1.json?raw';
import presentacionA1 from '../../curriculum/scenarios/presentacion_a1.json?raw';
import direccionesA1 from '../../curriculum/scenarios/direcciones_a1.json?raw';
import comprasA1 from '../../curriculum/scenarios/compras_a1.json?raw';
import familiaA1 from '../../curriculum/scenarios/familia_a1.json?raw';
import horaA1 from '../../curriculum/scenarios/hora_a1.json?raw';
import restauranteA2 from '../../curriculum/scenarios/restaurante_a2.json?raw';
import planesA2 from '../../curriculum/scenarios/planes_a2.json?raw';

const SCENARIOS: Record<string, Scenario> = (() => {
  const parsed: Record<string, Scenario> = {};
  const raws = [
    cafeA1,
    presentacionA1,
    direccionesA1,
    comprasA1,
    familiaA1,
    horaA1,
    restauranteA2,
    planesA2
  ];
  for (const raw of raws) {
    const s = JSON.parse(raw) as Scenario;
    parsed[s.id] = s;
  }
  return parsed;
})();

export function listScenarios(): Scenario[] {
  return Object.values(SCENARIOS);
}

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS[id];
}

// ---------------------------------------------------------------------
// Item-shape utifrån scenariots target_items.
//
// Vi gör en item per lemma för vokab-target, och en item för själva
// grammar/pattern-refen.
// ---------------------------------------------------------------------

export interface DerivedItem {
  ref: string;                  // unik nyckel, t.ex. "vocab:café" eller "grammar:articles_indef_a1"
  item_type: 'vocab' | 'grammar' | 'pattern';
  payload: Record<string, unknown>;
  level: string;
  tags: string[];
  source: string;
}

export function deriveItemsForScenario(s: Scenario): DerivedItem[] {
  const out: DerivedItem[] = [];

  for (const t of s.target_items) {
    const kind = t.ref.split(':')[0];
    if (kind === 'vocab' && t.lemmas) {
      for (const lemma of t.lemmas) {
        out.push({
          ref: `vocab:${lemma}`,
          item_type: 'vocab',
          payload: { lemma, parent_ref: t.ref },
          level: s.level,
          tags: deriveTagsFromRef(t.ref, s.id),
          source: `scenario:${s.id}`
        });
      }
    } else if (kind === 'grammar') {
      out.push({
        ref: t.ref,
        item_type: 'grammar',
        payload: { note: t.note ?? '', parent_ref: t.ref },
        level: s.level,
        tags: deriveTagsFromRef(t.ref, s.id),
        source: `scenario:${s.id}`
      });
    } else if (kind === 'pattern') {
      out.push({
        ref: t.ref,
        item_type: 'pattern',
        payload: { examples: t.examples ?? [], parent_ref: t.ref },
        level: s.level,
        tags: deriveTagsFromRef(t.ref, s.id),
        source: `scenario:${s.id}`
      });
    }
  }

  return out;
}

function deriveTagsFromRef(ref: string, scenarioId: string): string[] {
  // "vocab:cafe_drinks_a1" → ["cafe","drinks"]
  const tail = ref.split(':')[1] ?? '';
  const parts = tail
    .replace(/_(a1|a2|b1|b2|c1|c2)$/i, '')
    .split('_')
    .filter(Boolean);
  return [...new Set([scenarioId, ...parts])];
}
