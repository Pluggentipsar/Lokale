/**
 * SQLite-åtkomst via @tauri-apps/plugin-sql.
 *
 * Migrationer ligger i Rust-sidan (src-tauri/src/lib.rs) och körs vid
 * första anslutningen. Här bara typer + hjälpfunktioner för app-koden.
 */

import Database from '@tauri-apps/plugin-sql';
import type {
  ItemRecord,
  ItemType,
  ItemWithState,
  NoteRecord,
  ReviewState,
  ReviewStateNew
} from '$lib/types';
import { newReviewState } from '$lib/pedagogy/fsrs';
import type { DerivedItem } from '$lib/curriculum';

let _db: Database | null = null;

async function db(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load('sqlite:lokale.db');
  return _db;
}

// ---------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------

export interface ProfileRecord {
  displayName: string;
  l1: string;
  targetLevel: string;
}

export async function ensureProfile(): Promise<ProfileRecord> {
  const conn = await db();
  type Row = { display_name: string; l1: string; target_level: string };
  const rows = await conn.select<Row[]>(
    `SELECT display_name, l1, target_level FROM profile WHERE id = 1`
  );
  if (rows.length === 0) {
    await conn.execute(
      `INSERT INTO profile (id, display_name, l1, target_level) VALUES (1, $1, $2, $3)`,
      ['Elev', 'sv', 'A1']
    );
    return { displayName: 'Elev', l1: 'sv', targetLevel: 'A1' };
  }
  return {
    displayName: rows[0].display_name,
    l1: rows[0].l1,
    targetLevel: rows[0].target_level
  };
}

export async function updateProfile(p: Partial<ProfileRecord>): Promise<void> {
  const conn = await db();
  const fields: string[] = [];
  const args: unknown[] = [];
  let i = 1;
  if (p.displayName !== undefined) {
    fields.push(`display_name = $${i++}`);
    args.push(p.displayName);
  }
  if (p.l1 !== undefined) {
    fields.push(`l1 = $${i++}`);
    args.push(p.l1);
  }
  if (p.targetLevel !== undefined) {
    fields.push(`target_level = $${i++}`);
    args.push(p.targetLevel);
  }
  if (fields.length === 0) return;
  await conn.execute(`UPDATE profile SET ${fields.join(', ')} WHERE id = 1`, args);
}

// ---------------------------------------------------------------------
// Items + review_state
// ---------------------------------------------------------------------

interface ItemRow {
  id: number;
  item_type: string;
  payload_json: string;
  level: string;
  tags_json: string;
  source: string | null;
}

interface ReviewStateRow {
  item_id: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: string;
  last_review: string | null;
  due_at: string;
}

function rowToItem(r: ItemRow): ItemRecord {
  return {
    id: r.id,
    item_type: r.item_type as ItemType,
    payload: JSON.parse(r.payload_json) as Record<string, unknown>,
    level: r.level,
    tags: JSON.parse(r.tags_json) as string[],
    source: r.source
  };
}

function rowToReviewState(r: ReviewStateRow): ReviewState {
  return {
    item_id: r.item_id,
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state as ReviewState['state'],
    last_review: r.last_review,
    due_at: r.due_at
  };
}

/**
 * Returnerar item-id för ett ref (item:NN-format). Idempotent — om
 * ref:en redan finns gör vi inget. Vi använder payload-json's "ref"-fält
 * som "natural key" via en unik söknyckel byggd över source+payload.
 *
 * Praktiskt: vi söker först om en item med samma payload->>ref redan
 * finns; annars insert.
 */
async function findItemByRef(ref: string): Promise<ItemRecord | null> {
  const conn = await db();
  // Vi lagrar ref i payload_json. JSON-extraktion via SQLite's json1.
  const rows = await conn.select<ItemRow[]>(
    `SELECT id, item_type, payload_json, level, tags_json, source
     FROM items WHERE json_extract(payload_json, '$.ref') = $1 LIMIT 1`,
    [ref]
  );
  return rows[0] ? rowToItem(rows[0]) : null;
}

