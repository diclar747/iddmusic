import db from '../db.js';
import { forbidden, notFound, isUuid } from './http.js';

export const isSuper = user => !!user?.roles?.includes('super_admin');

/** Devuelve 'leader' | 'member' | null. El super_admin actúa como líder en todos los grupos. */
export async function groupRole(user, groupId){
  if (!isUuid(groupId)) return null;
  const q = await db.query('SELECT group_role FROM group_members WHERE group_id=$1 AND user_id=$2', [groupId, user.id]);
  if (q.rowCount) return q.rows[0].group_role;
  if (isSuper(user)) {
    const g = await db.query('SELECT 1 FROM groups WHERE id=$1', [groupId]);
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
  ? 'SELECT id FROM groups WHERE $1::uuid IS NOT NULL'
  : 'SELECT group_id FROM group_members WHERE user_id=$1';
