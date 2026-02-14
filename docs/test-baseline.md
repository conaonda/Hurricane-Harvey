# OpenLayers COG Viewer 테스트 기준서 (Test Baseline Document)

**작성일**: 2026-02-14  
**프로젝트**: cog-viewer-openlayers  
**버전**: 1.0.0  
**문서 목적**: 현재 구현체의 동작을 기록하고 추후 변경 시 검증 기준으로 사용

---

## 📋 문서 개요

이 문서는 **기능 변경 없이 현재 구현체의 동작을 상세히 기록**한 것입니다. 추후 구현체에 변경이 발생했을 때, 이 문서의 기준값과 비교하여 정상 동작 여부를 판단할 수 있습니다.

### 사용 목적
1. **성능 회귀 방지**: 추후 변경으로 인한 성능 저하 감지
2. **기능 검증**: 새로운 기능 추가 시 기존 기능이 정상 동작하는지 확인
3. **참고 문서**: 개발자가 현재 동작을 이해하는 데 활용

---

## 🎯 현재 구현체 동작 기록

### 1. 애플리케이션 초기화 동작

#### 1.1 초기화 순서
```
1. DOMContentLoaded 이벤트 대기
2. showLoading() 호출 → 로딩 인디케이터 표시
3. GeoTIFFSource 생성 (비동기)
4. COG 소스의 'change' 이벤트 리스너 등록
5. cogSource.getView() 호출 (비동기 - COG 메타데이터 로드)
6. WebGLTileLayer + OSM TileLayer 생성
7. Map 인스턴스 생성 (View 포함)
8. map.getView().fit() 호출 (extent로 이동, 1초 duration 애니메이션)
9. 좌표 표시 UI 생성 및 pointermove 이벤트 리스너 등록
```

#### 1.2 COG 소스 상태 변화
| 상태 | 발생 시점 | UI 변화 |
|------|-----------|---------|
| `undefined` | 초기 상태 | 로딩 인디케이터 표시 |
| `'loading'` | 소스 생성 직후 | 로딩 인디케이터 표시 |
| `'ready'` | COG 메타데이터 로드 완료 | hideLoading() 호출, 영상 표시 |
| `'error'` | 로드 실패 시 | showError() 호출, 에러 메시지 표시 |

#### 1.3 초기 View 설정값
```javascript
{
  projection: cogView.projection,  // COG 원본 좌표계
  center: cogView.center,            // COG 중심점
  zoom: cogView.zoom || 12,          // COG 권장 줌 또는 12
  minZoom: 8,
  maxZoom: 20
}
```

#### 1.4 자동 이동 (fit) 동작
- **트리거**: `map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000 })`
- **지속시간**: 1000ms (1초)
- **패딩**: 상하좌우 50px
- **효과**: 영상이 화면에 최적화된 크기로 표시됨

---

### 2. 사용자 인터랙션 동작

#### 2.1 지도 이동 (Pan)

**드래그 동작:**
```
pointerdown → map.on('pointermove') → pointerup
```

**내부 동작:**
1. pointerdown: 드래그 시작, 마지막 마우스 위치 저장
2. pointermove: 이동량 계산 → View.setCenter() 호출 → 즉시 렌더링
3. pointerup: 드래그 종료, 타일 로딩 시작
4. tileloadstart → tileloadend 이벤트 발생
5. postrender 이벤트로 화면 갱신

**타일 로딩 패턴:**
- 드래그 중: 기존 타일 유지 (끊김 없는 이동)
- 드래그 종료 후: 새 영역의 타일 요청 시작
- 타일 로딩 우선순위: 현재 화면 중심 → 주변 영역

#### 2.2 지도 확대/축소 (Zoom)

**마우스 휠 동작:**
```
wheel 이벤트 → View.setZoom() → tile loading → render
```

**더블클릭 줌 인:**
```
dblclick → View.setZoom(current + 1) → 애니메이션 → tile loading
```

