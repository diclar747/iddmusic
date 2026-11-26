# API implementada y propuesta
Base: `/api`
- GET `/health`
- POST `/auth/login`
- GET `/songs?q=` (JWT)
- GET `/songs/:id` (JWT)
- POST `/songs` (editor+)
- PATCH `/songs/:id` (editor+)
- POST `/songs/:id/transpose` (JWT)
- GET/POST `/groups` (miembro / roles de gestión)
- GET/POST `/setlists`
- POST `/setlists/:id/items`
- POST `/uploads` multipart field `file`
- GET `/files/:filename` (JWT)

## Pendiente
Completar administración de usuarios/invitaciones, membresía y permisos granulares por grupo, borrado lógico, paginación, validación Zod/Joi, OpenAPI/Swagger, endpoint de favoritos, comentarios, notificaciones y auditoría exhaustiva.
