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

/**
 * Plockar ut <<META>>...<<END>>-blocket från LLM-utdata. Returnerar både
 * det rensade visningsbara svaret och den strukturerade metadatan om
 * den kunde parsas.
 */
export function extractMeta(raw: string): {
  display: string;
  meta: TutorMeta | null;
} {
  const match = raw.match(META_RE);
  if (!match) return { display: raw.trim(), meta: null };

  const display = raw.replace(META_RE, '').trim();
  try {
    const parsed = JSON.parse(match[1]) as Partial<TutorMeta>;
    if (
      Array.isArray(parsed.target_items) &&
      Array.isArray(parsed.observed_errors) &&
      typeof parsed.engagement === 'string' &&
      typeof parsed.next_move === 'string'
    ) {
      return { display, meta: parsed as TutorMeta };
    }
  } catch {
    /* fall through */
  }
  return { display, meta: null };
}
