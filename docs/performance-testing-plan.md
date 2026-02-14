# OpenLayers COG Viewer 성능 측정 계획

## 📋 개요

이 문서는 **OpenLayers 기반 COG (Cloud Optimized GeoTIFF) 뷰어**의 성능을 측정하기 위한 포괄적인 계획을 정의합니다. 기능 변경 없이 현재 구현체의 성능 특성을 객관적으로 측정하고 분석하는 것이 목표입니다.

### 측정 대상 시스템
- **애플리케이션**: OpenLayers COG Viewer
- **기술 스택**: OpenLayers 10.4.0, Vite 6.1.0, Vanilla JavaScript
- **데이터**: Hurricane Harvey SkySat 위성 영상 (Google Cloud Storage)
- **렌더링**: WebGLTile 레이어 (WebGL 가속)

---

## 🎯 측정 목표

### 1차 목표
| 측정 항목 | 목적 |
|-----------|------|
| **첫 화면 로딩 성능** | 사용자가 페이지를 열어서 영상이 완전히 표시될 때까지의 시간 측정 |
| **지도 이동 (Pan) 성능** | 드래그로 지도를 이동할 때의 반응 속도 및 렌더링 완료 시간 |
| **지도 확대/축소 (Zoom) 성능** | 줌 인/아웃 시 새 해상도의 타일 로딩 및 렌더링 완료 시간 |

### 2차 목표
| 측정 항목 | 목적 |
|-----------|------|
| **네트워크 타일 로딩** | 개별 COG 타일의 로딩 시간 및 패턴 분석 |
| **WebGL 렌더링 성능** | 프레임 레이트 및 GPU 사용량 모니터링 |
| **메모리 사용량** | 브라우저 메모리 힙 사용량 추적 |

---

## 📊 측정 메트릭 정의

### 1. 첫 화면 로딩 메트릭

| 메트릭 ID | 이름 | 정의 | 측정 방법 |
|-----------|------|------|-----------|
| `TTFB` | Time to First Byte | 브라우저가 첫 번째 바이트를 받기까지의 시간 | Navigation Timing API |
| `FCP` | First Contentful Paint | 첫 번째 콘텐츠가 화면에 표시되는 시간 | PerformanceObserver (paint) |
| `LCP` | Largest Contentful Paint | 가장 큰 콘텐츠 요소가 표시되는 시간 | PerformanceObserver (largest-contentful-paint) |
| `TTI` | Time to Interactive | 사용자 인터랙션이 가능해지는 시간 | WebGL 초기화 완료 + 첫 타일 렌더링 |
| `COG_READY` | COG Source Ready | COG 소스가 'ready' 상태가 될 때까지의 시간 | OpenLayers `change` 이벤트 |
| `MAP_INIT` | Map Initialization Complete | 지도 초기화 및 fit 완료까지의 시간 | `postrender` 이벤트 + fit 콜백 |
| `TOTAL_LOAD` | Total Page Load | 페이지 로드 완료까지의 총 시간 | `performance.now()` 측정 |

### 2. 지도 인터랙션 메트릭

| 메트릭 ID | 이름 | 정의 | 측정 방법 |
|-----------|------|------|-----------|
| `PAN_START` | Pan Start Time | 드래그 시작 시점의 타임스탬프 | `pointerdown` 이벤트 |
| `PAN_END` | Pan End Time | 드래그 종료 시점의 타임스탬프 | `pointerup` 이벤트 |
| `PAN_RENDER` | Pan Render Complete | 새 영역의 타일 로딩 및 렌더링 완료 | `postrender` 이벤트 |
| `PAN_DURATION` | Pan Total Duration | 드래그 시작부터 렌더링 완료까지 | `PAN_RENDER` - `PAN_START` |
| `ZOOM_START` | Zoom Start Time | 줌 이벤트 시작 시점 | `wheel` 또는 더블클릭 이벤트 |
| `ZOOM_END` | Zoom End Time | 줌 동작 종료 시점 | `moveend` 이벤트 |
| `ZOOM_RENDER` | Zoom Render Complete | 새 해상도 타일 렌더링 완료 | `postrender` 이벤트 |
| `ZOOM_DURATION` | Zoom Total Duration | 줌 시작부터 렌더링 완료까지 | `ZOOM_RENDER` - `ZOOM_START` |
| `FPS_AVG` | Average FPS During Interaction | 인터랙션 중 평균 프레임 레이트 | `requestAnimationFrame` 카운터 |
| `FPS_MIN` | Minimum FPS | 인터랙션 중 최저 프레임 레이트 | `requestAnimationFrame` 측정 |

