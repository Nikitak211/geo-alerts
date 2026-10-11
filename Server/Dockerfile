FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev && npm cache clean --force
ENV NODE_ENV=production PORT=5535 HTTP_PORT=8090
EXPOSE 5535 8090
# Run as the unprivileged "node" user that ships with the image
USER node
CMD ["node", "./src/server.js"]
