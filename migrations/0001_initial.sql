-- Lokale: initial schema.
-- En SQLite-fil per elev. Allt på en plats: items, FSRS-tillstånd,
-- sessions, encounters, fritextnoter, profil, RAG-chunks.
--
-- Versionshanteras via tabellen schema_version.

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------
-- Elevprofil. Exakt en rad.
-- ----------------------------------------------------------------------
CREATE TABLE profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    display_name TEXT NOT NULL,
    l1 TEXT NOT NULL DEFAULT 'sv',          -- modersmål
    target_level TEXT NOT NULL DEFAULT 'A1',
    interests_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------
-- Items: det atomära som spaced repetition opererar på.
-- En "item" kan vara ett vokabord, en grammatisk regel, eller ett
-- konversationsmönster ("hälsa och presentera sig").
-- ----------------------------------------------------------------------
CREATE TABLE items (
    id INTEGER PRIMARY KEY,
    item_type TEXT NOT NULL CHECK (item_type IN ('vocab','grammar','pattern')),
    payload_json TEXT NOT NULL,             -- typspecifikt: lemma, regelreferens, etc.
    level TEXT NOT NULL,                    -- A1, A2, B1, ...
    tags_json TEXT NOT NULL DEFAULT '[]',   -- ["café","verb","preteritum"]
    source TEXT,                            -- curriculum-fil eller "generated"
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_items_type_level ON items(item_type, level);

-- ----------------------------------------------------------------------
-- FSRS-tillstånd per item. (Free Spaced Repetition Scheduler v4-ish.)
-- ----------------------------------------------------------------------
CREATE TABLE review_state (
    item_id INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    stability REAL NOT NULL DEFAULT 0,
    difficulty REAL NOT NULL DEFAULT 5,
    elapsed_days REAL NOT NULL DEFAULT 0,
    scheduled_days REAL NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'new' CHECK (state IN ('new','learning','review','relearning')),
    last_review TEXT,
    due_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_review_due ON review_state(due_at);

-- ----------------------------------------------------------------------
-- Sessions: en konversationsomgång, oftast 5–15 min.
-- ----------------------------------------------------------------------
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    scenario_id TEXT,                       -- ref till curriculum/scenarios/<id>.json
    goal TEXT,                              -- elevens egen formulering
    closing_reflection TEXT,                -- elevens svar i slutet
    model_name TEXT,                        -- t.ex. "gemma3:4b"
    model_version TEXT                      -- hash eller datum för reproducerbarhet
);

-- ----------------------------------------------------------------------
-- Encounters: varje turn, struktur + transkript.
-- ----------------------------------------------------------------------
CREATE TABLE encounters (
    id INTEGER PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    turn_index INTEGER NOT NULL,
    ts TEXT NOT NULL DEFAULT (datetime('now')),
    speaker TEXT NOT NULL CHECK (speaker IN ('student','tutor')),
    text TEXT NOT NULL,
    audio_path TEXT,                        -- valfri, om STT/TTS användes
    -- LLM:s strukturerade metadata (för tutor-turns):
    target_items_json TEXT,                 -- ["item:42","item:17"]
    observed_errors_json TEXT,              -- ["ser_estar/place"]
    engagement TEXT CHECK (engagement IN ('passive','active','constructive')),
    next_move TEXT
);

CREATE INDEX idx_encounters_session ON encounters(session_id, turn_index);

-- ----------------------------------------------------------------------
-- Notes: LLM-skrivna observationer om eleven, mellan sessioner.
-- Detta är vår "långtidsminne" — kortare än hela transkript, rikare än
-- enbart FSRS-siffror.
-- ----------------------------------------------------------------------
CREATE TABLE notes (
    id INTEGER PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    body TEXT NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_notes_created ON notes(created_at DESC);

-- ----------------------------------------------------------------------
-- RAG-chunks. Embeddings via sqlite-vec laddas separat (vec0-tabell).
-- Här lagras enbart innehåll + metadata.
-- ----------------------------------------------------------------------
CREATE TABLE curriculum_chunks (
    id INTEGER PRIMARY KEY,
    source_path TEXT NOT NULL,              -- t.ex. "grammar/ser_estar.md"
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]'
);

-- Vector-tabellen skapas av app vid första körning:
--   CREATE VIRTUAL TABLE curriculum_vec USING vec0(
--       embedding FLOAT[768]
--   );

-- ----------------------------------------------------------------------
-- Inställningar (key-value, för att slippa schema-migrera trivia).
-- ----------------------------------------------------------------------
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO schema_version (version) VALUES (1);
