// Notificaciones push: versículo del día a las 6:00 (hora de Paraguay) para cada persona suscrita.
// - Claves VAPID: las de VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY o, si no están, generadas una vez y guardadas en la base.
// - Cada persona recibe 2 versículos distintos según su usuario y el día (no todos reciben los mismos).
import crypto from 'crypto';
import webpush from 'web-push';
import db from '../db.js';
import { DAILY_VERSES } from './verses.js';
import { getChapter } from '../routes/bible.js';
import { parseReference, formatReference } from '../../../frontend/src/lib/bible.js';

export const TZ = process.env.PUSH_TZ || 'America/Asuncion';
const HOUR = Math.min(23, Math.max(0, Number(process.env.PUSH_HOUR ?? 6)));
const VERSION = 'RV1960';
let publicKey = null;

/** Prepara las claves (una vez al arrancar). */
export async function initPush(){
  let pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    const k = webpush.generateVAPIDKeys();
    await db.query("INSERT INTO app_settings(key, value) VALUES('vapid_keys', $1) ON CONFLICT (key) DO NOTHING", [JSON.stringify(k)]);
    ({ publicKey: pub, privateKey: priv } = JSON.parse((await db.query("SELECT value FROM app_settings WHERE key='vapid_keys'")).rows[0].value));
  }
  webpush.setVapidDetails(process.env.PUSH_CONTACT || 'mailto:info@cd.com.py', pub, priv);
  publicKey = pub;
}
export const getPublicKey = () => publicKey;

/** Fecha y hora actuales en Paraguay: { date: '2026-11-27', hour: 6, day: número de día } */
export function localNow(d = new Date()){
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  return { date, hour: Number(p.hour), day: Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000) };
}

const seedOf = userId => crypto.createHash('sha256').update(String(userId)).digest().readUInt32BE(0);

/** Las 2 referencias del día para un usuario: distintas entre sí, cambian cada día y no se repiten por varios meses. */
export function pickRefs(userId, day = localNow().day){
  const n = DAILY_VERSES.length, base = seedOf(userId) % n;
  const i = (base + day * 2) % n;
  return [DAILY_VERSES[i], DAILY_VERSES[(i + 1) % n]];
}

/** Texto de una referencia ("Proverbios 3:5-6") desde la Biblia guardada. */
export async function verseText(refText){
  const ref = parseReference(refText);
  if (!ref) return null;
  const verses = await getChapter(VERSION, ref.book.id, ref.chapter);
  const from = ref.from || 1, to = ref.to || from;
  const text = verses.filter(v => v.verse >= from && v.verse <= to).map(v => v.text).join(' ').trim();
  return text ? { reference: formatReference(ref.book, ref.chapter, ref.from, ref.to), text, version: VERSION } : null;
}

/** Los 2 versículos del día de un usuario (si uno no se puede leer, usa el siguiente de la lista). */
export async function versesFor(userId, day){
  const refs = pickRefs(userId, day), out = [];
  let k = DAILY_VERSES.indexOf(refs[1]);
  for (let ref of refs) {
    for (let tries = 0; tries < 4; tries++) {
      const v = await verseText(ref).catch(() => null);
      if (v && !out.some(o => o.reference === v.reference)) { out.push(v); break; }
      k = (k + 1) % DAILY_VERSES.length; ref = DAILY_VERSES[k];
    }
  }
  return out;
}

const cut = (t, n) => t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t;

/** Contenido de la notificación con los versículos. */
export function buildPayload(verses){
  return JSON.stringify({
    title: 'Versículo del día para vos',
    body: verses.map(v => `«${cut(v.text, 170)}» ${v.reference}`).join('\n\n'),
    url: '/#/versiculo',
    tag: 'versiculo-' + localNow().date
  });
}

/** Envía a una suscripción. Si el navegador ya no existe (404/410) la borra. */
async function sendOne(sub, payload){
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 6 * 3600, urgency: 'normal' });
    await db.query('UPDATE push_subscriptions SET last_sent_at=now(), failures=0 WHERE id=$1', [sub.id]);
    return true;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) await db.query('DELETE FROM push_subscriptions WHERE id=$1', [sub.id]);
    else await db.query('UPDATE push_subscriptions SET failures=failures+1 WHERE id=$1', [sub.id]);
    if (e.statusCode !== 404 && e.statusCode !== 410) console.warn('Push: no se pudo enviar', e.statusCode || '', (e.body || e.message || '').toString().slice(0, 160));
    return false;
  }
}

/** Envía el versículo del día a los usuarios indicados (o a todos los suscritos). */
export async function sendDaily({ userId } = {}){
  const subs = (await db.query(`SELECT s.id, s.user_id, s.endpoint, s.p256dh, s.auth
    FROM push_subscriptions s JOIN users u ON u.id = s.user_id
    LEFT JOIN churches c ON c.id = u.church_id
    WHERE u.status = 'active' AND s.failures < 20 ${userId ? 'AND s.user_id = $1' : `AND (c.id IS NULL OR c.status = 'active')`}
    ORDER BY s.user_id`, userId ? [userId] : [])).rows;
  const byUser = new Map();
  for (const s of subs) (byUser.get(s.user_id) || byUser.set(s.user_id, []).get(s.user_id)).push(s);
  const day = localNow().day;
  let sent = 0, people = 0;
  for (const [uid, list] of byUser) {
    const verses = await versesFor(uid, day);
    if (!verses.length) continue;
    const payload = buildPayload(verses);
    const ok = await Promise.all(list.map(s => sendOne(s, payload)));
    sent += ok.filter(Boolean).length; if (ok.some(Boolean)) people++;
  }
  return { people, sent, devices: subs.length };
}

/** Programa el envío diario: revisa cada minuto y envía una sola vez por día (aunque el servidor se reinicie). */
export function startDailyPush(){
  const tick = async () => {
    const now = localNow();
    if (now.hour < HOUR || now.hour >= HOUR + 5) return; // si el servidor estuvo apagado a las 6, envía apenas vuelve (hasta las 11)
    const claim = await db.query(`INSERT INTO app_settings(key, value) VALUES('push_daily_sent', $1)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now() WHERE app_settings.value <> EXCLUDED.value RETURNING key`, [now.date]);
    if (!claim.rowCount) return;
    const r = await sendDaily();
    console.log(`Versículo del día (${now.date}): enviado a ${r.people} personas (${r.sent} de ${r.devices} dispositivos).`);
  };
  setInterval(() => tick().catch(e => console.error('Versículo del día:', e.message)), 60000).unref();
  setTimeout(() => tick().catch(e => console.error('Versículo del día:', e.message)), 15000).unref();
  // Deja guardados en la base los capítulos de la lista (así a las 6 no depende del servicio de la Biblia).
  setTimeout(async () => {
    for (const ref of DAILY_VERSES) {
      await verseText(ref).catch(() => null);
      await new Promise(r => setTimeout(r, 1500));
    }
  }, 60000).unref();
}
