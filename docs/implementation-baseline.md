# OpenLayers COG Viewer 구현체 상세 동작 기록

**작성일**: 2026-02-14  
**대상 파일**: `src/main.js`, `index.html`  
**목적**: 현재 구현체의 코드 레벨 동작 상세 기록

---

## 📁 소스 코드 구조

### 파일 목록
```
src/
└── main.js          # 메인 애플리케이션 로직 (155라인)
index.html           # HTML 템플릿 및 스타일 (158라인)
package.json         # 프로젝트 설정
vite.config.js      # Vite 빌드 설정
```

---

## 🔍 main.js 상세 분석

### 1. 상수 및 변수 정의 (라인 1-14)

```javascript
// OpenLayers 모듈 임포트
import { Map, View } from 'ol'
import TileLayer from 'ol/layer/Tile'
import WebGLTileLayer from 'ol/layer/WebGLTile'
import GeoTIFFSource from 'ol/source/GeoTIFF'
import OSM from 'ol/source/OSM'
import { defaults as defaultControls } from 'ol/control'
import { transform } from 'ol/proj'
import 'ol/ol.css'

// COG 데이터 소스 URL (Google Cloud Storage)
const COG_URL = 'https://storage.googleapis.com/pdd-stac/disasters/hurricane-harvey/0831/SkySat_20170831T195552Z_RGB.tif'

// DOM 요소 참조
const loadingEl = document.getElementById('loading')
const errorEl = document.getElementById('error')
```

**기록 사항:**
- COG_URL 변경 시 테스트 기준도 변경됨
- bands: [1, 2, 3]는 RGB 밴드 사용을 의미
- normalize: true는 픽셀값 정규화 활성화

---

### 2. UI 헬퍼 함수 (라인 15-22)

```javascript
const showLoading = () => loadingEl.classList.add('active')
const hideLoading = () => loadingEl.classList.remove('active')

const showError = (message) => {
  errorEl.textContent = message
  errorEl.classList.add('active')
  hideLoading()
}
```

**동작 특성:**
- `showLoading`: DOM의 classList를 직접 조작하여 인디케이터 표시
- `hideLoading`: 동일하게 classList에서 'active' 제거
- `showError`: 에러 표시와 동시에 로딩 인디케이터 자동 숨김

**테스트 연관성:**
- 로딩 인디케이터의 표시/숨김이 테스트의 중요한 기준점
- `active` 클래스의 존재 여부로 로딩 상태 판단

---

### 3. COG 소스 생성 (라인 24-37)

```javascript
const createCOGSource = () => {
  return new GeoTIFFSource({
    sources: [{
      url: COG_URL,
      bands: [1, 2, 3]  // RGB 밴드
    }],
    normalize: true,          // 픽셀값 정규화
    convertToRGB: false,      // RGB 변환 비활성화
    opaque: false,           // 투명도 지원
    sourceOptions: {
      allowFullFile: false   // 전체 파일 다운로드 방지
    }
  })
}
```

**구성 옵션 상세:**

| 옵션 | 값 | 의미 | 성능 영향 |
|------|-----|------|-----------|
| `sources[].url` | COG_URL | 데이터 소스 위치 | 네트워크 로딩 시간 결정 |
| `sources[].bands` | [1,2,3] | 사용할 밴드 인덱스 | 메모리 사용량 및 렌더링 품질 |
| `normalize` | true | 픽셀값을 0-1 범위로 정규화 | WebGL 쉐이더 처리 시간 |
| `convertToRGB` | false | 자동 RGB 변환 비활성화 | 단일 밴드 COG용 옵션 |
| `opaque` | false | 투명도 채널 사용 | 렌더링 복잡도 |
| `sourceOptions.allowFullFile` | false | 전체 파일 다운로드 금지 | 메모리 및 대역폭 절약 |

**성능 특성:**
- `normalize: true` 시 GPU에서 추가 연산 발생
- `bands: [1,2,3]` 대신 `[1]` 사용 시 메모리 절약 가능 (단, 흑백 출력)

---

### 4. 지도 초기화 프로세스 (라인 39-101)

