# ---- Stage 1: Build Next.js ----
FROM node:22-alpine AS builder

WORKDIR /build

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./

RUN npm run build

# ---- Stage 2: Runner (frontend + backend juntos) ----
FROM node:22-alpine AS runner

WORKDIR /app

RUN npm install -g pm2

# Backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev
COPY backend/ ./backend/

# Frontend (standalone)
COPY --from=builder /build/.next/standalone ./frontend/
COPY --from=builder /build/.next/static ./frontend/.next/static
RUN mkdir -p ./frontend/public

# PM2 config
COPY ecosystem.config.js ./

EXPOSE 80

CMD ["pm2-runtime", "ecosystem.config.js"]