### 3. 네트워크 및 리소스 메트릭

| 메트릭 ID | 이름 | 정의 | 측정 방법 |
|-----------|------|------|-----------|
| `TILE_COUNT` | Tile Request Count | 로드된 타일의 총 개수 | Resource Timing API 필터링 |
| `TILE_SIZE` | Total Tile Data Size | 로드된 타일 데이터의 총 크기 | Resource Timing + HAR 분석 |
| `TILE_TTFB` | Tile Time to First Byte | 개별 타일의 TTFB | Resource Timing API |
| `TILE_LOAD` | Tile Load Time | 개별 타일의 로딩 완료 시간 | Resource Timing API |
| `CACHED_TILES` | Cached Tile Ratio | 캐시에서 로드된 타일 비율 | Resource Timing `transferSize` |

---

## 🛠️ 측정 방법론

### 1. 성능 측정 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                     Playwright Test                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Page Metrics │  │ Browser CDP  │  │ Custom Marks │       │
│  │   (timing)   │  │  (tracing)   │  │   (window)   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
├─────────────────────────────────────────────────────────────┤
│                     Browser Context                          │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐ │
│  │                   OpenLayers Map                        │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │
│  │  │ Map      │ │ View     │ │ COG Src  │ │ WebGL    │ │ │
│  │  │ Instance │ │ Instance │ │ Instance │ │ Renderer │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2. 측정 접근법

#### A. 첫 화면 로딩 측정

```javascript
// 1. 페이지 로드 타이밍
const navigationStart = performance.timeOrigin;
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

// 2. OpenLayers 특화 메트릭 측정
const olMetrics = await page.evaluate(() => {
  return new Promise((resolve) => {
    const metrics = {};
    
    // COG 소스 상태 모니터링
    const checkSource = setInterval(() => {
      if (window.cogSource && window.cogSource.getState() === 'ready') {
        metrics.cogReadyTime = performance.now();
        clearInterval(checkSource);
        resolve(metrics);
      }
    }, 10);
    
    // 타임아웃 설정 (30초)
    setTimeout(() => {
      clearInterval(checkSource);
      metrics.timeout = true;
      resolve(metrics);
    }, 30000);
  });
});
```

#### B. 지도 인터랙션 측정

```javascript
// 드래그 (Pan) 성능 측정
async function measurePanPerformance(page, direction, distance) {
  const panMetrics = await page.evaluate(() => ({
    startTime: null,
    endTime: null,
    renderTime: null,
    frameCount: 0
  }));
  
  // 1. 드래그 시작
  await page.mouse.move(400, 300);
  await page.mouse.down();
  
  const startTime = performance.now();
  
  // 2. 드래그 수행 (단계별 이동)
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const x = 400 + (distance * (i / steps));
    await page.mouse.move(x, 300, { steps: 1 });
    await page.waitForTimeout(16); // ~60fps 간격
  }
  
  await page.mouse.up();
  const endTime = performance.now();
  
  // 3. 렌더링 완료 대기
  await page.waitForFunction(() => {
    return new Promise((resolve) => {
      const map = window.map;
      if (!map) return resolve(false);
      
      let frameCount = 0;
      const checkRender = () => {
        frameCount++;
        // 3프레임 연속 렌더링 후 완료로 간주
        if (frameCount >= 3) {
          resolve(true);
        } else {
          requestAnimationFrame(checkRender);
        }
      };
      requestAnimationFrame(checkRender);
    });
  }, { timeout: 10000 });
  
  const renderTime = performance.now();
  
  return {
    dragDuration: endTime - startTime,
    totalDuration: renderTime - startTime,
    renderOverhead: renderTime - endTime
  };
}

// 확대/축소 (Zoom) 성능 측정
async function measureZoomPerformance(page, zoomIn = true) {
  const startTime = performance.now();
  
  // 마우스 휠 이벤트 시뮬레이션
  const wheelEvents = zoomIn ? 5 : -5;
  await page.mouse.move(400, 300);
  await page.mouse.wheel(0, wheelEvents * 100);
  
  // 줌 완료 대기
  await page.waitForTimeout(500);
  
  // 렌더링 완료 대기 (타일 로딩 포함)
  await page.waitForFunction(() => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 1000); // 안정화 대기
    });
  });
  
  const endTime = performance.now();
  
  return {
    zoomDuration: endTime - startTime
  };
}
```