**줌 레벨 변화:**
| 줌 레벨 | 해상도 (m/pixel) | 타일 수 | 용도 |
|---------|------------------|---------|------|
| 8 | ~600 | 소수 | 개요 보기 |
| 12 | ~37 | 중간 | 기본 표시 |
| 16 | ~2.3 | 많음 | 상세 보기 |
| 20 | ~0.15 | 매우 많음 | 최대 확대 |

**타일 캐싱 동작:**
- 이전 줌 레벨 타일: 캐시에 유지 (빠른 줌 아웃용)
- 새 줌 레벨 타일: 순차적 로딩 (우선순위: 중심 → 주변)

#### 2.3 좌표 표시 동작

**pointermove 이벤트 핸들러:**
```javascript
map.on('pointermove', (event) => {
  const coord = event.coordinate
  // 1. 좌표 표시 업데이트 (map-coords)
  // 2. 좌표계 변환 (projection → 'EPSG:4326')
  // 3. 경위도 표시 업데이트 (wgs84-coords)
})
```

**업데이트 빈도:**
- 이벤트 발생 빈도에 따라 실시간 업데이트
- 디바운싱 없음 (OpenLayers 내부 최적화)

---

### 3. WebGL 렌더링 동작

#### 3.1 WebGLTileLayer 특성
- **렌더러**: WebGL (GPU 가속)
- **타일 소스**: GeoTIFFSource (COG)
- **렌더링 모드**: 실시간 (60fps 목표)

#### 3.2 렌더링 사이클
```
1. 타일 데이터 준비 (CPU)
2. WebGL 텍스처 업로드 (GPU 메모리)
3. 버텍스 쉐이더 실행 (GPU)
4. 프래그먼트 쉐이더 실행 (GPU)
5. 화면 출력 (Canvas)
```

#### 3.3 성능 특성
| 동작 | 예상 FPS | GPU 사용량 | 메모리 사용량 |
|------|----------|------------|---------------|
| 정지 상태 | 0 (렌더링 안함) | 없음 | 기본 |
| 이동 중 | 45-60 | 중간 | 증가 |
| 줌 중 | 30-60 | 높음 | 크게 증가 |
| 타일 로딩 중 | 30-45 | 중간-높음 | 최대 |

---

### 4. 네트워크 동작

#### 4.1 COG 타일 요청 패턴
```
1. HTTP Range 요청 헤더: bytes=start-end
2. 64KB~256KB 블록 단위 요청
3. HTTP/1.1 또는 HTTP/2 (브라우저 설정에 따름)
4. Keep-Alive 연결 재사용
```

#### 4.2 캐싱 동작
| 캐시 유형 | 대상 | 만료 정책 |
|-----------|------|-----------|
| 브라우저 HTTP 캐시 | 타일 바이너리 | Cache-Control 헤더 따름 |
| OpenLayers TileCache | 디코딩된 타일 | 메모리 제한 또는 명시적 삭제 |
| GPU 텍스처 캐시 | WebGL 텍스처 | 레이어 삭제 시 해제 |

#### 4.3 요청 우선순위
1. 현재 화면 중심 영역 (필수)
2. 현재 화면 주변 영역 (선택적)
3. 줌/이동 시 미리보기 (선택적)

---

## 📊 테스트 시나리오별 기준값

### 시나리오 1: 첫 화면 로딩

#### 테스트 파일
- `tests/performance/01-page-load.spec.js`

#### 측정 항목 및 기준값

| 메트릭 | 기준값 | 허용 범위 | 측정 방법 |
|--------|--------|-----------|-----------|
| 페이지 로드 시간 | ~2500ms | < 5000ms | `Date.now()` 측정 |
| FCP | ~800ms | < 1500ms | PerformanceObserver |
| LCP | ~2100ms | < 3000ms | PerformanceObserver |
| COG Ready | ~3200ms | < 10000ms | `cogSource.getState() === 'ready'` |
| First Tile Rendered | ~3500ms | < 12000ms | TileCache 확인 |
| TTFB | ~80ms | < 500ms | Navigation Timing API |
| Total Load Time | ~4000ms | < 15000ms | Navigation Timing API |

