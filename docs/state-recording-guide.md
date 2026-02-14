# OpenLayers COG Viewer 상태 기록 및 검증 가이드

**작성일**: 2026-02-14  
**대상**: 첫 화면 로딩 완료 후 상세 상태 기록

---

## 📋 개요

첫 화면 로딩이 완료된 후의 **정확한 상태를 기록**하여 추후 기능 변경 시 정상 작동 여부를 판단할 수 있도록 합니다. HTTP 요청부터 OpenLayers 내부 상태까지 포괄적으로 기록합니다.

---

## 🎯 기록되는 상태 정보

### 1. HTTP 요청/응답 정보

| 항목 | 설명 | 용도 |
|------|------|------|
| 요청 URL | 모든 HTTP 요청의 URL | 요청 패턴 분석 |
| 요청 메서드 | GET, POST 등 | Range 요청 확인 |
| 요청 헤더 | Range, Accept 등 | COG 요청 특성 파악 |
| 응답 상태 | 200, 206, 404 등 | 정상/비정상 응답 확인 |
| 응답 헤더 | Content-Range, ETag 등 | 캐싱 및 부분 응답 확인 |
| 타임스탬프 | 요청/응답 시간 | 지연 시간 분석 |
| 리소스 타입 | xhr, fetch, document 등 | 요청 종류 분류 |

### 2. COG Range Request 특정 정보

```json
{
  "cogRangeRequests": [
    {
      "url": "https://storage.googleapis.com/.../SkySat_20170831T195552Z_RGB.tif",
      "rangeRequest": "bytes=0-65535",
      "status": 206,
      "isCOGRangeRequest": true
    }
  ]
}
```

**Range Request 패턴 예시:**
- `bytes=0-65535` - 첫 번째 블록 (헤더/메타데이터)
- `bytes=131072-196607` - 타일 데이터 블록
- `bytes=1048576-1114111` - 더 높은 해상도 타일

### 3. OpenLayers 상태 정보

#### 프로젝션 좌표계 (Projection)
```json
{
  "projection": {
    "code": "EPSG:3857",
    "units": "m",
    "extent": [-20037508.34, -20037508.34, 20037508.34, 20037508.34]
  }
}
```

#### 뷰 상태 (View State)
```json
{
  "center": [-10888888.12, 3444444.56],
  "zoom": 12.5,
  "resolution": 38.22,
  "extent": [-10950000, 3400000, -10830000, 3500000],
  "viewState": {
    "rotation": 0,
    "maxZoom": 20,
    "minZoom": 8
  }
}
```

#### 레이어 목록 (Layers)
```json
{
  "layers": [
    {
      "index": 0,
      "type": "TileLayer",
      "sourceType": "OSM",
      "sourceState": "ready",
      "opacity": 0.3,
      "visible": true,
      "zIndex": 0
    },
    {
      "index": 1,
      "type": "WebGLTileLayer",
      "sourceType": "GeoTIFFSource",
      "sourceState": "ready",
      "opacity": 1,
      "visible": true,
      "zIndex": 1
    }
  ]
}
```

#### 타일 캐시 (Tile Cache)
```json
{
  "tileCache": {
    "count": 24,
    "tiles": [
      { "z": 12, "x": 1234, "y": 5678 },
      { "z": 12, "x": 1235, "y": 5678 },
      { "z": 12, "x": 1234, "y": 5679 }
    ]
  }
}
```

#### COG 소스 설정 (COG Source)
```json
{
  "cogSource": {
    "state": "ready",
    "url": "https://storage.googleapis.com/.../SkySat_20170831T195552Z_RGB.tif",
    "bands": [1, 2, 3],
    "normalize": true,
    "convertToRGB": false,
    "opaque": false
  }
}
```

---

## 📝 테스트 실행 방법

### 기본 실행
```bash
npx playwright test tests/performance/04-detailed-state.spec.js
```

### 결과와 함께 실행 (headed 모드)
```bash
npx playwright test tests/performance/04-detailed-state.spec.js --headed
```

### 출력 파일 확인
```bash
ls -la test-results/initial-load-state-*.json
```

---

## 🔍 결과 파일 구조

### 파일명 형식
```
initial-load-state-2026-02-14T10-30-45-123Z.json
```

