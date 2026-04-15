"""
ML 파이프라인 전체 실행 스크립트

실행 순서:
  1. 서울 전체 상가업소 + 유동인구 수집 (API)
  2. 수동 다운로드 파일 파싱 (추정매출, 임대료, 대중교통)
  3. 피처 엔지니어링 → district_features 저장
  4. XGBoost 학습 → revenue_model.pkl 저장
  5. 전체 행정동 예측값 업데이트

수동 다운로드 파일:
  a) 서울시 상권분석서비스(추정매출):
     https://data.seoul.go.kr/dataList/OA-15572/S/1/datasetView.do
     → 파일데이터 탭 → ZIP → CSV 추출
     → 저장: backend/data/seeds/sbiz/seoul_revenue.csv

  b) 한국부동산원 소규모상가 임대료 (선택):
     https://www.reb.or.kr/r-one/statistics
     → 저장: backend/data/seeds/reb/reb_rent.csv

  c) 대중교통 위치 (선택):
     지하철: backend/data/seeds/transit/subway_stations.csv
     버스:   backend/data/seeds/transit/bus_stops.csv

사용:
  python -m backend.scripts.seed_seoul_ml [--skip-api] [--skip-files] [--skip-train]
"""
import asyncio
import argparse


async def main(skip_api: bool, skip_files: bool, skip_train: bool):
    # 1. 서울 전체 API 수집
    if not skip_api:
        print("\n=== 1/5 서울 전체 상가업소 + 유동인구 수집 ===")
        from backend.data.crawlers.seoul_open_full import fetch_and_save_all_seoul
        result = await fetch_and_save_all_seoul()
        print(f"  완료: {result}")
    else:
        print("\n[건너뜀] 서울 전체 API 수집")

    # 2. 수동 파일 파싱
    if not skip_files:
        print("\n=== 2/5 수동 다운로드 파일 파싱 ===")
        try:
            from backend.data.parsers.sbiz_parser import parse_and_store as sbiz_parse
            sbiz_parse()
        except FileNotFoundError as e:
            print(f"  [건너뜀] {e}")

        try:
            from backend.data.parsers.reb_parser import parse_and_store as reb_parse
            reb_parse()
        except FileNotFoundError as e:
            print(f"  [건너뜀] {e}")

        from backend.data.parsers.transit_parser import parse_and_store as transit_parse
        transit_parse()
    else:
        print("\n[건너뜀] 수동 파일 파싱")

    # 3. 피처 엔지니어링
    print("\n=== 3/5 피처 엔지니어링 ===")
    from backend.ml.features import build_and_store_features
    build_and_store_features()

    # 4. 학습
    if not skip_train:
        print("\n=== 4/5 모델 학습 ===")
        from backend.ml.train import train
        try:
            train()
        except ValueError as e:
            print(f"  [건너뜀] {e}")
            return
    else:
        print("\n[건너뜀] 모델 학습")

    # 5. 예측
    print("\n=== 5/5 전체 행정동 예측 ===")
    from backend.ml.predict import predict_and_store
    predict_and_store()

    print("\n[완료]")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-api",   action="store_true")
    parser.add_argument("--skip-files", action="store_true")
    parser.add_argument("--skip-train", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(args.skip_api, args.skip_files, args.skip_train))
