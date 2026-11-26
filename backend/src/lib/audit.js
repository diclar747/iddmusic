import db from '../db.js';
/** Registra actividad; nunca rompe la operación principal si falla. */
export async function audit(user, action, entityType, entityId, groupId, details = {}){
  try {
    await db.query(
      'INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,group_id,details) VALUES($1,$2,$3,$4,$5,$6)',
      [user?.id || null, action, entityType, entityId || null, groupId || null, JSON.stringify(details)]
    );
  } catch (e) { console.warn('audit:', e.message); }
}
