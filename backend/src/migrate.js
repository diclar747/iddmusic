// CLI: aplica las migraciones pendientes (el servidor también lo hace solo al arrancar).
import db from './db.js';
import { runMigrations } from './lib/migrations.js';
try { await runMigrations(db); } catch (e) { console.error(e.message); process.exitCode = 1; } finally { await db.end(); }
