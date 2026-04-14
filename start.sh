#!/bin/sh
# Start Python transcription microservice in background
/opt/venv/bin/python transcribe_service.py &

# Start Node/Express main server (foreground)
NODE_ENV=production node dist/index.cjs
