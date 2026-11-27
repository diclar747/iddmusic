import { Router } from 'express';
import db from '../db.js';
import { auth } from '../middleware/auth.js';
import { transposeSections, sanitizeSections } from '../lib/chords.js';
import { bad, clean, isUuid, notFound, forbidden } from '../lib/http.js';
import { myGroupsSql, requireMember, groupRole } from '../lib/access.js';
import { audit } from '../lib/audit.js';
import { songUpload, fileKind, removeStored } from '../lib/uploads.js';

const r = Router();
r.use(auth);
const STATUSES = ['draft', 'review', 'published', 'archived'];

async function loadSong(user, id, { read = false } = {}){
  if (!isUuid(id)) throw notFound('Canción no encontrada');
  const q = await db.query(`SELECT s.*, g.name group_name, cu.full_name created_by_name, uu.full_name updated_by_name
    FROM songs s LEFT JOIN groups g ON g.id=s.group_id LEFT JOIN users cu ON cu.id=s.created_by LEFT JOIN users uu ON uu.id=s.updated_by
    WHERE s.id=$1`, [id]);
  if (!q.rowCount) throw notFound('Canción no encontrada');
  const song = q.rows[0];
  if (read) {
    song.my_role = await groupRole(user, song.group_id);
    if (!song.my_role) {
      const same = await db.query('SELECT 1 FROM groups WHERE id=$1 AND church_id=(SELECT church_id FROM users WHERE id=$2)', [song.group_id, user.id]);
      if (!same.rowCount) throw notFound('Canción no encontrada');
      song.my_role = 'viewer';
    }
    return song;
  }
  song.my_role = await requireMember(user, song.group_id);
  return song;
}

r.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const groupId = isUuid(req.query.group_id) ? req.query.group_id : null;
  const result = await db.query(`SELECT s.id, s.title, s.author, s.category, s.original_key, s.tempo_bpm, s.status, s.source, s.group_id, g.name group_name, s.updated_at
    FROM songs s JOIN groups g ON g.id=s.group_id
    WHERE s.group_id IN (${myGroupsSql(req.user)}) AND s.status<>'archived'
      AND ($2::uuid IS NULL OR s.group_id=$2)
      AND ($3='' OR s.title ILIKE '%'||$3||'%' OR coalesce(s.author,'') ILIKE '%'||$3||'%' OR s.lyrics_sections::text ILIKE '%'||$3||'%')
    ORDER BY ${req.query.sort === 'recent' ? 's.updated_at DESC' : 's.title'} LIMIT 300`, [req.user.id, groupId, q]);
  res.json({ items: result.rows });
});

/**
 * Cancionero de la iglesia: todas las canciones de todos los grupos (una por título),
 * con cuántas veces se tocaron en cultos y cuándo fue la última. Paginado.
 * ?q= &group_id= (filtro) &prefer= (grupo preferido para la copia) &sort=played|title|recent &played=1 &page= &per=
 */
r.get('/church', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const groupId = isUuid(req.query.group_id) ? req.query.group_id : null;
  const prefer = isUuid(req.query.prefer) ? req.query.prefer : null;
  const played = req.query.played === '1';
  const per = Math.min(50, Math.max(5, parseInt(req.query.per, 10) || 12));
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const order = { title: 'b.title', recent: 'p.last DESC NULLS LAST, b.title' }[req.query.sort] || 'coalesce(p.n,0) DESC, p.last DESC NULLS LAST, b.title';
  const result = await db.query(`
    WITH ch AS (SELECT church_id id FROM users WHERE id=$1),
    mine AS (SELECT group_id FROM group_members WHERE user_id=$1),
    base AS (
      SELECT DISTINCT ON (lower(trim(s.title))) s.id, s.title, s.author, s.original_key, s.status, s.group_id, g.name group_name, lower(trim(s.title)) tkey, s.lyrics_sections::text lyr
      FROM songs s JOIN groups g ON g.id=s.group_id JOIN ch ON g.church_id=ch.id
      WHERE s.status<>'archived'
      ORDER BY lower(trim(s.title)), (s.group_id IS NOT DISTINCT FROM $3::uuid) DESC, (s.group_id IN (SELECT group_id FROM mine)) DESC, s.updated_at DESC),
    grp AS (
      SELECT lower(trim(s.title)) tkey, string_agg(DISTINCT g.name, ', ') names, array_agg(DISTINCT s.group_id) gids
      FROM songs s JOIN groups g ON g.id=s.group_id JOIN ch ON g.church_id=ch.id
      WHERE s.status<>'archived' GROUP BY 1),
    p AS (
      SELECT lower(trim(s.title)) tkey, count(*)::int n, max(e.event_date) last
      FROM setlist_items i JOIN setlists e ON e.id=i.setlist_id JOIN songs s ON s.id=i.song_id JOIN groups g ON g.id=e.group_id JOIN ch ON g.church_id=ch.id
      WHERE e.event_date <= current_date GROUP BY 1)
    SELECT b.id, b.title, b.author, b.original_key, b.status, b.group_id, b.group_name, grp.names groups, grp.gids group_ids,
      coalesce(p.n,0) times_played, p.last last_played, count(*) OVER()::int total
    FROM base b JOIN grp USING (tkey) LEFT JOIN p USING (tkey)
    WHERE ($2='' OR b.title ILIKE '%'||$2||'%' OR coalesce(b.author,'') ILIKE '%'||$2||'%' OR b.lyr ILIKE '%'||$2||'%')
      AND ($4::uuid IS NULL OR $4::uuid = ANY(grp.gids))
      AND (NOT $5 OR p.n > 0)
    ORDER BY ${order} LIMIT $6 OFFSET $7`, [req.user.id, q, prefer, groupId, played, per, (page - 1) * per]);
  const groups = await db.query(`SELECT g.id, g.name, g.color FROM groups g WHERE g.church_id=(SELECT church_id FROM users WHERE id=$1) ORDER BY g.name`, [req.user.id]);
  const total = result.rows[0]?.total || 0;
  res.json({ items: result.rows.map(({ total: _t, ...x }) => x), total, page, per, pages: Math.max(1, Math.ceil(total / per)), groups: groups.rows });
});

