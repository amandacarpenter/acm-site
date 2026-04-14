"""
Transcription microservice. Called by the Node backend via HTTP.
Runs on port 5001.
"""
import base64
import asyncio
import sys
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add transcribe_audio helper
sys.path.insert(0, os.path.dirname(__file__))
from transcribe_audio import transcribe_audio

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class TranscribeRequest(BaseModel):
    audio_b64: str
    media_type: str = "audio/mpeg"

@app.post("/transcribe")
async def transcribe(req: TranscribeRequest):
    try:
        audio_bytes = base64.b64decode(req.audio_b64)
        result = await transcribe_audio(
            audio_bytes,
            media_type=req.media_type,
            timestamps="word",
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5001)
