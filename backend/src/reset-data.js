// Borra TODOS los datos (usuarios, grupos, canciones, eventos, archivos) y deja la base vacía, lista para producción.
// Conserva la estructura, los roles y la caché de la Biblia. Pide confirmación explícita:
//   npm run reset-data -- --si-borrar-todo
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import db from './db.js';
import { uploadDir } from './lib/uploads.js';

if (!process.argv.includes('--si-borrar-todo')) {
  console.error('Esto borra todos los usuarios, grupos, canciones, eventos y archivos.\nPara confirmar: npm run reset-data -- --si-borrar-todo');
  process.exit(1);
}
try {
  await db.query(`TRUNCATE audit_logs, favorites, setlist_items, setlists, group_backgrounds, group_songs, group_members,
    song_versions, song_files, songs, groups, user_roles, users RESTART IDENTITY CASCADE`);
  let n = 0;
  if (fs.existsSync(uploadDir)) for (const f of fs.readdirSync(uploadDir)) { if (f.startsWith('.')) continue; fs.rmSync(path.join(uploadDir, f), { force: true, recursive: true }); n++; }
  console.log(`Base limpia. Archivos borrados: ${n}. Ahora creá el administrador: npm run admin -- --email ...`);
} catch (e) {
  console.error('No se pudo limpiar:', e.message); process.exitCode = 1;
} finally { await db.end(); }
