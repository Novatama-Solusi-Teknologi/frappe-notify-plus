from urllib.parse import urlsplit, unquote

STYLES = {"Minimal", "Accent", "Solid", "Glass", "Banner"}
TONES = {"Info", "Success", "Warning", "Danger"}
POSITIONS = {"Top Right", "Top Left", "Bottom Right", "Bottom Left"}
SOUNDS = {"None", "Chime", "Bell", "Pulse", "Custom"}

def validate_config(data):
    for key, values in (("toast_style", STYLES), ("tone", TONES), ("position", POSITIONS), ("sound", SOUNDS)):
        if data.get(key) not in values:
            raise ValueError(f"Invalid {key}")
    for key, maximum in (("duration", 60), ("volume", 100)):
        value = data.get(key)
        if value is None or float(value) != int(value) or not 0 <= int(value) <= maximum:
            raise ValueError(f"{key} must be an integer between 0 and {maximum}")
    if data.get("sound") == "Custom":
        url = urlsplit(data.get("custom_sound") or "")
        path = unquote(url.path)
        if (url.scheme or url.netloc or url.query or url.fragment
            or not path.startswith("/files/") or ".." in path or "\\" in path
            or path.lower().rsplit(".", 1)[-1] not in {"mp3", "wav", "ogg"}):
            raise ValueError("Custom sound must be a public /files/ MP3, WAV or OGG upload")
