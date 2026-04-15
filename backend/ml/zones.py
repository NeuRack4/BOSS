"""
상권 권역(zone) 클러스터 유틸리티

detect_zone(dong_name)  → 권역명 (ZONE_CLUSTERS 키워드 매칭)
encode_zone(zone_name)  → 정수 인코딩 (ML 피처용)
ZONE_ENC                → {권역명: 정수} 딕셔너리
"""
from backend.core.constants import ZONE_CLUSTERS

# 권역명 → 정수 인코딩 (알파벳순 정렬 → 1-based)
ZONE_ENC: dict[str, int] = {
    zone: i + 1 for i, zone in enumerate(sorted(ZONE_CLUSTERS.keys()))
}
ZONE_ENC["기타"] = 0  # 매칭 실패 fallback


def detect_zone(dong_name: str) -> str:
    """상권명(dong_name) 키워드로 권역 탐지. 매칭 실패 시 '기타' 반환."""
    for zone, keywords in ZONE_CLUSTERS.items():
        if any(kw in dong_name for kw in keywords):
            return zone
    return "기타"


def encode_zone(zone_name: str) -> int:
    """권역명 → ML 피처용 정수. 알 수 없는 권역은 0."""
    return ZONE_ENC.get(zone_name, 0)
