import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { auth, churchBlock, forgetUser, signToken } from '../middleware/auth.js';
import { bad, normPhone } from '../lib/http.js';

const r = Router();
const USER_SQL = `SELECT u.*, coalesce(array_remove(array_agg(ro.code),NULL),'{}') roles, c.name church_name, c.status church_status, c.plan_until::text church_until FROM users u
  LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles ro ON ro.id=ur.role_id LEFT JOIN churches c ON c.id=u.church_id`;
const publicUser = u => ({ id: u.id, email: u.email, fullName: u.full_name, phone: u.phone || null, roles: u.roles || [], church_id: u.church_id || null, church_name: u.church_name || null });

r.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw bad('Email y contraseña son obligatorios');
  const q = await db.query(`${USER_SQL} WHERE lower(u.email)=lower($1) GROUP BY u.id, c.id`, [String(email).trim()]);
  const user = q.rows[0];
  if (!user || user.status !== 'active' || !(await bcrypt.compare(String(password), user.password_hash)))
    return res.status(401).json({ error: 'Credenciales incorrectas o cuenta no activa' });
  const block = churchBlock(user);
  if (block) return res.status(403).json({ error: block, code: 'church_inactive' });
  forgetUser(user.id);
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

r.get('/me', auth, async (req, res) => {
  const q = await db.query(`${USER_SQL} WHERE u.id=$1 GROUP BY u.id, c.id`, [req.user.id]);
  if (!q.rowCount) return res.status(401).json({ error: 'Usuario no encontrado' });
  res.json(publicUser(q.rows[0]));
});

r.post('/change-password', auth, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!new_password || String(new_password).length < 8) throw bad('La nueva contraseña debe tener al menos 8 caracteres');
  const q = await db.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  if (!q.rowCount || !(await bcrypt.compare(String(current_password || ''), q.rows[0].password_hash))) throw bad('La contraseña actual no es correcta');
  await db.query('UPDATE users SET password_hash=$1, updated_at=now() WHERE id=$2', [await bcrypt.hash(String(new_password), 12), req.user.id]);
  res.json({ ok: true });
});

r.patch('/me', auth, async (req, res) => {
  const name = String(req.body?.full_name || '').trim();
  if (!name) throw bad('El nombre es obligatorio');
  const phone = normPhone(req.body?.phone);
  if (phone !== undefined) await db.query('UPDATE users SET full_name=$1, phone=$2, updated_at=now() WHERE id=$3', [name.slice(0, 160), phone, req.user.id]);
  else await db.query('UPDATE users SET full_name=$1, updated_at=now() WHERE id=$2', [name.slice(0, 160), req.user.id]);
  res.json({ ok: true, phone: phone ?? null });
});

export default r;
