# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files and scripts so postinstall (copy-cesium) can run
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci

COPY . .

# Build-time env for API/WS URLs when talking to server from browser
ARG REACT_APP_API_BASE=http://localhost:8090
ARG REACT_APP_WS_URL=ws://localhost:5535
ENV REACT_APP_API_BASE=$REACT_APP_API_BASE
ENV REACT_APP_WS_URL=$REACT_APP_WS_URL

RUN npm run build

# Cesium/bundle may use import.meta; script must run as ES module
RUN sed -i 's/<script /<script type="module" /g' build/index.html

# Production stage: serve static files with nginx
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
