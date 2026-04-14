#!/bin/sh
# Start Python transcription microservice in background
python3 transcribe_service.py &

# Start Node/Express main server (foreground)
NODE_ENV=production node dist/index.cjs
