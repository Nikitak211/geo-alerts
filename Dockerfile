# syntax=docker/dockerfile:1.7
# ---------- Client build stage (official Node image; no curl | bash) ----------
FROM node:20-bookworm-slim AS client
WORKDIR /src/client
COPY client/package.json client/package-lock.json ./
COPY client/scripts ./scripts
RUN npm ci --no-audit --no-fund
COPY client/ ./
# REACT_APP_* values are public in the CRA bundle either way.
# The Pi deploy portal injects them as build-args (see docker-compose.yml). Those args
# are recorded in image history; the JS bundle already contains the same values.
# Optional: a non-empty BuildKit secret named client_env overrides the args and is not
# stored as build-arg values:
#   docker build --secret id=client_env,src=client/.env.production .
ARG REACT_APP_GEOAPIFY_API_KEY=
ARG REACT_APP_CESIUM_ION_ACCESS_TOKEN=
ARG REACT_APP_OREF_TRAJECTORY_DEBUG=
ARG REACT_APP_STADIA_MAPS_API_KEY=
RUN --mount=type=secret,id=client_env,required=false \
    if [ -s /run/secrets/client_env ]; then \
      cp /run/secrets/client_env .env.production.local; \
    else \
      printf 'REACT_APP_GEOAPIFY_API_KEY=%s\nREACT_APP_CESIUM_ION_ACCESS_TOKEN=%s\nREACT_APP_OREF_TRAJECTORY_DEBUG=%s\nREACT_APP_STADIA_MAPS_API_KEY=%s\n' \
        "$REACT_APP_GEOAPIFY_API_KEY" "$REACT_APP_CESIUM_ION_ACCESS_TOKEN" "$REACT_APP_OREF_TRAJECTORY_DEBUG" "$REACT_APP_STADIA_MAPS_API_KEY" > .env.production.local; \
    fi && \
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
# Writable dir for the persistent news cache (mount a volume here; owned by the app user
# so a fresh named volume inherits the ownership).
# Pi deploy: deployd extracts sources 0640, and COPY can keep that mode. The app user
# must still be able to read the published files. PERMFIX is referenced so changing it
# invalidates this layer.
ARG PERMFIX=20261102b
RUN chmod -R a+rX /app && echo "permfix=${PERMFIX}" >/dev/null
RUN mkdir -p /app/cache && chown $APP_UID:$APP_UID /app/cache
# Built-in non-root user of the official .NET images (UID 1654)
USER $APP_UID
ENTRYPOINT ["dotnet", "Server.dll"]
