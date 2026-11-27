// Panel de administración de SION Music: alta, activación, vencimiento y baja de iglesias.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { tx } from '../db.js';
import { auth, allow, forgetUser } from '../middleware/auth.js';
import { bad, clean, isUuid, notFound, normPhone } from '../lib/http.js';
import { removeStored } from '../lib/uploads.js';
import { friendlyPassword } from '../lib/passwords.js';

const r = Router();
r.use(auth, allow('platform_admin'));

const LIST_SQL = `SELECT c.id, c.name, c.branch, c.status, c.plan_until::text, c.notes, c.created_at, c.settings->>'logo' logo, c.settings->>'logo_url' logo_url,
    (SELECT count(*)::int FROM users u WHERE u.church_id=c.id) users,
    (SELECT count(*)::int FROM groups g WHERE g.church_id=c.id) groups,
    (SELECT count(*)::int FROM songs s JOIN groups g ON g.id=s.group_id WHERE g.church_id=c.id AND s.status<>'archived') songs,
    (SELECT json_agg(json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email, 'phone', u.phone) ORDER BY u.created_at)
       FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles ro ON ro.id=ur.role_id WHERE u.church_id=c.id AND ro.code='super_admin') admins
  FROM churches c`;
const shape = c => ({ ...c, logo_src: c.logo ? `/api/church/${c.id}/logo?v=${c.logo.slice(0, 8)}` : (c.logo_url || ''), logo: undefined, logo_url: undefined, admins: c.admins || [],
  expired: !!c.plan_until && c.plan_until < new Date().toISOString().slice(0, 10) });

r.get('/churches', async (_req, res) => {
  const q = await db.query(`${LIST_SQL} ORDER BY c.name`);
  res.json({ items: q.rows.map(shape) });
});
async function one(id){
  const q = await db.query(`${LIST_SQL} WHERE c.id=$1`, [id]);
  if (!q.rowCount) throw notFound('Iglesia no encontrada');
  return shape(q.rows[0]);
}

/** Crea una iglesia con su administrador (con contraseña elegida o una fácil de recordar). */
r.post('/churches', async (req, res) => {
  const b = req.body || {};
  const name = clean(b.name, 160);
  if (!name) throw bad('El nombre de la iglesia es obligatorio');
  const email = clean(b.admin_email, 255)?.toLowerCase();
  const adminName = clean(b.admin_name, 160);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Ingresá el correo del administrador de la iglesia');
  if (!adminName) throw bad('Ingresá el nombre del administrador de la iglesia');
  const phone = normPhone(b.admin_phone);
  const password = String(b.admin_password || '').trim() || friendlyPassword();
  if (password.length < 6) throw bad('La contraseña debe tener al menos 6 caracteres');
  if ((await db.query('SELECT 1 FROM users WHERE lower(email)=$1', [email])).rowCount) throw bad('Ese correo ya tiene una cuenta en SION Music');
  const months = [0, 1, 3, 6, 12].includes(Number(b.months)) ? Number(b.months) : 1;
  const id = await tx(async c => {
    const ch = await c.query(`INSERT INTO churches(name, branch, status, plan_until, settings, notes) VALUES($1,$2,'active',
      CASE WHEN $3::int > 0 THEN current_date + make_interval(months => $3::int) ELSE NULL END, $4::jsonb, $5) RETURNING id`,
      [name, clean(b.branch, 160), months, JSON.stringify({ theme: b.theme || 'azul-dorado', cover: 'c-0', mode: 'light' }), clean(b.notes, 2000)]);
    const u = await c.query("INSERT INTO users(full_name,email,password_hash,status,phone,church_id) VALUES($1,$2,$3,'active',$4,$5) RETURNING id",
      [adminName, email, await bcrypt.hash(password, 12), phone || null, ch.rows[0].id]);
    await c.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code IN ('super_admin','worship_director') ON CONFLICT DO NOTHING", [u.rows[0].id]);
    // Primer grupo de alabanza para empezar a cargar música.
    const g = await c.query("INSERT INTO groups(name, description, created_by, church_id) VALUES('Alabanza', 'Grupo principal de alabanza', $1, $2) RETURNING id", [u.rows[0].id, ch.rows[0].id]);
    await c.query("INSERT INTO group_members(group_id,user_id,group_role) VALUES($1,$2,'leader')", [g.rows[0].id, u.rows[0].id]);
    return ch.rows[0].id;
  });
  res.status(201).json({ church: await one(id), admin: { full_name: adminName, email, phone, password } });
});

