"""
지원사업 첨부파일 일괄 수집 스크립트

subsidy_programs 전체를 순회하며:
  - detail_url 스크래핑 → HWP 링크 추출
  - HWP 다운로드 → Supabase Storage 저장
  - hwp5 텍스트 추출 → subsidy_attachments 저장

사용:
  python -m backend.scripts.fetch_subsidy_attachments
"""
import asyncio
import logging
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

from backend.data.crawlers.bizinfo import fetch_attachments, download_attachment
from backend.db.client import get_supabase
from backend.rag.hwp_parser import extract_hwp_text


async def run():
    supabase = get_supabase()

    # 전체 공고 조회
    res = (
        supabase.table("subsidy_programs")
        .select("id, external_id, title, detail_url")
        .not_.is_("detail_url", "null")
        .order("id")
        .execute()
    )
    programs = res.data or []
    logger.info(f"총 {len(programs)}개 공고 처리 시작")

    # 이미 수집 완료된 program_id
    done_res = (
        supabase.table("subsidy_attachments")
        .select("program_id")
        .eq("parse_status", "ok")
        .execute()
    )
    done_ids = {r["program_id"] for r in (done_res.data or [])}
    logger.info(f"이미 수집 완료: {len(done_ids)}개 스킵")

    stats = {"ok": 0, "no_hwp": 0, "failed": 0, "skipped": 0}

    for i, prog in enumerate(programs, 1):
        pid = prog["id"]
        title = prog["title"][:35]

        if pid in done_ids:
            stats["skipped"] += 1
            continue

        logger.info(f"[{i}/{len(programs)}] {pid} {title}")

        try:
            attachments = await fetch_attachments(prog["detail_url"])
            hwp_items = [a for a in attachments if a["file_type"] == "hwp"]

            if not hwp_items:
                logger.info(f"  → HWP 없음")
                _save(supabase, pid, "(없음)", "hwp", None, None, None, "failed")
                stats["no_hwp"] += 1
                await asyncio.sleep(0.5)
                continue

            item = hwp_items[0]
            logger.info(f"  → {item['filename']} 다운로드 중")

            raw = await download_attachment(item["download_url"])
            if not raw:
                logger.warning(f"  → 다운로드 실패")
                _save(supabase, pid, item["filename"], item["file_type"],
                      item["download_url"], None, None, "failed")
                stats["failed"] += 1
                await asyncio.sleep(0.5)
                continue

            # Storage 업로드
            storage_path = f"{prog['external_id']}/{item['filename']}"
            try:
                supabase.storage.from_("subsidy-attachments").upload(
                    storage_path, raw,
                    {"content-type": "application/octet-stream", "upsert": "true"},
                )
                logger.info(f"  → Storage 업로드 완료")
            except Exception as e:
                logger.warning(f"  → Storage 업로드 실패: {e}")
                storage_path = None

            # 텍스트 추출
            text = extract_hwp_text(raw)
            status = "ok" if text else "failed"
            logger.info(f"  → 텍스트 {len(text)}자 추출 ({status})")

            _save(supabase, pid, item["filename"], item["file_type"],
                  item["download_url"], storage_path, text, status)

            if status == "ok":
                stats["ok"] += 1
            else:
                stats["failed"] += 1

        except Exception as e:
            logger.error(f"  → 오류: {e}")
            stats["failed"] += 1

        await asyncio.sleep(1.0)

    logger.info(
        f"\n완료 — 성공: {stats['ok']}, HWP없음: {stats['no_hwp']}, "
        f"실패: {stats['failed']}, 스킵: {stats['skipped']}"
    )


def _save(supabase, program_id, filename, file_type,
          download_url, storage_path, raw_text, parse_status):
    try:
        supabase.table("subsidy_attachments").upsert(
            {
                "program_id": program_id,
                "filename": filename,
                "file_type": file_type,
                "download_url": download_url,
                "storage_path": storage_path,
                "raw_text": raw_text,
                "parse_status": parse_status,
            },
            on_conflict="program_id,filename",
        ).execute()
    except Exception as e:
        logger.warning(f"DB 저장 실패 {program_id}: {e}")


if __name__ == "__main__":
    asyncio.run(run())