#### 검증 기준
```javascript
expect(olMetrics.cogReadyTime).toBeTruthy();
expect(olMetrics.cogReadyTime).toBeLessThan(30000);
expect(olMetrics.timeout).toBeFalsy();
expect(navMetrics.totalLoadTime).toBeLessThan(15000);
```

#### 정상 동작 확인 사항
- [ ] 페이지 로드 시 로딩 인디케이터 즉시 표시
- [ ] 3~5초 내에 COG 영상 표시
- [ ] 영상 표시 후 로딩 인디케이터 자동 숨김
- [ ] 좌하단에 좌표 표시 UI 생성
- [ ] 마우스 이동 시 좌표 실시간 업데이트

---

### 시나리오 2: 지도 이동 (Pan)

#### 테스트 파일
- `tests/performance/02-map-pan.spec.js`

#### 측정 항목 및 기준값

| 메트릭 | 기준값 | 허용 범위 | 측정 방법 |
|--------|--------|-----------|-----------|
| 드래그 소요 시간 | ~300ms | < 500ms | `mouse.down()` → `mouse.up()` |
| 렌더링 소요 시간 | ~550ms | < 1500ms | `mouse.up()` → 안정화 |
| 총 소요 시간 | ~850ms | < 2000ms | 전체 과정 |
| 평균 FPS (이동 중) | 45fps | > 30fps | `requestAnimationFrame` 카운트 |
| 최소 FPS | 38fps | > 20fps | 측정 중 최저값 |

#### 테스트 케이스별 동작

**수평 이동 (Pan Right/Left, 300px):**
```
기대 동작:
1. 드래그 중 지도가 즉시 따라움직임 (60fps)
2. 드래그 종료 후 0.5~1초 내 새 타일 로딩
3. 타일 로딩 중에도 지도 이동은 유지
4. 타일 로딩 완료 후 선명한 영상 표시
```

**수직 이동 (Pan Up/Down, 300px):**
```
기대 동작:
- 수평 이동과 동일한 성능 특성
- y축 이동에 따른 타일 로딩 (x축과 동일한 알고리즘)
```

**대각선 이동 (300px, 300px):**
```
기대 동작:
- 수평/수직 이동보다 약간 느림 (예상: ~20% 증가)
- 두 방향의 타일을 동시에 로드
- 총 소요 시간: ~1000ms (기준 850ms보다 20% 증가 허용)
```

**일관성 테스트 (10회 반복):**
```
기대 동작:
- 평균: ~850ms
- 표준편차: < 평균의 30% (변동계수 < 30%)
- 최소/최대 차이: < 2배
```

#### 검증 기준
```javascript
expect(metrics.totalDuration).toBeLessThan(2000);
expect(metrics.fps.avg).toBeGreaterThan(30);
expect(stdDev / avg).toBeLessThan(0.3);
```

#### 정상 동작 확인 사항
- [ ] 드래그 중 지도가 끊김 없이 따라움직임
- [ ] 드래그 종료 후 새 영역의 타일이 순차적으로 로드됨
- [ ] 타일 로딩 중에도 지도 이동 가능 (반응성 유지)
- [ ] 타일 로딩 완료 후 영상 선명도 향상
- [ ] 드래그 중 FPS가 30fps 이상 유지

---

### 시나리오 3: 지도 확대/축소 (Zoom)

#### 테스트 파일
- `tests/performance/03-map-zoom.spec.js`

#### 측정 항목 및 기준값

| 메트릭 | 기준값 | 허용 범위 | 측정 방법 |
|--------|--------|-----------|-----------|
| 줌 동작 소요 | ~400ms | < 1000ms | wheel 이벤트 처리 |
| 타일 로딩 소요 | ~800ms | < 2000ms | 새 해상도 타일 로드 |
| 렌더링 소요 | ~0ms | < 500ms | 타일 로딩 포함 |
| 총 소요 시간 | ~1200ms | < 3000ms | 전체 과정 |