```javascript
const initMap = async () => {
  showLoading()

  try {
    const cogSource = createCOGSource()

    // 1. COG 소스 상태 변경 리스너
    cogSource.on('change', () => {
      if (cogSource.getState() === 'ready') {
        hideLoading()
      }
      if (cogSource.getState() === 'error') {
        const error = cogSource.getError()
        console.error('COG Error:', error)
        showError('COG 영상을 로드하는 중 오류가 발생했습니다.')
      }
    })

    // 2. COG 메타데이터 로드 (비동기)
    const cogView = await cogSource.getView()
    const extent = cogView.extent
    const projection = cogView.projection

    console.log('COG Info:', {
      extent,
      projection: projection?.getCode(),
      zoom: cogView.zoom
    })

    // 3. 레이어 생성
    const cogLayer = new WebGLTileLayer({
      source: cogSource,
      opacity: 1
    })

    const osmLayer = new TileLayer({
      source: new OSM(),
      opacity: 0.3  // 30% 투명도로 배경 표시
    })

    // 4. View 생성
    const view = new View({
      projection: projection,
      center: cogView.center,
      zoom: cogView.zoom || 12,
      minZoom: 8,
      maxZoom: 20
    })

    // 5. Map 인스턴스 생성
    const map = new Map({
      target: 'map',
      layers: [osmLayer, cogLayer],  // OSM 아래, COG 위에
      view: view,
      controls: defaultControls({
        zoom: true,
        rotate: true,
        attribution: true
      })
    })

    // 6. 전역 변수에 저장 (테스트 접근용)
    window.cogSource = cogSource
    window.map = map

    // 7. 영상 범위로 자동 이동
    if (extent) {
      map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 1000  // 1초 애니메이션
      })
    }
```

**단계별 동작 및 시간:**

| 단계 | 동작 | 예상 시간 | 테스트 검증 포인트 |
|------|------|-----------|---------------------|
| 1 | `createCOGSource()` | 즉시 | 소스 객체 생성 |
| 2 | `'change'` 리스너 등록 | 즉시 | 이벤트 핸들러 설정 |
| 3 | `cogSource.getView()` | 1-3초 | HTTP 요청 및 메타데이터 파싱 |
| 4 | 레이어 생성 | 즉시 | WebGLTileLayer 인스턴스화 |
| 5 | View 생성 | 즉시 | View 인스턴스화 |
| 6 | Map 생성 | < 100ms | WebGL 컨텍스트 초기화 |
| 7 | 전역 변수 저장 | 즉시 | window 객체에 참조 저장 |
| 8 | `fit()` 호출 | 1초 (애니메이션) | 애니메이션 + 새 타일 로딩 |

**테스트 연관성:**
- `window.cogSource`와 `window.map`은 테스트에서 필수적인 접근점
- `fit()`의 duration 1000ms는 테스트 대기 시간에 포함
- OSM 레이어의 opacity 0.3은 COG가 주요 레이어임을 의미

---

### 5. 좌표 표시 UI (라인 102-144)

```javascript
    // 좌표 표시 UI 생성
    const coordDisplay = document.createElement('div')
    coordDisplay.id = 'coordinate-display'
    coordDisplay.style.cssText = `
      position: absolute;
      bottom: 1.5rem;
      right: 1.5rem;
      background: rgba(255,255,255,0.95);
      padding: 0.75rem 1rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font-family: monospace;
      font-size: 0.75rem;
      z-index: 10;
      min-width: 200px;
    `
    coordDisplay.innerHTML = `
      <div style="color: #666; margin-bottom: 0.25rem;">지도 좌표:</div>
      <div id="map-coords" style="color: #333; margin-bottom: 0.5rem;">-</div>
      <div style="color: #666; margin-bottom: 0.25rem;">경위도 (WGS84):</div>
      <div id="wgs84-coords" style="color: #333;">-</div>
    `
    document.getElementById('app').appendChild(coordDisplay)

    // 마우스 이동 시 좌표 업데이트
    map.on('pointermove', (event) => {
      const coord = event.coordinate
      const mapCoordsEl = document.getElementById('map-coords')
      const wgs84CoordsEl = document.getElementById('wgs84-coords')
      
      if (coord) {
        const mapX = coord[0].toFixed(2)
        const mapY = coord[1].toFixed(2)
        mapCoordsEl.textContent = `X: ${mapX}, Y: ${mapY}`
        
        try {
          const lonLat = transform(coord, projection, 'EPSG:4326')
          const lon = lonLat[0].toFixed(6)
          const lat = lonLat[1].toFixed(6)
          wgs84CoordsEl.textContent = `경도: ${lon}°, 위도: ${lat}°`
        } catch (e) {
          wgs84CoordsEl.textContent = '변환 불가'
        }
      }
    })
```

