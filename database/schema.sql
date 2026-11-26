CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 full_name VARCHAR(160) NOT NULL,
 email VARCHAR(255) UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','blocked')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS roles (
 id SMALLSERIAL PRIMARY KEY,
 code VARCHAR(40) UNIQUE NOT NULL,
 name VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS user_roles (
 user_id UUID REFERENCES users(id) ON DELETE CASCADE,
 role_id SMALLINT REFERENCES roles(id) ON DELETE CASCADE,
 PRIMARY KEY(user_id,role_id)
);
INSERT INTO roles(code,name) VALUES
 ('super_admin','Administrador general'),('music_admin','Administrador musical'),
 ('worship_director','Director de alabanza'),('editor','Editor musical'),('member','Integrante')
ON CONFLICT(code) DO NOTHING;

CREATE TABLE IF NOT EXISTS songs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 title VARCHAR(240) NOT NULL,
 author VARCHAR(240),
 category VARCHAR(80),
 original_key VARCHAR(12),
 tempo_bpm SMALLINT,
 time_signature VARCHAR(10),
 lyrics_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
 status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','published','archived')),
 created_by UUID REFERENCES users(id),
 updated_by UUID REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS song_files (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
 file_type VARCHAR(20) NOT NULL CHECK(file_type IN ('pdf','image','audio','other')),
 storage_name TEXT NOT NULL,
 original_name TEXT NOT NULL,
 mime_type VARCHAR(120),
 uploaded_by UUID REFERENCES users(id),
 created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS song_versions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
 version_number INTEGER NOT NULL,
 snapshot JSONB NOT NULL,
 changed_by UUID REFERENCES users(id),
 change_note TEXT,
 created_at TIMESTAMPTZ DEFAULT now(),
 UNIQUE(song_id,version_number)
);
CREATE TABLE IF NOT EXISTS groups (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name VARCHAR(160) NOT NULL,
 description TEXT,
 created_by UUID REFERENCES users(id),
 created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS group_members (
 group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
 user_id UUID REFERENCES users(id) ON DELETE CASCADE,
 group_role VARCHAR(30) NOT NULL DEFAULT 'member',
 joined_at TIMESTAMPTZ DEFAULT now(),
 PRIMARY KEY(group_id,user_id)
);
CREATE TABLE IF NOT EXISTS group_songs (
 group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
 song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
 shared_by UUID REFERENCES users(id),
 shared_at TIMESTAMPTZ DEFAULT now(),
 PRIMARY KEY(group_id,song_id)
);
CREATE TABLE IF NOT EXISTS setlists (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 title VARCHAR(180) NOT NULL,
 event_date DATE NOT NULL,
 event_time TIME,
 group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
 notes TEXT,
 status VARCHAR(20) NOT NULL DEFAULT 'draft',
 created_by UUID REFERENCES users(id),
 created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS setlist_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 setlist_id UUID REFERENCES setlists(id) ON DELETE CASCADE,
 song_id UUID REFERENCES songs(id),
 position INTEGER NOT NULL,
 performance_key VARCHAR(12),
 notes TEXT,
 UNIQUE(setlist_id,position)
);
CREATE TABLE IF NOT EXISTS favorites (
 user_id UUID REFERENCES users(id) ON DELETE CASCADE,
 song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ DEFAULT now(),
 PRIMARY KEY(user_id,song_id)
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id BIGSERIAL PRIMARY KEY,
 actor_user_id UUID REFERENCES users(id),
 action VARCHAR(100) NOT NULL,
 entity_type VARCHAR(80) NOT NULL,
 entity_id UUID,
 details JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS songs_search_idx ON songs USING gin(to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(author,'') || ' ' || coalesce(lyrics_sections::text,'')));
CREATE INDEX IF NOT EXISTS songs_status_idx ON songs(status);
CREATE INDEX IF NOT EXISTS setlists_date_idx ON setlists(event_date);
