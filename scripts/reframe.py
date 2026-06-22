#!/usr/bin/env python3
"""
Estimate the horizontal focal point of a video using face detection so it can
be cropped to 9:16 vertical while keeping faces in frame.

Usage:
    python scripts/reframe.py <input_video>

Prints JSON to stdout: {"center_x": 0.5, "faces": 123}
center_x is the normalised (0..1) average horizontal position of detected faces.
Falls back to 0.5 (centre) when no faces are found.

Requires: opencv-python (cv2). If unavailable, exits non-zero so the caller
can fall back to a plain centre crop.
"""
import json
import sys


def main():
    if len(sys.argv) < 2:
        print("usage: reframe.py <input_video>", file=sys.stderr)
        sys.exit(2)

    try:
        import cv2
    except ImportError:
        print("opencv not installed", file=sys.stderr)
        sys.exit(3)

    path = sys.argv[1]
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        print("cannot open video", file=sys.stderr)
        sys.exit(4)

    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    # sample ~2 frames per second
    step = max(1, int(fps / 2))

    centers = []
    idx = 0
    sampled = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if idx % step == 0:
            sampled += 1
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = cascade.detectMultiScale(gray, 1.1, 5, minSize=(40, 40))
            h, w = gray.shape[:2]
            for (x, y, fw, fh) in faces:
                centers.append((x + fw / 2) / w)
        idx += 1
        if sampled > 600:  # cap work on long videos
            break

    cap.release()

    if centers:
        centers.sort()
        center_x = centers[len(centers) // 2]  # median
    else:
        center_x = 0.5

    print(json.dumps({"center_x": round(center_x, 4), "faces": len(centers)}))


if __name__ == "__main__":
    main()
