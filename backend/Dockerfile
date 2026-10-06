FROM node:22-bookworm-slim

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json backend/.npmrc ./
ARG NPM_REGISTRY=https://registry.npmjs.org/
RUN npm ci --registry="$NPM_REGISTRY"

COPY backend/ ./
COPY database/ /app/database/

EXPOSE 3001

CMD ["npx", "tsx", "src/index.ts"]
