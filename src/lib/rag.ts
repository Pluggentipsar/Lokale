/**
 * RAG-pipeline för curriculum.
 *
 * - Statiska curriculum-filer (grammar/*.md, examples/*.md) bundlas via Vite
 *   som ?raw-imports.
 * - Vid app-start: kontrollera hash mot curriculum_index_meta; bygg om
 *   index om något ändrats.
 * - Vid prompt-konstruktion: embedda en query (scenario + goal + senaste
 *   yttrande), brute-force cosine, ta top-K, injicera som REFERENS-block.
 */

import Database from '@tauri-apps/plugin-sql';
import { embed, embedOne, cosine, EMBED_MODEL } from '$lib/api/embed';

// Curriculum-källor som ska indexeras. Lägg till nya filer här.
import serEstar from '../../curriculum/grammar/ser_estar.md?raw';
import articulos from '../../curriculum/grammar/articulos.md?raw';
import presenteRegular from '../../curriculum/grammar/presente_regular.md?raw';
import gustar from '../../curriculum/grammar/gustar.md?raw';
import futuroProximo from '../../curriculum/grammar/futuro_proximo.md?raw';
import numerosHora from '../../curriculum/grammar/numeros_hora.md?raw';
import preteritoBasico from '../../curriculum/grammar/preterito_basico.md?raw';
import verbosReflexivos from '../../curriculum/grammar/verbos_reflexivos.md?raw';

interface Source {
  path: string;
  content: string;
}

const SOURCES: Source[] = [
  { path: 'grammar/ser_estar.md', content: serEstar },
  { path: 'grammar/articulos.md', content: articulos },
  { path: 'grammar/presente_regular.md', content: presenteRegular },
  { path: 'grammar/gustar.md', content: gustar },
  { path: 'grammar/futuro_proximo.md', content: futuroProximo },
  { path: 'grammar/numeros_hora.md', content: numerosHora },
  { path: 'grammar/preterito_basico.md', content: preteritoBasico },
  { path: 'grammar/verbos_reflexivos.md', content: verbosReflexivos }
];

let _db: Database | null = null;
async function db(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load('sqlite:lokale.db');
  return _db;
}

// Enkel synkron strängbaserad hash (FNV-1a 32-bit). Räcker för
// change-detection av statiska filer.
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/**
 * Bryt en markdown-fil i meningsfulla chunks. Strategi:
 * - Splitta på dubbla nyrader (paragrafer)
 * - För paragrafer med listpunkter: varje punkt blir egen chunk
 * - Hoppa över rena rubrik-rader
 * - Trimma och filtrera bort tomma
 */
export function chunkMarkdown(md: string): string[] {
  const paras = md.split(/\n\s*\n/);
  const chunks: string[] = [];

  for (const para of paras) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Tabeller: behåll som en chunk (Markdown-tabeller har riktning vi inte vill bryta)
    if (trimmed.includes('|')) {
      chunks.push(trimmed);
      continue;
    }

    // Lista: dela på rad
    if (/^[-*]\s/m.test(trimmed)) {
      for (const line of trimmed.split('\n')) {
        const item = line.replace(/^[-*]\s+/, '').trim();
        if (item) chunks.push(item);
      }
      continue;
    }

    // Rubriker: hoppa över (de saknar standalone-mening)
    if (/^#{1,6}\s/.test(trimmed)) continue;

    chunks.push(trimmed);
  }

  return chunks.filter((c) => c.length > 4);
}

/**
 * Bygg eller uppdatera index. Idempotent: skippar källor vars hash inte
 * ändrats sedan senaste indexering med samma embedding-modell.
 *
 * Returnerar antal chunks som faktiskt embeddades (för progress).
 */
export async function buildIndex(
  onProgress?: (current: number, total: number) => void
): Promise<number> {
  const conn = await db();
  let embedded = 0;

  for (const source of SOURCES) {
    const hash = fnv1a(source.content);
    const existing = await conn.select<
      { source_hash: string; embedding_model: string }[]
    >(
      `SELECT source_hash, embedding_model FROM curriculum_index_meta WHERE source_path = $1`,
      [source.path]
    );

    if (
      existing[0] &&
      existing[0].source_hash === hash &&
      existing[0].embedding_model === EMBED_MODEL
    ) {
      continue;
    }

    // Rensa gamla chunks för denna källa
    await conn.execute(`DELETE FROM curriculum_chunks WHERE source_path = $1`, [source.path]);

    const chunks = chunkMarkdown(source.content);
    if (chunks.length === 0) continue;

    const vectors = await embed(chunks);
    for (let i = 0; i < chunks.length; i++) {
      await conn.execute(
        `INSERT INTO curriculum_chunks
           (source_path, chunk_index, content, tags_json, embedding, embedding_model, content_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          source.path,
          i,
          chunks[i],
          JSON.stringify(deriveTags(source.path)),
          JSON.stringify(vectors[i]),
          EMBED_MODEL,
          fnv1a(chunks[i])
        ]
      );
      embedded++;
      onProgress?.(embedded, chunks.length);
    }

    await conn.execute(
      `INSERT INTO curriculum_index_meta
        (source_path, indexed_at, embedding_model, chunk_count, source_hash)
       VALUES ($1, datetime('now'), $2, $3, $4)
       ON CONFLICT(source_path) DO UPDATE SET
         indexed_at = excluded.indexed_at,
         embedding_model = excluded.embedding_model,
         chunk_count = excluded.chunk_count,
         source_hash = excluded.source_hash`,
      [source.path, EMBED_MODEL, chunks.length, hash]
    );
  }

  return embedded;
}

function deriveTags(path: string): string[] {
  const parts = path.split('/');
  const file = parts[parts.length - 1].replace(/\.md$/, '');
  return [parts[0], ...file.split('_')];
}

export interface RetrievedChunk {
  content: string;
  source_path: string;
  similarity: number;
}

interface ChunkRow {
  source_path: string;
  content: string;
  embedding: string | null;
}

/**
 * Hämta top-K chunks som matchar query. Brute-force cosine — fine för
 * några hundra chunks.
 */
export async function retrieve(query: string, k: number = 3): Promise<RetrievedChunk[]> {
  if (!query.trim()) return [];
  const conn = await db();
  const rows = await conn.select<ChunkRow[]>(
    `SELECT source_path, content, embedding
       FROM curriculum_chunks
      WHERE embedding IS NOT NULL`
  );
  if (rows.length === 0) return [];

  const queryVec = await embedOne(query);
  const scored: RetrievedChunk[] = [];
  for (const r of rows) {
    if (!r.embedding) continue;
    const vec = JSON.parse(r.embedding) as number[];
    scored.push({
      content: r.content,
      source_path: r.source_path,
      similarity: cosine(queryVec, vec)
    });
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}
