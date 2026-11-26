# Arquitectura
- Frontend: React + Vite servido por Nginx.
- Backend: Node.js 20 + Express.
- Base de datos: PostgreSQL 16.
- Archivos: volumen privado local en MVP; migrar a S3 compatible para producción.
- PWA: manifest y service worker básico; no cachea API privada.
- Docker Compose: red privada, healthcheck de PostgreSQL, volumen persistente.

## Datos musicales
`lyrics_sections` usa JSON estructurado:
```json
[
 {"type":"verse","label":"Estrofa 1","lines":[
   {"text":"Grande es tu fidelidad","chords":[{"name":"G","position":0}]}
 ]}
]
```
El programador debe formalizar validación de este esquema y el editor visual. No guardar los acordes solo como texto concatenado: se perdería la capacidad de transponer y posicionar.
