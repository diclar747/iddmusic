import jwt from 'jsonwebtoken';
import db from '../db.js';

// Datos del usuario y de su iglesia, leídos de la base (con caché corta) para que los cambios de
// roles, la desactivación de una iglesia o el vencimiento del plan se apliquen sin volver a ingresar.
const cache = new Map();
const TTL = 20000;
export const forgetUser = id => id ? cache.delete(id) : cache.clear();

async function loadUser(id){
  const hit = cache.get(id);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const q = await db.query(`SELECT u.id, u.email, u.full_name, u.status, u.church_id,
      coalesce(array_remove(array_agg(r.code), NULL), '{}') roles,
      c.name church_name, c.status church_status, c.plan_until::text church_until
    FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id LEFT JOIN churches c ON c.id=u.church_id
    WHERE u.id=$1 GROUP BY u.id, c.id`, [id]);
  const v = q.rows[0] || null;
  cache.set(id, { t: Date.now(), v });
  return v;
}

/** ¿La iglesia puede usar el sistema? Devuelve null si sí, o el motivo si no. */
export function churchBlock(u){
  if (!u || u.roles.includes('platform_admin')) return null;
  if (!u.church_id) return 'Tu usuario no pertenece a ninguna iglesia.';
  if (u.church_status !== 'active') return `La cuenta de ${u.church_name} está desactivada. Comunicate con el administrador de SION Music.`;
  if (u.church_until && u.church_until < new Date().toISOString().slice(0, 10)) return `El plan de ${u.church_name} venció el ${u.church_until.split('-').reverse().join('/')}. Comunicate con el administrador de SION Music para renovarlo.`;
  return null;
}

export async function auth(req, res, next){
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Autenticación requerida' });
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Sesión inválida o vencida' }); }
  try {
    const u = await loadUser(payload.id);
    if (!u || u.status === 'blocked') return res.status(401).json({ error: 'Usuario inexistente o bloqueado' });
    req.user = { id: u.id, email: u.email, fullName: u.full_name, roles: u.roles, church_id: u.church_id };
    const block = churchBlock(u);
    if (block) return res.status(403).json({ error: block, code: 'church_inactive' });
    next();
  } catch (e) { next(e); }
}
export function allow(...roles){
  return (req, res, next) => {
    if (!req.user || !roles.some(r => req.user.roles?.includes(r)))
      return res.status(403).json({ error: 'No tenés permisos para esta operación' });
    next();
  };
}
