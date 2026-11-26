import { Router } from 'express';
import path from 'path';
import db from '../db.js';
import { auth } from '../middleware/auth.js';
import { isUuid, notFound } from '../lib/http.js';
import { requireMember } from '../lib/access.js';
import { uploadDir } from '../lib/uploads.js';

const r = Router();
r.use(auth);

function send(res, row){
  res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(row.original_name)}`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(path.join(uploadDir, path.basename(row.storage_name)));
}

/** Archivo adjunto de canción: solo integrantes del grupo dueño. */
r.get('/:id', async (req, res) => {
  if (!isUuid(req.params.id)) throw notFound('Archivo no encontrado');
  const q = await db.query('SELECT f.*, s.group_id FROM song_files f JOIN songs s ON s.id=f.song_id WHERE f.id=$1', [req.params.id]);
  if (!q.rowCount) throw notFound('Archivo no encontrado');
  await requireMember(req.user, q.rows[0].group_id);
  send(res, q.rows[0]);
});

/** Fondo de proyección del grupo. */
r.get('/backgrounds/:id', async (req, res) => {
  if (!isUuid(req.params.id)) throw notFound('Fondo no encontrado');
  const q = await db.query('SELECT * FROM group_backgrounds WHERE id=$1', [req.params.id]);
  if (!q.rowCount) throw notFound('Fondo no encontrado');
  await requireMember(req.user, q.rows[0].group_id);
  send(res, q.rows[0]);
});

export default r;