#### C. FPS 측정

```javascript
// 인터랙션 중 FPS 측정
async function measureFPSDuringInteraction(page, interactionFn) {
  const fpsData = await page.evaluate(() => {
    return new Promise((resolve) => {
      const frames = [];
      let lastTime = performance.now();
      let frameCount = 0;
      
      function measureFrame() {
        const now = performance.now();
        const delta = now - lastTime;
        
        if (delta >= 1000) {
          const fps = Math.round((frameCount * 1000) / delta);
          frames.push({ time: now, fps });
          frameCount = 0;
          lastTime = now;
        }
        
        frameCount++;
        
        if (window.stopFPSMeasurement) {
          resolve(frames);
        } else {
          requestAnimationFrame(measureFrame);
        }
      }
      
      requestAnimationFrame(measureFrame);
    });
  });
  
  // 인터랙션 수행
  await interactionFn();
  
  // 측정 종료
  await page.evaluate(() => { window.stopFPSMeasurement = true; });
  
  return fpsData;
}
```

---

## 🔧 도구 및 환경 설정

### 1. 필수 의존성

```bash
# Playwright 설치
npm install --save-dev @playwright/test
npx playwright install chromium

# 성능 측정 유틸리티
npm install --save-dev lighthouse chrome-trace
```

### 2. Playwright 설정 (`playwright.config.js`)

```javascript
// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/performance',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // 성능 테스트는 순차 실행 권장
  reporter: [
    ['html', { outputFolder: 'test-results/performance-report' }],
    ['json', { outputFile: 'test-results/performance-results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    
    // 성능 측정을 위한 브라우저 설정
    launchOptions: {
      headless: true,
      args: [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ]
    },
    
    // 네트워크 조건 설정 (옵션)
    contextOptions: {
      // Throttling 설정 가능
    }
  },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-throttled',
      use: { 
        ...devices['Desktop Chrome'],
        // 3G 연결 시뮬레이션
        contextOptions: {
          // CDP를 통한 네트워크 조건 설정
        }
      },
    }
  ],
  
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### 3. 테스트 디렉토리 구조

```
tests/
├── performance/
│   ├── 01-page-load.spec.js        # 첫 화면 로딩 테스트
│   ├── 02-map-pan.spec.js          # 지도 이동 성능 테스트
│   ├── 03-map-zoom.spec.js         # 지도 확대/축소 성능 테스트
│   ├── 04-webgl-performance.spec.js # WebGL 렌더링 성능 테스트
│   └── helpers/
│       ├── metrics-collector.js     # 메트릭 수집 유틸리티
│       ├── performance-logger.js    # 성능 로깅 유틸리티
│       └── test-utils.js            # 공통 테스트 유틸리티
└── fixtures/
    └── baseline-metrics.json        # 기준 성능 메트릭
