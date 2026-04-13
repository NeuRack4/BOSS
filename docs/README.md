# docs/ — RAG 서식 문서 폴더

BOSS RAG 파이프라인이 이 폴더의 파일을 읽어 Supabase pgvector에 수집합니다.

## 이 폴더에 넣을 파일

| 파일명 예시                 | 출처                      | 카테고리 |
| --------------------------- | ------------------------- | -------- |
| `사업자등록_신청서.pdf`     | 국세청 홈택스 서식자료실  | license  |
| `휴게음식점_영업신고서.pdf` | 식품의약품안전처 / 정부24 | license  |
| `표준_근로계약서.pdf`       | 고용노동부                | labor    |
| `표준_임대차계약서.pdf`     | 법제처                    | lease    |
| `식품위생법_시행규칙.pdf`   | 국가법령정보센터          | license  |

## 지원 파일 형식

- `.pdf` — 정부 표준서식 (국세청, 식약처, 고용노동부 등)
- `.md` — 직접 작성한 서식 템플릿
- `.txt` — 텍스트 추출본

## 파일명 규칙 (카테고리 자동 감지)

| 파일명에 포함된 키워드           | 카테고리            |
| -------------------------------- | ------------------- |
| 사업자등록, 영업신고, 휴게음식점 | license             |
| 임대차, 임대                     | lease               |
| 근로계약, 고용, 노동             | labor               |
| 부가세, 세금, 소득세, 원천세     | tax                 |
| 지원사업, 공고, 기업마당         | subsidy             |
| 식품위생법, 법령, 시행규칙       | license (법령 원문) |

## 수집 방법

```bash
# 전체 폴더 수집
python -m backend.scripts.ingest_docs

# 특정 파일만 수집
python -m backend.scripts.ingest_docs --file docs/사업자등록_신청서.pdf
```

또는 API로 수집:

```
POST /rag/ingest/all
POST /rag/ingest/file  {"file_path": "docs/사업자등록_신청서.pdf"}
```
