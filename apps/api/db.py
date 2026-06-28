import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from dotenv import load_dotenv

load_dotenv()

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        uri = os.environ["MONGODB_URI"]
        _client = AsyncIOMotorClient(uri)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    db_name = os.getenv("MONGODB_DB", "dream")
    return get_client()[db_name]


async def ensure_indexes():
    db = get_db()
    # Only dream_logs is persisted — all other data stays on local disk
    await db.dream_logs.create_index([("date", 1)], unique=True)