#### 테스트 케이스별 동작

**줌 인 (3단계):**
```
기대 동작:
1. 각 wheel 이벤트에 따라 줌 레벨 증가 (애니메이션 포함)
2. 줌 레벨 확정 후 새 해상도 타일 요청 시작
3. 중심 영역 타일 우선 로딩
4. 1~2초 내 모든 타일 로딩 완료 및 표시
```

**줌 아웃 (2단계):**
```
기대 동작:
- 줌 인과 유사한 성능
- 이전 줌 레벨의 캐시된 타일 재사용 가능
- 줌 아웃이 더 빠를 수 있음 (캐시 히트율 높음)
```

**연속 줌 (5회 반복):**
```
기대 동작:
- 1회차: ~1200ms
- 2~5회차: 점진적 감소 (~800ms, 캐시 효과)
- 평균: ~1000ms 이하
```

**급격한 줌 변화 (5단계):**
```
기대 동작:
- 더 많은 타일 로딩 필요
- 예상 시간: 3~5초
- 타일 로딩 순서: 중심 → 주변 → 먼 영역
```

**더블클릭 줌:**
```
기대 동작:
1. 더블클릭 즉시 줌 인 애니메이션 시작
2. 애니메이션 중 타일 로딩 병행
3. 애니메이션 완료 후 남은 타일 로딩
4. 총 소요: ~2~3초
```

#### 검증 기준
```javascript
expect(metrics.totalDuration).toBeLessThan(3000);
expect(metrics.tileLoadTime).toBeLessThan(2000);
```

#### 정상 동작 확인 사항
- [ ] 줌 동작 시 애니메이션 부드러움 (끊김 없음)
- [ ] 줌 레벨 변화에 따라 타일 해상도 변경
- [ ] 줌 인 시 더 선명한 영상 표시
- [ ] 줌 아웃 시 더 넓은 영역 표시
- [ ] 타일 로딩 중에도 줌 동작 가능 (반응성 유지)

---

## 🔄 추후 변경 시 검증 방법

### 변경 유형별 검증 체크리스트

#### A. 코드 변경 (리팩토링/버그 수정)
```
□ npm run test:performance 실행
□ 모든 테스트 PASS 확인
□ 기준값 대비 ±20% 이내 확인
□ HTML 리포트에서 이상치 확인
```

#### B. 의존성 업데이트 (OpenLayers/Vite 등)
```
□ 이전 버전 결과 백업
□ 새 버전으로 업데이트
□ npm run test:performance 실행
□ 결과 비교 (±30% 허용)
□ 기능적 동작 확인 (수동 테스트)
```

#### C. 데이터 소스 변경 (COG URL 변경)
```
□ 새 COG URL 적용
□ npm run test:performance:headed로 수동 확인
□ 타일 로딩 시간 확인 (네트워크 환경에 따라 다름)
□ 기능 정상 동작 확인
```

#### D. UI 변경 (스타일/HTML 수정)
```
□ 로딩 인디케이터 표시 확인
□ 좌표 표시 UI 확인
□ 테스트 코드 내 선택자 업데이트 필요 여부 확인
```

---

## ⚠️ 테스트 실패 시 대응 가이드

### 실패 유형별 원인 분석 및 대응

#### 1. 첫 화면 로딩 실패

**증상**: COG Ready 시간 > 30000ms

**원인 분석 체크리스트:**
- [ ] 네트워크 연결 상태 확인
- [ ] COG URL 접근 가능 여부 확인
- [ ] Google Cloud Storage 상태 확인
- [ ] CORS 정책 변경 여부 확인
- [ ] 브라우저 콘솔 에러 확인