**동작 특성:**
- `pointermove` 이벤트는 마우스가 움직일 때마다 발생
- `transform()`은 좌표계 변환 (원본 → WGS84)
- 업데이트 빈도: 이벤트 발생 빈도 그대로 (디바운싱 없음)
- OpenLayers 내부에서 최적화 (불필요한 렌더링 방지)

**성능 영향:**
- 좌표 변환은 CPU 연산 (간단한 수학 연산)
- 60fps 이상에서도 무리 없이 동작
- WebGL 렌더링과는 별도 스레드에서 실행

---

### 6. 에러 핸들링 (라인 148-152)

```javascript
  } catch (error) {
    console.error('Initialization error:', error)
    showError(`지도 초기화 중 오류 발생: ${error.message}`)
  }
}

document.addEventListener('DOMContentLoaded', initMap)
```

**에러 발생 가능 지점:**
1. `cogSource.getView()` - 네트워크 에러, CORS 에러
2. `new WebGLTileLayer()` - WebGL 초기화 실패
3. `new Map()` - DOM 요소 없음
4. `transform()` - 좌표계 변환 실패 (희귀)

---

## 🎨 index.html 상세 분석

### DOM 구조

```html
<div id="app">
  <header class="header">
    <h1>🛰️ COG Viewer</h1>
    <p>Hurricane Harvey SkySat 영상 | OpenLayers 10.x + Vite</p>
  </header>
  <div id="map"></div>
  <div id="loading" class="loading">영상 로딩 중...</div>
  <div id="error" class="error"></div>
  <div class="controls">
    <h3>영상 정보</h3>
    <p>SkySat_20170831T195552Z_RGB.tif<br>
    Hurricane Harvey 재해 지역<br>
    2017년 8월 31일 촬영</p>
  </div>
</div>
```

**요소별 역할:**

| 요소 ID | 역할 | 테스트 접근 방법 |
|---------|------|------------------|
| `app` | 루트 컨테이너 | `document.getElementById('app')` |
| `map` | OpenLayers 대상 | `page.locator('#map')` |
| `loading` | 로딩 인디케이터 | `page.locator('#loading')` |
| `error` | 에러 메시지 | `page.locator('#error')` |
| `coordinate-display` | 동적 생성 좌표 UI | `page.locator('#coordinate-display')` |

### CSS 스타일 특성

**로딩 인디케이터:**
```css
.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 0.875rem;
  z-index: 100;
  display: none;  /* 기본 숨김 */
}

.loading.active {
  display: block;  /* 활성화 시 표시 */
}
```

**테스트 검증:**
- `.loading.active` 클래스 유무로 로딩 상태 판단
- z-index: 100으로 최상위에 표시

---

## 🔧 테스트 코드와의 연결

### 테스트에서 접근하는 전역 변수

```javascript
// 테스트 코드에서
await page.evaluate(() => {
  // 현재 구현체에서 window 객체에 저장한 참조
  const cogSource = window.cogSource
  const map = window.map
  
  return {
    sourceState: cogSource.getState(),
    mapZoom: map.getView().getZoom(),
    tileCacheCount: cogSource.getTileCache().getCount()
  }
})
```

### 이벤트 리스너 연결

**테스트에서 모니터링하는 이벤트:**

