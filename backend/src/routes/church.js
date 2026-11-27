// Datos y marca de cada iglesia (logo, portada, colores, modo claro/oscuro, contacto) y notificaciones de la campanita.
import { Router } from 'express';
import path from 'path';
import db from '../db.js';
import { auth } from '../middleware/auth.js';
import { bad, clean, forbidden, normPhone, isUuid } from '../lib/http.js';
import { myGroupsSql, isSuper, isPlatform } from '../lib/access.js';
import { imageUpload, uploadDir, removeStored } from '../lib/uploads.js';

export const church = Router();
export const notifications = Router();

const DEFAULTS = { slogan: 'Un lugar de adoración y presencia de Dios', address: '', city: '', maps_url: '', phone: '', email: '', pastor: '', pastor_phone: '',
  leader: '', leader_phone: '', schedule: '', website: '', logo: null, logo_url: '', logo_fit: 'icon', cover: 'c-0', cover_image: null, theme: 'azul-dorado', mode: 'light' };
const FIELDS = { slogan: 160, address: 200, city: 120, maps_url: 500, email: 160, pastor: 120, leader: 120, schedule: 600, website: 300, cover: 40, theme: 40 };
const PHONES = ['phone', 'pastor_phone', 'leader_phone'];
const MODES = ['light', 'dark', 'auto'];

export async function loadChurch(id){
  if (!id) return null;
  const q = await db.query('SELECT id, name, branch, status, plan_until::text, settings FROM churches WHERE id=$1', [id]);
  if (!q.rowCount) return null;
  const c = q.rows[0];
  return { id: c.id, name: c.name, branch: c.branch || '', status: c.status, plan_until: c.plan_until, ...DEFAULTS, ...c.settings };
}
async function saveSettings(id, patch){
  await db.query('UPDATE churches SET settings = settings || $2::jsonb, updated_at=now() WHERE id=$1', [id, JSON.stringify(patch)]);
}
const canEdit = user => isSuper(user) || isPlatform(user) || user?.roles?.includes('worship_director');
/** Lo que ve la app: sin nombres de archivo internos; con las URL públicas del logo y la portada. */
export const publicChurch = c => {
  if (!c) return null;
  const { logo, cover_image, ...rest } = c;
  const v = s => (s ? s.slice(0, 8) : '');
  return { ...rest, logo_src: logo ? `/api/church/${c.id}/logo?v=${v(logo)}` : (c.logo_url || ''), cover_src: cover_image ? `/api/church/${c.id}/cover?v=${v(cover_image)}` : '' };
};

/** Logo y portada: públicos (se usan en la pantalla de inicio, el proyector y el TV). */
for (const kind of ['logo', 'cover']) {
  church.get(`/:id/${kind}`, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(404).end();
    const c = await loadChurch(req.params.id);
    const file = c?.[kind === 'logo' ? 'logo' : 'cover_image'];
    if (!file) return res.status(404).json({ error: 'Sin imagen' });
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.join(uploadDir, path.basename(file)));
  });
}

church.use(auth);
church.get('/', async (req, res) => {
  const c = await loadChurch(req.user.church_id);
  if (!c) return res.json({ id: null, name: 'SION Music', branch: '', ...DEFAULTS, logo_src: '', cover_src: '', can_edit: false });
  res.json({ ...publicChurch(c), can_edit: canEdit(req.user) });
});
church.put('/', async (req, res) => {
  if (!canEdit(req.user)) throw forbidden('Solo la administración de la iglesia puede editar estos datos');
  if (!req.user.church_id) throw bad('Tu usuario no pertenece a ninguna iglesia');
  const b = req.body || {};
  const patch = {};
  for (const [k, max] of Object.entries(FIELDS)) if (b[k] !== undefined) patch[k] = clean(b[k], max) || '';
  for (const k of PHONES) if (b[k] !== undefined) patch[k] = normPhone(b[k]) || '';
  if (b.mode !== undefined) patch.mode = MODES.includes(b.mode) ? b.mode : 'light';
  if (b.logo_fit !== undefined) patch.logo_fit = b.logo_fit === 'fill' ? 'fill' : 'icon';
  if (b.name !== undefined || b.branch !== undefined) {
    const name = clean(b.name, 160);
    if (b.name !== undefined && !name) throw bad('El nombre de la iglesia es obligatorio');
    await db.query('UPDATE churches SET name=coalesce($2,name), branch=CASE WHEN $3::boolean THEN $4 ELSE branch END, updated_at=now() WHERE id=$1',
      [req.user.church_id, name, b.branch !== undefined, clean(b.branch, 160)]);
  }
  await saveSettings(req.user.church_id, patch);
  res.json({ ...publicChurch(await loadChurch(req.user.church_id)), can_edit: true });
});
for (const kind of ['logo', 'cover']) {
  const key = kind === 'logo' ? 'logo' : 'cover_image';
  church.post(`/${kind}`, (req, res, next) => {
    if (!canEdit(req.user) || !req.user.church_id) return next(forbidden('Solo la administración de la iglesia puede cambiar las imágenes'));
    imageUpload.single('file')(req, res, async err => {
      try {
        if (err) throw err;
        if (!req.file) throw bad('Subí una imagen JPG, PNG o WEBP');
        const c = await loadChurch(req.user.church_id);
        const patch = { [key]: req.file.filename };
        if (kind === 'cover') patch.cover = 'photo';
        await saveSettings(c.id, patch);
        if (c[key]) removeStored(c[key]);
        res.json({ ...publicChurch(await loadChurch(c.id)), can_edit: true });
      } catch (e) { next(e); }
    });
  });
  church.delete(`/${kind}`, async (req, res) => {
    if (!canEdit(req.user) || !req.user.church_id) throw forbidden();
    const c = await loadChurch(req.user.church_id);
    if (c[key]) removeStored(c[key]);
    const patch = { [key]: null };
    if (kind === 'cover' && c.cover === 'photo') patch.cover = 'c-0';
    if (kind === 'logo') patch.logo_url = '';
    await saveSettings(c.id, patch);
    res.json({ ...publicChurch(await loadChurch(c.id)), can_edit: true });
  });
}

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
