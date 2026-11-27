import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import db from './db.js';
import { runMigrations } from './lib/migrations.js';
import authRoutes from './routes/auth.js';
import songRoutes from './routes/songs.js';
import groupRoutes from './routes/groups.js';
import eventRoutes from './routes/events.js';
import fileRoutes from './routes/files.js';
import importRoutes from './routes/imports.js';
import bibleRoutes from './routes/bible.js';
import liveRoutes from './routes/live.js';
import { church as churchRoutes, notifications as notificationRoutes } from './routes/church.js';
import platformRoutes from './routes/platform.js';

// Al arrancar: aplica migraciones pendientes y, si no se configuró JWT_SECRET, usa uno generado y guardado en la base.
try {
  await runMigrations(db);
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    const fresh = crypto.randomBytes(48).toString('base64url');
    await db.query('INSERT INTO app_settings(key, value) VALUES($1, $2) ON CONFLICT (key) DO NOTHING', ['jwt_secret', fresh]);
    process.env.JWT_SECRET = (await db.query('SELECT value FROM app_settings WHERE key=$1', ['jwt_secret'])).rows[0].value;
    console.log('JWT_SECRET: usando el secreto generado y guardado en la base.');
  }
  // Primer arranque sin usuarios: crea el administrador (ADMIN_EMAIL) con una contraseña aleatoria que se muestra UNA vez en los registros.
  const users = await db.query('SELECT count(*)::int n FROM users');
  if (!users.rows[0].n) {
    const email = (process.env.ADMIN_EMAIL || 'admin@cd.com.py').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'Sion-' + crypto.randomBytes(6).toString('base64url');
    const bcrypt = (await import('bcryptjs')).default;
    const id = (await db.query("INSERT INTO users(full_name,email,password_hash,status) VALUES($1,$2,$3,'active') RETURNING id", [process.env.ADMIN_NAME || 'Administración SION', email, await bcrypt.hash(password, 12)])).rows[0].id;
    await db.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code = 'platform_admin' ON CONFLICT DO NOTHING", [id]);
    console.log('==================================================');
    console.log(' ADMINISTRADOR DE SION MUSIC CREADO (primer arranque)');
    console.log(`   Usuario:    ${email}`);
    console.log(`   Contraseña: ${process.env.ADMIN_PASSWORD ? '(la de ADMIN_PASSWORD)' : password}`);
    console.log(' Guardala y cambiala desde "Mi perfil".');
    console.log('==================================================');
  }
} catch (e) {
  console.error('No se pudo preparar la base de datos:', e.message, '\nRevisá DATABASE_URL (postgresql://usuario:clave@host:5432/base).');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // detrás de Nginx/Caddy: IP real para el límite de intentos de ingreso
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
  contentSecurityPolicy: { directives: {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'media-src': ["'self'", 'blob:'],
    'frame-src': ["'self'", 'blob:'],
    'object-src': ["'self'", 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    'connect-src': ["'self'"],
    'font-src': ["'self'", 'data:'],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'self'"]
  } }
}));
app.use(cors({ origin: (process.env.APP_ORIGIN || 'http://localhost:5173').split(',') }));
app.use(express.json({ limit: '5mb' }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, message: { error: 'Demasiados intentos. Esperá unos minutos.' } }));

app.get('/api/health', async (_req, res) => {
  try { await db.query('SELECT 1'); res.json({ status: 'ok', database: 'connected', ai_enabled: !!process.env.NIRO_API_KEY }); }
  catch { res.status(503).json({ status: 'error', database: 'disconnected' }); }
});
app.use('/api/auth', authRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/setlists', eventRoutes); // alias de compatibilidad
app.use('/api/files', fileRoutes);
app.use('/api/import', importRoutes);
app.use('/api/bible', bibleRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/church', churchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Web compilada (frontend/dist): la sirve la misma API cuando corre como un único proceso Node (panel de hosting).
const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
if (fs.existsSync(path.join(webDir, 'index.html'))) {
  app.use('/assets', express.static(path.join(webDir, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(webDir, { index: false, maxAge: 0 }));
  app.use((req, res, next) => (req.method === 'GET' || req.method === 'HEAD') && req.accepts('html') ? res.set('Cache-Control', 'no-cache').sendFile(path.join(webDir, 'index.html')) : next());
}

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el tamaño máximo permitido' : 'Error al subir el archivo: ' + err.message;
    return res.status(400).json({ error: msg });
  }
  if (err?.status && err.status < 600) return res.status(err.status).json({ error: err.message });
  if (err?.code === '22P02') return res.status(400).json({ error: 'Dato con formato inválido' });
  if (err?.code === '23503') return res.status(400).json({ error: 'Referencia inválida a otro registro' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`SION Music API escuchando en http://localhost:${port} · IA Niro: ${process.env.NIRO_API_KEY ? 'activa' : 'sin configurar'}`));