export async function ensureItemsForScenario(
  derived: DerivedItem[]
): Promise<ItemRecord[]> {
  const conn = await db();
  const out: ItemRecord[] = [];

  for (const d of derived) {
    const existing = await findItemByRef(d.ref);
    if (existing) {
      out.push(existing);
      continue;
    }
    const payload = { ...d.payload, ref: d.ref };
    const result = await conn.execute(
      `INSERT INTO items (item_type, payload_json, level, tags_json, source)
       VALUES ($1, $2, $3, $4, $5)`,
      [d.item_type, JSON.stringify(payload), d.level, JSON.stringify(d.tags), d.source]
    );
    const id = Number(result.lastInsertId);

    const rs = newReviewState();
    await conn.execute(
      `INSERT INTO review_state
         (item_id, stability, difficulty, elapsed_days, scheduled_days,
          reps, lapses, state, last_review, due_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        rs.stability,
        rs.difficulty,
        rs.elapsed_days,
        rs.scheduled_days,
        rs.reps,
        rs.lapses,
        rs.state,
        rs.last_review,
        rs.due_at
      ]
    );
    out.push({
      id,
      item_type: d.item_type,
      payload,
      level: d.level,
      tags: d.tags,
      source: d.source
    });
  }
  return out;
}

export async function getReviewState(itemId: number): Promise<ReviewState | null> {
  const conn = await db();
  const rows = await conn.select<ReviewStateRow[]>(
    `SELECT * FROM review_state WHERE item_id = $1`,
    [itemId]
  );
  return rows[0] ? rowToReviewState(rows[0]) : null;
}

export async function updateReviewState(
  itemId: number,
  next: ReviewStateNew
): Promise<void> {
  const conn = await db();
  await conn.execute(
    `UPDATE review_state SET
        stability = $1,
        difficulty = $2,
        elapsed_days = $3,
        scheduled_days = $4,
        reps = $5,
        lapses = $6,
        state = $7,
        last_review = $8,
        due_at = $9
      WHERE item_id = $10`,
    [
      next.stability,
      next.difficulty,
      next.elapsed_days,
      next.scheduled_days,
      next.reps,
      next.lapses,
      next.state,
      next.last_review,
      next.due_at,
      itemId
    ]
  );
}

/** Items som faktiskt är förfallna just nu (due_at <= now). */
export async function selectDueItems(limit: number): Promise<ItemWithState[]> {
  const conn = await db();
  const rows = await conn.select<(ItemRow & ReviewStateRow)[]>(
    `SELECT i.id, i.item_type, i.payload_json, i.level, i.tags_json, i.source,
            rs.item_id, rs.stability, rs.difficulty, rs.elapsed_days,
            rs.scheduled_days, rs.reps, rs.lapses, rs.state,
            rs.last_review, rs.due_at
       FROM review_state rs
       JOIN items i ON i.id = rs.item_id
      WHERE rs.due_at <= datetime('now')
      ORDER BY rs.due_at ASC
      LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    item: rowToItem(r),
    state: rowToReviewState(r)
  }));
}

export async function getItemsByRefs(refs: string[]): Promise<ItemWithState[]> {
  if (refs.length === 0) return [];
  const conn = await db();
  // SQLite stöder inte enkel "WHERE ... IN ($1)" med array via plugin-sql,
  // så vi bygger en placeholder per ref.
  const placeholders = refs.map((_, i) => `$${i + 1}`).join(',');
  const rows = await conn.select<(ItemRow & ReviewStateRow)[]>(
    `SELECT i.id, i.item_type, i.payload_json, i.level, i.tags_json, i.source,
            rs.item_id, rs.stability, rs.difficulty, rs.elapsed_days,
            rs.scheduled_days, rs.reps, rs.lapses, rs.state,
            rs.last_review, rs.due_at
       FROM items i
       JOIN review_state rs ON rs.item_id = i.id
      WHERE json_extract(i.payload_json, '$.ref') IN (${placeholders})`,
    refs
  );
  return rows.map((r) => ({
    item: rowToItem(r),
    state: rowToReviewState(r)
  }));
}

export async function listAllItemsWithState(): Promise<ItemWithState[]> {
  const conn = await db();
  const rows = await conn.select<(ItemRow & ReviewStateRow)[]>(
    `SELECT i.id, i.item_type, i.payload_json, i.level, i.tags_json, i.source,
            rs.item_id, rs.stability, rs.difficulty, rs.elapsed_days,
            rs.scheduled_days, rs.reps, rs.lapses, rs.state,
            rs.last_review, rs.due_at
       FROM items i
       JOIN review_state rs ON rs.item_id = i.id
      ORDER BY rs.state, rs.due_at ASC`
  );
  return rows.map((r) => ({
    item: rowToItem(r),
    state: rowToReviewState(r)
  }));
}

// ---------------------------------------------------------------------
// Sessions + encounters
// ---------------------------------------------------------------------

export interface NewSessionInput {
  scenarioId: string;
  goal: string;
  selfRating: number;
  modelName: string;
}

export async function createSession(input: NewSessionInput): Promise<number> {
  const conn = await db();
  const result = await conn.execute(
    `INSERT INTO sessions (scenario_id, goal, model_name) VALUES ($1, $2, $3)`,
    [input.scenarioId, input.goal, input.modelName]
  );
  await conn.execute(
    `INSERT INTO notes (session_id, body, tags_json) VALUES ($1, $2, $3)`,
    [
      result.lastInsertId,
      `Självskattning vid start: ${input.selfRating}/5`,
      JSON.stringify(['self_rating'])
    ]
  );
  return Number(result.lastInsertId);
}

export interface InsertEncounterInput {
  sessionId: number;
  turnIndex: number;
  speaker: 'student' | 'tutor';
  text: string;
  targetItems?: string[];
  observedErrors?: string[];
  engagement?: string | null;
  nextMove?: string | null;
}

