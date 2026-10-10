# 배드민턴 복식 가이드 (badminton_study)

BWF 코치 매뉴얼 Level 1 을 바탕으로 만든 **비공식 한국어 배드민턴 학습 사이트**입니다.

- 사이트: https://knext.github.io/badminton_study/
- 레벨(입문·초급·중급)을 고르면 그 레벨에 맞는 매뉴얼 토픽과 로테이션 시나리오만 보입니다.
- **로테이션 플레이어**: 상황마다 선택지를 고르면 그 선택이 왜 좋은지·위험한지 먼저 보여 주고, 다음 상황으로 선수들이 움직입니다. 경로 기록에서 지나온 지점으로 돌아가 다른 선택과 비교할 수 있습니다.
- 매뉴얼 13개 장 목차·토픽, 용어집, 소개 화면.

## 구조

빌드 단계가 없는 정적 HTML/CSS/JS 입니다. `docs/` 가 그대로 GitHub Pages 배포 루트입니다(`main` 브랜치 `/docs`).

```
docs/
  index.html          단일 페이지(해시 라우팅: #/ #/m/<id> #/t/<id> #/r #/r/<시나리오>/<노드> #/glossary #/about)
  404.html  .nojekyll
  assets/             app.js(라우터) views.js(화면) player.js(분기 플레이어) court.js(SVG 코트)
                      data.js(데이터 로드) text.js(이스케이프) style.css
  data/               levels.json guide.json rotations.json glossary.json
```

모든 경로는 상대 경로라 저장소 하위 경로(`/badminton_study/`)에서 그대로 동작합니다.

## 로컬에서 보기

`fetch` 는 `file://` 에서 막히므로 간단한 서버로 띄웁니다.

```bash
cd docs
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000/
```

공유 링크에는 레벨이 담깁니다(예: `#/r/sc-def-counter?lv=novice`).

## 저작권 고지

이 사이트는 **BWF Coaches' Manual Level 1 (2nd ed.)을 바탕으로 한 비공식 한국어 학습 요약**입니다. 원문 저작권은 BWF(Badminton World Federation)에 있습니다. 원문을 문장 단위로 옮기지 않고 학습용으로 요약·재구성했으며, 매뉴얼 PDF·그림은 저장소에 포함하지 않습니다. 각 항목의 출처 쪽수(「매뉴얼 p.154 (PDF 183)」)로 원문을 확인하세요.

공식 정보: https://corporate.bwfbadminton.com/
