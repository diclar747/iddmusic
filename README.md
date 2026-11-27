# SION Music
*Un lugar de adoración y presencia de Dios*

Plataforma para iglesias (cada una con su logo, colores, portada y modo claro/oscuro) para el ministerio de alabanza: canciones con letra y acordes, grupos colaborativos, agenda de cultos y ensayos, importación de cifrados con IA (Niro) y **proyección tipo PowerPoint** con Chromecast, vista de músicos con acordes y Biblia.

## Qué incluye
- **Varias iglesias** (SION): cada iglesia tiene sus usuarios, grupos, canciones, logo, portada, 9 paletas de colores y modo claro/oscuro/automático. **Panel de SION** (administrador de la plataforma): crear iglesias con su administrador, activar/desactivar, extender el plan 1, 3, 6 o 12 meses, fecha de vencimiento, restablecer acceso y eliminar. Al vencer o desactivarse, sus usuarios no pueden ingresar.
- **Grupos colaborativos**: canciones, agenda, integrantes, imágenes y actividad. Todos los integrantes cargan y editan; los líderes administran integrantes.
- **Canciones**: editor de cifrado (acordes encima de la letra o ChordPro `[G]Santo`), transposición (cifrado americano y latino), adjuntos (PDF, fotos, audio) e historial de versiones.
- **Importar desde LaCuerda**: pegás la URL de una canción de acordes.lacuerda.net o la buscás por canción/artista; se carga letra + acordes en el editor para corregir y guardar.
- **Importar**: PDF o fotos → **Niro IA** transcribe letra y acordes (editable antes de guardar). Archivos **.txt / ChordPro** (.cho, .chopro, .crd, .pro) se abren directo, sin IA, de a uno o muchos a la vez.
- **Agenda y repertorio por evento**: calendario, eventos con orden, tono y quién dirige cada canción.
- **Proyección** (menú *Proyectar*, o desde una canción o evento):
  - Letra **sin acordes**, frase por frase, como diapositivas. Se avanza con flechas, espacio o control remoto de presentaciones.
  - **+75 fondos**: degradados, colores, sólidos, naturaleza, luces, ondas, cruz, geométricos, logo de la iglesia y **fotos propias** (subidas desde la computadora). Fondo general o **distinto por canción**. Tipografías, color, tamaño, posición, mayúsculas.
  - **Pantalla de espera** con el logo (tecla `B`) entre canciones y al salir — nunca queda en negro.
  - **Biblia**: `Juan 3:16`, `Jn 1.3`, `1 Co 13:4-7`, `Sal 23` o por palabra; RVR1960, NTV, LBLA y RVR1909.
  - **Texto libre** (avisos, mensajes rápidos), **imágenes a pantalla completa** (flyers, fotos), **editar la letra en vivo**, **abrir canciones desde la computadora**.
  - **Salidas**: Chromecast / Google TV (lista de dispositivos de Chrome, buscar de nuevo, conectar/desconectar), proyector o TV por **HDMI** (detecta las pantallas y abre la ventana en la elegida).
- **Músicos** (menú *Músicos*): la canción que se proyecta **con acordes**, siguiendo en vivo la sección actual, en la tablet o el teléfono de cada músico, o transmitida a un **segundo Chromecast**. Cada músico puede transponer, cambiar el tamaño y mantener la pantalla encendida.

## Instalar en el servidor (cd.com.py)
**Panel de hosting (Importar de GitHub):** runtime **Node.js 22**, variables `DATABASE_URL`, `JWT_SECRET`, `APP_ORIGIN`, `NIRO_API_KEY`; `npm install` + `npm start`. Detalle en **[docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)**.

**Docker en servidor propio:**
```bash
git clone https://github.com/diclar747/iddmusic.git /opt/iddmusic && cd /opt/iddmusic
cp .env.example .env && nano .env            # dominio, claves, NIRO_API_KEY
docker compose --profile https up -d --build # HTTPS automático (o sin --profile si ya hay Nginx)
docker compose exec api npm run admin -- --email admin@cd.com.py --name "Administración IDD"
```

## Desarrollo local (Windows)
Requisitos: Node.js 20+ y PostgreSQL.
```powershell
npm --prefix backend install
npm --prefix frontend install
```
1. `backend/.env` con `DATABASE_URL`, `JWT_SECRET` (32+ caracteres), `APP_ORIGIN=http://localhost:5173` y `NIRO_API_KEY`.
2. Base de datos: `npm --prefix backend run migrate` (aplica `database/schema.sql` + `database/migrations/*.sql`).
3. Administrador: `npm --prefix backend run admin -- --email tu@correo --name "Tu nombre"`.
4. Servidores: `npm --prefix backend run dev` y `npm --prefix frontend run dev` → http://localhost:5173

En esta PC ya está todo instalado (base del proyecto en `.pgdata`, puerto 5434): `powershell -ExecutionPolicy Bypass -File scripts\iniciar.ps1`.

### Scripts del backend
| Comando | Qué hace |
|---|---|
| `npm run migrate` | Aplica migraciones pendientes |
| `npm run admin -- --email X [--name Y] [--password Z]` | Crea o actualiza el administrador |
| `npm run seed-demo` | Carga datos de ejemplo (solo para probar) |
| `npm run reset-data -- --si-borrar-todo` | Borra todos los datos (deja la estructura) |

## Estructura
- `frontend/` React + Vite. `src/lib/` (cifrado, Biblia, temas, Chromecast, vivo) — `chart.js` y `bible.js` se comparten con el backend.
- `backend/` Node.js + Express 5 + PostgreSQL. Rutas en `src/routes/` (auth, grupos, canciones, eventos, archivos, importar, biblia, vivo).
- `database/` `schema.sql`, `migrations/` y `idd_music_completo.sql` (estructura completa para restaurar sin Docker).
- `deploy/` Caddyfile (HTTPS), configuración de Nginx para cd.com.py y script de backups.
- `docs/` alcance, arquitectura, API y despliegue.

## Seguridad
`.env`, `backend/.env`, archivos subidos, backups y credenciales locales están en `.gitignore`. La key de Niro queda solo en el servidor. Usá contraseñas largas y cambiá la del administrador desde **Mi perfil**.
