"""Local-only JSON-lines XTTS worker. No HTTP server and no runtime downloads."""
import argparse
import base64
from contextlib import redirect_stdout
import io
import json
import math
import os
from pathlib import Path
import sys
import wave

MODEL = "tts_models/multilingual/multi-dataset/xtts_v2"
MODEL_FOLDER = "tts_models--multilingual--multi-dataset--xtts_v2"


def number(request, key, default, low, high):
    value = request.get(key, default)
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f"Invalid {key}.")
    return value


def validate(request):
    if request.get("action") not in ("status", "speak"):
        raise ValueError("Unknown XTTS action.")
    if request["action"] == "speak":
        text = request.get("text")
        if not isinstance(text, str) or not text.strip() or len(text) > 12000:
            raise ValueError("XTTS requires 1–12000 characters.")
        number(request, "speed", 1.0, 0.5, 2.0)
        number(request, "temperature", 0.65, 0.1, 1.0)
    if request.get("device", "cpu") not in ("cpu", "cuda"):
        raise ValueError("Choose CPU or CUDA.")


class Engine:
    def __init__(self, root):
        self.root = Path(root)
        self.model_dir = self.root / "models" / "tts" / MODEL_FOLDER
        self.model = None
        self.device = None
        self.conditioning = None
        self.reference_key = None

    def load(self, device):
        if self.model is not None and self.device == device:
            return
        import torch
        from TTS.tts.configs.xtts_config import XttsConfig
        from TTS.tts.models.xtts import Xtts
        if device == "cuda" and not torch.cuda.is_available():
            raise ValueError("CUDA is unavailable. Select CPU or install the CUDA runtime.")
        for name in ("config.json", "model.pth", "vocab.json", "speakers_xtts.pth"):
            if not (self.model_dir / name).is_file():
                raise ValueError("XTTS model is incomplete. Install or repair it in Speech settings.")
        config = XttsConfig()
        config.load_json(str(self.model_dir / "config.json"))
        model = Xtts(config)
        model.load_checkpoint(config, checkpoint_dir=str(self.model_dir), eval=True)
        model.to(device)
        self.model, self.device = model, device
        self.conditioning, self.reference_key = None, None

    def handle(self, request):
        validate(request)
        self.load(request.get("device", "cpu"))
        speakers = self.model.speaker_manager.speakers
        if request["action"] == "status":
            return {"ok": True, "voices": [{"id": name, "name": name} for name in speakers],
                    "languages": self.model.config.languages, "device": self.device}
        language = request.get("language", "").lower().split("-")[0]
        if language == "zh":
            language = "zh-cn"
        if language not in self.model.config.languages:
            raise ValueError("This language is not supported by XTTS v2.")
        reference = request.get("reference")
        if reference:
            reference = Path(reference)
            if reference.suffix.lower() != ".wav" or not reference.is_file() or reference.stat().st_size > 20 * 1024 * 1024:
                raise ValueError("Choose a WAV voice sample under 20 MB.")
            import soundfile as sf
            info = sf.info(str(reference))
            if not 3 <= info.duration <= 30:
                raise ValueError("Use a clean voice sample lasting 3–30 seconds.")
            key = (str(reference), reference.stat().st_mtime_ns)
            if key != self.reference_key:
                self.conditioning = self.model.get_conditioning_latents(audio_path=[str(reference)])
                self.reference_key = key
            latent, embedding = self.conditioning
        else:
            voice = request.get("voice") or next(iter(speakers))
            if voice not in speakers:
                raise ValueError("Selected XTTS voice is unavailable. Refresh the voice list.")
            latent = speakers[voice]["gpt_cond_latent"]
            embedding = speakers[voice]["speaker_embedding"]
        result = self.model.inference(request["text"].strip(), language, latent, embedding,
                                      speed=request.get("speed", 1.0),
                                      temperature=request.get("temperature", 0.65),
                                      enable_text_splitting=True)
        import numpy as np
        audio = np.asarray(result["wav"], dtype=np.float32)
        if not audio.size or not np.isfinite(audio).all() or audio.size > 24000 * 600:
            raise ValueError("XTTS returned invalid or excessively long audio.")
        pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes()
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(24000)
            wav.writeframes(pcm)
        return {"ok": True, "audio": base64.b64encode(buffer.getvalue()).decode("ascii")}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    os.environ.update(HF_HUB_DISABLE_TELEMETRY="1", DO_NOT_TRACK="1")
    if args.download:
        from TTS.utils.manage import ModelManager
        ModelManager(output_prefix=str(Path(args.root) / "models"), progress_bar=False).download_model(MODEL)
        # Confirm that downloaded weights actually load before advertising readiness.
        Engine(args.root).load("cpu")
        return
    os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1")
    engine = Engine(args.root)
    for line in sys.stdin:
        try:
            if len(line) > 200000:
                raise ValueError("XTTS request is too large.")
            # Libraries print progress; keep the IPC stdout channel JSON-only.
            with redirect_stdout(sys.stderr):
                result = engine.handle(json.loads(line))
        except Exception as error:
            result = {"ok": False, "error": str(error)[:1000]}
        print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
