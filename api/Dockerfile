FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY packages/frontend-client/package.json packages/frontend-client/package.json
RUN npm ci --ignore-scripts
COPY api api
COPY packages/frontend-client packages/frontend-client
RUN npm run build && npm prune --omit=dev --ignore-scripts
FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules node_modules
COPY --from=build --chown=node:node /app/api/dist api/dist
COPY --from=build --chown=node:node /app/api/package.json api/package.json
COPY --chown=node:node config config
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","api/dist/main.js"]
