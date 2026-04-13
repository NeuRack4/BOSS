"""법제처 API 응답 구조 확인용 디버그 스크립트"""
import asyncio
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx

_BASE_URL = "https://www.law.go.kr/DRF"
_OC = "kimjaehyun9605"


async def main():
    async with httpx.AsyncClient(timeout=15.0) as client:
        print("=== 1. 법령 검색 (식품위생법) ===")
        resp = await client.get(
            f"{_BASE_URL}/lawSearch.do",
            params={
                "OC": _OC,
                "target": "law",
                "type": "JSON",
                "query": "식품위생법",
                "display": 1,
                "page": 1,
            },
        )
        print(f"status: {resp.status_code}")
        data = resp.json()
        print(json.dumps(data, ensure_ascii=False, indent=2))

        # lsiSeq 추출 시도
        search = data.get("LawSearch", {})
        law = search.get("law") or search.get("법령")
        print(f"\n추출된 law 필드: {law}")

        if law:
            if isinstance(law, list):
                law = law[0]
            lsi_seq = law.get("법령일련번호") or law.get("lsiSeq")
            print(f"lsiSeq: {lsi_seq}")

            if lsi_seq:
                print("\n=== 2. 법령 조문 조회 (첫 5개만) ===")
                await asyncio.sleep(0.5)
                resp2 = await client.get(
                    f"{_BASE_URL}/lawService.do",
                    params={
                        "OC": _OC,
                        "target": "law",
                        "type": "JSON",
                        "MST": lsi_seq,
                    },
                )
                data2 = resp2.json()
                law_data = data2.get("법령", {})
                units = law_data.get("조문", {}).get("조문단위", [])
                if isinstance(units, dict):
                    units = [units]
                print(f"전체 조문 수: {len(units)}")
                print("\n첫 3개 조문 구조:")
                print(json.dumps(units[:3], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
