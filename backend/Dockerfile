FROM node:22-bookworm-slim

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json backend/.npmrc ./
RUN npm ci

COPY backend/ ./
COPY database/ /app/database/

EXPOSE 3001

CMD ["npx", "tsx", "src/index.ts"]
