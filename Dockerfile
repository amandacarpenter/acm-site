# ── Stage 1: Build the frontend ──────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: Runtime (Node + Python) ─────────────────────────────────────────
FROM node:20-slim
WORKDIR /app

# Install Python + pip
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv ffmpeg curl tesseract-ocr --no-install-recommends && rm -rf /var/lib/apt/lists/* \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Python deps via venv
# Pre-download Whisper base model at build time so first transcription is fast
COPY requirements.txt ./
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt
# Pre-download Whisper base model so first transcription doesn't time out
RUN python3 -c "import whisper; whisper.load_model('base')"

# Node deps (production only)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built app + server files
COPY --from=builder /app/dist ./dist
COPY transcribe_service.py transcribe_audio.py ./

# Start both services via a shell script
COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 5000
CMD ["./start.sh"]
