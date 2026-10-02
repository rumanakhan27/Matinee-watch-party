import re
from urllib.parse import parse_qs, urlparse

_VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")   # YouTube IDs are 11 characters


def extract_video_id(text):
    """Accepts a video ID or a YouTube link. Returns the 11-character ID, or None."""
    text = str(text).strip()
    if _VIDEO_ID.match(text):
        return text

    try:
        url = urlparse(text if "://" in text else "https://" + text)
    except ValueError:
        return None

    host = (url.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    elif host.startswith("m."):
        host = host[2:]

    candidate = None
    if host == "youtu.be":
        candidate = url.path.lstrip("/").split("/")[0]
    elif host in ("youtube.com", "music.youtube.com"):
        if url.path == "/watch":
            candidate = parse_qs(url.query).get("v", [""])[0]
        else:
            parts = [p for p in url.path.split("/") if p]
            if len(parts) >= 2 and parts[0] in ("embed", "shorts", "live", "v"):
                candidate = parts[1]

    if candidate and _VIDEO_ID.match(candidate):
        return candidate
    return None