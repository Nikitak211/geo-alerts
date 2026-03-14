FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
# Install all deps for build (TypeScript is devDependency)
RUN npm ci

# Build TypeScript (produces dist/)
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune dev deps for smaller image
RUN npm prune --omit=dev

# Server entry is src/server.js (requires dist/ and src/)
EXPOSE 5535 8090

ENV NODE_ENV=production
ENV PORT=5535
ENV HTTP_PORT=8090

CMD ["node", "./src/server.js"]
