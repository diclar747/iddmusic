-- Grupos colaborativos: canciones por grupo, agenda de eventos, archivos, actividad y proyección.
ALTER TABLE songs ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual';
CREATE INDEX IF NOT EXISTS songs_group_idx ON songs(group_id);

ALTER TABLE groups ADD COLUMN IF NOT EXISTS color VARCHAR(16);
ALTER TABLE groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
UPDATE group_members SET group_role='leader' WHERE group_role='admin';

ALTER TABLE setlists ADD COLUMN IF NOT EXISTS event_type VARCHAR(20) NOT NULL DEFAULT 'culto';
ALTER TABLE setlists ADD COLUMN IF NOT EXISTS location VARCHAR(200);
ALTER TABLE setlists ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE setlists ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
CREATE INDEX IF NOT EXISTS setlists_group_idx ON setlists(group_id);

ALTER TABLE setlist_items DROP CONSTRAINT IF EXISTS setlist_items_setlist_id_position_key;
ALTER TABLE setlist_items DROP CONSTRAINT IF EXISTS setlist_items_song_id_fkey;
ALTER TABLE setlist_items ADD CONSTRAINT setlist_items_song_id_fkey FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE;
ALTER TABLE setlist_items ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE song_files ADD COLUMN IF NOT EXISTS size_bytes BIGINT;

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS audit_group_idx ON audit_logs(group_id, created_at DESC);

-- Fondos de proyección subidos por el grupo (imágenes propias).
CREATE TABLE IF NOT EXISTS group_backgrounds (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
 storage_name TEXT NOT NULL,
 original_name TEXT NOT NULL,
 mime_type VARCHAR(120),
 uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ DEFAULT now()
);
