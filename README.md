# COG Viewer with OpenLayers

OpenLayers 기반 Cloud Optimized GeoTIFF (COG) 영상 가시화 웹 애플리케이션

![OpenLayers](https://img.shields.io/badge/OpenLayers-10.x-blue)
![Vite](https://img.shields.io/badge/Vite-6.x-646CFF)

## 📖 개요

이 프로젝트는 Hurricane Harvey 재해 지역의 SkySat 위성 영상을 **Cloud Optimized GeoTIFF (COG)** 형식으로 웹에서 직접 시각화하는 데모 애플리케이션입니다. OpenLayers의 WebGLTile 레이어를 활용하여 대용량 위성 영상을 효율적으로 렌더링합니다.

### COG란?

**Cloud Optimized GeoTIFF**는 클라우드 스토리지에서 효율적으로 스트리밍할 수 있도록 최적화된 GeoTIFF 형식입니다. 전체 파일을 다운로드하지 않고도 특정 영역의 타일만 선택적으로 로드할 수 있어 대용량 영상 데이터의 웹 가시화에 최적화되어 있습니다.

## 🚀 시작하기

### 요구사항

- Node.js 18+
- npm

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 브라우저에서 열기
# http://localhost:3000
```

### 빌드

```bash
# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

## 📋 주요 기능

### 🗺️ 영상 가시화
- **COG 직접 로드**: 구글 클라우드 스토리지에서 COG 파일을 직접 스트리밍
- **자동 좌표계 인식**: 영상의 원본 좌표계(Projection) 자동 감지
- **WebGL 가속**: OpenLayers WebGLTile 레이어로 고성능 렌더링

### 🎯 사용자 인터랙션
- **마우스/터치 네비게이션**: 줌, 팬, 회전 지원
- **좌표 표시**: 실시간 마우스 위치의 좌표 및 경위도(WGS84) 표시
- **영상 범위 자동 맞춤**: 로드 완료 시 영상 영역으로 자동 이동

### 🎨 UI/UX
- **로딩 인디케이터**: 영상 로딩 상태 표시
- **에러 핸들링**: 로드 실패 시 사용자 친화적 에러 메시지
- **반응형 디자인**: 다양한 화면 크기 지원

## 🛠️ 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|
| OpenLayers | 10.4.0 | 지도 엔진 및 COG 렌더링 |
| Vite | 6.1.0 | 빌드 도구 및 개발 서버 |

## 📁 프로젝트 구조

```
├── src/
│   └── main.js                # 메인 애플리케이션 로직
├── tests/
│   └── performance/           # Playwright 성능 테스트
│       ├── 01-page-load.spec.js
│       ├── 02-map-pan.spec.js
│       ├── 03-map-zoom.spec.js
│       ├── 04-detailed-state.spec.js
│       └── helpers/
│           └── metrics-collector.js
├── docs/
│   └── testing-guide.md       # 테스트 가이드 (통합 문서)
├── index.html                 # HTML 템플릿 및 스타일
├── playwright.config.js       # Playwright 설정
├── vite.config.js             # Vite 설정
├── CLAUDE.md                  # AI 코딩 지침
└── package.json               # 프로젝트 의존성
```

## 🔧 설정 및 커스터마이징

### URL 파라미터

URL 쿼리 파라미터로 렌더링 동작을 제어할 수 있습니다.

| 파라미터 | 기본값 | 값 | 설명 |
|----------|--------|----|------|
| `url` | Hurricane Harvey SkySat URL | COG URL | 초기 로드할 COG 영상 URL |
| `mode` | `affine` | `affine`, `reproject` | 좌표계 투영 처리 방식 |
| `render` | `tile` | `tile`, `image` | 렌더링 파이프라인 선택 |
| `tileSize` | `256` | 양의 정수 | `mode=affine` + `render=tile`에서 타일 스케일업 크기 |

**mode 값 설명:**
- `affine` — Affine 변환 기반 좌표 매핑 (기본값). 좌표계가 유사할 때 빠르게 동작
- `reproject` — proj4 기반 좌표계 재투영. 정확한 좌표 변환이 필요할 때 사용

**render 값 설명:**
- `tile` — OpenLayers WebGLTile 레이어 기반 타일 렌더링 (기본값)
- `image` — 뷰포트 단위 이미지 렌더링. 전체 뷰를 하나의 이미지로 요청

**사용 예시:**

```
http://localhost:3000/?url=https://example.com/my-image.tif
http://localhost:3000/?mode=affine&tileSize=512
http://localhost:3000/?mode=reproject
http://localhost:3000/?render=image
http://localhost:3000/?url=https://example.com/my-image.tif&render=image
```

### COG URL 변경

헤더의 URL 입력 필드에 COG URL을 입력하고 **로드** 버튼을 클릭하면 페이지 리로드 없이 영상이 교체됩니다. `url` 쿼리 파라미터로도 초기 영상을 지정할 수 있습니다.

### 옵션 설정

```javascript
const cogSource = new GeoTIFFSource({
  sources: [{
    url: COG_URL,
    bands: [1, 2, 3],       // RGB 밴드 선택
    nodata: 0               // nodata 값 설정
  }],
  normalize: true,           // 픽셀값 정규화
  convertToRGB: false,       // RGB 변환 여부
  opaque: false,             // 투명도 지원
  sourceOptions: {
    allowFullFile: false     // 전체 파일 다운로드 방지
  }
})
```

## 🗺️ 데이터 정보

### Hurricane Harvey SkySat 영상

| 속성 | 값 |
|------|-----|
| **데이터셋** | SkySat_20170831T195552Z_RGB.tif |
| **촬영일** | 2017년 8월 31일 |
| **지역** | Hurricane Harvey 재해 지역 (미국 텍사스) |
| **URL** | `https://storage.googleapis.com/pdd-stac/disasters/hurricane-harvey/0831/SkySat_20170831T195552Z_RGB.tif` |

## 🧪 테스트

Playwright 기반 성능 테스트로 페이지 로딩, 팬/줌 인터랙션, COG 상태를 측정한다.

```bash
npm run build
npm run test:performance
```

자세한 내용은 [docs/testing-guide.md](docs/testing-guide.md) 참조.

## 📚 참고 자료

- [OpenLayers GeoTIFFSource 문서](https://openlayers.org/en/latest/apidoc/module-ol_source_GeoTIFF-GeoTIFFSource.html)
- [Cloud Optimized GeoTIFF 스펙](https://www.cogeo.org/)
