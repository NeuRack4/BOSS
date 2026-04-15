"""
HWP5 텍스트 추출기 (olefile 직접 파싱)

HWP5 포맷 구조:
  - BodyText/Section0, Section1, ... — 본문 섹션 (zlib raw deflate 압축)
  - 각 섹션은 HWP 레코드 스트림
  - 레코드 헤더: tag_id(10bit) | level(4bit) | size(18bit)
  - HWPTAG_CHAR(67): 2바이트 유니코드 문자 또는 제어코드

Python 3.12 호환, pyhwp/hwp5 패키지 불필요.
"""
import struct
import tempfile
import os
import zlib
from typing import Optional

try:
    import olefile
    _OLEFILE_AVAILABLE = True
except ImportError:
    _OLEFILE_AVAILABLE = False

# HWP 레코드 태그
_HWPTAG_PARA_TEXT = 67      # 문단 텍스트
_HWPTAG_PARA_BREAK = 11     # 문단 구분자 (줄바꿈)

# 제어 문자 코드 (2바이트 유니코드 특수값)
_CTRL_CODES = {
    0x0009: "\t",   # 탭
    0x000A: "\n",   # 줄바꿈
    0x000D: "\n",   # 캐리지리턴
}
_INLINE_CTRL_START = 0x0001
_INLINE_CTRL_END   = 0x001F


def extract_hwp_text(hwp_bytes: bytes) -> str:
    """
    HWP 파일 바이트에서 텍스트를 추출한다.

    Args:
        hwp_bytes: HWP5 파일 전체 바이트

    Returns:
        추출된 텍스트. 파싱 실패 시 빈 문자열.
    """
    if not _OLEFILE_AVAILABLE:
        return ""

    with tempfile.NamedTemporaryFile(suffix=".hwp", delete=False) as tmp:
        tmp.write(hwp_bytes)
        tmp_path = tmp.name

    try:
        return _parse_hwp_ole(tmp_path)
    except Exception:
        return ""
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _parse_hwp_ole(path: str) -> str:
    """OLE 파일에서 BodyText 섹션을 순서대로 파싱해 텍스트 합친다."""
    sections: list[str] = []

    with olefile.OleFileIO(path) as ole:
        # FileHeader 확인 — HWP5 시그니처 체크
        if not ole.exists("FileHeader"):
            return ""

        i = 0
        while True:
            entry = f"BodyText/Section{i}"
            if not ole.exists(entry):
                break
            raw = ole.openstream(entry).read()
            text = _decode_section(raw)
            if text:
                sections.append(text)
            i += 1

    return _clean("\n".join(sections))


def _decode_section(data: bytes) -> str:
    """압축된 섹션 스트림을 디코딩해 텍스트를 추출한다."""
    # HWP 섹션은 raw deflate (wbits=-15)
    try:
        decompressed = zlib.decompress(data, -15)
    except zlib.error:
        # 일부 구버전은 압축 안 할 수 있음
        decompressed = data

    return _parse_records(decompressed)


def _parse_records(data: bytes) -> str:
    """HWP 레코드 스트림에서 텍스트 레코드만 추출한다."""
    texts: list[str] = []
    offset = 0
    length = len(data)

    while offset + 4 <= length:
        header = struct.unpack_from("<I", data, offset)[0]
        offset += 4

        tag_id = header & 0x3FF
        # level = (header >> 10) & 0xF  # 사용 안 함
        size = (header >> 20) & 0xFFF

        if size == 0xFFF:
            # 확장 크기
            if offset + 4 > length:
                break
            size = struct.unpack_from("<I", data, offset)[0]
            offset += 4

        record_data = data[offset : offset + size]
        offset += size

        if tag_id == _HWPTAG_PARA_TEXT:
            text = _decode_para_text(record_data)
            if text:
                texts.append(text)
        elif tag_id == _HWPTAG_PARA_BREAK:
            texts.append("\n")

    return "".join(texts)


def _decode_para_text(data: bytes) -> str:
    """문단 텍스트 레코드에서 유니코드 문자열을 추출한다."""
    chars: list[str] = []
    i = 0
    length = len(data)

    while i + 2 <= length:
        code = struct.unpack_from("<H", data, i)[0]
        i += 2

        if code in _CTRL_CODES:
            chars.append(_CTRL_CODES[code])
        elif _INLINE_CTRL_START <= code <= _INLINE_CTRL_END:
            # 인라인 오브젝트 (이미지, 표 등) — 헤더 16바이트 스킵
            i += 14
        else:
            try:
                chars.append(chr(code))
            except (ValueError, OverflowError):
                pass

    return "".join(chars)


def _clean(text: str) -> str:
    """연속 빈 줄 압축, 앞뒤 공백 제거."""
    lines = [line.rstrip() for line in text.splitlines()]
    cleaned: list[str] = []
    prev_blank = False
    for line in lines:
        if not line:
            if not prev_blank:
                cleaned.append("")
            prev_blank = True
        else:
            cleaned.append(line)
            prev_blank = False
    return "\n".join(cleaned).strip()
