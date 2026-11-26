// Proyección en vivo para los músicos: el presentador publica el repertorio y la posición actual,
// y las tablets/teléfonos (o un segundo Chromecast) la reciben al instante por Server-Sent Events.
// El estado vive en memoria (un proceso de API); si la API se reinicia, el presentador lo vuelve a publicar solo.
import { Router } from 'express';
import db from '../db.js';
import { auth } from '../middleware/auth.js';
import { bad, isUuid } from '../lib/http.js';
import { myGroupsSql, requireMember } from '../lib/access.js';

const r = Router();
r.use(auth);
const sessions = new Map(); // groupId -> { setlist, pos, by, updatedAt, clients:Set<res> }
const MAX_AGE = 8 * 60 * 60 * 1000;
const session = gid => { if (!sessions.has(gid)) sessions.set(gid, { setlist: null, pos: null, by: '', updatedAt: 0, clients: new Set() }); return sessions.get(gid); };
const send = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
const broadcast = (s, event, data) => s.clients.forEach(res => send(res, event, data));

/** Sesiones en vivo de mis grupos (para elegir a cuál seguir). */
r.get('/', async (req, res) => {
  const mine = await db.query(`SELECT id, name FROM groups WHERE id IN (${myGroupsSql(req.user)}) ORDER BY name`, [req.user.id]);
  const now = Date.now();
  res.json({ items: mine.rows.map(g => {
    const s = sessions.get(g.id);
    const active = !!s?.setlist && now - s.updatedAt < MAX_AGE;
    return { group_id: g.id, group_name: g.name, active, title: active ? s.setlist.title : null, by: active ? s.by : null, updated_at: active ? s.updatedAt : null, listeners: s?.clients.size || 0 };
  }) });
});

/** El presentador publica el repertorio (setlist) y/o la posición actual (pos). */
r.put('/:gid', async (req, res) => {
  const gid = req.params.gid;
  if (!isUuid(gid)) throw bad('Grupo inválido');
  await requireMember(req.user, gid);
  const s = session(gid);
  const { setlist, pos } = req.body || {};
  if (setlist !== undefined) {
    if (setlist && (!Array.isArray(setlist.songs) || setlist.songs.length > 60)) throw bad('Repertorio inválido');
    s.setlist = setlist; broadcast(s, 'setlist', setlist);
  }
  if (pos !== undefined) { s.pos = pos; broadcast(s, 'pos', pos); }
  s.by = req.user.fullName || req.user.email || ''; s.updatedAt = Date.now();
  res.json({ ok: true, listeners: s.clients.size });
});

/** Termina la sesión en vivo del grupo. */
r.delete('/:gid', async (req, res) => {
  if (!isUuid(req.params.gid)) throw bad('Grupo inválido');
  await requireMember(req.user, req.params.gid);
  const s = sessions.get(req.params.gid);
  if (s) { s.setlist = null; s.pos = null; broadcast(s, 'end', {}); }
  res.json({ ok: true });
});

/** Flujo en vivo (SSE). Se usa con fetch + Authorization (no EventSource) para no poner el token en la URL. */
r.get('/:gid/stream', async (req, res) => {
  const gid = req.params.gid;
  if (!isUuid(gid)) throw bad('Grupo inválido');
  await requireMember(req.user, gid);
  res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const s = session(gid);
  s.clients.add(res);
  send(res, 'hello', { listeners: s.clients.size });
  if (s.setlist) send(res, 'setlist', s.setlist);
  if (s.pos) send(res, 'pos', s.pos);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); s.clients.delete(res); });
});

export default r;
