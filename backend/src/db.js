import 'dotenv/config';
import pg from 'pg';
// Devolver DATE como texto 'YYYY-MM-DD' para evitar corrimientos de zona horaria.
pg.types.setTypeParser(1082, v => v);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export default pool;
export async function tx(fn){
  const client = await pool.connect();
  try { await client.query('BEGIN'); const r = await fn(client); await client.query('COMMIT'); return r; }
  catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
