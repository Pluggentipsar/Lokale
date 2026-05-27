/**
 * Lokal embedding via Ollama. Använder /api/embed.
 *
 * Modellen är konfigurerbar — vi defaultar till nomic-embed-text (768d)
 * som har bra svenska/spanska-stöd och kör snabbt på CPU.
 */

export const EMBED_MODEL = 'nomic-embed-text';

const OLLAMA_BASE = 'http://localhost:11434';

interface EmbedResponse {
  embeddings: number[][];
}

export async function embed(texts: string[], model: string = EMBED_MODEL): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: texts })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Embedding failed: ${res.status} ${t}`);
  }
  const body = (await res.json()) as EmbedResponse;
  return body.embeddings;
}

export async function embedOne(text: string, model: string = EMBED_MODEL): Promise<number[]> {
  const [vec] = await embed([text], model);
  return vec;
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
