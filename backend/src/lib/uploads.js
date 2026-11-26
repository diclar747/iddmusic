import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { bad } from './http.js';

export const uploadDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../storage/uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const MIME_EXT = {
  'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
  'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/ogg': '.ogg'
};
const maxBytes = Number(process.env.MAX_UPLOAD_MB || 25) * 1024 * 1024;

export function fileKind(mime){
  if (mime === 'application/pdf') return 'pdf';
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('audio/')) return 'audio';
  return 'other';
}

function make(allowedMimes, storage){
  return multer({
    storage, limits: { fileSize: maxBytes, files: 10 },
    fileFilter: (_req, file, cb) => allowedMimes.includes(file.mimetype) ? cb(null, true) : cb(bad(`Tipo de archivo no admitido: ${file.mimetype}`))
  });
}
const disk = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => cb(null, crypto.randomUUID() + (MIME_EXT[file.mimetype] || ''))
});
/** Archivos adjuntos de canciones (PDF, imágenes, audio) guardados en disco. */
export const songUpload = make(Object.keys(MIME_EXT), disk);
/** Fondos de proyección (solo imágenes). */
export const imageUpload = make(['image/jpeg', 'image/png', 'image/webp'], disk);
/** Archivo a transcribir con IA: se mantiene en memoria y se reenvía a Niro. */
export const memoryUpload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)
    ? cb(null, true) : cb(bad('Para transcribir subí una imagen (JPG, PNG, WEBP) o un PDF'))
});
export function removeStored(name){
  if (!name || name.includes('/') || name.includes('\\')) return;
  fs.promises.unlink(path.join(uploadDir, name)).catch(() => {});
}
