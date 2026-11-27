-- Iglesia de Dios · Bella Vista: su logo original (llamas blancas sobre círculo negro) en PNG, ocupando todo el círculo.
UPDATE churches
SET settings = settings || '{"logo_url": "/icons/idd-logo.png", "logo_fit": "fill"}'::jsonb, updated_at = now()
WHERE coalesce(settings->>'logo', '') = '' AND settings->>'logo_url' = '/icons/flames-gold.png';
