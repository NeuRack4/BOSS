from pydantic import BaseModel
from datetime import datetime
from backend.core.constants import DraftType


class DraftResponse(BaseModel):
    id: int
    user_id: str
    type: DraftType
    storage_path: str
    metadata: dict
    created_at: datetime