r.get('/:id', async (req, res) => {
  const song = await loadSong(req.user, req.params.id, { read: true });
  const files = await db.query(`SELECT f.id, f.file_type, f.original_name, f.mime_type, f.size_bytes, f.created_at, u.full_name uploaded_by_name
    FROM song_files f LEFT JOIN users u ON u.id=f.uploaded_by WHERE f.song_id=$1 ORDER BY f.created_at`, [song.id]);
  res.json({ ...song, files: files.rows });
});

function songFields(b){
  const tempo = b.tempo_bpm === '' || b.tempo_bpm == null ? null : parseInt(b.tempo_bpm, 10);
  if (tempo !== null && (!Number.isInteger(tempo) || tempo < 20 || tempo > 300)) throw bad('El tempo debe estar entre 20 y 300 BPM');
  if (b.status !== undefined && !STATUSES.includes(b.status)) throw bad('Estado inválido');
  return {
    title: clean(b.title, 240), author: clean(b.author, 240), category: clean(b.category, 80), original_key: clean(b.original_key, 12),
    tempo_bpm: b.tempo_bpm === undefined ? undefined : tempo, time_signature: clean(b.time_signature, 10), notes: clean(b.notes, 5000),
    lyrics_sections: b.lyrics_sections === undefined ? undefined : sanitizeSections(b.lyrics_sections), status: b.status
  };
}

r.post('/', async (req, res) => {
  const b = req.body || {};
  await requireMember(req.user, b.group_id);
  const f = songFields(b);
  if (!f.title) throw bad('El título es obligatorio');
  const source = b.source === 'ai_import' ? 'ai_import' : 'manual';
  const q = await db.query(`INSERT INTO songs(group_id,title,author,category,original_key,tempo_bpm,time_signature,notes,lyrics_sections,status,source,created_by,updated_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *`,
    [b.group_id, f.title, f.author ?? null, f.category ?? null, f.original_key ?? null, f.tempo_bpm ?? null, f.time_signature ?? null, f.notes ?? null,
     JSON.stringify(f.lyrics_sections || []), f.status || (source === 'ai_import' ? 'review' : 'published'), source, req.user.id]);
  await audit(req.user, source === 'ai_import' ? 'song.import' : 'song.create', 'song', q.rows[0].id, b.group_id, { title: f.title });
  res.status(201).json(q.rows[0]);
});

r.patch('/:id', async (req, res) => {
  const old = await loadSong(req.user, req.params.id);
  const f = songFields(req.body || {});
  if (req.body?.title !== undefined && !f.title) throw bad('El título es obligatorio');
  const next = { ...old };
  for (const [k, v] of Object.entries(f)) if (v !== undefined) next[k] = v;
  // Guardar el estado anterior como versión, para poder restaurarlo.
  const v = await db.query('SELECT coalesce(max(version_number),0)+1 n FROM song_versions WHERE song_id=$1', [old.id]);
  const snapshot = { title: old.title, author: old.author, category: old.category, original_key: old.original_key, tempo_bpm: old.tempo_bpm,
    time_signature: old.time_signature, notes: old.notes, lyrics_sections: old.lyrics_sections, status: old.status };
  await db.query('INSERT INTO song_versions(song_id,version_number,snapshot,changed_by,change_note) VALUES($1,$2,$3,$4,$5)',
    [old.id, v.rows[0].n, JSON.stringify(snapshot), req.user.id, clean(req.body?.change_note, 300) || 'Edición']);
  const q = await db.query(`UPDATE songs SET title=$1,author=$2,category=$3,original_key=$4,tempo_bpm=$5,time_signature=$6,notes=$7,lyrics_sections=$8,status=$9,updated_by=$10,updated_at=now()
    WHERE id=$11 RETURNING *`,
    [next.title, next.author, next.category, next.original_key, next.tempo_bpm, next.time_signature, next.notes, JSON.stringify(next.lyrics_sections), next.status, req.user.id, old.id]);
  await audit(req.user, 'song.update', 'song', old.id, old.group_id, { title: next.title });
  res.json(q.rows[0]);
});

