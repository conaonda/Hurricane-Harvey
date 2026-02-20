# COG Viewer with OpenLayers

OpenLayers 기반 Cloud Optimized GeoTIFF (COG) 영상 가시화 웹 애플리케이션

![OpenLayers](https://img.shields.io/badge/OpenLayers-10.x-blue)
![Vite](https://img.shields.io/badge/Vite-6.x-646CFF)

**라이브 데모**: https://conaonda.github.io/Hurricane-Harvey/

## 📖 개요

이 프로젝트는 Cloud Optimized GeoTIFF (COG) 형식의 위성·SAR 영상을 웹에서 직접 시각화하는 데모 애플리케이션입니다. OpenLayers의 WebGLTile 레이어를 활용하여 대용량 위성 영상을 효율적으로 렌더링하며, **회전된 SAR 영상**(ModelTransformation 포함 GeoTIFF)을 아핀 변환 기반으로 정확하게 표시합니다.

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
- **COG 직접 로드**: 클라우드 스토리지에서 COG 파일을 직접 스트리밍
- **자동 좌표계 인식**: 영상의 원본 좌표계(Projection) 자동 감지
- **WebGL 가속**: OpenLayers WebGLTile 레이어로 고성능 렌더링
- **회전 SAR 영상 지원**: ModelTransformation 기반 아핀 변환으로 회전·전단된 영상 정확 표시
- **프로그레시브 로딩**: 줌 레벨 전환 시 하위 해상도 타일을 플레이스홀더로 표시

### 🎯 사용자 인터랙션
- **마우스/터치 네비게이션**: 줌, 팬, 회전 지원
- **좌표 표시**: 실시간 마우스 위치의 좌표 및 경위도(WGS84) 표시
- **영상 범위 자동 맞춤**: 로드 완료 시 영상 영역으로 자동 이동
- **URL 입력**: 헤더의 URL 필드로 임의의 COG 영상 즉시 로드

### 🎨 UI/UX
- **로딩 인디케이터**: 영상 로딩 상태 표시
- **에러 핸들링**: 로드 실패 시 사용자 친화적 에러 메시지
- **반응형 디자인**: 다양한 화면 크기 지원

## 🛠️ 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|
| OpenLayers | 10.4.0 | 지도 엔진 및 COG 렌더링 |
| Vite | 6.1.0 | 빌드 도구 및 개발 서버 |
| geotiff.js | — | GeoTIFF 파싱 및 래스터 읽기 |

## 📁 프로젝트 구조

```
├── src/
│   ├── main.js              # 메인 애플리케이션 (UI, URL 파라미터, 레이어 조율)
│   ├── cogLayer.js          # WebGLTile 기반 COG 레이어 생성 (affine 모드 포함)
│   ├── cogImageLayer.js     # Canvas 기반 COG 이미지 레이어 (image 렌더 모드)
│   └── AffineTileLayer.js   # WebGL renderTile 아핀 변환 패치
├── tests/
│   └── performance/         # Playwright 성능 테스트
│       ├── 01-page-load.spec.js
│       ├── 02-map-pan.spec.js
│       ├── 03-map-zoom.spec.js
│       ├── 04-detailed-state.spec.js
│       └── helpers/
│           └── metrics-collector.js
├── docs/
│   ├── testing-guide.md         # 테스트 가이드
│   └── reprojection-analysis.md # 리프로젝션 파이프라인 분석
├── public/
│   └── style.json           # 베이스맵 스타일
├── index.html               # HTML 템플릿 및 스타일
├── playwright.config.js     # Playwright 설정
├── vite.config.js           # Vite 설정
├── CLAUDE.md                # AI 코딩 지침
└── package.json             # 프로젝트 의존성
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
- `affine` — 아핀 변환 기반 좌표 매핑 (기본값). 회전·전단된 SAR 영상에 필요
- `reproject` — proj4 기반 좌표계 재투영. 비회전 영상에 적합

**render 값 설명:**
- `tile` — OpenLayers WebGLTile 레이어 기반 타일 렌더링 (기본값)
- `image` — 뷰포트 단위 이미지 렌더링. 전체 뷰를 하나의 이미지로 요청

**사용 예시:**

```
https://conaonda.github.io/Hurricane-Harvey/?url=https://example.com/my-image.tif
https://conaonda.github.io/Hurricane-Harvey/?mode=affine&tileSize=512
https://conaonda.github.io/Hurricane-Harvey/?mode=reproject
https://conaonda.github.io/Hurricane-Harvey/?render=image
```

### COG URL 변경

헤더의 URL 입력 필드에 COG URL을 입력하고 **로드** 버튼을 클릭하면 페이지 리로드 없이 영상이 교체됩니다.

## 🗺️ 데이터 예시

### Hurricane Harvey SkySat 영상 (기본값)

| 속성 | 값 |
|------|-----|
| **데이터셋** | SkySat_20170831T195552Z_RGB.tif |
| **촬영일** | 2017년 8월 31일 |
| **지역** | Hurricane Harvey 재해 지역 (미국 텍사스) |
| **좌표계** | EPSG:32615 (UTM Zone 15N) |

### Umbra SAR 영상 (회전 영상 예시)

```
https://conaonda.github.io/Hurricane-Harvey/?url=https://umbra-open-data-catalog.s3.amazonaws.com/sar-data/tasks/Tanna%20Island,%20Vanuatu/9c76a918-9247-42bf-b9f6-3b4f672bc148/2023-02-12-21-33-56_UMBRA-04/2023-02-12-21-33-56_UMBRA-04_GEC.tif
```

## 🧩 아키텍처: Affine Bypass

회전된 SAR 영상(ModelTransformation 포함 GeoTIFF)은 OL의 기본 축-정렬 타일 그리드로 올바르게 표시되지 않습니다. 이를 해결하기 위해 두 가지 패치를 적용합니다.

### 1. 렌더러 패치 (`AffineTileLayer.js`)

`WebGLTileLayer`의 `renderTile`을 monkey-patch하여 각 타일마다 3단 아핀 행렬을 계산합니다:

```
M_final = viewToClip × pixelToView × texToPixel
```

- `texToPixel`: 텍스처 [0,1]² → 전체 해상도 픽셀 좌표
- `pixelToView`: 픽셀 좌표 → 뷰 CRS (ModelTransformation에서 파생)
- `viewToClip`: 뷰 CRS → WebGL clip space [-1,1]²

### 2. 타일 그리드 패치 (`cogLayer.js`)

- **`getTileRangeForExtentAndZ`**: 뷰 영역 4꼭짓점을 픽셀 좌표로 역변환하여 올바른 타일 범위 반환 (줌인 후 타일 누락 방지)
- **`getTileRangeForTileCoordAndZ`**: pixel-space 기반 부모/자식 타일 계산 (프로그레시브 로딩용 placeholder 정확도 보장)
- **`tileCoordIntersectsViewport`**: 항상 `true` 반환 (회전 뷰에서 타일 누락 방지)

## 🧪 테스트

Playwright 기반 성능 테스트로 페이지 로딩, 팬/줌 인터랙션, COG 상태를 측정합니다.

```bash
npm run build
npm run test:performance
```

자세한 내용은 [docs/testing-guide.md](docs/testing-guide.md) 참조.

## 📚 참고 자료

- [OpenLayers GeoTIFFSource 문서](https://openlayers.org/en/latest/apidoc/module-ol_source_GeoTIFF-GeoTIFFSource.html)
- [Cloud Optimized GeoTIFF 스펙](https://www.cogeo.org/)
- [리프로젝션 파이프라인 분석](docs/reprojection-analysis.md)
