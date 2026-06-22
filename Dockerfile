# ---- ซับไทย AI (Klipr clone) — production image ----
# Bundles Node, FFmpeg, Python+Whisper, Thai fonts, and optional tools.
FROM node:22-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    PORT=3000 \
    PYTHON_BIN=python3 \
    WHISPER_MODEL=base \
    HF_HOME=/app/.hfcache \
    HF_HUB_DISABLE_TELEMETRY=1

# System deps: ffmpeg (encode/burn), python (Whisper), Thai + Noto fonts (libass)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      python3-pip \
      fonts-thai-tlwg \
      fonts-noto-core \
      fonts-noto-color-emoji \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Python deps: Whisper (required) + face-reframe + YouTube import (optional)
RUN pip3 install --no-cache-dir --break-system-packages \
      faster-whisper \
      opencv-python-headless \
      yt-dlp

# Pre-download the Whisper model into the image so the first transcription does
# NOT fetch it from HuggingFace at runtime (avoids the model download being
# killed / OOM and slow cold starts). Keep 'base' in sync with WHISPER_MODEL.
RUN python3 -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')"

WORKDIR /app

# Install node deps first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Build the Next.js app
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
