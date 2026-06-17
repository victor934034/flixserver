# ---- Stage 1: Build Next.js ----
FROM node:20-alpine AS builder

WORKDIR /build

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

RUN npm run build

# ---- Stage 2: Runner (frontend + backend juntos) ----
FROM node:20-alpine AS runner

WORKDIR /app

RUN npm install -g pm2

# Backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY backend/ ./backend/

# Frontend (standalone)
COPY --from=builder /build/public ./frontend/public
COPY --from=builder /build/.next/standalone ./frontend/
COPY --from=builder /build/.next/static ./frontend/.next/static

# PM2 config
COPY ecosystem.config.js ./

EXPOSE 3000

CMD ["pm2-runtime", "ecosystem.config.js"]
