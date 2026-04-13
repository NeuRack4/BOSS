"""
OpenAI text-embedding-3-small 기반 임베딩 생성
1536차원 벡터 → Supabase pgvector에 저장
"""
from openai import AsyncOpenAI
from backend.core.config import get_settings

_MODEL = "text-embedding-3-small"
_DIMENSIONS = 1536


async def embed(texts: list[str]) -> list[list[float]]:
    """텍스트 리스트를 임베딩 벡터로 변환"""
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    response = await client.embeddings.create(
        model=_MODEL,
        input=texts,
        dimensions=_DIMENSIONS,
    )
    return [item.embedding for item in response.data]


async def embed_single(text: str) -> list[float]:
    vectors = await embed([text])
    return vectors[0]
