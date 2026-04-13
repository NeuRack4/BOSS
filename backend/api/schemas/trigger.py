from pydantic import BaseModel
from datetime import datetime
from backend.core.constants import TriggerType


class TriggerLogResponse(BaseModel):
    id: int
    user_id: str
    trigger_type: TriggerType
    message: str
    draft_url: str | None
    sent_at: datetime
    read_at: datetime | None
