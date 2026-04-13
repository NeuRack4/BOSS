"""
BGE-M3 기반 임베딩 생성 (BAAI/bge-m3)
1024차원 dense 벡터 → Supabase pgvector에 저장

sentence-transformers 라이브러리 사용.
모델은 최초 호출 시 HuggingFace에서 자동 다운로드 (~570MB).
CPU/GPU 자동 감지: CUDA 사용 가능 시 cuda로 실행.
"""
import asyncio
from functools import lru_cache

from sentence_transformers import SentenceTransformer

_MODEL_NAME = "BAAI/bge-m3"
DIMENSIONS = 1024


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    try:
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        device = "cpu"
    return SentenceTransformer(_MODEL_NAME, device=device)


def _encode_sync(texts: list[str]) -> list[list[float]]:
    model = _get_model()
    vectors = model.encode(
        texts,
        batch_size=12,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return [v.tolist() for v in vectors]


async def embed(texts: list[str]) -> list[list[float]]:
    """텍스트 리스트를 BGE-M3 dense 벡터로 변환 (비동기 래퍼)"""
    return await asyncio.to_thread(_encode_sync, texts)


async def embed_single(text: str) -> list[float]:
    vectors = await embed([text])
    return vectors[0]
