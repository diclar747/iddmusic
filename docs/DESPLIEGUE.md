# Despliegue en el servidor (cd.com.py)

Todo corre con **Docker**: PostgreSQL, la API y la web. La base de datos se crea sola la primera vez
(la API aplica `database/schema.sql` + `database/migrations/*.sql` cada vez que arranca, sin repetir nada).

## 1. Requisitos en el servidor
- Linux con **Docker** y el plugin **docker compose** (`docker compose version`).
- El dominio **cd.com.py** apuntando a la IP del servidor (registro A).
- Puertos 80 y 443 abiertos.

## 2. Descargar el proyecto
```bash
sudo mkdir -p /opt/iddmusic && sudo chown $USER /opt/iddmusic
git clone https://github.com/diclar747/iddmusic.git /opt/iddmusic
cd /opt/iddmusic
```

## 3. Configurar
```bash
cp .env.example .env
nano .env
```
Completar como mínimo:
| Variable | Valor |
|---|---|
| `DOMAIN` | `cd.com.py` |
| `APP_ORIGIN` | `https://cd.com.py` |
| `POSTGRES_PASSWORD` | clave larga aleatoria (`openssl rand -base64 24`) |
| `JWT_SECRET` | secreto aleatorio de 32+ caracteres (`openssl rand -base64 36`) |
| `NIRO_API_KEY` | la key de Niro IA (para transcribir PDF/fotos) |

`.env` **nunca** se sube a Git.

## 4. Levantar
Elegí **una** de las dos opciones según el servidor:

**A) El servidor NO tiene otro sitio web (puertos 80/443 libres)** — Caddy saca el certificado HTTPS solo:
```bash
docker compose --profile https up -d --build
```

**B) El servidor YA tiene Nginx** (otros sitios) — la app queda en `127.0.0.1:8080` y Nginx la publica:
```bash
docker compose up -d --build
sudo cp deploy/nginx-cd.com.py.conf /etc/nginx/sites-available/cd.com.py
sudo ln -s /etc/nginx/sites-available/cd.com.py /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d cd.com.py -d www.cd.com.py
```
(Con Apache: `ProxyPass / http://127.0.0.1:8080/` y para `/api/live/` desactivar el buffer.)

Verificar: `docker compose ps` (todo `healthy`/`running`) y `curl -s https://cd.com.py/api/health`.

## 5. Crear el usuario administrador
```bash
docker compose exec api npm run admin -- --email admin@cd.com.py --name "Administración IDD"
```
Muestra **una sola vez** la contraseña generada. Para elegirla vos: agregar `--password "TuClaveSegura"`.
Si ya existe, le cambia la contraseña (sirve para recuperar el acceso).

Después, desde la web: **Mis grupos → crear grupo → Integrantes → agregar** a cada músico (se les crea su usuario
con contraseña temporal) o compartir el usuario general.

## 6. Actualizar a una versión nueva
```bash
cd /opt/iddmusic
git pull
docker compose up -d --build        # (agregar --profile https si usás la opción A)
```
Las migraciones nuevas se aplican solas. Los datos y archivos quedan en los volúmenes `idd_pgdata` e `idd_uploads`.

## 7. Copias de seguridad
```bash
sh deploy/backup.sh                 # base (pg_dump) + archivos subidos → backups/
crontab -e                          # diario a las 3:00
0 3 * * * cd /opt/iddmusic && sh deploy/backup.sh >> backups/backup.log 2>&1
```
Restaurar la base:
```bash
docker compose exec -T db pg_restore -U idd_user -d idd_music --clean --if-exists < backups/db-AAAAMMDD-HHMM.dump
```
Guardá copias fuera del servidor (otro disco o la nube).

## 8. Base de datos sin Docker (opcional)
`database/idd_music_completo.sql` tiene la estructura completa + roles. En un PostgreSQL vacío:
```bash
psql -U idd_user -d idd_music -f database/idd_music_completo.sql
```
y luego `npm --prefix backend run admin -- --email ...`.

## Chromecast y vista de músicos en producción
- Chromecast necesita **HTTPS** (cd.com.py lo tiene). Usar **Google Chrome o Microsoft Edge** en la computadora que proyecta,
  conectada a la **misma red Wi-Fi** que los Chromecast.
- Los músicos abren `https://cd.com.py/#/musicos` en su tablet o teléfono e ingresan con su usuario.

## Comandos útiles
| Qué | Comando |
|---|---|
| Ver logs | `docker compose logs -f api` |
| Reiniciar | `docker compose restart` |
| Entrar a la base | `docker compose exec db psql -U idd_user idd_music` |
| Borrar TODOS los datos (¡cuidado!) | `docker compose exec api npm run reset-data -- --si-borrar-todo` |
