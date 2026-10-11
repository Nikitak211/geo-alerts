# Security Audit — geo-alerts (2026-10-11)

Tools: npm audit, Semgrep (p/default + p/owasp-top-ten), gitleaks (full git history), Trivy fs (vuln/secret/misconfig, HIGH+CRITICAL), Hadolint, `dotnet list package --vulnerable`, manual OWASP Top 10 review.

## Summary

| Area | Result | Action in this PR |
|---|---|---|
| npm (Server/) | 1 CRITICAL (proxy-addr IP spoofing) | Fixed via `npm audit fix` -> 0 vulnerabilities |
| npm (client/) | 2 CRITICAL, 19+ HIGH (shell-quote, proxy-addr, braces, postcss, nth-check, node-forge...) | `npm audit fix` -> 0 critical. Remaining HIGH are inside the `react-scripts`/`craco-cesium` build toolchain (dev/build-time only, not shipped to browsers). Full fix needs migrating off CRA (e.g. Vite) — tracked as follow-up. |
| NuGet (Server.csproj) | No vulnerable packages | — |
| gitleaks (history) | **9 findings, 3 real** | See "Secrets" — needs owner action |
| Hadolint | DL3008/DL3015/DL4006, DL3064 (secret-looking ARG/ENV) | Addressed in Docker hardening PR |
| Trivy misconfig | DS-0002 no non-root USER (Dockerfile, Server/Dockerfile) | Addressed in Docker hardening PR |
| Semgrep (app code) | 21 findings, reviewed | No true positives (see below) |

## Secrets (ACTION REQUIRED — repository is PUBLIC)

`.env` files are gitignored and **no `.env` is tracked at HEAD** (only `*.env.example`). However git history still contains:

- `server/.env` (commit 44c4d29 "feat: news"): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_API_HASH`
- `save.txt` (commit 44c4d29): Telegram `api_hash`
- `client/src/index.tsx` (commit 007822f): hard-coded Cesium ion access token (now read from `REACT_APP_CESIUM_ION_ACCESS_TOKEN`)

Recommended: **rotate** the Telegram bot token (BotFather /revoke), the Telegram API hash (my.telegram.org) and the Cesium ion token. Rewriting history (git filter-repo + force push) is optional after rotation and was NOT done here.

False positives: `X-API-Key` examples in `.cursor/**/SKILL.md`; Cesium's built-in default token in `client/public/cesium/*`.

## Semgrep triage
- `path-join-resolve-traversal` (Server/src/**, server.js:326): paths built from constants or a strict regex-validated filename (`^alert-[a-zA-Z0-9_-]+-\d+\.png$`) — not exploitable.
- `detect-insecure-websocket` client/src/utils/helper.ts:54: code converts ws:// -> http:// for SignalR; not a plaintext socket in prod (same-origin HTTPS).
- `wildcard-postmessage` MapRenderPage.tsx:112: posts only `{type:"render-ready", alertId}` (non-sensitive) to the screenshot-worker parent.
- `using-http-server` mock-oref-ws.js / `playwright-goto-injection` scripts: dev-only tools.
- `.github/skills/**`, `.cursor/**`: vendored agent tooling, out of scope.

## OWASP Top 10 review
- A01 Broken Access Control: **FIXED** `POST /api/debug/realtime/test-wallet` was reachable anonymously in production and broadcast a fake `wallet_updated` event to all connected clients; now returns 404 outside Development. **FIXED (critical)** `POST /api/debug/telegram/send-photo` let anyone make the server read an arbitrary file path from disk and post it to the public Telegram channel (arbitrary file read + exfiltration). All `/api/debug/*` controllers are now `[DevelopmentOnly]` (404 in production). `/api/register` and `/api/login` are placeholders that store nothing (no real accounts).
- A02 Crypto failures: TLS terminated by Cloudflare; HSTS missing -> security headers PR.
- A03 Injection: EF/parameterized data access; no raw SQL string building found by Semgrep.
- A04 Insecure design: betting/wallet feature has no payment integration in the server code; scope to be confirmed and documented in the Terms PR.
- A05 Misconfiguration: no security headers/CSP; container runs as root; CORS AllowAnyOrigin only in Development -> headers + Docker PRs.
- A06 Vulnerable components: fixed criticals above; CRA toolchain follow-up.
- A07 Auth failures: N/A (no accounts).
- A08 Integrity: Dockerfile pipes `curl | bash` (NodeSource) -> Docker PR.
- A09 Logging: structured logging present; ensure no secrets logged.
- A10 SSRF: server fetches only fixed upstream URLs (OREF/Telegram/news).
- Rate limiting: only the `news` policy (60/min/IP) — no global limiter; partition key uses RemoteIpAddress which behind Cloudflare is the tunnel IP -> rate-limit PR.

Raw scan outputs are kept locally (not committed).
