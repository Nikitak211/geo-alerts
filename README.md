# Geo Alerts – Fullstack Setup

This project consists of:

- `client/` – React (Create React App) front-end (TypeScript).
- `Server/` – ASP.NET Core backend that serves the API and, in production, the built client.
- `server/` – Original Node.js backend (kept for reference during migration).

The long‑term goal is to serve both API and client from the .NET backend only.

## Local development

### Frontend dev (React only)

Use this when you are working on the UI and want fast hot‑reload.

1. From the `client/` folder:

   ```bash
   npm install
   npm start
   ```

2. The app will start on the port defined in `client/.env` (default `4421`).

3. The frontend will call whatever base URL is configured in:
   - `REACT_APP_API_BASE` – HTTP API base (default `http://localhost:8090`).
   - `REACT_APP_WS_URL` – WebSocket base (default `ws://localhost:5535`).

By default this talks to the **Node.js** backend in `server/`. To target the ASP.NET Core backend instead, point these values to the .NET server URL.

### Backend dev (.NET only)

Use this when you are working on the new ASP.NET Core backend.

1. From the `Server/` folder:

   ```bash
   dotnet restore
   dotnet run
   ```

2. ASP.NET Core will listen on the URLs configured in `Server/Properties/launchSettings.json` (for example `http://localhost:5206` / `https://localhost:7113`).

3. During backend‑only development you can:
   - Hit HTTP endpoints directly (e.g. `GET /api/health`).
   - Point the React dev server at the .NET backend by setting in `client/.env`:
     - `REACT_APP_API_BASE=http://localhost:5206`
     - `REACT_APP_WS_URL=ws://localhost:5206/ws`

The .NET backend is the long‑term replacement for the Node.js backend but the Node server remains available until feature parity is confirmed.

### Legacy backend dev (Node.js)

The original Node.js backend remains in the `server/` folder.

- It is still useful while the migration is in progress.
- Do **not** remove it until the ASP.NET Core backend has been fully validated.

To run it, follow the existing Node.js instructions you’ve been using (for example `npm install` / `npm start` inside `server/` if that is how it was set up).

## Full production build (client + .NET server)

In production, the goal is to run **only the ASP.NET Core server**, which serves both the API and the static client files.

1. From the `Server/` folder, publish in Release:

   ```bash
   dotnet publish -c Release
   ```

2. The publish step will:
   - Run `npm install` and `npm run build` in `client/`.
   - Copy the client build output from `client/build` into `Server/wwwroot`.
   - Produce a self‑contained publish directory under:
     - `Server/bin/Release/net9.0/publish`

3. Deploy the contents of the `publish` directory to your hosting environment and start the app with:

   ```bash
   dotnet Server.dll
   ```

4. In this mode:
   - The React app is served from `wwwroot` by ASP.NET Core.
   - API routes are served from the same origin under `/api/...`.
   - Non‑API routes fall back to `index.html` so direct reloads of deep links work.
   - Static data assets from `client/public/data` are available under `/data/*` (for example `/data/municipalities.geojson`).

### Local fullstack run (without Docker)

To run everything locally with ASP.NET Core serving the built client and data files:

1. Build the client:

   ```bash
   cd client
   npm install
   npm run build
   ```

2. Copy the build and data assets into `Server/wwwroot`:

   ```bash
   cd ..
   rm -rf Server/wwwroot
   mkdir -p Server/wwwroot/data
   cp -R client/build/* Server/wwwroot/
   cp -R client/public/data/* Server/wwwroot/data/
   ```

3. Start the ASP.NET Core server:

   ```bash
   cd Server
   dotnet run
   ```

4. Visit `http://localhost:5206/` (or the URL from `launchSettings.json`). Requests like `/data/municipalities.geojson` should now return JSON successfully.

## Configuration and environment variables

- Frontend configuration lives in `client/.env` and is **public** (anything `REACT_APP_*` is baked into the bundle).
- Backend configuration and secrets live in:
  - `Server/appsettings.json` / `Server/appsettings.Development.json` (non‑secret defaults).
  - Environment variables (recommended for secrets in each environment).

High‑level mapping:

- **Backend (ASP.NET Core)** – set via environment variables / appsettings:
  - `ConnectionStrings__DefaultDatabase` – Postgres connection string.
  - `App__CorsOrigin` – allowed origin for dev CORS.
  - `App__ClientBaseUrl` – public base URL of the app.
  - `App__WebSocketPath` – WebSocket/SignalR path (default `/ws`).
  - Feature flags and domain config (examples):
    - `Features__EnableTelegram`, `Features__EnableBets`
    - `Betting__*` – bet timing / payout config
    - `Screenshot__*` – screenshot storage and thresholds
    - `GeoData__ClientDataDir`, `Geocode__BaseUrl`, `Geocode__NominatimUrl`
  - Third‑party secrets (examples):
    - `Telegram__BotToken`, `Telegram__ChannelId`
    - `Telegram__ApiId`, `Telegram__ApiHash`

- **Frontend (React)** – set via `client/.env` (public, non‑secret):
  - `REACT_APP_API_BASE` – API base URL override (mainly for dev).
  - `REACT_APP_WS_URL` – WebSocket base URL override (mainly for dev).
  - `REACT_APP_GEOAPIFY_API_KEY`, `REACT_APP_CESIUM_ION_ACCESS_TOKEN`
  - `REACT_APP_ACTIVE_TOOLBAR`, `REACT_APP_OREF_TRAJECTORY_DEBUG`

Do not commit real secrets to the repository; always provide them via environment variables in each environment.

