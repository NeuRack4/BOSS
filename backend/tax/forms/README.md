# 국세청 공식 서식 PDF 저장소

이 디렉토리에 국세청 공식 부가가치세 신고서 PDF를 저장하면
`pdf_generator.py`가 pypdf로 AcroForm 필드를 채워 반환합니다.

파일이 없으면 reportlab으로 자동 생성합니다.

## 서식 파일명 규칙

| 파일명               | 서식 번호   | 과세자 유형 |
| -------------------- | ----------- | ----------- |
| `vat_simplified.pdf` | 별지 제44호 | 간이과세자  |
| `vat_general.pdf`    | 별지 제21호 | 일반과세자  |

## 다운로드 경로

국세청 서식자료실:
https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2312&cntntsId=7671

> 주의: 국세청 서식은 매년 개정될 수 있습니다. 연초에 최신 버전으로 교체하세요.
