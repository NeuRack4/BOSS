"""서류 파서 — 파일 형식별 로컬 텍스트 추출

파싱 전담 모듈. 파일 bytes + 확장자 → 텍스트 반환.
- PDF   : PyMuPDF → 스캔 PDF이면 EasyOCR fallback
- 이미지 : EasyOCR (ko + en)
- DOCX  : python-docx
"""

import io

from fastapi import HTTPException


def parse_pdf(file_bytes: bytes) -> str:
    """PyMuPDF로 PDF 텍스트 추출. 추출 길이 < 50자이면 EasyOCR fallback."""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="PDF 처리 모듈(PyMuPDF)이 설치되지 않았습니다. 'uv pip install pymupdf'를 실행하세요.",
        )

    doc = fitz.open(stream=file_bytes, filetype="pdf")
    texts = [page.get_text() for page in doc]
    doc.close()
    text = "\n".join(texts).strip()

    if len(text) < 50:
        # 스캔 PDF로 간주 → EasyOCR fallback (페이지별 이미지 렌더링)
        try:
            import fitz as _fitz
            import easyocr
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail=(
                    "스캔 PDF OCR 모듈(EasyOCR)이 설치되지 않았습니다. "
                    "'uv pip install easyocr'를 실행하세요."
                ),
            )

        reader = easyocr.Reader(["ko", "en"], gpu=True)
        ocr_doc = _fitz.open(stream=file_bytes, filetype="pdf")
        ocr_texts: list[str] = []
        for page in ocr_doc:
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")
            result = reader.readtext(img_bytes, detail=0)
            ocr_texts.append(" ".join(result))
        ocr_doc.close()
        text = "\n".join(ocr_texts).strip()

    if not text:
        raise HTTPException(
            status_code=422,
            detail="PDF에서 텍스트를 추출할 수 없습니다. 파일을 확인해주세요.",
        )
    return text


def parse_image(file_bytes: bytes) -> str:
    """EasyOCR로 이미지에서 텍스트 추출 (ko + en)."""
    try:
        import easyocr
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail=(
                "OCR 모듈(EasyOCR)이 설치되지 않았습니다. "
                "'uv pip install easyocr'를 실행하세요."
            ),
        )

    try:
        reader = easyocr.Reader(["ko", "en"], gpu=True)
        result = reader.readtext(file_bytes, detail=0)
        text = " ".join(result).strip()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"이미지 OCR 처리 중 오류가 발생했습니다: {e}")

    if not text:
        raise HTTPException(status_code=422, detail="이미지에서 텍스트를 인식하지 못했습니다.")
    return text


def parse_docx(file_bytes: bytes) -> str:
    """python-docx로 DOCX 텍스트 추출."""
    try:
        from docx import Document
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail=(
                "DOCX 처리 모듈(python-docx)이 설치되지 않았습니다. "
                "'uv pip install python-docx'를 실행하세요."
            ),
        )

    doc = Document(io.BytesIO(file_bytes))
    text = "\n".join(p.text for p in doc.paragraphs).strip()

    if not text:
        raise HTTPException(status_code=422, detail="DOCX에서 텍스트를 추출할 수 없습니다.")
    return text


def parse_file(file_bytes: bytes, filename: str) -> str:
    """확장자 기반 파서 라우팅. 지원하지 않는 형식이면 HTTPException 415."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        return parse_pdf(file_bytes)
    elif ext in ("jpg", "jpeg", "png", "webp", "bmp", "tiff"):
        return parse_image(file_bytes)
    elif ext in ("docx", "doc"):
        return parse_docx(file_bytes)
    else:
        raise HTTPException(
            status_code=415,
            detail=(
                f"지원하지 않는 파일 형식: .{ext}. "
                "PDF, DOCX, 이미지(JPG/PNG/WEBP/BMP/TIFF)만 허용됩니다."
            ),
        )
