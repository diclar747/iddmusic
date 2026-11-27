-- SION Music: plataforma para varias iglesias. Cada iglesia tiene sus usuarios, grupos, canciones y su propia marca.
CREATE TABLE IF NOT EXISTS churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  branch VARCHAR(160),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  plan_until DATE,                       -- vencimiento del plan (NULL = sin vencimiento)
  settings JSONB NOT NULL DEFAULT '{}',  -- datos de contacto, logo, portada, colores, modo claro/oscuro…
  notes TEXT,                            -- notas internas del administrador de SION
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users  ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS users_church_idx ON users(church_id);
CREATE INDEX IF NOT EXISTS groups_church_idx ON groups(church_id);

INSERT INTO roles(code,name) VALUES ('platform_admin','Administrador de SION') ON CONFLICT(code) DO NOTHING;
UPDATE roles SET name='Administrador de la iglesia' WHERE code='super_admin';

-- Instalación existente: todo pasa a ser la primera iglesia (Iglesia de Dios · Bella Vista), activa por un año.
DO $$
DECLARE cid UUID; cfg JSONB;
BEGIN
  IF EXISTS (SELECT 1 FROM users) AND NOT EXISTS (SELECT 1 FROM churches) THEN
    SELECT value::jsonb INTO cfg FROM app_settings WHERE key='church';
    cfg := coalesce(cfg, '{}'::jsonb) || jsonb_build_object('logo_url', '/icons/flames-gold.png', 'theme', 'azul-dorado', 'cover', 'c-0', 'mode', 'light');
    -- La foto de la iglesia que ya estaba cargada pasa a ser la portada.
    IF coalesce(cfg->>'image','') <> '' THEN cfg := cfg || jsonb_build_object('cover_image', cfg->>'image', 'cover', 'photo'); END IF;
    cfg := cfg - 'image';
    INSERT INTO churches(name, branch, status, plan_until, settings)
      VALUES (coalesce(cfg->>'name','Iglesia de Dios'), coalesce(cfg->>'branch','Bella Vista'), 'active', current_date + 365, cfg - 'name' - 'branch')
      RETURNING id INTO cid;
    UPDATE users SET church_id = cid WHERE church_id IS NULL;
    UPDATE groups SET church_id = cid WHERE church_id IS NULL;
    -- Quien administraba la instalación pasa a administrar también SION.
    INSERT INTO user_roles(user_id, role_id)
      SELECT ur.user_id, (SELECT id FROM roles WHERE code='platform_admin') FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.code='super_admin'
      ON CONFLICT DO NOTHING;
  END IF;
END $$;
