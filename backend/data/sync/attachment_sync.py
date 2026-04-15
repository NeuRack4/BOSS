"""
지원사업 첨부파일 수집 동기화

스케줄러가 매일 06:30 KST 에 호출.
subsidy_programs 중 첨부파일 미수집 공고를 순회하며 HWP 다운로드 → 텍스트 추출 → DB 저장.

설계 원칙:
  - 이미 parse_status='ok' 인 공고는 스킵 (캐시 재활용)
  - 요청 사이 1초 딜레이 (서버 부하 방지)
  - 개별 공고 실패는 로그만 남기고 계속 진행
"""
import asyncio
import logging

from backend.data.crawlers.bizinfo import fetch_attachments, download_attachment
from backend.db.client import get_supabase
from backend.rag.hwp_parser import extract_hwp_text

logger = logging.getLogger(__name__)


async def sync_attachments() -> dict:
    """
    첨부파일 미수집 공고 전체를 순회하며 HWP 수집.

    Returns:
        {"processed": int, "ok": int, "failed": int, "skipped": int}
    """
    supabase = get_supabase()

    # 첨부파일 수집 완료 program_id 목록
    done_res = (
        supabase.table("subsidy_attachments")
        .select("program_id")
        .eq("parse_status", "ok")
        .execute()
    )
    done_ids = {row["program_id"] for row in (done_res.data or [])}

    # detail_url 이 있는 공고만 대상
    prog_res = (
        supabase.table("subsidy_programs")
        .select("id, external_id, title, detail_url")
        .not_.is_("detail_url", "null")
        .order("id", desc=False)
        .limit(500)
        .execute()
    )
    programs = prog_res.data or []

    stats = {"processed": 0, "ok": 0, "failed": 0, "skipped": 0}

    for prog in programs:
        pid = prog["id"]

        if pid in done_ids:
            stats["skipped"] += 1
            continue

        stats["processed"] += 1
        logger.info(f"[attachment_sync] 공고 {pid} 수집 시작: {prog['title'][:40]}")

        success = await _process_program(supabase, prog)
        if success:
            stats["ok"] += 1
        else:
            stats["failed"] += 1

        await asyncio.sleep(1.0)  # 서버 부하 방지

    logger.info(f"[attachment_sync] 완료 {stats}")
    return stats


async def _process_program(supabase, prog: dict) -> bool:
    """단일 공고 첨부파일 수집. 성공 여부 반환."""
    pid = prog["id"]
    ext_id = prog["external_id"]
    detail_url = prog["detail_url"]

    try:
        attachments = await fetch_attachments(detail_url)
        hwp_items = [a for a in attachments if a["file_type"] == "hwp"]

        if not hwp_items:
            # 첨부파일 없음 — failed 로 기록해서 재시도 방지
            _upsert_attachment(
                supabase, pid,
                filename="(없음)", file_type="hwp",
                download_url=None, storage_path=None,
                raw_text=None, parse_status="failed",
            )
            return False

        item = hwp_items[0]
        raw_bytes = await download_attachment(item["download_url"])

        if not raw_bytes:
            _upsert_attachment(
                supabase, pid,
                filename=item["filename"], file_type=item["file_type"],
                download_url=item["download_url"], storage_path=None,
                raw_text=None, parse_status="failed",
            )
            return False

        # Supabase Storage 업로드
        storage_path = f"{ext_id}/{item['filename']}"
        try:
            supabase.storage.from_("subsidy-attachments").upload(
                storage_path,
                raw_bytes,
                {"content-type": "application/octet-stream", "upsert": "true"},
            )
        except Exception as e:
            logger.warning(f"[attachment_sync] Storage 업로드 실패 {pid}: {e}")

        # HWP 텍스트 추출
        hwp_text = extract_hwp_text(raw_bytes)
        parse_status = "ok" if hwp_text else "failed"

        _upsert_attachment(
            supabase, pid,
            filename=item["filename"], file_type=item["file_type"],
            download_url=item["download_url"], storage_path=storage_path,
            raw_text=hwp_text, parse_status=parse_status,
        )
        return parse_status == "ok"

    except Exception as e:
        logger.error(f"[attachment_sync] 공고 {pid} 처리 오류: {e}")
        return False


def _upsert_attachment(
    supabase, program_id: int,
    filename: str, file_type: str,
    download_url, storage_path, raw_text, parse_status: str,
):
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
        logger.warning(f"[attachment_sync] DB upsert 실패 {program_id}: {e}")
