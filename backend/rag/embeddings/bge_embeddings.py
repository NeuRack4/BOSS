"""
BGE-M3 기반 임베딩 생성 (BAAI/bge-m3)
1024차원 dense 벡터 → Supabase pgvector에 저장

sentence-transformers 라이브러리 사용.
모델은 최초 호출 시 HuggingFace에서 자동 다운로드 (~570MB).
CPU/GPU 자동 감지: CUDA 사용 가능 시 cuda로 실행.
"""
import asyncio
import threading
from functools import lru_cache

from sentence_transformers import SentenceTransformer

_MODEL_NAME = "BAAI/bge-m3"
DIMENSIONS = 1024
_ENCODE_LOCK = threading.Lock()  # SentenceTransformer는 멀티스레드 안전하지 않음


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    try:
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        device = "cpu"
    return SentenceTransformer(_MODEL_NAME, device=device)


def _encode_sync(texts: list[str]) -> list[list[float]]:
    with _ENCODE_LOCK:
        model = _get_model()

        try:
            import torch
            use_cuda = torch.cuda.is_available()
        except ImportError:
            use_cuda = False

        results = []
        # VRAM OOM 방지: 텍스트 하나씩 처리 후 캐시 비우기
        for text in texts:
            vec = model.encode(
                [text],
                batch_size=1,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            results.append(vec[0].tolist())
            if use_cuda:
                import torch
                torch.cuda.empty_cache()

        return results


async def embed(texts: list[str]) -> list[list[float]]:
    """텍스트 리스트를 BGE-M3 dense 벡터로 변환 (비동기 래퍼)"""
    return await asyncio.to_thread(_encode_sync, texts)


async def embed_single(text: str) -> list[float]:
    vectors = await embed([text])
    return vectors[0]
