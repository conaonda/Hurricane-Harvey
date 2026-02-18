# COG 뷰어 리프로젝션 분석

## 개요

COG 뷰어에서 리프로젝션이 발생하는지, 발생한다면 CPU/GPU 중 어디서 처리되는지 조사한 결과입니다.

**결론**: 리프로젝션이 매 타일마다 발생하고 있으며, GPU 가속(WebGL 셰이더)으로 처리되지만 CPU 오버헤드가 수반됩니다.

## 좌표계 불일치

| 항목 | 좌표계 |
|------|--------|
| COG 원본 (SkySat Hurricane Harvey) | EPSG:32615 (UTM Zone 15N) |
| Map View | EPSG:3857 (Web Mercator) |

`src/main.js`에서 `GeoTIFFSource`에 `projection` 옵션을 지정하지 않으므로, OpenLayers가 GeoTIFF 메타데이터(`ProjectedCSTypeGeoKey: 32615`)에서 좌표계를 자동 추출합니다. View는 `EPSG:3857`로 설정되어 있어 불일치가 발생합니다.

## 리프로젝션 파이프라인

```
GeoTIFF 타일 (EPSG:32615, UTM)
        │
        ▼  source/DataTile.js — equivalent(32615, 3857) = false
        │  → getReprojTile_() 분기
        │
ReprojDataTile.load()
        │
        ├─ [CPU] reproj/Triangulation.js
        │  proj4 좌표 변환으로 삼각형 메쉬 생성
        │  타일당 수십 회의 좌표 변환 호출
        │
        ├─ [GPU] reproj/glreproj.js
        │  WebGL 오프스크린 캔버스에서 삼각형 텍스처 워프
        │  - 소스 타일을 텍스처로 업로드
        │  - 삼각형 메쉬의 각 정점을 타겟 좌표계로 매핑
        │  - 프래그먼트 셰이더가 픽셀 리샘플링 수행
        │
        ├─ [CPU] gl.readPixels()
        │  GPU → CPU 리드백 (GPU 파이프라인 플러시 강제)
        │  리프로젝션된 타일 데이터를 Float32Array로 반환
        │
        ▼
WebGLTileLayer [GPU]
        │  이미 EPSG:3857인 타일 데이터를 수신
        │  밴드 스타일 수식을 프래그먼트 셰이더로 적용
        ▼
화면 출력
```

## CPU/GPU 역할 분담

### CPU 처리 (타일당)

| 단계 | 위치 | 내용 |
|------|------|------|
| 삼각형 메쉬 생성 | `reproj/Triangulation.js` | proj4로 소스↔타겟 좌표 변환, 최대 2^10 삼각형까지 세분화 |
| GPU 리드백 | `reproj/DataTile.js:490` | `gl.readPixels()`로 리프로젝션된 픽셀 데이터를 CPU 메모리로 복사 |

### GPU 처리 (타일당)

| 단계 | 위치 | 내용 |
|------|------|------|
| 텍스처 워프 | `reproj/glreproj.js` | 삼각형 메쉬 기반 텍스처 매핑으로 픽셀 리샘플링 |
| 밴드 스타일 렌더링 | `layer/WebGLTile.js` | 리프로젝션 완료된 타일에 `['/', ['-', ['band', N], min], range]` 스타일 적용 |

## 관련 OpenLayers 소스 코드

| 파일 | 역할 |
|------|------|
| `ol/source/GeoTIFF.js:522-532` | GeoTIFF 메타데이터에서 좌표계 추출 |
| `ol/source/DataTile.js:293-308` | 좌표계 불일치 감지 → `ReprojDataTile` 분기 |
| `ol/reproj/Triangulation.js` | 소스↔타겟 좌표 변환 삼각형 메쉬 생성 |
| `ol/reproj/DataTile.js:317-518` | 리프로젝션 실행 (WebGL 컨텍스트 생성 + readPixels) |
| `ol/reproj/glreproj.js` | GPU 셰이더 기반 삼각형 텍스처 워프 |

## 가능한 대응 방안

| 방안 | 효과 | 트레이드오프 |
|------|------|-------------|
| **COG를 EPSG:3857로 사전 변환** | 리프로젝션 완전 제거 | 코드 변경 없음. `gdalwarp`으로 원본 파일 재가공 필요. 파일 크기 증가 가능 |
| **View를 EPSG:32615(UTM)로 변경** | COG 리프로젝션 제거 | OSM 베이스맵이 대신 리프로젝션됨. 지도 표시 왜곡 가능 |
| **현재 상태 유지** | 변경 없음 | GPU 가속이므로 성능상 큰 문제 없음. `gl.readPixels()` 리드백이 유일한 병목 |

## 참고: gdalwarp 변환 예시

```bash
gdalwarp -t_srs EPSG:3857 \
  -of COG \
  -co COMPRESS=DEFLATE \
  -co TILING_SCHEME=GoogleMapsCompatible \
  input.tif output_3857.tif
```
