#!/usr/bin/env python3
"""
Read public Telegram channels (no bot). Uses Telethon + api_id/api_hash from my.telegram.org.
First run: you'll be asked for phone + code; session is saved so you don't need to log in again.

Channels (edit TELEGRAM_CHANNELS or CHANNELS below):
  - warmonitors   War Monitor
  - intelslava    Intel Slava Z
  - osintupdates  OSINT Updates (if exists)

Usage:
  export TELEGRAM_API_ID=12345
  export TELEGRAM_API_HASH=your_api_hash
  python scripts/telegram_channels.py

Optional: INGEST_URL=http://localhost:8090/api/strike-news/ingest  → POST items to Node server.
"""

import asyncio
import json
import os
import re
import sys
from datetime import datetime

# Default channels (usernames without @)
CHANNELS = os.environ.get("TELEGRAM_CHANNELS", "warmonitors,intelslava").strip().split(",")
CHANNELS = [c.strip().lstrip("@") for c in CHANNELS if c.strip()]

STRIKE_KEYWORDS = [
    "iran", "strike", "missile", "drone", "explosion", "attack", "tehran", "baghdad",
    "damascus", "houthi", "saudi", "uae", "yemen", "iraq", "syria", "gulf",
]

REGION_KEYWORDS = [
    "iran", "tehran", "saudi", "riyadh", "uae", "dubai", "yemen", "iraq", "syria",
    "baghdad", "damascus", "gulf", "houthi",
]

KNOWN_PLACES = [
    "Tehran", "Isfahan", "Shiraz", "Tabriz", "Mashhad", "Qom", "Baghdad", "Damascus",
    "Riyadh", "Dubai", "Abu Dhabi", "Sana'a", "Aden", "Erbil", "Basra", "Aleppo",
]


def is_relevant(text: str) -> bool:
    if not text:
        return False
    lower = text.lower()
    return any(k in lower for k in STRIKE_KEYWORDS)


def exclude_israel(title: str, description: str) -> bool:
    text = f"{(title or '').lower()} {(description or '').lower()}"
    if "israel" in text and not any(k in text for k in REGION_KEYWORDS):
        return True
    if re.search(r"strike\s+in\s+israel|israeli\s+strike|rocket\s+.*\bisrael", title or "", re.I):
        return True
    return False


def extract_place(title: str, description: str) -> str | None:
    text = f"{title or ''} {description or ''}"
    for place in KNOWN_PLACES:
        if re.search(re.escape(place), text, re.I):
            return place
    m = re.search(r"\bin\s+([A-Za-z\u0600-\u06FF\s'-]+?)(?:\s*[,.]|\s+on\s+|\s+strike|$)", text, re.I)
    if m:
        name = m.group(1).strip()
        if 2 <= len(name) < 50:
            return name
    m = re.search(r"^([A-Za-z\u0600-\u06FF\s'-]+?),?\s+(?:Iran|Saudi|UAE|Iraq|Syria|Yemen)", title or "", re.I)
    if m:
        name = m.group(1).strip()
        if 2 <= len(name) < 50:
            return name
    return (title or "").split(",")[0].strip()[:50] or None


async def main():
    try:
        from telethon import TelegramClient
        from telethon.tl.types import Channel
    except ImportError:
        print("Install: pip install telethon", file=sys.stderr)
        sys.exit(1)

    api_id = os.environ.get("TELEGRAM_API_ID")
    api_hash = os.environ.get("TELEGRAM_API_HASH")
    if not api_id or not api_hash:
        print("Set TELEGRAM_API_ID and TELEGRAM_API_HASH (from https://my.telegram.org)", file=sys.stderr)
        sys.exit(1)

    session_path = os.environ.get("TELEGRAM_SESSION", "telegram_strike_session")
    ingest_url = os.environ.get("INGEST_URL", "").strip()
    limit = int(os.environ.get("TELEGRAM_LIMIT", "15"))

    client = TelegramClient(session_path, int(api_id), api_hash)

    await client.start()
    if not await client.is_user_authorized():
        print("Not authorized. Run again and complete phone/code login.", file=sys.stderr)
        sys.exit(1)

    all_items = []
    seen = set()

    for channel_name in CHANNELS:
        try:
            entity = await client.get_entity(channel_name)
            channel_title = getattr(entity, "title", channel_name)
            async for msg in client.iter_messages(entity, limit=limit):
                if not msg.text:
                    continue
                text = msg.text
                if not is_relevant(text):
                    continue
                title = (text[:200] or "").replace("\n", " ")
                if exclude_israel(title, text):
                    continue
                msg_id = f"tg-{channel_name}-{msg.id}"
                if msg_id in seen:
                    continue
                seen.add(msg_id)
                place = extract_place(title, text)
                username = getattr(entity, "username", None)
                if username:
                    link = f"https://t.me/{username}/{msg.id}"
                else:
                    cid = getattr(entity, "id", "")
                    link = f"https://t.me/c/{str(cid).replace('-100', '')}/{msg.id}" if cid else ""
                published = datetime.utcfromtimestamp(msg.date.timestamp()).isoformat() + "Z" if msg.date else ""
                all_items.append({
                    "id": msg_id,
                    "title": title,
                    "description": (text[:500] or ""),
                    "url": link,
                    "publishedAt": published,
                    "sourceName": channel_title,
                    "placeName": place,
                })
        except Exception as e:
            print(f"[{channel_name}] {e}", file=sys.stderr)

    await client.disconnect()

    if ingest_url and all_items:
        try:
            import urllib.request
            data = json.dumps({"items": all_items}).encode("utf-8")
            req = urllib.request.Request(ingest_url, data=data, method="POST", headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=15) as r:
                print(json.dumps({"ok": True, "ingested": len(all_items), "response": json.loads(r.read().decode())}))
        except Exception as e:
            print(json.dumps({"items": all_items}))
            print(f"INGEST failed: {e}", file=sys.stderr)
    else:
        print(json.dumps({"items": all_items}))


if __name__ == "__main__":
    asyncio.run(main())
