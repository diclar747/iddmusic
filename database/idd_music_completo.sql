-- IDD Music · base de datos completa (estructura + datos base)
-- Generada con pg_dump desde una base limpia (sin usuarios ni datos de prueba).
-- Restaurar en una base vacía:  psql -U idd_user -d idd_music -f database/idd_music_completo.sql
-- Luego crear el administrador:  npm --prefix backend run admin -- --email ...
-- (Con Docker no hace falta: la API aplica schema.sql + migrations/ al arrancar.)

--
-- PostgreSQL database dump
--

\restrict Dfv34PCHXrIdfqtouhQe3oxxz8RkMuEhgBN2VqbQ80g729hpVmx2Xbx3F9pcpcK

-- Dumped from database version 17.12
-- Dumped by pg_dump version 17.12

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    actor_user_id uuid,
    action character varying(100) NOT NULL,
    entity_type character varying(80) NOT NULL,
    entity_id uuid,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    group_id uuid
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: bible_chapters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bible_chapters (
    version character varying(20) NOT NULL,
    book smallint NOT NULL,
    chapter smallint NOT NULL,
    verses jsonb NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorites (
    user_id uuid NOT NULL,
    song_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: group_backgrounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_backgrounds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    storage_name text NOT NULL,
    original_name text NOT NULL,
    mime_type character varying(120),
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_members (
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    group_role character varying(30) DEFAULT 'member'::character varying NOT NULL,
    joined_at timestamp with time zone DEFAULT now()
);


--
-- Name: group_songs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_songs (
    group_id uuid NOT NULL,
    song_id uuid NOT NULL,
    shared_by uuid,
    shared_at timestamp with time zone DEFAULT now()
);


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(160) NOT NULL,
    description text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    color character varying(16),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id smallint NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(100) NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now()
);


--
-- Name: setlist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setlist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setlist_id uuid,
    song_id uuid,
    "position" integer NOT NULL,
    performance_key character varying(12),
    notes text,
    assigned_to uuid
);


--
-- Name: setlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.setlists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(180) NOT NULL,
    event_date date NOT NULL,
    event_time time without time zone,
    group_id uuid,
    notes text,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    event_type character varying(20) DEFAULT 'culto'::character varying NOT NULL,
    location character varying(200),
    end_time time without time zone,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: song_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    song_id uuid NOT NULL,
    file_type character varying(20) NOT NULL,
    storage_name text NOT NULL,
    original_name text NOT NULL,
    mime_type character varying(120),
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    size_bytes bigint,
    CONSTRAINT song_files_file_type_check CHECK (((file_type)::text = ANY ((ARRAY['pdf'::character varying, 'image'::character varying, 'audio'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: song_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    song_id uuid NOT NULL,
    version_number integer NOT NULL,
    snapshot jsonb NOT NULL,
    changed_by uuid,
    change_note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: songs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.songs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(240) NOT NULL,
    author character varying(240),
    category character varying(80),
    original_key character varying(12),
    tempo_bpm smallint,
    time_signature character varying(10),
    lyrics_sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    group_id uuid,
    notes text,
    source character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    CONSTRAINT songs_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'review'::character varying, 'published'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id smallint NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name character varying(160) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'blocked'::character varying])::text[])))
);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bible_chapters bible_chapters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bible_chapters
    ADD CONSTRAINT bible_chapters_pkey PRIMARY KEY (version, book, chapter);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (user_id, song_id);


--
-- Name: group_backgrounds group_backgrounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_backgrounds
    ADD CONSTRAINT group_backgrounds_pkey PRIMARY KEY (id);


--
-- Name: group_members group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (group_id, user_id);


--
-- Name: group_songs group_songs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_songs
    ADD CONSTRAINT group_songs_pkey PRIMARY KEY (group_id, song_id);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (name);


--
-- Name: setlist_items setlist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setlist_items
    ADD CONSTRAINT setlist_items_pkey PRIMARY KEY (id);


--
-- Name: setlists setlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setlists
    ADD CONSTRAINT setlists_pkey PRIMARY KEY (id);


--
-- Name: song_files song_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_files
    ADD CONSTRAINT song_files_pkey PRIMARY KEY (id);


--
-- Name: song_versions song_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_versions
    ADD CONSTRAINT song_versions_pkey PRIMARY KEY (id);


