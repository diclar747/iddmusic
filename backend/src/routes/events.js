import { Router } from 'express';
import db, { tx } from '../db.js';
import { auth } from '../middleware/auth.js';
import { bad, clean, isUuid, notFound, forbidden } from '../lib/http.js';
import { myGroupsSql, requireMember } from '../lib/access.js';
import { audit } from '../lib/audit.js';

const r = Router();
r.use(auth);
const TYPES = ['culto', 'ensayo', 'evento', 'otro'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;

async function loadEvent(user, id){
  if (!isUuid(id)) throw notFound('Evento no encontrado');
  const q = await db.query(`SELECT e.*, g.name group_name, u.full_name created_by_name FROM setlists e
    LEFT JOIN groups g ON g.id=e.group_id LEFT JOIN users u ON u.id=e.created_by WHERE e.id=$1`, [id]);
  if (!q.rowCount) throw notFound('Evento no encontrado');
  const ev = q.rows[0];
  ev.my_role = await requireMember(user, ev.group_id);
  return ev;
}

function eventFields(b, partial){
  const f = {
    title: clean(b.title, 180), event_type: b.event_type, event_date: b.event_date, event_time: b.event_time || null,
    end_time: b.end_time || null, location: clean(b.location, 200), notes: clean(b.notes, 5000), status: b.status
  };
  if (!partial || b.title !== undefined) if (!f.title) throw bad('El título es obligatorio');
  if (!partial || b.event_date !== undefined) if (!DATE.test(f.event_date || '')) throw bad('Fecha inválida (AAAA-MM-DD)');
  if (f.event_time && !TIME.test(f.event_time)) throw bad('Hora inválida');
  if (f.end_time && !TIME.test(f.end_time)) throw bad('Hora de fin inválida');
  if (f.event_type !== undefined && !TYPES.includes(f.event_type)) throw bad('Tipo de evento inválido');
  return f;
}

r.get('/', async (req, res) => {
  const from = DATE.test(req.query.from || '') ? req.query.from : null;
  const to = DATE.test(req.query.to || '') ? req.query.to : null;
  const groupId = isUuid(req.query.group_id) ? req.query.group_id : null;
  const q = await db.query(`SELECT e.*, g.name group_name, g.color group_color,
      (SELECT count(*)::int FROM setlist_items i WHERE i.setlist_id=e.id) song_count
    FROM setlists e JOIN groups g ON g.id=e.group_id
    WHERE e.group_id IN (${myGroupsSql(req.user)}) AND ($2::date IS NULL OR e.event_date>=$2) AND ($3::date IS NULL OR e.event_date<=$3)
      AND ($4::uuid IS NULL OR e.group_id=$4)
    ORDER BY e.event_date, e.event_time NULLS FIRST LIMIT 500`, [req.user.id, from, to, groupId]);
  res.json({ items: q.rows });
});

r.get('/:id', async (req, res) => {
  const ev = await loadEvent(req.user, req.params.id);
  const items = await db.query(`SELECT i.*, s.title, s.author, s.original_key, s.status song_status, u.full_name assigned_name
    FROM setlist_items i JOIN songs s ON s.id=i.song_id LEFT JOIN users u ON u.id=i.assigned_to
    WHERE i.setlist_id=$1 ORDER BY i.position`, [ev.id]);
  res.json({ ...ev, items: items.rows });
});

r.post('/', async (req, res) => {
  const b = req.body || {};
  await requireMember(req.user, b.group_id);
  const f = eventFields(b, false);
  const q = await db.query(`INSERT INTO setlists(group_id,title,event_type,event_date,event_time,end_time,location,notes,status,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9) RETURNING *`,
    [b.group_id, f.title, f.event_type || 'culto', f.event_date, f.event_time, f.end_time, f.location, f.notes, req.user.id]);
  await audit(req.user, 'event.create', 'event', q.rows[0].id, b.group_id, { title: f.title, date: f.event_date });
  res.status(201).json(q.rows[0]);
});

r.patch('/:id', async (req, res) => {
  const ev = await loadEvent(req.user, req.params.id);
  const b = req.body || {};
  const f = eventFields(b, true);
  const next = { ...ev };
  for (const k of ['title', 'event_type', 'event_date', 'event_time', 'end_time', 'location', 'notes', 'status']) if (b[k] !== undefined) next[k] = f[k];
  const q = await db.query(`UPDATE setlists SET title=$1,event_type=$2,event_date=$3,event_time=$4,end_time=$5,location=$6,notes=$7,status=$8,updated_at=now() WHERE id=$9 RETURNING *`,
    [next.title, next.event_type, next.event_date, next.event_time, next.end_time, next.location, next.notes, next.status || 'draft', ev.id]);
  await audit(req.user, 'event.update', 'event', ev.id, ev.group_id, { title: next.title });
  res.json(q.rows[0]);
});

r.delete('/:id', async (req, res) => {
  const ev = await loadEvent(req.user, req.params.id);
  if (ev.my_role !== 'leader' && ev.created_by !== req.user.id) throw forbidden('Solo un líder o quien creó el evento puede eliminarlo');
  await db.query('DELETE FROM setlists WHERE id=$1', [ev.id]);
  await audit(req.user, 'event.delete', 'event', null, ev.group_id, { title: ev.title });
  res.json({ ok: true });
});

/* ---------- Repertorio del evento ---------- */
r.post('/:id/items', async (req, res) => {
  const ev = await loadEvent(req.user, req.params.id);
  const b = req.body || {};
  if (!isUuid(b.song_id)) throw bad('Elegí una canción');
  // La canción puede ser del grupo o de otro grupo de la misma iglesia: en ese caso se copia al grupo del evento,
  // así todos los integrantes del grupo la pueden ver, editar y proyectar.
  const src = await db.query(`SELECT s.*, g.church_id FROM songs s JOIN groups g ON g.id=s.group_id
    WHERE s.id=$1 AND g.church_id=(SELECT church_id FROM groups WHERE id=$2)`, [b.song_id, ev.group_id]);
  if (!src.rowCount) throw bad('Esa canción no está en el cancionero de tu iglesia');
  let song = src.rows[0];
  if (song.group_id !== ev.group_id) {
    const dup = await db.query('SELECT id, title FROM songs WHERE group_id=$1 AND lower(title)=lower($2) AND status<>\'archived\' LIMIT 1', [ev.group_id, song.title]);
    if (dup.rowCount) song = { ...song, id: dup.rows[0].id };
    else {
      const c = await db.query(`INSERT INTO songs(group_id,title,author,category,original_key,tempo_bpm,time_signature,notes,lyrics_sections,status,source,created_by,updated_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING id`,
        [ev.group_id, song.title, song.author, song.category, song.original_key, song.tempo_bpm, song.time_signature, song.notes,
          JSON.stringify(song.lyrics_sections || []), song.status === 'archived' ? 'published' : song.status, song.source || 'manual', req.user.id]);
      song = { ...song, id: c.rows[0].id };
    }
  }
  if ((await db.query('SELECT 1 FROM setlist_items WHERE setlist_id=$1 AND song_id=$2', [ev.id, song.id])).rowCount) throw bad('Esa canción ya está en el repertorio');
  b.song_id = song.id;
  const s = { rows: [{ title: song.title }] };
  const q = await db.query(`INSERT INTO setlist_items(setlist_id,song_id,position,performance_key,notes,assigned_to)
    VALUES($1,$2,(SELECT coalesce(max(position),0)+1 FROM setlist_items WHERE setlist_id=$1),$3,$4,$5) RETURNING *`,
    [ev.id, b.song_id, clean(b.performance_key, 12), clean(b.notes, 1000), isUuid(b.assigned_to) ? b.assigned_to : null]);
  await audit(req.user, 'event.add_song', 'event', ev.id, ev.group_id, { title: ev.title, song: s.rows[0].title });
  res.status(201).json(q.rows[0]);
});

r.patch('/:id/items/:itemId', async (req, res) => {
  const ev = await loadEvent(req.user, req.params.id);
  if (!isUuid(req.params.itemId)) throw notFound('Ítem no encontrado');
  const b = req.body || {};
  const q = await db.query(`UPDATE setlist_items SET
      performance_key=CASE WHEN $1::boolean THEN $2 ELSE performance_key END,
      notes=CASE WHEN $3::boolean THEN $4 ELSE notes END,
      assigned_to=CASE WHEN $5::boolean THEN $6::uuid ELSE assigned_to END
    WHERE id=$7 AND setlist_id=$8 RETURNING *`,
    [b.performance_key !== undefined, clean(b.performance_key, 12), b.notes !== undefined, clean(b.notes, 1000),
     b.assigned_to !== undefined, isUuid(b.assigned_to) ? b.assigned_to : null, req.params.itemId, ev.id]);
  if (!q.rowCount) throw notFound('Ítem no encontrado');
  res.json(q.rows[0]);
});

r.delete('/:id/items/:itemId', async (req, res) => {
  const ev = await loadEvent(req.user, req.params.id);
  if (!isUuid(req.params.itemId)) throw notFound('Ítem no encontrado');
  await db.query('DELETE FROM setlist_items WHERE id=$1 AND setlist_id=$2', [req.params.itemId, ev.id]);
  res.json({ ok: true });
});

r.put('/:id/order', async (req, res) => {
  const ev = await loadEvent(req.user, req.params.id);
  const ids = Array.isArray(req.body?.item_ids) ? req.body.item_ids.filter(isUuid) : [];
  await tx(async c => {
    for (let i = 0; i < ids.length; i++) await c.query('UPDATE setlist_items SET position=$1 WHERE id=$2 AND setlist_id=$3', [i + 1, ids[i], ev.id]);
  });
  res.json({ ok: true });
});

export default r;
