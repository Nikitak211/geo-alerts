# Telegram strike news (public channels you don’t control)

Uses a **Telegram client session** (GramJS/MTProto) to read public OSINT channels. No bot, no admin rights.

## 1. Get API credentials

1. Go to [my.telegram.org](https://my.telegram.org) and log in.
2. Open “API development tools” → create application.
3. Note **api_id** and **api_hash**.

## 2. Add to server/.env

```
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
```

## 3. One-time login

From the `server` folder:

```bash
node scripts/telegram-login.js
```

You’ll be asked for:

- **Phone number** (with country code, e.g. `+1234567890`)
- **Code** from Telegram
- **2FA password** (if enabled)

Session is saved to `server/telegram_session`. Don’t commit it.

## 4. Start the server

```bash
npm start
```

The server reads from the configured channels every ~90 seconds and merges strike news into the same WS feed as RSS.

## 5. Channels

Default: `warmonitors`, `intelslava`. Override:

```
TELEGRAM_CHANNELS=warmonitors,intelslava,osintupdates
```

Use channel **usernames** (no `@`). Examples:

| Channel       | Username    |
|---------------|-------------|
| War Monitor   | warmonitors |
| Intel Slava Z | intelslava  |

## 6. Alternative: Python script

If you prefer Python (Telethon), use `scripts/telegram_channels.py`. It POSTs to `/api/strike-news/ingest`:

```bash
pip install -r scripts/requirements-telegram.txt
TELEGRAM_API_ID=... TELEGRAM_API_HASH=... INGEST_URL=http://localhost:8090/api/strike-news/ingest python scripts/telegram_channels.py
```
