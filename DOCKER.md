# Running with Docker

Build and run the client, server, and Postgres with Docker Compose:

```bash
docker compose up --build
```

- **Client**: http://localhost:3000 (nginx serving the React build)
- **Server API**: http://localhost:8090
- **WebSocket**: ws://localhost:5535
- **Postgres**: localhost:5432 (user `app`, password `app`, database `bets`)

## Database setup

On first run, apply the schema and migrations to the `bets` database:

```bash
# After db is up
docker compose exec db psql -U app -d bets -f - < server/src/schema.sql
docker compose exec -T db psql -U app -d bets < server/migrations/002_pipeline_storage.sql
```

Or run the SQL files from your host if you have `psql` and the port is exposed.

## Environment

- **Server**: `CORS_ORIGIN` (default in compose: `http://localhost:3000`), `DATABASE_URL`, `PORT`, `HTTP_PORT`.
- **Client**: Build args `REACT_APP_API_BASE` and `REACT_APP_WS_URL` (set in docker-compose for localhost; change if you use another host/port).

To use an existing Postgres instance instead of the `db` service, remove the `db` service and `depends_on: db` from `server`, and set `DATABASE_URL` to your connection string.
