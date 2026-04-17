"""
네이버 블로그 자동 업로드
stdlib subprocess.run()으로 별도 Python 프로세스를 실행합니다.
Windows + uvicorn asyncio 이벤트 루프 충돌을 완전히 우회합니다.
"""

import sys
import json
import asyncio
import subprocess
from pathlib import Path

_RUNNER = Path(__file__).parent / "naver_blog_runner.py"


def _run_subprocess(content: str, blog_id: str, blog_pw: str) -> str:
    """stdlib subprocess.run()으로 runner 스크립트를 실행합니다."""
    payload = json.dumps({"content": content, "blog_id": blog_id, "blog_pw": blog_pw})
    result = subprocess.run(
        [sys.executable, str(_RUNNER)],
        input=payload,
        capture_output=True,
        text=True,
        timeout=120,
    )
    output = result.stdout.strip()
    if not output:
        stderr = result.stderr.strip()
        raise RuntimeError(f"업로드 프로세스 오류: {stderr or '알 수 없는 오류'}")
    data = json.loads(output)
    if "error" in data:
        raise RuntimeError(data["error"])
    return data["url"]


async def upload_to_naver_blog(content: str, blog_id: str, blog_pw: str) -> str:
    """
    별도 프로세스에서 Playwright를 실행해 네이버 블로그에 업로드합니다.
    uvicorn Windows 환경의 asyncio 이벤트 루프 제한을 완전히 우회합니다.
    """
    if not blog_id or not blog_pw:
        raise ValueError("네이버 블로그 아이디와 비밀번호를 .env에 설정하세요. (NAVER_BLOG_ID, NAVER_BLOG_PW)")

    return await asyncio.to_thread(_run_subprocess, content, blog_id, blog_pw)
