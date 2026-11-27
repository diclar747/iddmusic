// Rutas públicas (sin sesión): formulario "Solicitar información" de la landing.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { bad, clean, normPhone } from '../lib/http.js';

const r = Router();
const limit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: false, legacyHeaders: false, message: { error: 'Ya recibimos varias solicitudes desde esta conexión. Probá más tarde o escribinos por WhatsApp.' } });

r.post('/info-request', limit, async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // campo trampa para robots
  const name = clean(b.name, 120), phone = normPhone(clean(b.phone, 40)), email = clean(b.email, 160);
  if (!name) throw bad('Contanos tu nombre');
  if (!phone && !email) throw bad('Dejanos un WhatsApp o un correo para contactarte');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('El correo no parece válido');
  await db.query('INSERT INTO info_requests(name, church, city, phone, email, message) VALUES($1,$2,$3,$4,$5,$6)',
    [name, clean(b.church, 160), clean(b.city, 120), phone, email, clean(b.message, 2000)]);
  console.log(`Nueva solicitud de información: ${name}${b.church ? ' · ' + clean(b.church, 160) : ''}`);
  res.json({ ok: true });
});

export default r;
