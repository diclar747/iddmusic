-- Caché de capítulos bíblicos descargados (para que funcionen sin internet después del primer uso).
CREATE TABLE IF NOT EXISTS bible_chapters (
 version VARCHAR(20) NOT NULL,
 book SMALLINT NOT NULL,
 chapter SMALLINT NOT NULL,
 verses JSONB NOT NULL,
 fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY (version, book, chapter)
);
