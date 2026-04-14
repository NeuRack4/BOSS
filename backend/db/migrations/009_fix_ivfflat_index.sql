-- ivfflat (lists=100) + 기본 probes=1 설정으로 100개 클러스터 중 1개만 탐색하는 문제.
-- 카테고리 필터가 붙는 벡터 검색에서 특정 카테고리 문서가 다른 클러스터에 있으면
-- 결과 0건이 반환되는 cluster miss 발생.
-- HNSW 인덱스로 교체 — 제한된 검색에서도 안정적인 recall 보장.

DROP INDEX IF EXISTS law_chunks_embedding_idx;

CREATE INDEX law_chunks_embedding_idx
  ON law_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