```

---

## 📈 테스트 시나리오

### 시나리오 1: 첫 화면 로딩

```javascript
// tests/performance/01-page-load.spec.js
test.describe('첫 화면 로딩 성능', () => {
  
  test('초기 페이지 로드 메트릭 측정', async ({ page }) => {
    // 1. Performance Observer 설정
    await page.addInitScript(() => {
      window.performanceMetrics = {};
      
      // FCP 측정
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        window.performanceMetrics.fcp = entries[0].startTime;
      });
      fcpObserver.observe({ type: 'paint', buffered: true });
      
      // LCP 측정
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        window.performanceMetrics.lcp = entries[entries.length - 1].startTime;
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    });
    
    // 2. 페이지 로드
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    
    // 3. OpenLayers 메트릭 측정
    const olMetrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const metrics = {
          cogReady: null,
          mapReady: null,
          firstTileRendered: null
        };
        
        let checkCount = 0;
        const checkInterval = setInterval(() => {
          checkCount++;
          
          // COG 소스 상태 체크
          const cogSource = window.cogSource || 
            (window.map && window.map.getLayers().getArray()
              .find(l => l.getSource && l.getSource().getState)?.getSource());
          
          if (cogSource && !metrics.cogReady && cogSource.getState() === 'ready') {
            metrics.cogReady = performance.now();
          }
          
          // 타일 로딩 체크
          if (cogSource && cogSource.getTileCache) {
            const cache = cogSource.getTileCache();
            if (cache && cache.getCount() > 0 && !metrics.firstTileRendered) {
              metrics.firstTileRendered = performance.now();
            }
          }
          
          // 완료 조건 확인
          if (metrics.cogReady && metrics.firstTileRendered || checkCount > 300) {
            clearInterval(checkInterval);
            resolve(metrics);
          }
        }, 100);
      });
    });
    
    // 4. Navigation Timing API 메트릭 수집
    const navMetrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return {
        dnsLookup: nav.domainLookupEnd - nav.domainLookupStart,
        tcpConnect: nav.connectEnd - nav.connectStart,
        sslHandshake: nav.secureConnectionStart > 0 ? 
          nav.connectEnd - nav.secureConnectionStart : 0,
        ttfb: nav.responseStart - nav.requestStart,
        downloadTime: nav.responseEnd - nav.responseStart,
        domProcessing: nav.domComplete - nav.domInteractive,
        loadEvent: nav.loadEventEnd - nav.loadEventStart,
        totalLoadTime: nav.loadEventEnd - nav.startTime
      };
    });
    
    // 5. 결과 로깅 및 검증
    const results = {
      testName: 'initial-page-load',
      timestamp: new Date().toISOString(),
      pageLoadTime: loadTime,
      navigationMetrics: navMetrics,
      openLayersMetrics: olMetrics,
      performanceObserverMetrics: await page.evaluate(() => window.performanceMetrics)
    };
    
    console.log('Page Load Results:', JSON.stringify(results, null, 2));
    
    // 기대값 검증 (조정 가능)
    expect(olMetrics.cogReady).toBeLessThan(30000); // 30초 이내 COG 준비
    expect(navMetrics.totalLoadTime).toBeLessThan(10000); // 10초 이내 로드
  });
  
});
```

### 시나리오 2: 지도 이동 (Pan) 성능

```javascript
// tests/performance/02-map-pan.spec.js
test.describe('지도 이동 성능', () => {
  
  test.beforeEach(async ({ page }) => {
    // 페이지 로드 및 초기화 대기
    await page.goto('/');
    await page.waitForFunction(() => {
      const cogSource = window.cogSource;
      return cogSource && cogSource.getState() === 'ready';
    }, { timeout: 30000 });
    
    // 안정화 대기
    await page.waitForTimeout(2000);
  });
  
  test('수평 이동 (Pan Right) 성능 측정', async ({ page }) => {
    const metrics = await measurePan(page, 'right', 300);
    
    console.log('Pan Right Metrics:', metrics);
    
    expect(metrics.totalDuration).toBeLessThan(2000); // 2초 이내
    expect(metrics.fps.avg).toBeGreaterThan(30); // 평균 30fps 이상
  });
  
  test('수직 이동 (Pan Down) 성능 측정', async ({ page }) => {
    const metrics = await measurePan(page, 'down', 300);
    
    console.log('Pan Down Metrics:', metrics);
    
    expect(metrics.totalDuration).toBeLessThan(2000);
    expect(metrics.fps.avg).toBeGreaterThan(30);
  });
  
  test('대각선 이동 성능 측정', async ({ page }) => {
    const metrics = await measurePanDiagonal(page, 300, 300);
    
    console.log('Diagonal Pan Metrics:', metrics);
    
    expect(metrics.totalDuration).toBeLessThan(2500);
  });
  
  // 반복 테스트로 일관성 확인
  test('이동 성능 일관성 테스트 (10회 반복)', async ({ page }) => {
    const results = [];
    
    for (let i = 0; i < 10; i++) {
      const metrics = await measurePan(page, 'right', 200);
      results.push(metrics.totalDuration);
      
      // 원위치 복귀
      await measurePan(page, 'left', 200);
      await page.waitForTimeout(500);
    }
    
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const variance = results.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / results.length;
    const stdDev = Math.sqrt(variance);
    
    console.log('Consistency Test:', {
      avg,
      min: Math.min(...results),
      max: Math.max(...results),
      stdDev,
      variance
    });
    
    // 표준 편차가 평균의 20% 이내
    expect(stdDev / avg).toBeLessThan(0.2);
  });
  
});

