import unittest
from frappe_notify_plus.validation import validate_config

class ConfigTests(unittest.TestCase):
    def config(self, **kwargs):
        return dict(toast_style="Accent", tone="Info", position="Top Right", duration=7, sound="Chime", volume=60, **kwargs)

    def test_all_styles(self):
        for style in ["Minimal", "Accent", "Solid", "Glass", "Banner"]:
            config = self.config(); config["toast_style"] = style
            validate_config(config)

    def test_bounds(self):
        for key, value in [("duration", -1), ("duration", 61), ("duration", 1.5), ("volume", 101), ("tone", "<script>")]:
            config = self.config(); config[key] = value
            with self.assertRaises(ValueError): validate_config(config)

    def test_audio_paths(self):
        for path in ["https://example.com/a.mp3", "//evil.test/files/a.mp3", "/private/files/a.mp3", "/files/../a.mp3", "/files/%2e%2e/a.mp3", "/files/a.html", "/files/a.mp3?x=1"]:
            config = self.config(custom_sound=path); config["sound"] = "Custom"
            with self.assertRaises(ValueError): validate_config(config)
        config = self.config(custom_sound="/files/my sound.mp3"); config["sound"] = "Custom"
        validate_config(config)

if __name__ == "__main__": unittest.main()
