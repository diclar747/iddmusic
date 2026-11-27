-- Iglesia de Dios · Bella Vista: si quedó sin logo, se le vuelve a poner el original (llamas, redondo).
UPDATE churches
SET settings = settings || '{"logo_url": "/icons/idd-logo.png", "logo_fit": "fill"}'::jsonb, updated_at = now()
WHERE name ILIKE 'Iglesia de Dios%' AND coalesce(settings->>'logo', '') = '' AND coalesce(settings->>'logo_url', '') IN ('', '/icons/flames-gold.png');