// Pan 측정 헬퍼 함수
async function measurePan(page, direction, distance) {
  const centerX = 400;
  const centerY = 300;
  
  let endX = centerX;
  let endY = centerY;
  
  switch (direction) {
    case 'right': endX += distance; break;
    case 'left': endX -= distance; break;
    case 'down': endY += distance; break;
    case 'up': endY -= distance; break;
  }
  
  // FPS 측정 시작
  const fpsPromise = page.evaluate(() => {
    return new Promise((resolve) => {
      const frames = [];
      let lastTime = performance.now();
      let frameCount = 0;
      let isMeasuring = true;
      
      function countFrame() {
        if (!isMeasuring) return;
        
        const now = performance.now();
        const delta = now - lastTime;
        
        if (delta >= 100) { // 100ms마다 FPS 계산
          const fps = Math.round((frameCount * 1000) / delta);
          frames.push(fps);
          frameCount = 0;
          lastTime = now;
        }
        
        frameCount++;
        requestAnimationFrame(countFrame);
      }
      
      requestAnimationFrame(countFrame);
      
      window.stopFPS = () => {
        isMeasuring = false;
        resolve(frames);
      };
    });
  });
  
  // 드래그 수행
  const startTime = await page.evaluate(() => performance.now());
  
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  
  // 부드러운 드래그 (단계별)
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    const x = centerX + (endX - centerX) * (i / steps);
    const y = centerY + (endY - centerY) * (i / steps);
    await page.mouse.move(x, y);
    await page.waitForTimeout(16); // ~60fps
  }
  
  await page.mouse.up();
  const endTime = await page.evaluate(() => performance.now());
  
  // 렌더링 완료 대기
  await page.waitForTimeout(1000);
  const renderCompleteTime = await page.evaluate(() => performance.now());
  
  // FPS 측정 종료
  const fpsData = await page.evaluate(() => {
    window.stopFPS();
    return new Promise(resolve => setTimeout(() => resolve(window.fpsResult), 100));
  });
  
  return {
    dragDuration: endTime - startTime,
    renderDuration: renderCompleteTime - endTime,
    totalDuration: renderCompleteTime - startTime,
    fps: {
      data: fpsData,
      avg: fpsData.reduce((a, b) => a + b, 0) / fpsData.length,
      min: Math.min(...fpsData),
      max: Math.max(...fpsData)
    }
  };
}
```

### 시나리오 3: 지도 확대/축소 (Zoom) 성능

```javascript
// tests/performance/03-map-zoom.spec.js
test.describe('지도 확대/축소 성능', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const cogSource = window.cogSource;
      return cogSource && cogSource.getState() === 'ready';
    }, { timeout: 30000 });
    await page.waitForTimeout(2000);
  });
  
  test('줌 인 (Zoom In) 성능 측정', async ({ page }) => {
    const metrics = await measureZoom(page, 'in', 3);
    
    console.log('Zoom In Metrics:', metrics);
    
    expect(metrics.totalDuration).toBeLessThan(3000);
    expect(metrics.tileLoadTime).toBeLessThan(2000);
  });
  
  test('줌 아웃 (Zoom Out) 성능 측정', async ({ page }) => {
    // 먼저 줌 인
    await measureZoom(page, 'in', 2);
    await page.waitForTimeout(1000);
    
    const metrics = await measureZoom(page, 'out', 2);
    
    console.log('Zoom Out Metrics:', metrics);
    
    expect(metrics.totalDuration).toBeLessThan(3000);
  });
  
  test('연속 줌 성능 측정', async ({ page }) => {
    const results = [];
    
    for (let i = 0; i < 5; i++) {
      const metrics = await measureZoom(page, 'in', 1);
      results.push(metrics);
      await page.waitForTimeout(500);
    }
    
    const avgDuration = results.reduce((sum, r) => sum + r.totalDuration, 0) / results.length;
    
    console.log('Continuous Zoom Results:', {
      avgDuration,
      individualResults: results
    });
    
    expect(avgDuration).toBeLessThan(2000);
  });
  
  test('급격한 줌 변화 성능 측정', async ({ page }) => {
    const metrics = await measureZoom(page, 'in', 5);
    
    console.log('Rapid Zoom Metrics:', metrics);
    
    // 급격한 줌은 더 많은 타일 로딩 필요
    expect(metrics.totalDuration).toBeLessThan(5000);
  });
  
});

