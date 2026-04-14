"""
Audio transcription via ElevenLabs Speech-to-Text API.
Requires ELEVENLABS_API_KEY environment variable (falls back to PPLX_API_KEY).
"""
import os
import base64
import httpx

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("PPLX_API_KEY", "")

async def transcribe_audio(
    audio_bytes: bytes,
    *,
    media_type: str = "audio/mpeg",
    timestamps: str = "none",
    diarize: bool = False,
    num_speakers: int | None = None,
    language: str | None = None,
    model: str = "scribe_v1",
) -> dict:
    """Transcribe audio using ElevenLabs Speech-to-Text API."""
    ext_map = {
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/mp4": "mp4",
        "audio/wav": "wav",
        "audio/wave": "wav",
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "video/mp4": "mp4",
        "video/webm": "webm",
    }
    ext = ext_map.get(media_type, "mp3")
    filename = f"audio.{ext}"

    data = {"model_id": model}
    if diarize:
        data["diarize"] = "true"
    if timestamps != "none":
        data["timestamps_granularity"] = timestamps
    if num_speakers:
        data["num_speakers"] = str(num_speakers)
    if language:
        data["language_code"] = language

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            headers={"xi-api-key": ELEVENLABS_API_KEY},
            data=data,
            files={"file": (filename, audio_bytes, media_type)},
        )
        if response.status_code != 200:
            raise RuntimeError(f"ElevenLabs API error {response.status_code}: {response.text}")

        result = response.json()

    words = []
    for w in result.get("words", []):
        words.append({
            "text": w.get("text", ""),
            "start": w.get("start", 0),
            "end": w.get("end", 0),
            "speaker_id": w.get("speaker_id"),
        })

    return {
        "text": result.get("text", ""),
        "language_code": result.get("language_code", ""),
        "words": words,
    }
