// Aplica database/schema.sql y luego cada archivo de database/migrations en orden (una sola vez).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../database');
await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())');
const migrations = fs.readdirSync(path.join(root, 'migrations')).filter(f => f.endsWith('.sql')).sort().map(f => 'migrations/' + f);
for (const f of ['schema.sql', ...migrations]) {
  const done = await db.query('SELECT 1 FROM schema_migrations WHERE name=$1', [f]);
  if (done.rowCount) continue;
  const sql = fs.readFileSync(path.join(root, f), 'utf8');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [f]);
    await client.query('COMMIT');
    console.log('aplicada:', f);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('error en', f, '-', e.message);
    process.exit(1);
  } finally { client.release(); }
}
console.log('Migraciones al día.');
await db.end();