// Zoom 측정 헬퍼 함수
async function measureZoom(page, direction, levels) {
  const wheelDelta = direction === 'in' ? -100 : 100;
  
  // 줌 전 타일 캐시 상태 기록
  const beforeCache = await page.evaluate(() => {
    const cogSource = window.cogSource;
    return cogSource && cogSource.getTileCache ? 
      cogSource.getTileCache().getCount() : 0;
  });
  
  const startTime = await page.evaluate(() => performance.now());
  
  // 줌 수행
  await page.mouse.move(400, 300);
  
  for (let i = 0; i < levels; i++) {
    await page.mouse.wheel(0, wheelDelta);
    await page.waitForTimeout(200);
  }
  
  const zoomCompleteTime = await page.evaluate(() => performance.now());
  
  // 타일 로딩 완료 대기
  await page.waitForFunction((prevCount) => {
    const cogSource = window.cogSource;
    if (!cogSource || !cogSource.getTileCache) return false;
    
    const cache = cogSource.getTileCache();
    const currentCount = cache.getCount();
    
    // 새 타일이 로드되었고 일정 시간 안정화
    return currentCount > prevCount;
  }, { timeout: 10000 }, beforeCache);
  
  const tileLoadTime = await page.evaluate(() => performance.now());
  
  // 추가 안정화 대기
  await page.waitForTimeout(500);
  const renderCompleteTime = await page.evaluate(() => performance.now());
  
  return {
    zoomDuration: zoomCompleteTime - startTime,
    tileLoadTime: tileLoadTime - zoomCompleteTime,
    renderDuration: renderCompleteTime - tileLoadTime,
    totalDuration: renderCompleteTime - startTime
  };
}
```

---

## 📊 결과 분석 및 보고

### 1. 메트릭 집계 형식

```json
{
  "testRun": {
    "timestamp": "2026-02-14T10:30:00Z",
    "environment": {
      "browser": "chromium-120",
      "os": "linux",
      "network": "wifi-100mbps",
      "screenResolution": "1280x720"
    },
    "summary": {
      "totalTests": 15,
      "passed": 15,
      "failed": 0,
      "avgPageLoadTime": 2500,
      "avgPanDuration": 850,
      "avgZoomDuration": 1200
    }
  },
  "pageLoad": {
    "fcp": { "min": 800, "max": 1200, "avg": 950, "p95": 1150 },
    "lcp": { "min": 1500, "max": 2800, "avg": 2100, "p95": 2700 },
    "cogReady": { "min": 2000, "max": 4500, "avg": 3200, "p95": 4300 },
    "ttfb": { "min": 50, "max": 150, "avg": 80, "p95": 140 }
  },
  "panInteraction": {
    "right": { "dragDuration": { "avg": 300 }, "totalDuration": { "avg": 850 }, "fps": { "avg": 45 } },
    "down": { "dragDuration": { "avg": 320 }, "totalDuration": { "avg": 880 }, "fps": { "avg": 43 } }
  },
  "zoomInteraction": {
    "in": { "zoomDuration": { "avg": 400 }, "tileLoadTime": { "avg": 800 }, "totalDuration": { "avg": 1200 } },
    "out": { "zoomDuration": { "avg": 350 }, "tileLoadTime": { "avg": 750 }, "totalDuration": { "avg": 1100 } }
  },
  "network": {
    "totalTileRequests": 45,
    "avgTileLoadTime": 320,
    "cachedTileRatio": 0.35
  }
}
```

### 2. 성능 보고서 템플릿

```markdown
# 성능 테스트 보고서

