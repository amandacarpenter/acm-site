# ── Stage 1: Build the frontend ──────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Pass Railway service variables through as Vite build-time env vars.
# Railway auto-populates any declared ARG with a matching-name service variable.
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
RUN npm run build

# ── Stage 2: Runtime (Node + Python) ─────────────────────────────────────────
FROM node:20-slim
WORKDIR /app

# Install Python + pip
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv ffmpeg curl tesseract-ocr fonts-dejavu-core libjpeg-dev zlib1g-dev libpng-dev libpango-1.0-0 libpangoft2-1.0-0 libffi-dev libgdk-pixbuf2.0-0 shared-mime-info --no-install-recommends && rm -rf /var/lib/apt/lists/* \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Python deps via venv
# Pre-download Whisper base model at build time so first transcription is fast
COPY requirements.txt ./
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt

# Node deps (production only)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built app + server files
COPY --from=builder /app/dist ./dist
COPY transcribe_service.py transcribe_audio.py complexpdf_pipeline.py ./
# Copy bundled fonts for PDF generation (DejaVu for Unicode support)
COPY fonts/ ./fonts/

# Start both services via a shell script
COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 5000
# Force rebuild to pick up new env vars 2026-06-18
CMD ["./start.sh"]
