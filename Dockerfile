FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app/backend
ENV NODE_ENV=production
ENV PORT=8080
ENV FRONTEND_DIST=/app/frontend/dist
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist
EXPOSE 8080
CMD ["node", "src/index.js"]
