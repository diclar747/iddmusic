// Aplica database/schema.sql y luego cada archivo de database/migrations en orden (una sola vez).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../database');

export async function runMigrations(db, log = console.log){
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
      log('aplicada:', f);
    } catch (e) {
      await client.query('ROLLBACK');
      throw new Error(`Migración ${f}: ${e.message}`);
    } finally { client.release(); }
  }
  log('Migraciones al día.');
}
