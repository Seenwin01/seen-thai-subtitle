#!/usr/bin/env python3
"""
Thai speech-to-text with word-level timestamps using faster-whisper (local).

Usage:
    python scripts/transcribe.py <input_video_or_audio> <output_json> [model] [language]

Output JSON shape:
{
  "language": "th",
  "duration": 12.34,
  "segments": [
    {"id": 0, "start": 0.0, "end": 2.1, "text": "สวัสดีครับ",
     "words": [{"start": 0.0, "end": 0.4, "text": "สวัสดี"}, ...]}
  ]
}

Requires: faster-whisper, and ffmpeg available on PATH.
Install: pip install faster-whisper
"""
import json
import sys


def main():
    if len(sys.argv) < 3:
        print("usage: transcribe.py <input> <output.json> [model] [language]",
              file=sys.stderr)
        sys.exit(2)

    inp = sys.argv[1]
    out = sys.argv[2]
    model_name = sys.argv[3] if len(sys.argv) > 3 else "small"
    language = sys.argv[4] if len(sys.argv) > 4 else "th"

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            "faster-whisper not installed. Run: pip install faster-whisper",
            file=sys.stderr,
        )
        sys.exit(3)

    # device auto: use CUDA if available, else CPU with int8 for speed.
    device = "cpu"
    compute_type = "int8"
    try:
        import torch  # noqa

        if torch.cuda.is_available():
            device = "cuda"
            compute_type = "float16"
    except Exception:
        pass

    model = WhisperModel(model_name, device=device, compute_type=compute_type)

    segments_iter, info = model.transcribe(
        inp,
        language=language,
        word_timestamps=True,
        vad_filter=True,
        beam_size=5,
    )

    total = max(float(getattr(info, "duration", 0) or 0), 0.001)
    segments = []
    for i, seg in enumerate(segments_iter):
        pct = min(99.0, (float(seg.end) / total) * 100.0)
        print(f"PROGRESS {pct:.1f}", file=sys.stderr, flush=True)
        words = []
        for w in (seg.words or []):
            txt = (w.word or "").strip()
            if not txt:
                continue
            words.append(
                {"start": round(w.start, 3), "end": round(w.end, 3), "text": txt}
            )
        segments.append(
            {
                "id": i,
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": seg.text.strip(),
                "words": words,
            }
        )

    result = {
        "language": info.language,
        "duration": round(info.duration, 3),
        "segments": segments,
    }

    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)

    print(f"ok: {len(segments)} segments", file=sys.stderr)


if __name__ == "__main__":
    main()
