from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel

from db import get_db, ensure_indexes
from ingestion.pipeline import ingest_all
from synthesis.agent import synthesize
from synthesis.schema import DreamLog


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_indexes()
    yield


app = FastAPI(title="Dream API", lifespan=lifespan)

# In-memory job tracker
_jobs: dict[str, dict] = {}


class SynthesizeRequest(BaseModel):
    date: str | None = None  # YYYY-MM-DD, defaults to today


class JobStatus(BaseModel):
    job_id: str
    status: str        # running | done | error
    date: str | None = None
    error: str | None = None


async def _run_synthesis(job_id: str, date: str):
    try:
        result = await ingest_all(date)
        dream_log = await synthesize(result, date)
        _jobs[job_id] = {"status": "done", "date": date, "dream_log": dream_log.model_dump()}
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


@app.get("/dreams", response_model=list[dict])
async def list_dreams():
    db = get_db()
    docs = await db.dream_logs.find(
        {}, {"date": 1, "alignment_score": 1, "alignment_label": 1, "synthesized_at": 1}
    ).sort("date", -1).to_list(30)
    for d in docs:
        d.pop("_id", None)
    return docs


@app.get("/dreams/{date}", response_model=DreamLog)
async def get_dream(date: str):
    db = get_db()
    doc = await db.dream_logs.find_one({"date": date})
    if not doc:
        raise HTTPException(status_code=404, detail=f"No dream log for {date}")
    doc.pop("_id", None)
    doc.pop("synthesized_at", None)
    return DreamLog(**doc)


@app.get("/health")
async def health():
    status = {"gemini": False, "mongodb": False}
    try:
        db = get_db()
        await db.command("ping")
        status["mongodb"] = True
    except Exception:
        pass
    status["gemini"] = bool(__import__("os").getenv("GEMINI_API_KEY"))
    return status
