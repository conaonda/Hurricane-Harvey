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
# http://localhost:5173
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
cog-viewer-openlayers/
├── src/
│   └── main.js          # 메인 애플리케이션 로직
├── index.html           # HTML 템플릿 및 스타일
├── package.json         # 프로젝트 의존성
├── vite.config.js       # Vite 설정
└── README.md            # 프로젝트 문서
```

## 🔧 설정 및 커스터마이징

### COG URL 변경

`src/main.js`에서 `COG_URL` 상수를 수정하여 다른 COG 영상을 로드할 수 있습니다:

```javascript
const COG_URL = 'https://your-cog-url.tif'
```

### 옵션 설정

```javascript
const cogSource = new GeoTIFFSource({
  sources: [{
    url: COG_URL,
    bands: [1, 2, 3]        // RGB 밴드 선택
  }],
  normalize: true,         // 픽셀값 정규화
  convertToRGB: false,     // RGB 변환 여부
  opaque: false,          // 투명도 지원
  sourceOptions: {
    allowFullFile: false  // 전체 파일 다운로드 방지
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

## 📚 참고 자료

- [OpenLayers GeoTIFFSource 문서](https://openlayers.org/en/latest/apidoc/module-ol_source_GeoTIFF-GeoTIFFSource.html)
- [Cloud Optimized GeoTIFF 스펙](https://www.cogeo.org/)