## 실행 정보
- **실행일**: 2026-02-14
- **브라우저**: Chromium 120
- **네트워크**: WiFi (100 Mbps)
- **테스트 횟수**: 5회 평균

## 요약

| 측정 항목 | 평균 | 목표 | 상태 |
|-----------|------|------|------|
| 첫 화면 로딩 | 2.5초 | < 3초 | ✅ PASS |
| COG 로딩 완료 | 3.2초 | < 5초 | ✅ PASS |
| 지도 이동 | 0.85초 | < 2초 | ✅ PASS |
| 지도 줌 인 | 1.2초 | < 3초 | ✅ PASS |
| 평균 FPS (이동 중) | 45fps | > 30fps | ✅ PASS |

## 상세 결과

### 1. 첫 화면 로딩
- FCP: 0.95초 (p95: 1.15초)
- LCP: 2.1초 (p95: 2.7초)
- TTI: 2.5초

### 2. 지도 이동
- 평균 소요 시간: 0.85초
- 최소 FPS: 38fps
- 평균 FPS: 45fps

### 3. 지도 확대/축소
- 줌 인 평균: 1.2초
- 줌 아웃 평균: 1.1초
- 타일 로딩: 0.8초 (평균)

## 권장사항

1. **최적화 필요 영역**: 없음 (모든 메트릭이 목표 달성)
2. **모니터링 대상**: COG 로딩 시간이 네트워크 상태에 민감함
3. **추가 테스트 필요**: 3G/4G 네트워크 환경에서의 성능
```

### 3. CI/CD 통합

```yaml
# .github/workflows/performance-test.yml
name: Performance Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1'  # 매주 월요일

jobs:
  performance-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install chromium
      
      - name: Run performance tests
        run: npm run test:performance
        env:
          CI: true
      
      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: performance-results
          path: |
            test-results/
            performance-report.json
      
      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('performance-results.json', 'utf8'));
            
            const body = `## 🚀 성능 테스트 결과
            
            | 측정 항목 | 현재 | 기준 | 상태 |
            |-----------|------|------|------|
            | 첫 화면 로딩 | ${results.pageLoad.avg}ms | < 3000ms | ${results.pageLoad.avg < 3000 ? '✅' : '❌'} |
            | 지도 이동 | ${results.pan.avg}ms | < 2000ms | ${results.pan.avg < 2000 ? '✅' : '❌'} |
            | 지도 줌 | ${results.zoom.avg}ms | < 3000ms | ${results.zoom.avg < 3000 ? '✅' : '❌'} |
            
            [상세 보고서 보기](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });
```

---

## 📝 부록

### A. 성능 측정 유틸리티 코드

