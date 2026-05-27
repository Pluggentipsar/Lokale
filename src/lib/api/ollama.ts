/**
 * Ollama-klient. Pratar med localhost:11434.
 *
 * Vi använder /api/chat med streaming. Modellen specificeras per anrop
 * så att vi kan byta i runtime utan rebuild.
 */

import type { OllamaStatus, TutorMeta } from '$lib/types';

const OLLAMA_BASE = 'http://localhost:11434';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatStreamOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  signal?: AbortSignal;
  /** Anropas för varje token-delta. */
  onToken: (delta: string) => void;
}

export async function checkOllama(model: string): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { method: 'GET' });
    if (!res.ok) {
      return {
        ok: false,
        reachable: false,
        modelAvailable: false,
        modelName: model,
        message: `Ollama svarade ${res.status}.`
      };
    }
    const body = (await res.json()) as { models?: Array<{ name: string }> };
    const have = (body.models ?? []).map((m) => m.name);
    const modelAvailable = have.some(
      (n) => n === model || n.startsWith(`${model}:`) || n === `${model}:latest`
    );
    return {
      ok: modelAvailable,
      reachable: true,
      modelAvailable,
      modelName: model,
      message: modelAvailable
        ? 'OK'
        : `Hittade inte modellen "${model}". Kör: ollama pull ${model}`
    };
  } catch (err) {
    return {
      ok: false,
      reachable: false,
      modelAvailable: false,
      modelName: model,
      message:
        'Kan inte nå Ollama på localhost:11434. Starta Ollama och försök igen.'
    };
  }
}

/**
 * Strömmar ett chatt-svar från Ollama. Returnerar hela texten när
 * strömmen är klar.
 */
export async function chatStream(opts: ChatStreamOptions): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: true,
      options: {
        temperature: opts.temperature ?? 0.7
      }
    })
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama /api/chat failed: ${res.status} ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // Ollama streams newline-delimited JSON. Split on \n; keep partial line in buf.
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(line) as {
          message?: { content?: string };
          done?: boolean;
        };
        const delta = obj.message?.content ?? '';
        if (delta) {
          full += delta;
          opts.onToken(delta);
        }
      } catch {
        // Hoppa över felaktiga rader (kan hända vid avbrott).
      }
    }
  }
  return full;
}

const META_RE = /<<META>>([\s\S]*?)<<END>>/;
// Fallback: hitta sista JSON-objektet i utdata om <<META>>-markörerna saknas
// (vissa små modeller glömmer ramarna men producerar fortfarande JSON).
const TRAILING_JSON_RE = /\{[^{}]*"target_items"[\s\S]*?\}\s*$/;

function validateMeta(obj: unknown): TutorMeta | null {
  if (!obj || typeof obj !== 'object') return null;
  const p = obj as Partial<TutorMeta>;
  const engagementOk =
    p.engagement === 'passive' ||
    p.engagement === 'active' ||
    p.engagement === 'constructive';
  if (
    Array.isArray(p.target_items) &&
    Array.isArray(p.observed_errors) &&
    engagementOk &&
    typeof p.next_move === 'string'
  ) {
    return p as TutorMeta;
  }
  return null;
}

/**
 * Plockar ut <<META>>...<<END>>-blocket (eller trailing JSON-fallback)
 * från LLM-utdata. Returnerar det rensade visningsbara svaret och
 * den strukturerade metadatan om den kunde parsas.
 *
 * Robust mot:
 * - markdown-fenced JSON (```json ... ```)
 * - blank rad mellan <<META>> och innehållet
 * - modellen som glömmer <<END>>-markören
 * - trailing JSON utan ramar
 */
export function extractMeta(raw: string): {
  display: string;
  meta: TutorMeta | null;
} {
  let working = raw;

  // 1. Försök hitta <<META>>...<<END>>-blocket
  const match = working.match(META_RE);
  if (match) {
    const inner = match[1].replace(/```json|```/g, '').trim();
    try {
      const parsed = JSON.parse(inner);
      const valid = validateMeta(parsed);
      if (valid) {
        return { display: working.replace(META_RE, '').trim(), meta: valid };
      }
    } catch {
      /* fall through */
    }
  }

  // 2. Försök hitta <<META>> utan <<END>> — tag allt efter och försök parsa
  const startIdx = working.indexOf('<<META>>');
  if (startIdx !== -1) {
    const tail = working.slice(startIdx + '<<META>>'.length).trim();
    // Hitta första balanserade {...}
    const objMatch = tail.match(/\{[\s\S]*?\}\s*(?:<<END>>)?/);
    if (objMatch) {
      try {
        const parsed = JSON.parse(objMatch[0].replace(/<<END>>/g, ''));
        const valid = validateMeta(parsed);
        if (valid) {
          return { display: working.slice(0, startIdx).trim(), meta: valid };
        }
      } catch {
        /* fall through */
      }
    }
  }

  // 3. Trailing JSON utan ramar
  const trailing = working.match(TRAILING_JSON_RE);
  if (trailing) {
    try {
      const parsed = JSON.parse(trailing[0]);
      const valid = validateMeta(parsed);
      if (valid) {
        return {
          display: working.slice(0, working.length - trailing[0].length).trim(),
          meta: valid
        };
      }
    } catch {
      /* fall through */
    }
  }

  return { display: raw.trim(), meta: null };
}
