FROM node:24-alpine AS build
WORKDIR /build/webapp
COPY webapp/package.json webapp/package-lock.json ./
RUN npm ci
COPY webapp/ ./
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=3000 BACKEND_URL=https://dream-wheels-ai-prod-vnext.onrender.com
WORKDIR /opt/dreamwheels
COPY --from=build --chown=node:node /build/webapp /opt/dreamwheels/webapp
COPY --chown=node:node deploy/timeweb/server.js /opt/dreamwheels/deploy/timeweb/server.js
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "/opt/dreamwheels/deploy/timeweb/server.js"]
