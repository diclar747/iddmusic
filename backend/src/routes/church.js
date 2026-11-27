// Datos de la iglesia (dirección, teléfono, pastor, encargado, foto) y notificaciones de la campanita.
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db.js';
import { auth } from '../middleware/auth.js';
import { bad, clean, forbidden, normPhone } from '../lib/http.js';
import { myGroupsSql, isSuper } from '../lib/access.js';
import { imageUpload, uploadDir, removeStored } from '../lib/uploads.js';

export const church = Router();
export const notifications = Router();

const DEFAULTS = { name: 'Iglesia de Dios', branch: 'Bella Vista', slogan: 'Alabando a Dios con todo nuestro corazón', address: '', city: '', maps_url: '',
  phone: '', email: '', pastor: '', pastor_phone: '', leader: '', leader_phone: '', schedule: '', website: '', image: null };
const FIELDS = { name: 120, branch: 120, slogan: 160, address: 200, city: 120, maps_url: 500, email: 160, pastor: 120, leader: 120, schedule: 600, website: 300 };
const PHONES = ['phone', 'pastor_phone', 'leader_phone'];

async function load(){
  const q = await db.query("SELECT value FROM app_settings WHERE key='church'");
  let v = {}; try { v = JSON.parse(q.rows[0]?.value || '{}'); } catch { /* */ }
  return { ...DEFAULTS, ...v };
}
async function store(v){
  await db.query("INSERT INTO app_settings(key,value,updated_at) VALUES('church',$1,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()", [JSON.stringify(v)]);
}
const canEdit = user => isSuper(user) || user?.roles?.includes('worship_director') || user?.roles?.includes('music_admin');
const publicView = c => { const { image, ...rest } = c; return { ...rest, has_image: !!image, image_version: image ? image.slice(0, 8) : null }; };

/** Foto de la iglesia: pública (se muestra también en la pantalla de ingreso). */
church.get('/image', async (_req, res) => {
  const c = await load();
  if (!c.image) return res.status(404).json({ error: 'Sin foto' });
  res.set('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(uploadDir, path.basename(c.image)));
});
church.get('/public', async (_req, res) => { const c = await load(); res.json({ name: c.name, branch: c.branch, slogan: c.slogan, has_image: !!c.image, image_version: c.image ? c.image.slice(0, 8) : null }); });

church.use(auth);
church.get('/', async (req, res) => res.json({ ...publicView(await load()), can_edit: canEdit(req.user) }));
church.put('/', async (req, res) => {
  if (!canEdit(req.user)) throw forbidden('Solo la administración puede editar los datos de la iglesia');
  const c = await load();
  const b = req.body || {};
  for (const [k, max] of Object.entries(FIELDS)) if (b[k] !== undefined) c[k] = clean(b[k], max) || '';
  for (const k of PHONES) if (b[k] !== undefined) c[k] = normPhone(b[k]) || '';
  if (!c.name) throw bad('El nombre de la iglesia es obligatorio');
  await store(c);
  res.json({ ...publicView(c), can_edit: true });
});
church.post('/image', (req, res, next) => {
  if (!canEdit(req.user)) return next(forbidden('Solo la administración puede cambiar la foto'));
  imageUpload.single('file')(req, res, async err => {
    try {
      if (err) throw err;
      if (!req.file) throw bad('Subí una imagen JPG, PNG o WEBP');
      const c = await load();
      const old = c.image;
      c.image = req.file.filename;
      await store(c);
      if (old && fs.existsSync(path.join(uploadDir, path.basename(old)))) removeStored(old);
      res.json({ ...publicView(c), can_edit: true });
    } catch (e) { next(e); }
  });
});
church.delete('/image', async (req, res) => {
  if (!canEdit(req.user)) throw forbidden();
  const c = await load();
  if (c.image) removeStored(c.image);
  c.image = null; await store(c);
  res.json({ ...publicView(c), can_edit: true });
});

/* ---------- Notificaciones: novedades de mis grupos y próximos eventos ---------- */
const ACTIONS = {
  'song.create': 'cargó la canción', 'song.import': 'importó la canción', 'song.update': 'editó la canción', 'song.restore': 'restauró una versión de',
  'song.delete': 'eliminó la canción', 'file.upload': 'adjuntó un archivo a', 'event.create': 'programó', 'event.update': 'modificó', 'event.add_song': 'agregó una canción a',
  'event.delete': 'eliminó el evento', 'member.add': 'sumó a un integrante en', 'group.update': 'actualizó el grupo', 'group.create': 'creó el grupo'
};
notifications.use(auth);
notifications.get('/', async (req, res) => {
  const groups = myGroupsSql(req.user);
  const act = await db.query(`SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at, u.full_name actor, g.name group_name, a.group_id
    FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id LEFT JOIN groups g ON g.id=a.group_id
    WHERE a.group_id IN (${groups}) AND a.actor_user_id IS DISTINCT FROM $1 AND a.created_at > now() - interval '21 days' AND a.action = ANY($2)
    ORDER BY a.created_at DESC LIMIT 30`, [req.user.id, Object.keys(ACTIONS)]);
  const ev = await db.query(`SELECT e.id, e.title, e.event_type, e.event_date, e.event_time, g.name group_name FROM setlists e JOIN groups g ON g.id=e.group_id
    WHERE e.group_id IN (${groups}) AND e.event_date BETWEEN current_date AND current_date + 7 ORDER BY e.event_date, e.event_time NULLS LAST LIMIT 10`, [req.user.id]);
  const items = [
    ...ev.rows.map(e => ({ id: 'ev-' + e.id + '-' + e.event_date, kind: 'event', title: e.title, text: `${e.group_name} · ${e.event_date}${e.event_time ? ' ' + String(e.event_time).slice(0, 5) : ''}`, date: e.event_date, at: null, href: `#/events/${e.id}` })),
    ...act.rows.map(a => {
      const what = a.details?.title || a.details?.name || '';
      const href = a.entity_type === 'song' && a.action !== 'song.delete' ? `#/songs/${a.entity_id}` : a.entity_type === 'event' && a.action !== 'event.delete' ? `#/events/${a.entity_id}` : `#/groups/${a.group_id}`;
      return { id: 'a-' + a.id, kind: 'activity', title: `${a.actor || 'Alguien'} ${ACTIONS[a.action]}${what ? ` “${what}”` : ''}`, text: a.group_name, at: a.created_at, href };
    })
  ];
  res.json({ items });
});
