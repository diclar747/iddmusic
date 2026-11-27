import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db, { tx } from '../db.js';
import { auth } from '../middleware/auth.js';
import { bad, clean, isUuid, notFound, normPhone } from '../lib/http.js';
import { isSuper, requireLeader, requireMember } from '../lib/access.js';
import { audit } from '../lib/audit.js';
import { imageUpload, removeStored } from '../lib/uploads.js';

const r = Router();
r.use(auth);

r.get('/', async (req, res) => {
  const q = await db.query(`
    SELECT g.*, mine.group_role my_role,
      (SELECT count(*)::int FROM group_members gm WHERE gm.group_id=g.id) member_count,
      (SELECT count(*)::int FROM songs s WHERE s.group_id=g.id AND s.status<>'archived') song_count,
      (SELECT min(e.event_date)::text FROM setlists e WHERE e.group_id=g.id AND e.event_date>=current_date) next_event_date
    FROM groups g LEFT JOIN group_members mine ON mine.group_id=g.id AND mine.user_id=$1
    WHERE mine.user_id IS NOT NULL OR $2
    ORDER BY g.name`, [req.user.id, isSuper(req.user)]);
  res.json({ items: q.rows.map(g => ({ ...g, my_role: g.my_role || 'leader' })) });
});

r.post('/', async (req, res) => {
  const name = clean(req.body?.name, 160);
  if (!name) throw bad('El nombre del grupo es obligatorio');
  const g = await tx(async c => {
    const q = await c.query('INSERT INTO groups(name,description,color,created_by) VALUES($1,$2,$3,$4) RETURNING *',
      [name, clean(req.body?.description, 2000), clean(req.body?.color, 16), req.user.id]);
    await c.query("INSERT INTO group_members(group_id,user_id,group_role) VALUES($1,$2,'leader')", [q.rows[0].id, req.user.id]);
    return q.rows[0];
  });
  await audit(req.user, 'group.create', 'group', g.id, g.id, { name });
  res.status(201).json(g);
});

r.get('/:id', async (req, res) => {
  const role = await requireMember(req.user, req.params.id);
  const g = await db.query('SELECT * FROM groups WHERE id=$1', [req.params.id]);
  const members = await db.query(`SELECT u.id, u.full_name, u.email, u.phone, gm.group_role, gm.joined_at
    FROM group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=$1 ORDER BY gm.group_role DESC, u.full_name`, [req.params.id]);
  res.json({ ...g.rows[0], my_role: role, members: members.rows });
});

r.patch('/:id', async (req, res) => {
  await requireLeader(req.user, req.params.id);
  const b = req.body || {};
  const q = await db.query(`UPDATE groups SET name=coalesce($1,name), description=CASE WHEN $2::boolean THEN $3 ELSE description END,
    color=coalesce($4,color), updated_at=now() WHERE id=$5 RETURNING *`,
    [clean(b.name, 160), b.description !== undefined, clean(b.description, 2000), clean(b.color, 16), req.params.id]);
  await audit(req.user, 'group.update', 'group', req.params.id, req.params.id, {});
  res.json(q.rows[0]);
});

r.delete('/:id', async (req, res) => {
  await requireLeader(req.user, req.params.id);
  const files = await db.query(`SELECT sf.storage_name FROM song_files sf JOIN songs s ON s.id=sf.song_id WHERE s.group_id=$1
    UNION ALL SELECT storage_name FROM group_backgrounds WHERE group_id=$1`, [req.params.id]);
  await db.query('DELETE FROM setlists WHERE group_id=$1', [req.params.id]);
  await db.query('DELETE FROM groups WHERE id=$1', [req.params.id]);
  files.rows.forEach(f => removeStored(f.storage_name));
  res.json({ ok: true });
});

/* ---------- Integrantes ---------- */
r.post('/:id/members', async (req, res) => {
  await requireLeader(req.user, req.params.id);
  const email = clean(req.body?.email, 255)?.toLowerCase();
  const fullName = clean(req.body?.full_name, 160);
  const groupRole = req.body?.group_role === 'leader' ? 'leader' : 'member';
  const phone = normPhone(req.body?.phone);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Ingresá un email válido');
  let tempPassword = null;
  let u = await db.query('SELECT id, full_name, status FROM users WHERE lower(email)=$1', [email]);
  let userId = u.rows[0]?.id;
  if (!userId) {
    if (!fullName) throw bad('Ese email no tiene cuenta todavía: indicá también el nombre para crearla');
    tempPassword = 'Idd-' + crypto.randomBytes(4).toString('hex');
    userId = await tx(async c => {
      const n = await c.query("INSERT INTO users(full_name,email,password_hash,status,phone) VALUES($1,$2,$3,'active',$4) RETURNING id",
        [fullName, email, await bcrypt.hash(tempPassword, 12), phone || null]);
      await c.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='member'", [n.rows[0].id]);
      return n.rows[0].id;
    });
  }
  else if (phone) await db.query('UPDATE users SET phone=$1, updated_at=now() WHERE id=$2', [phone, userId]);
  const ins = await db.query('INSERT INTO group_members(group_id,user_id,group_role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING user_id', [req.params.id, userId, groupRole]);
  if (!ins.rowCount) throw bad('Esa persona ya es integrante del grupo');
  await audit(req.user, 'member.add', 'user', userId, req.params.id, { email });
  const who = await db.query('SELECT full_name, phone FROM users WHERE id=$1', [userId]);
  res.status(201).json({ user_id: userId, email, full_name: who.rows[0].full_name, phone: who.rows[0].phone, temp_password: tempPassword });
});

