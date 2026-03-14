# Geo Alerts – Fullstack Setup

This project is a fullstack application for real-time geo alerts (e.g. OREF-style alerts), with a map-based React client, optional betting/settlement, Telegram notifications, and screenshot capture. The backend can run as **ASP.NET Core** (primary) or the legacy **Node.js** server during migration.

---

## Project structure

| Path | Description |
|------|-------------|
| `client/` | React (Create React App) front-end in TypeScript. Map UI (Leaflet + Cesium), alerts, SignalR/WebSocket. |
| `server/` | **ASP.NET Core** (primary): `Program.cs`, `Server.csproj`, `appsettings.json`. Serves API + built client in production. Also contains the **Node.js** backend (`src/server.js`) kept for reference until migration is complete. |
| Root | `Dockerfile` (builds client + .NET server), `docker-compose.yml` (single service + env from root `.env`). |

The long-term goal is to serve both API and client from the .NET backend only.

---

## Tech stack and why

- **Frontend: React (CRA) + TypeScript** – Single-page app with hot reload; TypeScript for type safety and maintainability.
- **UI: MUI (Material UI) + Emotion** – Consistent components and theming.
- **Maps: Leaflet + Cesium (Resium)** – 2D (Leaflet) and 3D globe (Cesium) for alert visualization and trajectories; Cesium used for imagery and 3D (e.g. Cesium Ion).
- **Real-time: SignalR (@microsoft/signalr)** – Alerts and live updates from the .NET backend; replaces the legacy Node WebSocket on port 5535.
- **Backend: ASP.NET Core 9** – Primary API, static SPA hosting, SignalR hub at `/ws`; chosen for performance and single-deployment story.
- **Legacy backend: Node.js (Express)** – Original API + WebSocket; still runnable for parity during migration.
- **Database: PostgreSQL** – Stores alerts, inferences, wallets, bets; connection via `ConnectionStrings__DefaultDatabase` or `DATABASE_URL`.
- **Optional: Telegram** – Notifications (e.g. screenshot alerts) via Bot API; requires Bot Token and Channel ID.
- **Optional: Geoapify** – Boundaries API for alert polygons (cities); used by the client for geometry.
- **Optional: Cesium Ion** – Map imagery (e.g. Google roadmap asset); optional access token for higher quotas.

---

## Steps to run the app

### 1. Frontend-only (React dev server)

Use this when working on the UI with fast hot-reload. The client will call the API/WebSocket URLs set in `client/.env`.

