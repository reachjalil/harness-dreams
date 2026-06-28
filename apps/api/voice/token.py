"""Generate LiveKit participant tokens for the local dev server."""
import uuid
from livekit.api import AccessToken, VideoGrants

LIVEKIT_URL = "ws://localhost:7880"
API_KEY = "devkey"
API_SECRET = "secret"
ROOM_NAME = "dream-voice"


def create_participant_token() -> str:
    identity = f"user-{uuid.uuid4().hex[:8]}"
    token = (
        AccessToken(api_key=API_KEY, api_secret=API_SECRET)
        .with_identity(identity)
        .with_name("User")
        .with_grants(
            VideoGrants(
                room_join=True,
                room=ROOM_NAME,
                can_publish=True,
                can_subscribe=True,
            )
        )
    )
    return token.to_jwt()
