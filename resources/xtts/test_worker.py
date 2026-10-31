"""Offline protocol, validation and audio encoding tests; no pretrained weights."""
import importlib.util
import io
import math
from pathlib import Path
import tempfile
import types
import unittest
import wave

spec = importlib.util.spec_from_file_location("xtts_worker", Path(__file__).with_name("worker.py"))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class ProtocolTests(unittest.TestCase):
    def test_validation(self):
        for change in ({"speed": float("nan")}, {"temperature": 2}, {"device": "http"}, {"text": ""}, {"text": "x" * 12001}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                worker.validate(dict(action="speak", text="Привет", **change) if "text" not in change else dict(action="speak", **change))
        worker.validate({"action": "speak", "text": "Привет", "speed": 1.2})

    def test_unaccepted_model_license_prevents_installation(self):
        spec = importlib.util.spec_from_file_location("xtts_setup", Path(__file__).with_name("setup.py"))
        setup = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(setup)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "xtts"
            with self.assertRaisesRegex(ValueError, "license"):
                setup.install(root, "cpu", False)
            self.assertFalse(root.exists(), "no installation should begin before acceptance")

    def test_wav_result_and_settings_reach_inference(self):
        import numpy as np
        calls = []
        class Model:
            speaker_manager = types.SimpleNamespace(speakers={"Voice": {"gpt_cond_latent": "latent", "speaker_embedding": "embedding"}})
            config = types.SimpleNamespace(languages=["ru", "en"])
            def inference(self, *args, **kwargs):
                calls.append((args, kwargs))
                return {"wav": np.array([0, .5, -.5, 2], dtype=np.float32)}
        engine = worker.Engine("/unused")
        engine.model, engine.device = Model(), "cpu"
        result = engine.handle({"action": "speak", "text": "Привет", "language": "ru-RU", "speed": 1.25, "temperature": .5})
        import base64
        with wave.open(io.BytesIO(base64.b64decode(result["audio"])), "rb") as audio:
            self.assertEqual(audio.getframerate(), 24000)
            self.assertEqual(audio.getnframes(), 4)
            self.assertEqual(audio.getsampwidth(), 2)
        self.assertEqual(calls[0][0][1], "ru")
        self.assertEqual(calls[0][1]["speed"], 1.25)
        self.assertTrue(calls[0][1]["enable_text_splitting"])

    def test_reference_validation_and_cache(self):
        import numpy as np
        import soundfile as sf
        calls = []
        class Model:
            speaker_manager = types.SimpleNamespace(speakers={})
            config = types.SimpleNamespace(languages=["en"])
            def get_conditioning_latents(self, **kwargs):
                calls.append(kwargs)
                return "latent", "embedding"
            def inference(self, *args, **kwargs):
                return {"wav": np.array([0, .1], dtype=np.float32)}
        engine = worker.Engine("/unused")
        engine.model, engine.device = Model(), "cpu"
        with tempfile.TemporaryDirectory() as tmp:
            reference = Path(tmp) / "voice.wav"
            sf.write(reference, np.zeros(24000 * 4), 24000)
            request = {"action": "speak", "text": "Hello", "language": "en", "reference": str(reference)}
            self.assertTrue(engine.handle(request)["ok"])
            self.assertTrue(engine.handle(request)["ok"])
            self.assertEqual(len(calls), 1)
            sf.write(reference, np.zeros(100), 24000)
            with self.assertRaisesRegex(ValueError, "3–30"):
                engine.handle(request)

    def test_unknown_voice_language_and_nonfinite_audio_fail(self):
        import numpy as np
        class Model:
            speaker_manager = types.SimpleNamespace(speakers={"Voice": {"gpt_cond_latent": 1, "speaker_embedding": 2}})
            config = types.SimpleNamespace(languages=["ru"])
            def inference(self, *args, **kwargs):
                return {"wav": np.array([math.nan])}
        engine = worker.Engine("/unused")
        engine.model, engine.device = Model(), "cpu"
        for change in ({"language": "xx"}, {"voice": "missing"}, {}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                engine.handle({"action": "speak", "text": "Привет", "language": "ru", **change})


if __name__ == "__main__":
    unittest.main()