1. Copy `client/.env.example` to `client/.env` and set at least:
   - `PORT` (e.g. `4421`)
   - `REACT_APP_API_BASE` (e.g. `http://localhost:8090` for Node or `http://localhost:5206` for .NET)
   - `REACT_APP_WS_URL` (e.g. `ws://localhost:5535` for Node or `http://localhost:5206/ws` for .NET)
   - `REACT_APP_GEOAPIFY_API_KEY` if you use boundaries (see [API keys](#api-keys)).
2. From the repo root:
   ```bash
   cd client
   npm install
   npm start
   ```
3. Open the app at the port in `client/.env` (default `4421`). It will use the API and WebSocket URLs from that file.

### 2. Backend: ASP.NET Core only

Use this when working on the .NET API and SignalR hub.

1. Ensure PostgreSQL is running and create a database (e.g. `bets`). Optionally set `ConnectionStrings__DefaultDatabase` or use defaults in `server/appsettings.json`.
2. Optionally copy `server/.env.example` to `server/.env` and set any overrides (e.g. `USE_OREF_MOCK`, `TELEGRAM_BOT_TOKEN`). .NET reads from `appsettings.json` and environment variables.
3. From the repo root:
   ```bash
   cd server
   dotnet restore
   dotnet run
   ```
4. The API runs on the URL in `server/Properties/launchSettings.json` (e.g. `http://localhost:5206`). To use it with the React dev server, set in `client/.env`:
   - `REACT_APP_API_BASE=http://localhost:5206`
   - `REACT_APP_WS_URL=http://localhost:5206/ws`

### 3. Legacy backend: Node.js only

The Node server in `server/src/server.js` uses `server/.env` (loaded via `dotenv` from `server/.env`).

1. Copy `server/.env.example` to `server/.env` and set at least `DATABASE_URL`, and optionally `PORT`, `HTTP_PORT`, `CORS_ORIGIN`, `USE_OREF_MOCK`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`.
2. Install dependencies and run (exact commands depend on your Node setup, e.g. `npm install` and `npm start` from `server/` if configured).
3. Node listens on `HTTP_PORT` (default 8090) for HTTP and `PORT` (default 5535) for WebSocket. Point `client/.env` at these if using the React dev server.

### 4. Full production build (client + .NET server, no Docker)

.NET serves the built client and API from one process.

1. Build the client and copy into the server’s `wwwroot`:
   ```bash
   cd client
   npm install
   npm run build
   cd ..
   # Copy client/build into server/wwwroot and client/public/data into server/wwwroot/data
   # (On Windows use xcopy / robocopy; on Unix: cp -R client/build/* server/wwwroot/ and cp -R client/public/data/* server/wwwroot/data/)
   ```
2. From `server/`:
   ```bash
   dotnet publish -c Release
   dotnet run --project . -c Release
   # Or run the published output: dotnet server/bin/Release/net9.0/publish/Server.dll
   ```
3. Open the app at the URL configured for the .NET server (e.g. `http://localhost:5206`). API and `/ws` are on the same origin.

### 5. Run with Docker

Docker uses the **root** `.env` file (copy from root `.env.example`). It builds the client and .NET server and runs a single container.

1. Copy the root `.env.example` to `.env` in the repo root and set at least `DATABASE_URL`. Set other variables as needed (Telegram, OREF mock, betting, screenshot, etc.).
2. From the repo root:
   ```bash
   docker compose up --build
   ```
3. The app is served on the port mapped in `docker-compose.yml` (e.g. `8080`). API and WebSocket are on the same origin (`/api/*`, `/ws`).

For database setup (schema/migrations), see `DOCKER.md`.

---

## Configuration and environment variables

- **Frontend:** `client/.env` – Only variables prefixed with `REACT_APP_` are embedded in the bundle (they are public). Copy from `client/.env.example`.
- **Root (Docker):** `.env` in the repo root is used by `docker-compose`. Copy from root `.env.example`.
- **Backend (Node + .NET):** `server/.env` is used by the Node server. The .NET backend uses `server/appsettings.json` and `server/appsettings.Development.json`, and environment variables override (e.g. `TELEGRAM_BOT_TOKEN`, `USE_OREF_MOCK`). Copy from `server/.env.example` for local Node/.NET dev.

Do not commit real secrets; provide them via environment variables (or secure config) per environment.

| Scope | Config source | Purpose |
|-------|----------------|--------|
| Client | `client/.env` | `REACT_APP_*`: API base, WS URL, Geoapify key, Cesium Ion token, toolbar/debug flags |
| Root | `.env` | Docker Compose: `DATABASE_URL`, Telegram, features, betting, screenshot, geo |
| Server | `server/.env` | Node: `DATABASE_URL`, ports, CORS, OREF mock, Telegram. .NET: overrides via env (same names where applicable) |

---

## API keys – step-by-step

### Geoapify (Boundaries / alert polygons)

Used by the client to fetch boundary geometry (e.g. for cities from OREF data).

1. Go to [https://www.geoapify.com/](https://www.geoapify.com/).
2. Sign up or log in and open the dashboard.
3. Create an API key (or use the default one).
4. In `client/.env` set:
   ```env
   REACT_APP_GEOAPIFY_API_KEY=your_api_key_here
   ```
5. Restart the React dev server so the new value is baked into the bundle.

### Cesium Ion (Map imagery)

Used for Cesium-based imagery (e.g. Google roadmap-style layer). The app can use the default Cesium Ion token with limited quota; for production or higher usage you should use your own.

1. Go to [https://cesium.com/ion/](https://cesium.com/ion/).
2. Sign up or log in and open the Access Tokens section.
3. Create a new token or copy the default token.
4. In `client/.env` set (optional; only if you need a custom token):
   ```env
   REACT_APP_CESIUM_ION_ACCESS_TOKEN=your_cesium_ion_token_here
   ```
5. Restart the React dev server. If unset, Cesium may use its default token (subject to quota limits).

### Telegram (Alerts / screenshots)

Used by the backend to send messages (e.g. screenshot alerts) to a Telegram channel.

1. Create a bot via [@BotFather](https://t.me/BotFather) and copy the **Bot Token**.
2. Create a channel (or use an existing one). Add your bot as an administrator.
3. Get the **Channel ID** (e.g. use [@userinfobot](https://t.me/userinfobot) or the Telegram API; for public channels the username like `@mychannel` can sometimes be used).
4. For the backend, set in `server/.env` (Node) or in the root `.env` (Docker) or as environment variables for .NET:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHANNEL_ID=your_channel_id_or_@channel_username
   ```
   If using Telegram Client API (e.g. for user auth), also set:
   ```env
   TELEGRAM_API_ID=your_api_id
   TELEGRAM_API_HASH=your_api_hash
   ```
   (Get these from [my.telegram.org](https://my.telegram.org).)
5. Restart the backend (Node or .NET) or redeploy the Docker container so the new values are picked up.

---

## .env examples

- **Root:** `.env.example` – Used as a template for the root `.env` (Docker Compose). Copy to `.env` and fill in values.
- **Client:** `client/.env.example` – Template for `client/.env`. Copy to `client/.env` and set `PORT`, `REACT_APP_*` as needed.
- **Server:** `server/.env.example` – Template for `server/.env` (Node and .NET local overrides). Copy to `server/.env` and set database, Telegram, OREF, etc.

See the tables in [Configuration and environment variables](#configuration-and-environment-variables) for which variables apply to each part of the app.