**대응 방법:**
```bash
# 1. 수동으로 페이지 열어 확인
npm run preview
# 브라우저에서 http://localhost:5173 접속

# 2. COG URL 직접 접근 테스트
curl -I https://storage.googleapis.com/pdd-stac/disasters/hurricane-harvey/0831/SkySat_20170831T195552Z_RGB.tif

# 3. OpenLayers 버전 확인
npm list ol
```

#### 2. 지도 이동 실패

**증상**: 드래그 후 타일 로딩 지연 (totalDuration > 2000ms)

**원인 분석 체크리스트:**
- [ ] 타일 로딩 네트워크 지연 확인
- [ ] WebGL 컨텍스트 초기화 상태 확인
- [ ] 메모리 사용량 확인 (너무 많은 타일 캐싱)
- [ ] 브라우저 성능 프로파일러 확인

**대응 방법:**
```bash
# 1. headed 모드로 실행하여 시각적 확인
npm run test:performance:headed

# 2. 특정 테스트만 실행
npx playwright test tests/performance/02-map-pan.spec.js --headed
```

#### 3. 지도 확대/축소 실패

**증상**: 줌 후 타일 로딩 지연 (totalDuration > 3000ms)

**원인 분석 체크리스트:**
- [ ] 줌 레벨별 타일 로딩 시간 확인
- [ ] 타일 캐시 적중률 확인
- [ ] GPU 메모리 사용량 확인

**대응 방법:**
```bash
# 1. 줌 테스트만 실행
npx playwright test tests/performance/03-map-zoom.spec.js

# 2. 리포트 확인
open playwright-report/index.html
```

#### 4. FPS 측정 실패

**증상**: 평균 FPS < 30

**원인 분석 체크리스트:**
- [ ] 브라우저 백그라운드 실행 여부 확인
- [ ] GPU 가속 활성화 여부 확인
- [ ] 다른 프로세스와의 리소스 경쟁 확인
- [ ] 브라우저 버전 호환성 확인

**대응 방법:**
```bash
# 1. 시스템 리소스 확인
# CPU/메모리 사용량 확인

# 2. 브라우저 설정 확인
# Chrome: chrome://gpu/에서 WebGL 상태 확인

# 3. Playwright 설정에서 headless: false로 변경 후 테스트
```

---

## 📁 테스트 결과 저장 및 관리

### 결과 파일 위치
```
test-results/
├── performance-results.json    # JSON 형식 상세 결과
└── performance-report/         # HTML 리포트 (blob 형식)
playwright-report/
└── index.html                  # HTML 리포트 (최신)
```

### 결과 백업 전략
```bash
# 중요한 변경 전 결과 백업
cp test-results/performance-results.json test-results/baseline-$(date +%Y%m%d).json

# 추후 비교
npm run test:performance
diff test-results/baseline-20260214.json test-results/performance-results.json
```

### 버전 관리
- `package.json`의 버전을 업데이트할 때마다 테스트 결과 백업
- Git 태그와 테스트 결과 연동
- CI/CD에서 결과 아티팩트로 보관

---

## 📝 참고 사항

### 네트워크 환경에 따른 결과 차이
| 환경 | 예상 로딩 시간 증가 | 대응 방법 |
|------|---------------------|-----------|
| WiFi (100Mbps) | 기준값 | - |
| 4G LTE | +20~50% | 허용 범위 조정 |
| 3G | +100~200% | 별도 기준 적용 |
| VPN | +10~30% | 고려하여 분석 |

### 하드웨어 사양 기준
- **CPU**: 4코어 이상 (Intel i5-8xxx 또는 동등)
- **메모리**: 8GB 이상
- **GPU**: WebGL 2.0 지원 (Intel UHD Graphics 620 이상)

### 브라우저 버전
- **Chromium**: 120 이상
- **테스트 환경**: headless 모드 (CI), headed 모드 (디버깅)

---

## 📊 시나리오 4: 첫 화면 로딩 완료 후 상세 상태 기록

#### 테스트 파일
- `tests/performance/04-detailed-state.spec.js`

#### 측정 항목 및 기준값

