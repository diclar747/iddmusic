import db from '../db.js';
import { forbidden, notFound, isUuid } from './http.js';

/** Administrador de la iglesia: actúa como líder en todos los grupos DE SU iglesia. */
export const isSuper = user => !!user?.roles?.includes('super_admin');
/** Administrador de SION (dueño de la plataforma): gestiona todas las iglesias. */
export const isPlatform = user => !!user?.roles?.includes('platform_admin');

/** Devuelve 'leader' | 'member' | null. */
export async function groupRole(user, groupId){
  if (!isUuid(groupId)) return null;
  const q = await db.query('SELECT group_role FROM group_members WHERE group_id=$1 AND user_id=$2', [groupId, user.id]);
  if (q.rowCount) return q.rows[0].group_role;
  if (isSuper(user) && user.church_id) {
    const g = await db.query('SELECT 1 FROM groups WHERE id=$1 AND church_id=$2', [groupId, user.church_id]);
    return g.rowCount ? 'leader' : null;
  }
  return null;
}
export async function requireMember(user, groupId){
  const role = await groupRole(user, groupId);
  if (!role) throw notFound('Grupo no encontrado o no sos integrante');
  return role;
}
export async function requireLeader(user, groupId){
  const role = await requireMember(user, groupId);
  if (role !== 'leader') throw forbidden('Solo un líder del grupo puede hacer esto');
  return role;
}
/** Subconsulta con los ids de grupos visibles. Usa $1 = id del usuario. */
export const myGroupsSql = user => isSuper(user)
  ? 'SELECT id FROM groups WHERE church_id = (SELECT church_id FROM users WHERE id=$1)'
  : 'SELECT group_id FROM group_members WHERE user_id=$1';
