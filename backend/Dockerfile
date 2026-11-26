# API de IDD Music. Se construye desde la raíz del repo (docker-compose: context ".")
# porque comparte código con el frontend (parser de cifrado y libro de la Biblia) y usa database/ para las migraciones.
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /srv/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
COPY frontend/src/lib /srv/frontend/src/lib
COPY database /srv/database
RUN mkdir -p storage/uploads && chown -R node:node /srv
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
# Aplica las migraciones pendientes y arranca (idempotente: se puede reiniciar cuantas veces sea).
CMD ["node", "src/server.js"]
