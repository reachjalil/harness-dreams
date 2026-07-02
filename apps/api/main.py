from datetime import datetime, timezone

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ingestion.pipeline import ingest_all
from synthesis.agent import synthesize
from voice.token import LIVEKIT_URL, create_participant_token

app = FastAPI(title="Harness Health API (local compatibility)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_jobs: dict[str, dict] = {}


class SynthesizeRequest(BaseModel):
    date: str | None = None


class JobStatus(BaseModel):
    job_id: str
    status: str
    date: str | None = None
    error: str | None = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context_date: str | None = None
    session_id: str | None = None


def retired_cloud_api() -> None:
    raise HTTPException(
        status_code=410,
        detail=(
            "The legacy FastAPI cloud review API is retired. Private Device "
            "Sync now keeps durable data on the Mac and uses Cloudflare only "
            "for ephemeral WebRTC signaling."
        ),
    )


async def _run_synthesis(job_id: str, date: str):
    try:
        result = await ingest_all(date)
        health_log = await synthesize(result, date)
        _jobs[job_id] = {
            "status": "done",
            "date": date,
            "health_log": health_log.model_dump(),
        }
    except Exception as e:
        _jobs[job_id] = {"status": "error", "date": date, "error": str(e)}


@app.post("/synthesize", response_model=JobStatus)
async def trigger_synthesis(req: SynthesizeRequest, background_tasks: BackgroundTasks):
    date = req.date or datetime.now(timezone.utc).date().isoformat()
    job_id = f"{date}-{datetime.now(timezone.utc).strftime('%H%M%S')}"
    _jobs[job_id] = {"status": "running", "date": date}
    background_tasks.add_task(_run_synthesis, job_id, date)
    return JobStatus(job_id=job_id, status="running", date=date)


@app.get("/synthesize/{job_id}", response_model=JobStatus)
async def get_synthesis_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatus(
        job_id=job_id,
        status=job["status"],
        date=job.get("date"),
        error=job.get("error"),
    )


@app.get("/health-reviews")
async def list_health_reviews():
    retired_cloud_api()


@app.get("/health-reviews/{date}")
async def get_health_review(date: str):
    retired_cloud_api()


@app.post("/chat")
async def chat(req: ChatRequest):
    retired_cloud_api()


@app.get("/chat/sessions")
async def list_chat_sessions(limit: int = 20):
    retired_cloud_api()


@app.get("/chat/sessions/{session_id}")
async def get_chat_session(session_id: str):
    retired_cloud_api()


@app.post("/voice/token")
async def voice_token():
    """Local token minting; Cloudflare exposes the production route."""
    token, room_name = create_participant_token()
    return {"token": token, "url": LIVEKIT_URL, "room": room_name}


@app.get("/health")
async def health():
    return {
        "gemini": bool(__import__("os").getenv("GEMINI_API_KEY")),
        "cloud_persistence": "cloudflare-agents",
    }
