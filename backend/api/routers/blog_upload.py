import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.core.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter()


class BlogUploadRequest(BaseModel):
    content: str


@router.post("/marketing/blog/upload-naver")
async def upload_naver_blog(req: BlogUploadRequest):
    """생성된 블로그 콘텐츠를 네이버 블로그에 자동 업로드합니다."""
    settings = get_settings()
    try:
        from backend.automation.naver_blog import upload_to_naver_blog
        post_url = await upload_to_naver_blog(
            req.content,
            blog_id=settings.naver_blog_id,
            blog_pw=settings.naver_blog_pw,
        )
        return {"success": True, "post_url": post_url}
    except ImportError as e:
        logger.error("Playwright ImportError: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Playwright가 설치되지 않았습니다. 'pip install playwright && playwright install chromium'을 실행하세요.",
        )
    except ValueError as e:
        logger.error("ValueError: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("업로드 오류 (%s): %s", type(e).__name__, e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"[{type(e).__name__}] {e}")
