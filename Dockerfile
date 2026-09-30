# --- Install all dependencies (including devDeps for Vite / React Router build) ---
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json* ./
COPY extensions ./extensions

RUN npm ci && npm cache clean --force

# --- Build app ---
FROM deps AS build
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Production image ---
FROM node:20-alpine AS production
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY extensions ./extensions

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

EXPOSE 3000

CMD ["npm", "run", "docker-start"]