### JSON 구조
```json
{
  "metadata": {
    "testName": "initial-load-detailed-state",
    "timestamp": "2026-02-14T10:30:45.123Z",
    "navigationStart": 1707899445123,
    "totalDuration": 5689,
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    "viewport": { "width": 1280, "height": 720 }
  },
  "httpRequests": {
    "total": 45,
    "cogRangeRequests": 12,
    "requests": [...]
  },
  "httpResponses": {
    "total": 45,
    "cogRangeResponses": [...],
    "responses": [...]
  },
  "resourceTimings": {
    "total": 45,
    "timings": [...]
  },
  "mapState": {
    "timestamp": "2026-02-14T10:30:45.123Z",
    "projection": {...},
    "center": [...],
    "zoom": 12.5,
    "resolution": 38.22,
    "extent": [...],
    "layers": [...],
    "tileCache": {...},
    "cogSource": {...},
    "viewState": {...}
  },
  "summary": {
    "projectionCode": "EPSG:3857",
    "center": [-10888888.12, 3444444.56],
    "zoom": 12.5,
    "resolution": 38.22,
    "layerCount": 2,
    "tileCount": 24,
    "cogSourceState": "ready"
  }
}
```

---

## 🔄 추후 검증 방법

### 1. 기준 상태 수립

```bash
# 1. 초기 실행하여 기준값 생성
npx playwright test tests/performance/04-detailed-state.spec.js

# 2. 생성된 파일을 baseline으로 복사
cp test-results/initial-load-state-2026-02-14T10-30-45-123Z.json \
   test-results/baseline-state.json

# 3. docs/test-baseline.md에 기록
# - projectionCode
# - center (허용 오차 ±0.01)
# - zoom (허용 오차 ±0.1)
# - tileCount (허용 오차 ±5)
```

### 2. 변경 후 검증

```bash
# 1. 테스트 실행
npx playwright test tests/performance/04-detailed-state.spec.js

# 2. 새로 생성된 파일과 baseline 비교
diff test-results/baseline-state.json \
    test-results/initial-load-state-2026-02-14T12-00-00-000Z.json

# 3. 또는 jq로 특정 필드 비교
jq '.summary' test-results/baseline-state.json
jq '.summary' test-results/initial-load-state-*.json
```

### 3. 자동 비교 스크립트 예시

```javascript
// compare-state.js
import { readFileSync } from 'fs';

const baseline = JSON.parse(readFileSync('test-results/baseline-state.json'));
const current = JSON.parse(readFileSync(process.argv[2]));

const comparisons = [
  {
    field: 'summary.projectionCode',
    baseline: baseline.summary.projectionCode,
    current: current.summary.projectionCode,
    tolerance: null // 정확히 일치해야 함
  },
  {
    field: 'summary.center[0]',
    baseline: baseline.summary.center[0],
    current: current.summary.center[0],
    tolerance: 0.01 // 허용 오차
  },
  {
    field: 'summary.zoom',
    baseline: baseline.summary.zoom,
    current: current.summary.zoom,
    tolerance: 0.1 // 허용 오차
  },
  {
    field: 'summary.tileCount',
    baseline: baseline.summary.tileCount,
    current: current.summary.tileCount,
    tolerance: 5 // 허용 오차
  }
];

let passed = 0;
let failed = 0;

comparisons.forEach(comp => {
  const diff = Math.abs(comp.current - comp.baseline);
  const isPass = comp.tolerance === null 
    ? comp.current === comp.baseline 
    : diff <= comp.tolerance;
  
  if (isPass) {
    console.log(`✅ ${comp.field}: ${comp.baseline} → ${comp.current}`);
    passed++;
  } else {
    console.log(`❌ ${comp.field}: ${comp.baseline} → ${comp.current} (diff: ${diff})`);
    failed++;
  }
});

console.log(`\n총 ${comparisons.length}개 항목: ${passed}개 통과, ${failed}개 실패`);
process.exit(failed > 0 ? 1 : 0);
```

실행:
```bash
node compare-state.js test-results/initial-load-state-2026-02-14T12-00-00-000Z.json
```

---

## ⚠️ 상태 변경 시 주요 증상

### 1. 프로젝션 좌표계 변경

**증상:**
```
projectionCode: "EPSG:3857" → "EPSG:4326"
```

**영향:**
- 좌표 값의 단위 변경 (미터 → 도)
- extent 값의 범위 크게 변경
- transform() 함수 결과 변경

**대응:**
- 의도된 변경인지 확인
- 좌표 표시 UI 업데이트 필요
- 테스트 기준값 업데이트

### 2. 중심 좌표 변경

**증상:**
```
center: [-10888888.12, 3444444.56] → [-9500000.00, 3500000.00]
```

**영향:**
- 초기 표시 영역 변경
- 사용자 경험 변화

**대응:**
- fit() 함수의 padding/extent 변경 확인
- COG 메타데이터 변경 확인
- 의도된 변경이면 테스트 기준값 업데이트

### 3. 줌 레벨 변경

**증상:**
```
zoom: 12.5 → 10.0
```

**영향:**
- 초기 표시 해상도 변경
- 타일 로딩 개수 변경

