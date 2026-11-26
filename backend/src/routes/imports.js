import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { bad } from '../lib/http.js';
import { memoryUpload } from '../lib/uploads.js';
import { niroConfigured, niroVisionExtract, parseMusicResponse } from '../lib/niro.js';
import rateLimit from 'express-rate-limit';
import { fetchLaCuerda, searchLaCuerda, artistLaCuerda } from '../lib/lacuerda.js';

const r = Router();
r.use(auth);

r.get('/status', (_req, res) => res.json({ ai_enabled: niroConfigured(), provider: 'Niro IA' }));

// Cada llamada consume créditos de Niro: limitar por usuario.
const limiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 60, keyGenerator: req => req.user.id, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiadas transcripciones seguidas. Esperá unos minutos.' } });

/** Transcribe una imagen (o PDF con texto) a cifrado editable. El frontend envía cada página de un PDF como imagen. */
r.post('/transcribe', limiter, memoryUpload.single('file'), async (req, res) => {
  if (!req.file) throw bad('Subí una imagen o PDF');
  const started = Date.now();
  const body = await niroVisionExtract(req.file.buffer, Buffer.from(req.file.originalname, 'latin1').toString('utf8'), req.file.mimetype);
  const result = parseMusicResponse(body);
  if (!result.chart) throw bad('La IA no encontró texto en el archivo. Probá con una imagen más nítida.');
  res.json({ ...result, raw_text: body.text ?? null, cost: body.cost ?? null, model: body.model ?? null, latency_ms: body.latencyMs ?? (Date.now() - started) });
});


/* ---------- LaCuerda (acordes.lacuerda.net) ---------- */
const lcLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, keyGenerator: req => req.user.id, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiadas búsquedas seguidas en LaCuerda. Esperá un minuto.' } });
r.get('/lacuerda', lcLimiter, async (req, res) => { res.json(await fetchLaCuerda(String(req.query.url || ''))); });
r.get('/lacuerda/search', lcLimiter, async (req, res) => { res.json(await searchLaCuerda(req.query.q)); });
r.get('/lacuerda/artist', lcLimiter, async (req, res) => { res.json(await artistLaCuerda(String(req.query.url || ''))); });

export default r;