r.patch('/:id/members/:userId', async (req, res) => {
  await requireLeader(req.user, req.params.id);
  if (req.body?.phone !== undefined) {
    if (!isUuid(req.params.userId)) throw notFound('Integrante no encontrado');
    const m = await db.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2', [req.params.id, req.params.userId]);
    if (!m.rowCount) throw notFound('Integrante no encontrado');
    await db.query('UPDATE users SET phone=$1, updated_at=now() WHERE id=$2', [normPhone(req.body.phone), req.params.userId]);
  }
  if (req.body?.group_role !== undefined) {
    const role = req.body.group_role === 'leader' ? 'leader' : 'member';
    if (role === 'member') await ensureAnotherLeader(req.params.id, req.params.userId);
    await db.query('UPDATE group_members SET group_role=$1 WHERE group_id=$2 AND user_id=$3', [role, req.params.id, req.params.userId]);
  }
  res.json({ ok: true });
});

r.delete('/:id/members/:userId', async (req, res) => {
  const self = req.params.userId === req.user.id;
  if (self) await requireMember(req.user, req.params.id); else await requireLeader(req.user, req.params.id);
  await ensureAnotherLeader(req.params.id, req.params.userId);
  await db.query('DELETE FROM group_members WHERE group_id=$1 AND user_id=$2', [req.params.id, req.params.userId]);
  await audit(req.user, self ? 'member.leave' : 'member.remove', 'user', req.params.userId, req.params.id, {});
  res.json({ ok: true });
});

async function ensureAnotherLeader(groupId, userId){
  if (!isUuid(userId)) throw notFound('Integrante no encontrado');
  const q = await db.query("SELECT count(*)::int n, bool_or(user_id=$2) target FROM group_members WHERE group_id=$1 AND group_role='leader'", [groupId, userId]);
  if (q.rows[0].target && q.rows[0].n <= 1) throw bad('El grupo debe tener al menos un líder');
}

/* ---------- Actividad ---------- */
r.get('/:id/activity', async (req, res) => {
  await requireMember(req.user, req.params.id);
  const q = await db.query(`SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at, u.full_name actor
    FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.group_id=$1 ORDER BY a.created_at DESC LIMIT 40`, [req.params.id]);
  res.json({ items: q.rows });
});

/* ---------- Fondos de proyección ---------- */
r.get('/:id/backgrounds', async (req, res) => {
  await requireMember(req.user, req.params.id);
  const q = await db.query('SELECT id, original_name, mime_type, created_at FROM group_backgrounds WHERE group_id=$1 ORDER BY created_at DESC', [req.params.id]);
  res.json({ items: q.rows });
});
r.post('/:id/backgrounds', async (req, res, next) => {
  await requireMember(req.user, req.params.id);
  imageUpload.single('file')(req, res, async err => {
    try {
      if (err) throw err;
      if (!req.file) throw bad('Subí una imagen JPG, PNG o WEBP');
      const q = await db.query('INSERT INTO group_backgrounds(group_id,storage_name,original_name,mime_type,uploaded_by) VALUES($1,$2,$3,$4,$5) RETURNING id, original_name, mime_type, created_at',
        [req.params.id, req.file.filename, req.file.originalname.slice(0, 200), req.file.mimetype, req.user.id]);
      res.status(201).json(q.rows[0]);
    } catch (e) { next(e); }
  });
});
r.delete('/:id/backgrounds/:bgId', async (req, res) => {
  await requireMember(req.user, req.params.id);
  const q = await db.query('DELETE FROM group_backgrounds WHERE id=$1 AND group_id=$2 RETURNING storage_name', [req.params.bgId, req.params.id]);
  if (q.rowCount) removeStored(q.rows[0].storage_name);
  res.json({ ok: true });
});

export default r;