```javascript
// tests/performance/helpers/metrics-collector.js

class PerformanceMetricsCollector {
  constructor(page) {
    this.page = page;
    this.metrics = [];
  }
  
  async startCollection() {
    await this.page.addInitScript(() => {
      window.__perfMetrics = {
        marks: {},
        measures: [],
        resources: []
      };
      
      // Performance Observer 설정
      const observers = {
        paint: new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            window.__perfMetrics.marks[entry.name] = entry.startTime;
          });
        }),
        navigation: new PerformanceObserver((list) => {
          window.__perfMetrics.navigation = list.getEntries()[0];
        }),
        resource: new PerformanceObserver((list) => {
          window.__perfMetrics.resources.push(...list.getEntries());
        })
      };
      
      observers.paint.observe({ type: 'paint', buffered: true });
      observers.navigation.observe({ type: 'navigation', buffered: true });
      observers.resource.observe({ type: 'resource', buffered: true });
    });
  }
  
  async mark(name) {
    await this.page.evaluate((n) => {
      performance.mark(n);
      window.__perfMetrics.marks[n] = performance.now();
    }, name);
  }
  
  async measure(name, startMark, endMark) {
    await this.page.evaluate((n, s, e) => {
      performance.measure(n, s, e);
      const measure = performance.getEntriesByName(n)[0];
      window.__perfMetrics.measures.push(measure);
    }, name, startMark, endMark);
  }
  
  async getMetrics() {
    return await this.page.evaluate(() => window.__perfMetrics);
  }
  
  async getOpenLayersMetrics() {
    return await this.page.evaluate(() => {
      const map = window.map;
      const cogSource = window.cogSource;
      
      if (!map || !cogSource) return null;
      
      return {
        mapCenter: map.getView().getCenter(),
        mapZoom: map.getView().getZoom(),
        sourceState: cogSource.getState(),
        tileCacheCount: cogSource.getTileCache ? 
          cogSource.getTileCache().getCount() : 0,
        renderedTileCount: map.getAllLayers().reduce((sum, layer) => {
          if (layer.getRenderer && layer.getRenderer()) {
            const tiles = layer.getRenderer().getTileCache &&
              layer.getRenderer().getTileCache();
            return sum + (tiles ? tiles.getCount() : 0);
          }
          return sum;
        }, 0)
      };
    });
  }
}

module.exports = { PerformanceMetricsCollector };
```

### B. 네트워크 조건 시뮬레이션

```javascript
// tests/performance/helpers/network-throttle.js

const networkConditions = {
  wifi: { download: 100 * 1024 * 1024 / 8, upload: 50 * 1024 * 1024 / 8, latency: 2 },
  '4g': { download: 20 * 1024 * 1024 / 8, upload: 10 * 1024 * 1024 / 8, latency: 50 },
  '3g': { download: 1.6 * 1024 * 1024 / 8, upload: 768 * 1024 / 8, latency: 300 }
};

async function emulateNetwork(page, condition) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: networkConditions[condition].download,
    uploadThroughput: networkConditions[condition].upload,
    latency: networkConditions[condition].latency
  });
}

module.exports = { emulateNetwork, networkConditions };
```

### C. npm 스크립트 추가

```json
{
  "scripts": {
    "test:performance": "playwright test tests/performance",
    "test:performance:report": "playwright test tests/performance --reporter=html",
    "test:performance:ci": "playwright test tests/performance --reporter=line",
    "test:performance:headed": "playwright test tests/performance --headed"
  }
}
```

---

## 🎯 성능 기준 (Baseline)

| 측정 항목 | 목표값 | 최소값 | 우수값 |
|-----------|--------|--------|--------|
| FCP | < 1.5초 | < 3초 | < 1초 |
| LCP | < 2.5초 | < 4초 | < 1.5초 |
| COG Ready | < 5초 | < 10초 | < 3초 |
| Pan Duration | < 2초 | < 3초 | < 1초 |
| Zoom Duration | < 3초 | < 5초 | < 1.5초 |
| Avg FPS | > 30fps | > 20fps | > 50fps |

---

**문서 버전**: 1.0  
**작성일**: 2026-02-14  
**대상 프로젝트**: cog-viewer-openlayers
