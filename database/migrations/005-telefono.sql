-- WhatsApp / teléfono de cada usuario (formato internacional, ej. +595981123456).
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
