/**
 * SQLite-åtkomst via @tauri-apps/plugin-sql.
 *
 * Migrationer ligger i Rust-sidan (src-tauri/src/lib.rs) och körs vid
 * första anslutningen. Här bara typer + hjälpfunktioner för app-koden.
 */

import Database from '@tauri-apps/plugin-sql';

let _db: Database | null = null;

async function db(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load('sqlite:lokale.db');
  return _db;
}

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
  // Spara self_rating som en note med tagg.
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

export async function insertNote(
  sessionId: number | null,
  body: string,
  tags: string[] = []
): Promise<void> {
  const conn = await db();
  await conn.execute(
    `INSERT INTO notes (session_id, body, tags_json) VALUES ($1, $2, $3)`,
    [sessionId, body, JSON.stringify(tags)]
  );
}

export async function ensureProfile(): Promise<{
  displayName: string;
  l1: string;
  targetLevel: string;
}> {
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
