import json
import os
import sys
import warnings
from pathlib import Path

import torch
import torchaudio as ta

warnings.filterwarnings(
    "ignore",
    message="pkg_resources is deprecated as an API.",
)

from chatterbox.tts import ChatterboxTTS


def detect_device() -> str:
    preferred = os.environ.get("CHATTERBOX_DEVICE", "mps")

    if preferred == "mps" and torch.backends.mps.is_available():
        return "mps"

    if preferred == "cpu":
        return "cpu"

    if torch.backends.mps.is_available():
        return "mps"

    return "cpu"


def patch_torch_load(device: str) -> None:
    map_location = torch.device(device)
    original_torch_load = torch.load

    def patched_torch_load(*args, **kwargs):
        kwargs.setdefault("map_location", map_location)
        return original_torch_load(*args, **kwargs)

    torch.load = patched_torch_load


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(
            "Usage: generate_sales_pitch_voiceover_chatterbox.py <lines-json> <output-dir>"
        )

    lines_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)

    with lines_path.open("r", encoding="utf-8") as file:
        lines = json.load(file)

    device = detect_device()
    exaggeration = float(os.environ.get("CHATTERBOX_EXAGGERATION", "0.55"))
    cfg_weight = float(os.environ.get("CHATTERBOX_CFG_WEIGHT", "0.45"))

    patch_torch_load(device)
    print(f"using chatterbox device: {device}", flush=True)
    print(
        f"using chatterbox settings: exaggeration={exaggeration} cfg_weight={cfg_weight}",
        flush=True,
    )

    model = ChatterboxTTS.from_pretrained(device=device)

    for line in lines:
        output_path = output_dir / f"{line['id']}.wav"
        print(f"synthesizing {line['id']}", flush=True)
        wav = model.generate(
            line["text"],
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )
        ta.save(str(output_path), wav, model.sr)


if __name__ == "__main__":
    main()
