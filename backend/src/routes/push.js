// Suscripción a notificaciones push (versículo del día).
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { auth } from '../middleware/auth.js';
import { bad } from '../lib/http.js';
import { getPublicKey, versesFor, sendDaily, localNow, TZ } from '../lib/push.js';

const r = Router();

/** Clave pública para que el navegador se suscriba. */
r.get('/key', (_req, res) => res.json({ key: getPublicKey() }));

r.use(auth);

const okEndpoint = e => /^https:\/\/[^\s]{10,}$/.test(e) && e.length < 1000;

/** Guarda (o actualiza) la suscripción de este navegador para el usuario actual. */
r.post('/subscribe', async (req, res) => {
  const s = req.body?.subscription || {};
  const endpoint = String(s.endpoint || ''), p256dh = String(s.keys?.p256dh || ''), authKey = String(s.keys?.auth || '');
  if (!okEndpoint(endpoint) || !p256dh || !authKey || p256dh.length > 200 || authKey.length > 100) throw bad('Suscripción inválida');
  await db.query(`INSERT INTO push_subscriptions(user_id, endpoint, p256dh, auth, user_agent) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth, user_agent=EXCLUDED.user_agent, failures=0`,
    [req.user.id, endpoint, p256dh, authKey, String(req.headers['user-agent'] || '').slice(0, 300)]);
  res.json({ ok: true });
});

/** Deja de recibir en este navegador. */
r.post('/unsubscribe', async (req, res) => {
  const endpoint = String(req.body?.endpoint || '');
  if (endpoint) await db.query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2', [endpoint, req.user.id]);
  res.json({ ok: true });
});

/** Los 2 versículos de hoy para mí (la pantalla que abre la notificación). */
r.get('/today', async (req, res) => {
  const now = localNow();
  res.json({ date: now.date, items: await versesFor(req.user.id, now.day) });
});

/** "Enviarme uno ahora": prueba en mis dispositivos. */
r.post('/test', rateLimit({ windowMs: 10 * 60 * 1000, limit: 5, keyGenerator: req => req.user.id, standardHeaders: false, legacyHeaders: false, message: { error: 'Ya enviamos varias pruebas. Esperá unos minutos.' } }), async (req, res) => {
  const r2 = await sendDaily({ userId: req.user.id });
  if (!r2.devices) throw bad('Este usuario no tiene notificaciones activadas en ningún dispositivo.');
  res.json(r2);
});

/** Panel de SION: cuántas personas reciben el versículo del día. */
r.get('/stats', async (req, res) => {
  if (!req.user.roles?.includes('platform_admin')) return res.status(403).json({ error: 'No tenés permisos para esta operación' });
  const q = await db.query(`SELECT count(DISTINCT user_id)::int people, count(*)::int devices, max(last_sent_at) last_sent FROM push_subscriptions`);
  const last = await db.query("SELECT value FROM app_settings WHERE key='push_daily_sent'");
  res.json({ ...q.rows[0], last_daily: last.rows[0]?.value || null, timezone: TZ });
});

export default r;
