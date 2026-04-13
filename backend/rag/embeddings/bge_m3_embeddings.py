"""
BAAI/bge-m3 로컬 임베딩 (sentence-transformers + GPU)
- 1024차원 벡터 → Supabase pgvector에 저장
- GPU 있으면 자동으로 CUDA 사용, 없으면 CPU fallback
- 모델은 최초 1회만 로드 후 재사용 (싱글턴)
"""
import asyncio
from functools import lru_cache

import torch
from sentence_transformers import SentenceTransformer

_MODEL_NAME = "BAAI/bge-m3"
DIMENSIONS = 1024
_BATCH_SIZE = 32


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    return SentenceTransformer(_MODEL_NAME, device=device)


async def embed(texts: list[str]) -> list[list[float]]:
    """텍스트 리스트 → 1024차원 임베딩 벡터 리스트"""
    model = _get_model()
    loop = asyncio.get_event_loop()
    vectors = await loop.run_in_executor(
        None,
        lambda: model.encode(
            texts,
            normalize_embeddings=True,
            batch_size=_BATCH_SIZE,
            show_progress_bar=False,
        ).tolist(),
    )
    return vectors


async def embed_single(text: str) -> list[float]:
    vectors = await embed([text])
    return vectors[0]
