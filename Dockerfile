# ---------- Build stage ----------
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Install Node.js for client build
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY . .

# React build-time env (CRA bakes these into the bundle). Pass via docker-compose build.args from root .env.
ARG REACT_APP_ACTIVE_TOOLBAR
ARG REACT_APP_GEOAPIFY_API_KEY
ARG REACT_APP_OREF_TRAJECTORY_DEBUG
ARG REACT_APP_CESIUM_ION_ACCESS_TOKEN
ENV REACT_APP_ACTIVE_TOOLBAR=$REACT_APP_ACTIVE_TOOLBAR
ENV REACT_APP_GEOAPIFY_API_KEY=$REACT_APP_GEOAPIFY_API_KEY
ENV REACT_APP_OREF_TRAJECTORY_DEBUG=$REACT_APP_OREF_TRAJECTORY_DEBUG
ENV REACT_APP_CESIUM_ION_ACCESS_TOKEN=$REACT_APP_CESIUM_ION_ACCESS_TOKEN

# Build React client
WORKDIR /src/client
RUN npm install
RUN npm run postinstall
RUN npm run build

# Copy client build into Server/wwwroot and include data assets (client public/data + server/data for municipalities.geojson)
WORKDIR /src/Server
RUN rm -rf wwwroot && mkdir -p wwwroot && cp -R ../client/build/* wwwroot/ && \
    mkdir -p wwwroot/data && \
    (cp -R ../client/public/data/* wwwroot/data/ 2>/dev/null || true) && \
    (cp -R ../server/data/* wwwroot/data/ 2>/dev/null || true)

# Publish backend only (SPA already in wwwroot)
RUN dotnet publish -c Release -o /app/publish

# ---------- Runtime stage ----------
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish ./

ENV ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Server.dll"]