// Crea (o actualiza) el usuario administrador real.
// Uso:  npm run admin -- --email admin@cd.com.py --name "Administración IDD" [--password "..."]
//       o con variables ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD.
// Si no se indica contraseña, genera una segura y la muestra UNA vez en pantalla.
// Si el usuario ya existe, le cambia la contraseña y le asegura el rol de administrador.
import 'dotenv/config';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db, { tx } from './db.js';

const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; };
const email = (arg('email') || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const fullName = (arg('name') || process.env.ADMIN_NAME || 'Administración IDD').trim();
let password = arg('password') || process.env.ADMIN_PASSWORD || '';
const generated = !password;
if (generated) password = 'Idd-' + crypto.randomBytes(9).toString('base64url');

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.error('Indicá un email válido: npm run admin -- --email admin@cd.com.py'); process.exit(1); }
if (password.length < 10) { console.error('La contraseña debe tener al menos 10 caracteres'); process.exit(1); }

try {
  const hash = await bcrypt.hash(password, 12);
  const created = await tx(async c => {
    const old = await c.query('SELECT id FROM users WHERE lower(email)=$1', [email]);
    let id = old.rows[0]?.id;
    if (id) await c.query("UPDATE users SET password_hash=$2, full_name=$3, status='active', updated_at=now() WHERE id=$1", [id, hash, fullName]);
    else id = (await c.query("INSERT INTO users(full_name,email,password_hash,status) VALUES($1,$2,$3,'active') RETURNING id", [fullName, email, hash])).rows[0].id;
    await c.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code = 'platform_admin' ON CONFLICT DO NOTHING", [id]);
    return !old.rows.length;
  });
  console.log(`\n${created ? 'Administrador creado' : 'Administrador actualizado'}`);
  console.log(`  Usuario:    ${email}`);
  console.log(`  Contraseña: ${generated ? password : '(la indicada)'}`);
  if (generated) console.log('  Guardala ahora: no se vuelve a mostrar. Se puede cambiar desde "Mi perfil".');
} catch (e) {
  console.error('No se pudo crear el administrador:', e.message);
  process.exitCode = 1;
} finally { await db.end(); }