| 이벤트 | 발생 시점 | 테스트 활용 |
|--------|-----------|-------------|
| `cogSource.on('change')` | 상태 변경 시 | `ready` 상태 대기 |
| `map.on('pointermove')` | 마우스 이동 시 | 좌표 표시 테스트 |
| `map.on('postrender')` | 렌더링 완료 시 | FPS 측정 |
| `map.on('moveend')` | 이동 완료 시 | Pan/Zoom 완료 시점 |

---

## 📊 변경 영향 분석

### 변경 시 테스트 기준 재검토 필요 항목

#### A. main.js 변경

| 변경 영역 | 영향 받는 테스트 | 재검토 사항 |
|-----------|------------------|-------------|
| `COG_URL` | 전체 | 새 데이터 소스의 로딩 시간 기준 재수립 |
| `bands` 옵션 | 로딩/렌더링 | 밴드 수에 따른 메모리/시간 변화 |
| `normalize` | 렌더링 | GPU 처리량 변화 |
| `fit()` duration | 로딩 | 애니메이션 시간 변경 시 대기 시간 조정 |
| 좌표 UI 스타일 | 기능 | 선택자 변경 여부 확인 |

#### B. index.html 변경

| 변경 영역 | 영향 받는 테스트 | 재검토 사항 |
|-----------|------------------|-------------|
| 요소 ID 변경 | 전체 | 테스트 코드 내 선택자 업데이트 |
| 로딩 UI 구조 | 로딩 테스트 | `active` 클래스 사용 방식 확인 |
| CSS 클래스명 | 없음 (시각적만) | 기능 테스트에는 영향 없음 |

#### C. package.json 변경

| 변경 영역 | 영향 받는 테스트 | 재검토 사항 |
|-----------|------------------|-------------|
| `ol` 버전 | 전체 | 주요 변경사항 확인, 새로운 기준 수립 |
| `vite` 버전 | 빌드/로딩 | 빌드 결과물 크기 변화 |

---

## 📝 테스트 기준과의 맵핑

### 01-page-load.spec.js 기준 연결

```javascript
// 테스트 코드
await page.waitForFunction(() => {
  const cogSource = window.cogSource
  return cogSource && cogSource.getState() === 'ready'
}, { timeout: 30000 })

// main.js의 대응 코드
cogSource.on('change', () => {
  if (cogSource.getState() === 'ready') {
    hideLoading()  // 테스트는 이 상태 변화를 감지
  }
})
```

### 02-map-pan.spec.js 기준 연결

```javascript
// 테스트의 드래그 동작
await page.mouse.move(centerX, centerY)
await page.mouse.down()
// ... 이동 ...
await page.mouse.up()

// main.js의 대응 동작 (OpenLayers 내부)
map.on('pointermove', (event) => {
  // 드래그 중 지도 이동 처리
})

// 테스트의 타일 로딩 대기
await page.waitForTimeout(1000)  // main.js의 fit duration(1000ms)과 연관
```

### 03-map-zoom.spec.js 기준 연결

```javascript
// 테스트의 줌 동작
await page.mouse.wheel(0, wheelDelta)

// main.js의 View 설정
const view = new View({
  zoom: cogView.zoom || 12,
  minZoom: 8,
  maxZoom: 20  // 이 제한 내에서만 줌 동작
})
```

---

## 🎯 구현체 변경 시 체크리스트

### 변경 전 확인 사항
- [ ] 이 문서의 현재 동작과 비교
- [ ] 테스트 기준서(`test-baseline.md`)의 기준값 확인
- [ ] 변경되는 코드의 테스트 영향 범위 확인

### 변경 후 확인 사항
- [ ] 모든 성능 테스트 실행 (`npm run test:performance`)
- [ ] 기준값 대비 ±20% 이내인지 확인
- [ ] 기능적 동작 확인 (수동 테스트)
- [ ] 이 문서 업데이트 (필요시)
- [ ] 테스트 기준서 업데이트 (필요시)

---

**이 문서는 현재 구현체의 상세 동작을 기록한 것입니다. 변경 시 반드시 테스트 결과와 함께 이 문서도 업데이트하세요.**
