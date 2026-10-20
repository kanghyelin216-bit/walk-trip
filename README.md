# 뚜벅이 여행 코스 웹앱

## 실행/배포
1. data.go.kr → "한국관광공사_국문 관광정보 서비스_GW" 활용신청 → **일반 인증키(Decoding)** 를 `config.js`의 KEY에 입력
2. 로컬 테스트: `python -m http.server 8000` → http://localhost:8000 (파일을 더블클릭해서 열면 안 됨)
3. GitHub 저장소에 push → Settings → Pages → Branch: main / (root) → `https://아이디.github.io/저장소명/`

## CORS로 막힐 때 (Cloudflare Workers 프록시)
브라우저 콘솔에 CORS 오류가 나면 Workers에서 API를 대신 호출하고, 응답에 `Access-Control-Allow-Origin: *`을 붙인 뒤
`config.js`의 BASE를 프록시 주소로 바꾸세요. 키를 Workers 환경변수에 두면 키 노출도 막을 수 있습니다.

## 구조
index(메인) / random(슬롯머신) / select(지역 선택) / course(코스·지도) / history(지난 여행)
common.js = 지역 데이터, 무중복 추첨, API 호출, 코스 알고리즘

## 장소 검색 코스 (search.html)
- 검색어 → ①한국관광공사 searchKeyword2(JSON) ②국가유산청 문화유산 목록(XML) ③OpenStreetMap Nominatim(역·일반 장소 좌표)을 동시에 호출
- 국가유산청 API가 CORS로 막히면 결과에 경고만 뜨고 나머지는 정상 동작합니다. 프록시를 쓸 땐 config.js에 `HERITAGE: '프록시주소/cha'`를 추가하세요.

## 추가 API: 국토교통부 TAGO 버스정류소정보 (대중교통 안내)
data.go.kr에서 "국토교통부_(TAGO)_버스정류소정보"도 활용신청하세요(같은 인증키 사용).
1km 넘는 구간은 근처 정류소 → 경유노선의 공통 노선번호로 직행 버스를 안내하고, 없으면 OSM 지하철·철도역, 그래도 없으면 카카오맵 링크로 대체합니다.