r.delete('/:id', async (req, res) => {
  const song = await loadSong(req.user, req.params.id);
  if (song.my_role !== 'leader' && song.created_by !== req.user.id) throw forbidden('Solo un líder o quien la cargó puede eliminar la canción');
  const files = await db.query('SELECT storage_name FROM song_files WHERE song_id=$1', [song.id]);
  await db.query('DELETE FROM songs WHERE id=$1', [song.id]);
  files.rows.forEach(f => removeStored(f.storage_name));
  await audit(req.user, 'song.delete', 'song', null, song.group_id, { title: song.title });
  res.json({ ok: true });
});

r.get('/:id/versions', async (req, res) => {
  const song = await loadSong(req.user, req.params.id, { read: true });
  const q = await db.query(`SELECT v.id, v.version_number, v.change_note, v.created_at, v.snapshot, u.full_name changed_by_name
    FROM song_versions v LEFT JOIN users u ON u.id=v.changed_by WHERE v.song_id=$1 ORDER BY v.version_number DESC LIMIT 50`, [song.id]);
  res.json({ items: q.rows });
});

r.post('/:id/versions/:versionId/restore', async (req, res) => {
  const song = await loadSong(req.user, req.params.id);
  if (!isUuid(req.params.versionId)) throw notFound('Versión no encontrada');
  const v = await db.query('SELECT snapshot, version_number FROM song_versions WHERE id=$1 AND song_id=$2', [req.params.versionId, song.id]);
  if (!v.rowCount) throw notFound('Versión no encontrada');
  const s = v.rows[0].snapshot;
  const n = await db.query('SELECT coalesce(max(version_number),0)+1 n FROM song_versions WHERE song_id=$1', [song.id]);
  await db.query('INSERT INTO song_versions(song_id,version_number,snapshot,changed_by,change_note) VALUES($1,$2,$3,$4,$5)',
    [song.id, n.rows[0].n, JSON.stringify({ title: song.title, author: song.author, category: song.category, original_key: song.original_key, tempo_bpm: song.tempo_bpm, time_signature: song.time_signature, notes: song.notes, lyrics_sections: song.lyrics_sections, status: song.status }),
     req.user.id, `Antes de restaurar v${v.rows[0].version_number}`]);
  const q = await db.query(`UPDATE songs SET title=$1,author=$2,category=$3,original_key=$4,tempo_bpm=$5,time_signature=$6,notes=$7,lyrics_sections=$8,status=$9,updated_by=$10,updated_at=now() WHERE id=$11 RETURNING *`,
    [s.title, s.author, s.category, s.original_key, s.tempo_bpm, s.time_signature, s.notes, JSON.stringify(s.lyrics_sections || []), s.status || 'published', req.user.id, song.id]);
  await audit(req.user, 'song.restore', 'song', song.id, song.group_id, { title: s.title, version: v.rows[0].version_number });
  res.json(q.rows[0]);
});

r.post('/:id/transpose', async (req, res) => {
  const steps = Number(req.body?.semitones || 0);
  if (!Number.isInteger(steps) || steps < -11 || steps > 11) throw bad('Semitonos debe ser entero entre -11 y 11');
  const song = await loadSong(req.user, req.params.id);
  res.json({ semitones: steps, lyrics_sections: transposeSections(song.lyrics_sections, steps) });
});

/* ---------- Archivos de la canción (PDF, imágenes, audio) ---------- */
r.post('/:id/files', async (req, res, next) => {
  const song = await loadSong(req.user, req.params.id);
  songUpload.array('files', 10)(req, res, async err => {
    try {
      if (err) throw err;
      if (!req.files?.length) throw bad('No se recibió ningún archivo');
      const out = [];
      for (const f of req.files) {
        const q = await db.query(`INSERT INTO song_files(song_id,file_type,storage_name,original_name,mime_type,size_bytes,uploaded_by)
          VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id, file_type, original_name, mime_type, size_bytes, created_at`,
          [song.id, fileKind(f.mimetype), f.filename, Buffer.from(f.originalname, 'latin1').toString('utf8').slice(0, 200), f.mimetype, f.size, req.user.id]);
        out.push(q.rows[0]);
      }
      await audit(req.user, 'file.upload', 'song', song.id, song.group_id, { title: song.title, count: out.length });
      res.status(201).json({ items: out });
    } catch (e) { next(e); }
  });
});

r.delete('/:id/files/:fileId', async (req, res) => {
  const song = await loadSong(req.user, req.params.id);
  if (!isUuid(req.params.fileId)) throw notFound('Archivo no encontrado');
  const q = await db.query('DELETE FROM song_files WHERE id=$1 AND song_id=$2 RETURNING storage_name', [req.params.fileId, song.id]);
  if (!q.rowCount) throw notFound('Archivo no encontrado');
  removeStored(q.rows[0].storage_name);
  res.json({ ok: true });
});

export default r;
