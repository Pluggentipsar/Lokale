-- M3: utöka curriculum_chunks med embeddings och bokföring.
--
-- Embeddings lagras som JSON-array av floats i en TEXT-kolumn. För det
-- korpus vi siktar på (några hundra chunks max) räcker brute-force
-- cosine i TypeScript. Vi tar sqlite-vec senare om/när korpusen växer.

ALTER TABLE curriculum_chunks ADD COLUMN embedding TEXT;
ALTER TABLE curriculum_chunks ADD COLUMN embedding_model TEXT;
ALTER TABLE curriculum_chunks ADD COLUMN content_hash TEXT NOT NULL DEFAULT '';

-- Bokföring per källfil. Låter oss skippa om-indexering när inget ändrats.
CREATE TABLE curriculum_index_meta (
    source_path TEXT PRIMARY KEY,
    indexed_at TEXT NOT NULL,
    embedding_model TEXT NOT NULL,
    chunk_count INTEGER NOT NULL,
    source_hash TEXT NOT NULL
);

CREATE INDEX idx_chunks_source ON curriculum_chunks(source_path);

INSERT INTO schema_version (version) VALUES (2);
