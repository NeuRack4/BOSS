# 네이버 블로그 업로드 실행 스크립트 (독립 프로세스용)
import sys
import json
import re
import base64
import subprocess
import time
from pathlib import Path

COOKIE_PATH = Path(__file__).parent / "naver_cookies.json"

_JS_CLICK_SEL = "(selector) => { const el = document.querySelector(selector); if (el) { el.click(); return true; } return false; }"
_JS_CLICK_TEXT = "(text) => { const btns = [...document.querySelectorAll('button')]; const el = btns.find(b => b.innerText.trim().includes(text)); if (el) { el.click(); return true; } return false; }"


def set_clipboard(text: str) -> None:
    """Base64 → UTF-16LE 경유로 한글 텍스트를 안전하게 Windows 클립보드에 씁니다."""
    b64 = base64.b64encode(text.encode("utf-16-le")).decode("ascii")
    ps_cmd = (
        "Add-Type -AssemblyName System.Windows.Forms; "
        f"$bytes = [Convert]::FromBase64String('{b64}'); "
        "$str = [Text.Encoding]::Unicode.GetString($bytes); "
        "[Windows.Forms.Clipboard]::SetText($str)"
    )
    subprocess.run(
        ["powershell", "-sta", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
        capture_output=True,
        timeout=15,
    )


def paste_text(page, text: str) -> None:
    """클립보드에 쓰고 Ctrl+V로 붙여넣기."""
    set_clipboard(text)
    time.sleep(0.3)
    page.keyboard.press("Control+v")
    time.sleep(0.4)


def strip_markdown(text: str) -> str:
    """마크다운 문법을 제거하고 평문으로 변환합니다."""
    text = re.sub(r"```[\s\S]*?```", "", text)
    text = re.sub(r"~~~[\s\S]*?~~~", "", text)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\*{3}(.+?)\*{3}", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"\*{2}(.+?)\*{2}", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"\*(.+?)\*", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"_{2}(.+?)_{2}", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"_(.+?)_", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"`(.+?)`", r"\1", text)
    text = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", text)
    text = re.sub(r"!\[.*?\]\(.+?\)", "", text)
    text = re.sub(r"^>\s?", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_content(raw: str) -> tuple[str, list[tuple[str, str]], list[str]]:
    """
    LLM이 생성한 블로그 콘텐츠를 파싱합니다.
    반환: (title, segments, tags)
      segments = [("subheading"|"body", text), ...] — 순서대로 입력
    """
    # LLM이 섹션 레이블로 쓰는 단어 → 해당 줄 스킵
    SKIP_LABELS = {
        "제목", "본문", "태그", "태그 추천", "해시태그", "소개", "내용",
        "블로그 포스팅", "포스팅 초안", "네이버 블로그 포스팅", "네이버 블로그",
    }
    META_KEYWORDS = ["포스팅 초안", "블로그 초안", "네이버 블로그", "초안"]

    lines = raw.strip().splitlines()
    title = ""
    segments: list[tuple[str, str]] = []
    tags: list[str] = []
    mode = "body"  # body | title_next | tags_next

    for line in lines:
        s = line.strip()

        # ── 빈 줄 → 단락 구분자 (연속 빈 줄 하나로 합침)
        if not s:
            if segments and segments[-1][0] != "blank":
                segments.append(("blank", ""))
            continue

        # ── 해시태그 라인 (#단어 #단어 ...)
        if re.match(r"^(#[\w가-힣A-Za-z]+\s*)+$", s):
            tags = re.findall(r"#([\w가-힣A-Za-z]+)", s)
            mode = "body"
            continue

        # ── # 레벨 헤딩
        if s.startswith("# "):
            candidate = s[2:].strip()
            if any(kw in candidate for kw in META_KEYWORDS) or candidate in SKIP_LABELS:
                continue
            if not title:
                title = strip_markdown(candidate)
            mode = "body"
            continue

        # ── ## 레벨 헤딩
        if s.startswith("## "):
            candidate = strip_markdown(s[3:].strip())
            if candidate in SKIP_LABELS or any(kw in candidate for kw in META_KEYWORDS):
                if "제목" in candidate:
                    mode = "title_next"
                elif "태그" in candidate or "해시" in candidate:
                    mode = "tags_next"
                else:
                    mode = "body"
                continue
            if not title:
                title = candidate
            else:
                segments.append(("subheading", candidate))
            mode = "body"
            continue

        # ── ### 이하 헤딩 → 소제목
        m = re.match(r"^#{3,6}\s+(.+)$", s)
        if m:
            candidate = strip_markdown(m.group(1))
            if candidate not in SKIP_LABELS:
                segments.append(("subheading", candidate))
            mode = "body"
            continue

        # ── 번호 섹션 레이블 ("1. 제목", "2. 본문", "3. 태그 추천")
        label_m = re.match(r"^\d+\.\s+(.+)$", s)
        if label_m:
            label = label_m.group(1).strip()
            if label in SKIP_LABELS or any(kw in label for kw in META_KEYWORDS):
                if "제목" in label:
                    mode = "title_next"
                elif "태그" in label or "해시" in label:
                    mode = "tags_next"
                else:
                    mode = "body"
                continue

        # ── 일반 텍스트
        if mode == "title_next":
            if not title:
                title = strip_markdown(s)
            mode = "body"
        elif mode == "tags_next":
            found = re.findall(r"#([\w가-힣A-Za-z]+)", s)
            if found:
                tags.extend(found)
            else:
                mode = "body"
                cleaned = strip_markdown(s)
                if cleaned:
                    segments.append(("body", cleaned))
        else:
            cleaned = strip_markdown(s)
            if cleaned:
                segments.append(("body", cleaned))

    if not title:
        for kind, text in segments:
            if kind == "body" and text:
                title = text[:40]
                break

    return title, segments, tags


def main():
    data = json.loads(sys.stdin.read())
    content = data["content"]
    blog_id = data["blog_id"]
    title, segments, tags = parse_content(content)

    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=["--no-sandbox", "--window-size=1280,900"],
        )
        context = browser.new_context(
            locale="ko-KR",
            viewport={"width": 1280, "height": 900},
        )
        page = context.new_page()

        def js_click(sel):
            return page.evaluate(_JS_CLICK_SEL, sel)

        def js_click_text(text):
            return page.evaluate(_JS_CLICK_TEXT, text)

        try:
            # ── 1. 쿠키 로그인 ───────────────────────────────────────────
            if not COOKIE_PATH.exists():
                print(json.dumps({"error": "먼저 naver_login_setup을 실행하세요."}))
                sys.exit(1)

            cookies = json.loads(COOKIE_PATH.read_text(encoding="utf-8"))
            context.add_cookies(cookies)

            # ── 2. 글쓰기 페이지 ─────────────────────────────────────────
            page.goto(f"https://blog.naver.com/{blog_id}", wait_until="domcontentloaded")
            page.wait_for_timeout(1500)
            page.goto(f"https://blog.naver.com/{blog_id}/postwrite", wait_until="domcontentloaded")

            if "nidlogin" in page.url or "login.naver" in page.url:
                COOKIE_PATH.unlink(missing_ok=True)
                print(json.dumps({"error": "세션 만료. naver_login_setup을 다시 실행하세요."}))
                sys.exit(1)

            # 에디터 로딩 대기
            print("에디터 로딩...", file=sys.stderr)
            try:
                page.locator("button:has-text('발행')").wait_for(timeout=30_000)
            except PWTimeout:
                print(json.dumps({"error": "에디터 로드 타임아웃."}))
                sys.exit(1)
            page.wait_for_timeout(3000)
            page.bring_to_front()

            # ── 임시저장 팝업 닫기 ───────────────────────────────────────
            if page.locator(".se-popup-alert-confirm").count() > 0:
                print("임시저장 팝업 닫기...", file=sys.stderr)
                page.locator(".se-popup-alert-confirm button").first.click(force=True)
                page.wait_for_timeout(1200)
                try:
                    page.locator(".se-popup-alert-confirm").wait_for(state="hidden", timeout=5000)
                except PWTimeout:
                    pass

            # ── 도움말 닫기 ──────────────────────────────────────────────
            if page.locator(".se-help-panel-close-button").count() > 0:
                page.locator(".se-help-panel-close-button").click(force=True)
                page.wait_for_timeout(500)

            page.wait_for_timeout(600)

            # ── 3. 제목 입력 ─────────────────────────────────────────────
            print(f"제목 입력: {title}", file=sys.stderr)

            TITLE_SELECTORS = [
                ".se-title-input",
                "p.se-title-input[contenteditable]",
                ".se-section-title p[contenteditable]",
                "[data-placeholder*='제목']",
                "[contenteditable][class*='title']",
            ]

            title_focused = False
            for sel in TITLE_SELECTORS:
                loc = page.locator(sel)
                if loc.count() > 0:
                    loc.first.click(force=True)
                    page.wait_for_timeout(600)
                    title_focused = True
                    print(f"제목 셀렉터: {sel}", file=sys.stderr)
                    break

            if not title_focused:
                page.mouse.click(640, 200)
                page.wait_for_timeout(600)
                print("제목 좌표 폴백", file=sys.stderr)

            page.keyboard.press("Control+a")
            page.wait_for_timeout(200)
            paste_text(page, title)
            page.wait_for_timeout(600)

            # ── 4. 본문 입력 ─────────────────────────────────────────────
            print("본문 입력...", file=sys.stderr)

            BODY_SELECTORS = [
                ".se-section-text p[contenteditable]",
                ".se-text-paragraph[contenteditable]",
                ".se-component-content p[contenteditable]",
                ".se-content-editor[contenteditable]",
                "div.se-main-container [contenteditable='true']",
            ]

            body_focused = False
            for sel in BODY_SELECTORS:
                loc = page.locator(sel)
                if loc.count() > 0:
                    loc.first.click(force=True)
                    page.wait_for_timeout(600)
                    body_focused = True
                    print(f"본문 셀렉터: {sel}", file=sys.stderr)
                    break

            if not body_focused:
                page.mouse.click(640, 420)
                page.wait_for_timeout(600)
                print("본문 좌표 폴백", file=sys.stderr)

            # ── 세그먼트별 입력 ──────────────────────────────────────────
            # SE One은 <p> 태그마다 자체 margin이 있어서 Enter 1번만 눌러도
            # 충분한 시각적 간격이 생깁니다. blank 세그먼트는 무시합니다.
            #
            # subheading → paste → 선택 → bold + 18pt → Enter 1번
            # body       → paste → Enter 1번
            # blank      → 건너뜀 (SE One 자체 paragraph margin으로 충분)
            prev_kind = None
            for kind, text in segments:
                if kind == "blank":
                    # 소제목 앞에서만 Enter 1번 추가 (소제목과 앞 단락 사이 간격)
                    if prev_kind == "body":
                        page.keyboard.press("Enter")
                        page.wait_for_timeout(80)
                    prev_kind = "blank"
                    continue

                elif kind == "subheading":
                    # Bold ON → 붙여넣기 → Bold OFF → 줄바꿈
                    # (선택 후 적용 방식은 SE One에서 텍스트가 삭제되는 버그 발생)
                    page.keyboard.press("Control+b")
                    time.sleep(0.15)
                    paste_text(page, text)
                    time.sleep(0.1)
                    page.keyboard.press("Control+b")
                    page.keyboard.press("Enter")
                    page.wait_for_timeout(150)

                else:  # body
                    paste_text(page, text)
                    page.keyboard.press("Enter")
                    page.wait_for_timeout(120)

                prev_kind = kind

            page.wait_for_timeout(500)

            # ── 해시태그: SE One 태그 입력 필드 사용 ──────────────────────
            # 본문에 직접 붙여넣으면 이중으로 표시되므로 별도 태그 필드에 입력
            if tags:
                TAG_SELECTORS = [
                    ".se-tag-input",
                    "input[placeholder*='태그']",
                    ".se-module-tag input",
                    "[class*='tag'] input",
                    ".se-tag-area input",
                ]
                tag_field_found = False
                for sel in TAG_SELECTORS:
                    loc = page.locator(sel)
                    if loc.count() > 0:
                        loc.first.click()
                        page.wait_for_timeout(300)
                        for tag in tags:
                            paste_text(page, tag)
                            page.keyboard.press("Enter")
                            page.wait_for_timeout(150)
                        tag_field_found = True
                        print(f"태그 입력 필드: {sel}", file=sys.stderr)
                        break
                if not tag_field_found:
                    # 폴백: 본문 하단에 삽입
                    page.keyboard.press("Enter")
                    paste_text(page, " ".join(f"#{t}" for t in tags))
                    print("태그 폴백: 본문 하단 삽입", file=sys.stderr)

            page.wait_for_timeout(1000)

            # ── 5. 발행 버튼 클릭 ────────────────────────────────────────
            print("발행 버튼 클릭...", file=sys.stderr)

            btn_texts = page.evaluate(
                "() => [...document.querySelectorAll('button')]"
                ".map(b=>b.innerText.trim()).filter(t=>t)"
            )
            print(f"현재 버튼 목록: {btn_texts}", file=sys.stderr)

            clicked = page.evaluate("""() => {
                let el = document.querySelector("button[data-click-area='tpb.publish']");
                if (el) { el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return 'data-attr'; }

                const btns = [...document.querySelectorAll('button')];
                el = btns.find(b => b.innerText.trim() === '발행');
                if (el) { el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return 'exact-text'; }

                el = btns.find(b => b.innerText.trim().includes('발행'));
                if (el) { el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return 'includes-text'; }

                return null;
            }""")
            print(f"발행 클릭 결과: {clicked}", file=sys.stderr)
            page.wait_for_timeout(3000)

            # ── 6. 발행 확인 패널 처리 ───────────────────────────────────
            btn_texts2 = page.evaluate(
                "() => [...document.querySelectorAll('button')]"
                ".map(b=>b.innerText.trim()).filter(t=>t)"
            )
            print(f"패널 오픈 후 버튼: {btn_texts2}", file=sys.stderr)

            confirmed = page.evaluate("""() => {
                const btns = [...document.querySelectorAll('button')];

                let el = btns.find(b => b.innerText.trim().includes('발행하기'));
                if (el) { el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return '발행하기'; }

                const matching = btns.filter(b => b.innerText.trim() === '발행');
                if (matching.length > 1) {
                    matching[matching.length-1].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
                    return '발행(last)';
                }
                if (matching.length === 1) {
                    matching[0].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
                    return '발행(only)';
                }

                el = btns.find(b => b.innerText.trim() === '확인');
                if (el) { el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return '확인'; }

                return null;
            }""")
            print(f"발행 확인: {confirmed}", file=sys.stderr)

            page.wait_for_timeout(5000)

            post_url = page.url
            if "postwrite" in post_url or not post_url.startswith("https://blog.naver.com"):
                post_url = f"https://blog.naver.com/{blog_id}"

            print(json.dumps({"url": post_url}))

        except (SystemExit, json.JSONDecodeError):
            raise
        except Exception as e:
            print(json.dumps({"error": str(e)}))
            sys.exit(1)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
