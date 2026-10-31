"""Install an isolated XTTS runtime; model terms must be accepted in Hina first."""
import argparse
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import venv


def install(root, device, accepted):
    if not accepted:
        raise ValueError("Read and accept the XTTS model license before downloading.")
    if not (3, 10) <= sys.version_info[:2] <= (3, 12) or struct.calcsize("P") != 8:
        raise ValueError("Install Python 3.10–3.12 (64-bit), then retry.")
    root = Path(root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    env_dir = root / "runtime"
    venv.EnvBuilder(with_pip=True).create(env_dir)
    python = env_dir / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    subprocess.run([str(python), "-m", "pip", "install", "--disable-pip-version-check",
                    "--upgrade", "--force-reinstall", "torch==2.8.0", "torchaudio==2.8.0", "--index-url",
                    "https://download.pytorch.org/whl/" + ("cu128" if device == "cuda" else "cpu")], check=True)
    subprocess.run([str(python), "-m", "pip", "install", "--disable-pip-version-check",
                    "-r", str(Path(__file__).with_name("requirements.txt"))], check=True)
    env = dict(os.environ, COQUI_TOS_AGREED="1", HF_HUB_OFFLINE="0", TRANSFORMERS_OFFLINE="0", HF_HUB_DISABLE_TELEMETRY="1", DO_NOT_TRACK="1")
    subprocess.run([str(python), "-X", "utf8", str(Path(__file__).with_name("worker.py")),
                    "--root", str(root), "--download"], env=env, check=True)
    # Write readiness only after dependencies, verified download and a model load succeed.
    tmp = root / "installed.tmp"
    tmp.write_text(json.dumps({"version": 1, "device": device}), encoding="utf-8")
    tmp.replace(root / "installed.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--device", choices=["cpu", "cuda"], default="cpu")
    parser.add_argument("--accept-license", action="store_true")
    args = parser.parse_args()
    try:
        install(args.root, args.device, args.accept_license)
    except Exception as error:
        print(f"XTTS installation failed: {error}", file=sys.stderr)
        sys.exit(1)