--
-- Name: song_versions song_versions_song_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_versions
    ADD CONSTRAINT song_versions_song_id_version_number_key UNIQUE (song_id, version_number);


--
-- Name: songs songs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.songs
    ADD CONSTRAINT songs_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: audit_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_group_idx ON public.audit_logs USING btree (group_id, created_at DESC);


--
-- Name: setlists_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setlists_date_idx ON public.setlists USING btree (event_date);


--
-- Name: setlists_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX setlists_group_idx ON public.setlists USING btree (group_id);


--
-- Name: songs_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX songs_group_idx ON public.songs USING btree (group_id);


--
-- Name: songs_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX songs_search_idx ON public.songs USING gin (to_tsvector('spanish'::regconfig, (((((COALESCE(title, ''::character varying))::text || ' '::text) || (COALESCE(author, ''::character varying))::text) || ' '::text) || COALESCE((lyrics_sections)::text, ''::text))));


--
-- Name: songs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX songs_status_idx ON public.songs USING btree (status);


--
-- Name: audit_logs audit_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id);


--
-- Name: audit_logs audit_logs_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_song_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_song_id_fkey FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: group_backgrounds group_backgrounds_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_backgrounds
    ADD CONSTRAINT group_backgrounds_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_backgrounds group_backgrounds_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_backgrounds
    ADD CONSTRAINT group_backgrounds_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: group_members group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_members group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: group_songs group_songs_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_songs
    ADD CONSTRAINT group_songs_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_songs group_songs_shared_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_songs
    ADD CONSTRAINT group_songs_shared_by_fkey FOREIGN KEY (shared_by) REFERENCES public.users(id);


--
-- Name: group_songs group_songs_song_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_songs
    ADD CONSTRAINT group_songs_song_id_fkey FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;


--
-- Name: groups groups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: setlist_items setlist_items_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setlist_items
    ADD CONSTRAINT setlist_items_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: setlist_items setlist_items_setlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setlist_items
    ADD CONSTRAINT setlist_items_setlist_id_fkey FOREIGN KEY (setlist_id) REFERENCES public.setlists(id) ON DELETE CASCADE;


--
-- Name: setlist_items setlist_items_song_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setlist_items
    ADD CONSTRAINT setlist_items_song_id_fkey FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;


--
-- Name: setlists setlists_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setlists
    ADD CONSTRAINT setlists_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: setlists setlists_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.setlists
    ADD CONSTRAINT setlists_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;


--
-- Name: song_files song_files_song_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_files
    ADD CONSTRAINT song_files_song_id_fkey FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;


--
-- Name: song_files song_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_files
    ADD CONSTRAINT song_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: song_versions song_versions_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_versions
    ADD CONSTRAINT song_versions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: song_versions song_versions_song_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_versions
    ADD CONSTRAINT song_versions_song_id_fkey FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;


--
-- Name: songs songs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.songs
    ADD CONSTRAINT songs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: songs songs_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.songs
    ADD CONSTRAINT songs_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: songs songs_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.songs
    ADD CONSTRAINT songs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Dfv34PCHXrIdfqtouhQe3oxxz8RkMuEhgBN2VqbQ80g729hpVmx2Xbx3F9pcpcK

--
-- PostgreSQL database dump
--

\restrict dw812FjkjFIigj5lDclLzGEvQT7f1qB1Zi09paVqU3J5bdwfcPaKS7B6oCvfZtx

-- Dumped from database version 17.12
-- Dumped by pg_dump version 17.12

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (id, code, name) FROM stdin;
1	super_admin	Administrador general
2	music_admin	Administrador musical
3	worship_director	Director de alabanza
4	editor	Editor musical
5	member	Integrante
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schema_migrations (name, applied_at) FROM stdin;
schema.sql	2026-11-26 17:22:48.284443-03
migrations/002-grupos-colaborativos.sql	2026-11-26 17:22:50.019611-03
migrations/003-biblia.sql	2026-11-26 17:35:43.159678-03
\.


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roles_id_seq', 5, true);


--
-- PostgreSQL database dump complete
--

\unrestrict dw812FjkjFIigj5lDclLzGEvQT7f1qB1Zi09paVqU3J5bdwfcPaKS7B6oCvfZtx