**대응:**
- minZoom/maxZoom 설정 확인
- cogView.zoom 값 확인
- 타일 캐시 개수 기준값 업데이트

### 4. 레이어 구조 변경

**증상:**
```
layerCount: 2 → 1
```

**영향:**
- OSM 배경지도 또는 COG 레이어 누락
- 기능 저하

**대응:**
- 레이어 생성 코드 확인
- 소스 URL 접근 가능 여부 확인
- 즉시 수정 필요

### 5. 타일 캐시 변경

**증상:**
```
tileCount: 24 → 5
```

**영향:**
- 타일 로딩 실패 또는 지연
- 화면 표시 불완전

**대응:**
- 네트워크 연결 확인
- COG 서버 상태 확인
- fit() 함수의 영역 확인

### 6. COG Range Request 변경

**증상:**
```
cogRangeRequests: 12 → 0
```

**영향:**
- COG 로딩 실패
- 영상 표시 안됨

**대응:**
- COG_URL 접근 가능 여부 확인
- CORS 정책 확인
- 네트워크 연결 확인

---

## 📊 주요 검증 포인트

### 필수 검증 항목 (반드시 일치 또는 허용 범위 내)

| 항목 | 기준값 예시 | 허용 오차 | 중요도 |
|------|-------------|-----------|--------|
| projectionCode | "EPSG:3857" | 정확히 일치 | 🔴 높음 |
| center | [-10888888, 3444444] | ±0.01 | 🔴 높음 |
| zoom | 12.5 | ±0.1 | 🟡 중간 |
| layerCount | 2 | 정확히 일치 | 🔴 높음 |
| tileCount | 24 | ±5 | 🟡 중간 |
| cogSourceState | "ready" | 정확히 일치 | 🔴 높음 |
| cogRangeRequests | > 0 | > 0 | 🔴 높음 |

### 참고 검증 항목 (정상 범위 내이면 OK)

| 항목 | 정상 범위 | 설명 |
|------|-----------|------|
| totalDuration | < 10000ms | 전체 로딩 시간 |
| httpRequests.total | 30~60 | 전체 요청 수 |
| resourceTimings.total | 30~60 | 리소스 타이밍 수 |
| resolution | 30~50 | m/pixel (줌 레벨에 따라 변함) |

---

## 📝 테스트 기준 업데이트 절차

### 변경이 필요한 경우

1. **의도된 기능 변경**
   - 새로운 기능 추가로 인한 상태 변화
   - UI 개선으로 인한 레이어 구조 변경
   - 성능 최적화로 인한 로딩 패턴 변경

2. **데이터 소스 변경**
   - COG URL 변경
   - 새로운 위성 영상 적용
   - 다른 지역 데이터로 변경

3. **라이브러리 업데이트**
   - OpenLayers 버전 업데이트
   - 브라우저 호환성 변경

### 업데이트 절차

```bash
# 1. 새로운 기준값 생성
npx playwright test tests/performance/04-detailed-state.spec.js

# 2. 결과 파일 확인
cat test-results/initial-load-state-*.json | jq '.summary'

# 3. docs/test-baseline.md 업데이트
# 새로운 기준값과 허용 오차 기록

# 4. 새로운 baseline 파일 생성
cp test-results/initial-load-state-*.json test-results/baseline-state-latest.json

# 5. Git 커밋
git add test-results/baseline-state-latest.json docs/test-baseline.md
git commit -m "docs: update test baseline for [변경 사유]"
```

---

## 🔧 문제 해결

### HTTP 요청이 기록되지 않는 경우

**원인:**
- page.route() 설정 시점 문제
- Service Worker 캐싱

**해결:**
```javascript
// page.goto() 전에 route 설정
await page.route('**/*', async (route, request) => {
  // ... 모니터링 로직
});

await page.goto('/');
```

### 타일 캐시가 0으로 표시되는 경우

**원인:**
- tileCache에 접근하는 메서드명 변경
- OpenLayers 버전 차이

**해결:**
```javascript
// 대체 접근 방법 시도
const tileCache = source.getTileCache 
  ? source.getTileCache() 
  : source.tileCache_;
```

### COG Range Request가 감지되지 않는 경우

**원인:**
- Range 헤더가 없는 경우
- COG 파일이 캐시되어 있는 경우

**해결:**
```javascript
// 캐시 비활성화하고 테스트
await page.route('**/*.tif', route => {
  route.continue({ headers: { 'Cache-Control': 'no-cache' } });
});
```

---

**이 문서를 따라 첫 화면 로딩 후의 상태를 기록하고, 추후 변경 시 기준값과 비교하여 정상 작동 여부를 판단하세요.**
