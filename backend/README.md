# API
Node 20+, Express, PostgreSQL.
En Docker se inicia con `docker compose up --build -d`.
Endpoints:
- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/songs?q=...` (requiere Bearer token)
- `POST /api/songs`, `GET /api/songs/:id`, `PATCH /api/songs/:id`
- `POST /api/songs/:id/transpose`
- `GET/POST /api/groups`
- `GET/POST /api/setlists`
- `POST /api/setlists/:id/items`
- `POST /api/uploads` (multipart field `file`)
El usuario inicial se crea con el script CLI indicado en el README raíz.