export async function insertEncounter(e: InsertEncounterInput): Promise<void> {
  const conn = await db();
  await conn.execute(
    `INSERT INTO encounters
      (session_id, turn_index, speaker, text, target_items_json, observed_errors_json, engagement, next_move)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      e.sessionId,
      e.turnIndex,
      e.speaker,
      e.text,
      e.targetItems ? JSON.stringify(e.targetItems) : null,
      e.observedErrors ? JSON.stringify(e.observedErrors) : null,
      e.engagement ?? null,
      e.nextMove ?? null
    ]
  );
}

export async function closeSession(
  sessionId: number,
  closingReflection: string
): Promise<void> {
  const conn = await db();
  await conn.execute(
    `UPDATE sessions SET ended_at = datetime('now'), closing_reflection = $1 WHERE id = $2`,
    [closingReflection, sessionId]
  );
}

// ---------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------

export async function insertNote(
  sessionId: number | null,
  body: string,
  tags: string[] = []
): Promise<number> {
  const conn = await db();
  const result = await conn.execute(
    `INSERT INTO notes (session_id, body, tags_json) VALUES ($1, $2, $3)`,
    [sessionId, body, JSON.stringify(tags)]
  );
  return Number(result.lastInsertId);
}

interface NoteRow {
  id: number;
  session_id: number | null;
  created_at: string;
  body: string;
  tags_json: string;
}

function rowToNote(r: NoteRow): NoteRecord {
  return {
    id: r.id,
    session_id: r.session_id,
    created_at: r.created_at,
    body: r.body,
    tags: JSON.parse(r.tags_json) as string[]
  };
}

export async function listRecentNotes(limit: number): Promise<NoteRecord[]> {
  const conn = await db();
  const rows = await conn.select<NoteRow[]>(
    `SELECT id, session_id, created_at, body, tags_json
       FROM notes
       ORDER BY created_at DESC
       LIMIT $1`,
    [limit]
  );
  return rows.map(rowToNote);
}

export interface SessionRow {
  id: number;
  started_at: string;
  ended_at: string | null;
  scenario_id: string | null;
  goal: string | null;
  closing_reflection: string | null;
  model_name: string | null;
  encounter_count: number;
}

export async function listSessions(): Promise<SessionRow[]> {
  const conn = await db();
  type Row = {
    id: number;
    started_at: string;
    ended_at: string | null;
    scenario_id: string | null;
    goal: string | null;
    closing_reflection: string | null;
    model_name: string | null;
    encounter_count: number | null;
  };
  const rows = await conn.select<Row[]>(
    `SELECT s.id, s.started_at, s.ended_at, s.scenario_id, s.goal,
            s.closing_reflection, s.model_name,
            (SELECT COUNT(*) FROM encounters e WHERE e.session_id = s.id) AS encounter_count
       FROM sessions s
       ORDER BY s.started_at DESC`
  );
  return rows.map((r) => ({ ...r, encounter_count: r.encounter_count ?? 0 }));
}

export interface EncounterRow {
  id: number;
  turn_index: number;
  speaker: 'student' | 'tutor';
  text: string;
  target_items: string[] | null;
  observed_errors: string[] | null;
  engagement: string | null;
  next_move: string | null;
  ts: string;
}

export async function listEncounters(sessionId: number): Promise<EncounterRow[]> {
  const conn = await db();
  type Row = {
    id: number;
    turn_index: number;
    speaker: string;
    text: string;
    target_items_json: string | null;
    observed_errors_json: string | null;
    engagement: string | null;
    next_move: string | null;
    ts: string;
  };
  const rows = await conn.select<Row[]>(
    `SELECT id, turn_index, speaker, text, target_items_json, observed_errors_json,
            engagement, next_move, ts
       FROM encounters
      WHERE session_id = $1
      ORDER BY turn_index ASC`,
    [sessionId]
  );
  return rows.map((r) => ({
    id: r.id,
    turn_index: r.turn_index,
    speaker: r.speaker as 'student' | 'tutor',
    text: r.text,
    target_items: r.target_items_json ? (JSON.parse(r.target_items_json) as string[]) : null,
    observed_errors: r.observed_errors_json
      ? (JSON.parse(r.observed_errors_json) as string[])
      : null,
    engagement: r.engagement,
    next_move: r.next_move,
    ts: r.ts
  }));
}

export async function listSessionNotes(sessionId: number): Promise<NoteRecord[]> {
  const conn = await db();
  const rows = await conn.select<NoteRow[]>(
    `SELECT id, session_id, created_at, body, tags_json
       FROM notes
      WHERE session_id = $1
      ORDER BY created_at ASC`,
    [sessionId]
  );
  return rows.map(rowToNote);
}

export async function listSummaryNotes(limit: number): Promise<NoteRecord[]> {
  const conn = await db();
  const rows = await conn.select<NoteRow[]>(
    `SELECT id, session_id, created_at, body, tags_json
       FROM notes
       WHERE tags_json LIKE '%session_summary%'
       ORDER BY created_at DESC
       LIMIT $1`,
    [limit]
  );
  return rows.map(rowToNote);
}