/** Editar, activar/desactivar, extender el plan (1, 3, 6, 12 meses) o fijar el vencimiento. */
r.patch('/churches/:id', async (req, res) => {
  if (!isUuid(req.params.id)) throw notFound('Iglesia no encontrada');
  const b = req.body || {};
  await one(req.params.id);
  if (b.name !== undefined && !clean(b.name, 160)) throw bad('El nombre es obligatorio');
  if (b.status !== undefined && !['active', 'inactive'].includes(b.status)) throw bad('Estado inválido');
  const months = Number(b.extend_months || 0);
  if (months && ![1, 3, 6, 12].includes(months)) throw bad('Plan inválido');
  if (b.plan_until !== undefined && b.plan_until !== null && !/^\d{4}-\d{2}-\d{2}$/.test(b.plan_until)) throw bad('Fecha inválida');
  await db.query(`UPDATE churches SET
      name = coalesce($2, name),
      branch = CASE WHEN $3::boolean THEN $4 ELSE branch END,
      status = coalesce($5, status),
      notes = CASE WHEN $6::boolean THEN $7 ELSE notes END,
      plan_until = CASE
        WHEN $8::int > 0 THEN greatest(coalesce(plan_until, current_date), current_date) + make_interval(months => $8::int)
        WHEN $9::boolean THEN $10::date
        ELSE plan_until END,
      updated_at = now()
    WHERE id = $1`,
    [req.params.id, clean(b.name, 160), b.branch !== undefined, clean(b.branch, 160), b.status ?? (months ? 'active' : null),
      b.notes !== undefined, clean(b.notes, 2000), months, b.plan_until !== undefined, b.plan_until || null]);
  forgetUser();
  res.json(await one(req.params.id));
});

/** Nueva contraseña para el administrador de una iglesia (por si se olvidó). */
r.post('/churches/:id/reset-admin', async (req, res) => {
  const c = await one(req.params.id);
  const admin = c.admins[0];
  if (!admin) throw bad('Esa iglesia no tiene administrador');
  const password = String(req.body?.password || '').trim() || friendlyPassword();
  if (password.length < 6) throw bad('La contraseña debe tener al menos 6 caracteres');
  await db.query('UPDATE users SET password_hash=$1, status=\'active\', updated_at=now() WHERE id=$2', [await bcrypt.hash(password, 12), admin.id]);
  forgetUser(admin.id);
  res.json({ admin: { ...admin, password } });
});

/** Elimina la iglesia con TODO su contenido (usuarios, grupos, canciones, eventos y archivos). */
r.delete('/churches/:id', async (req, res) => {
  if (!isUuid(req.params.id)) throw notFound('Iglesia no encontrada');
  const c = await one(req.params.id);
  if (req.user.church_id === c.id) throw bad('No podés eliminar tu propia iglesia desde tu usuario');
  if (String(req.body?.confirm || '').trim().toLowerCase() !== c.name.trim().toLowerCase()) throw bad('Para eliminar, escribí el nombre exacto de la iglesia');
  const files = await tx(async t => {
    const gids = (await t.query('SELECT id FROM groups WHERE church_id=$1', [c.id])).rows.map(x => x.id);
    const uids = (await t.query('SELECT id FROM users WHERE church_id=$1', [c.id])).rows.map(x => x.id);
    const sids = (await t.query('SELECT id FROM songs WHERE group_id = ANY($1) OR created_by = ANY($2) OR updated_by = ANY($2)', [gids, uids])).rows.map(x => x.id);
    const f = (await t.query(`SELECT storage_name FROM song_files WHERE song_id = ANY($1) OR uploaded_by = ANY($3)
      UNION ALL SELECT storage_name FROM group_backgrounds WHERE group_id = ANY($2)
      UNION ALL SELECT settings->>'logo' FROM churches WHERE id=$4 AND settings->>'logo' IS NOT NULL
      UNION ALL SELECT settings->>'cover_image' FROM churches WHERE id=$4 AND settings->>'cover_image' IS NOT NULL`, [sids, gids, uids, c.id])).rows.map(x => x.storage_name);
    await t.query('DELETE FROM audit_logs WHERE group_id = ANY($1) OR actor_user_id = ANY($2)', [gids, uids]);
    await t.query('DELETE FROM setlists WHERE group_id = ANY($1) OR created_by = ANY($2)', [gids, uids]);
    await t.query('DELETE FROM setlist_items WHERE song_id = ANY($1)', [sids]);
    await t.query('DELETE FROM song_files WHERE uploaded_by = ANY($1)', [uids]);
    await t.query('DELETE FROM song_versions WHERE changed_by = ANY($1)', [uids]);
    await t.query('DELETE FROM group_songs WHERE shared_by = ANY($1)', [uids]);
    await t.query('DELETE FROM songs WHERE id = ANY($1)', [sids]);
    await t.query('DELETE FROM groups WHERE id = ANY($1)', [gids]);
    await t.query('DELETE FROM users WHERE id = ANY($1)', [uids]);
    await t.query('DELETE FROM churches WHERE id=$1', [c.id]);
    return f;
  });
  files.filter(Boolean).forEach(f => removeStored(f));
  forgetUser();
  res.json({ ok: true });
});

/* ---------- Solicitudes de información (landing) ---------- */
r.get('/requests', async (_req, res) => {
  const q = await db.query('SELECT * FROM info_requests ORDER BY (status = $1) DESC, created_at DESC LIMIT 300', ['new']);
  res.json({ items: q.rows, pending: q.rows.filter(x => x.status === 'new').length });
});
r.patch('/requests/:id', async (req, res) => {
  if (!isUuid(req.params.id) || !['new', 'done'].includes(req.body?.status)) throw bad('Dato inválido');
  const q = await db.query('UPDATE info_requests SET status=$2 WHERE id=$1 RETURNING *', [req.params.id, req.body.status]);
  if (!q.rowCount) throw notFound('Solicitud no encontrada');
  res.json(q.rows[0]);
});
r.delete('/requests/:id', async (req, res) => {
  if (!isUuid(req.params.id)) throw notFound('Solicitud no encontrada');
  await db.query('DELETE FROM info_requests WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default r;
