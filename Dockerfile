# syntax=docker/dockerfile:1.7
# ---------- Client build stage (official Node image; no curl | bash) ----------
FROM node:20-bookworm-slim AS client
WORKDIR /src/client
COPY client/package.json client/package-lock.json ./
COPY client/scripts ./scripts
RUN npm ci --no-audit --no-fund
COPY client/ ./
# REACT_APP_* values are passed as a BuildKit secret file (not ARG/ENV), so they are never
# stored in image layers/history. CRA still bakes them into the public JS bundle.
# Provide with: docker compose build (see secrets: in docker-compose.yml) or
#   docker build --secret id=client_env,src=client/.env.production .
RUN --mount=type=secret,id=client_env,required=false \
    if [ -f /run/secrets/client_env ]; then cp /run/secrets/client_env .env.production.local; fi && \
    npm run build && rm -f .env.production.local

# ---------- Server build stage ----------
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY Server/Server.csproj Server/
RUN dotnet restore Server/Server.csproj
COPY Server/ Server/
COPY --from=client /src/client/build/ Server/wwwroot/
COPY client/public/data/ Server/wwwroot/data/
RUN dotnet publish Server/Server.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false /p:SkipClientBuild=true

# ---------- Runtime stage ----------
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build --chown=root:root /app/publish ./
ENV ASPNETCORE_URLS=http://0.0.0.0:8080 \
    DOTNET_EnableDiagnostics=0
EXPOSE 8080
# Built-in non-root user of the official .NET images (UID 1654)
USER $APP_UID
ENTRYPOINT ["dotnet", "Server.dll"]