| 메트릭 | 기준값 | 허용 범위 | 측정 방법 |
|--------|--------|-----------|-----------|
| projectionCode | "EPSG:3857" | 정확히 일치 | `view.getProjection().getCode()` |
| center[0] | ~-10888888 | ±0.01 | `view.getCenter()` |
| center[1] | ~3444444 | ±0.01 | `view.getCenter()` |
| zoom | ~12.5 | ±0.1 | `view.getZoom()` |
| resolution | ~38.22 | ±5 | `view.getResolution()` |
| layerCount | 2 | 정확히 일치 | `map.getLayers().getLength()` |
| tileCount | 20~30 | ±5 | `source.getTileCache().getCount()` |
| cogSourceState | "ready" | 정확히 일치 | `source.getState()` |
| cogRangeRequests | > 0 | > 0 | HTTP 요청 모니터링 |
| totalDuration | ~6000ms | < 10000ms | 전체 과정 |

#### HTTP 요청 패턴 기준

**정상적인 COG Range 요청:**
```
1. bytes=0-65535       - TIFF 헤더/IFD
2. bytes=131072-262143 - 초기 타일 데이터
3. bytes=262144-...    - 추가 타일 데이터 (줌 레벨에 따라 다름)
```

**요청 수 기준:**
- COG 메타데이터: 2~4개 요청
- OSM 타일: 5~10개 요청
- 스크립트/CSS: 5~10개 요청
- 총 요청: 30~60개

#### 검증 기준
```javascript
expect(detailedState.projection).toBeTruthy();
expect(detailedState.projection.code).toBeTruthy();
expect(detailedState.center).toBeTruthy();
expect(detailedState.zoom).toBeGreaterThan(0);
expect(detailedState.layers.length).toBeGreaterThan(0);
expect(detailedState.cogSource.state).toBe('ready');
```

#### 정상 동작 확인 사항
- [ ] 프로젝션 좌표계가 EPSG:3857 또는 EPSG:4326
- [ ] 중심 좌표가 Hurricane Harvey 지역 (텍사스) 좌표 범위 내
- [ ] 줌 레벨이 minZoom/maxZoom 범위 내 (8~20)
- [ ] 레이어가 2개 (OSM 배경 + COG 영상)
- [ ] COG 소스 상태가 "ready"
- [ ] 타일 캐시에 20개 이상의 타일
- [ ] HTTP 요청 중 Range 요청이 10개 이상
- [ ] 모든 응답이 200 또는 206 상태

#### 결과 저장 위치
```
test-results/
├── initial-load-state-2026-02-14T10-30-45-123Z.json
├── initial-load-state-2026-02-14T12-00-00-000Z.json
└── baseline-state.json  (수동 복사한 기준 파일)
```

#### 추후 비교 방법
```bash
# 1. 새로운 상태 기록
npx playwright test tests/performance/04-detailed-state.spec.js

# 2. 기준값과 비교
diff test-results/baseline-state.json test-results/initial-load-state-*.json

# 3. 특정 필드만 비교
jq '.summary' test-results/baseline-state.json
jq '.summary' test-results/initial-load-state-*.json
```

#### 상태 변경 감지 시 대응
- 프로젝션 변경: 좌표계 변환 로직 변경 여부 확인
- 중심 좌표 변경: fit() 함수 또는 COG extent 변경 여부 확인
- 줌 레벨 변경: 초기 zoom 설정 변경 여부 확인
- 레이어 수 변경: 레이어 추가/삭제 여부 확인
- 타일 수 변경: 네트워크 상태 또는 COG 서버 상태 확인

---

## 🔄 문서 업데이트 기록

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-02-14 | 1.0 | 초기 작성 | - |
| 2026-02-14 | 1.1 | 상세 상태 기록 테스트 추가 | - |

---

**주의**: 이 문서는 현재 구현체의 동작을 기록한 것입니다. 기능 변경 시 이 문서를 함께 업데이트하거나 새로운 기준을 수립해야 합니다.
