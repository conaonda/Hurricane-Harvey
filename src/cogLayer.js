import WebGLTileLayer from 'ol/layer/WebGLTile'
import GeoTIFFSource from 'ol/source/GeoTIFF'
import TileGrid from 'ol/tilegrid/TileGrid.js'
import { transformExtent, transform, get as getProjection } from 'ol/proj'
import { fromUrl as tiffFromUrl } from 'geotiff'

const applyAffineBypass = (cogSource, cogView, viewProjection, targetTileSize) => {
  const srcExtent = cogView.extent
  const srcProj = cogView.projection
  const srcTileGrid = cogSource.tileGrid

  const dstExtent = transformExtent(srcExtent, srcProj, viewProjection)

  const scaleX = (dstExtent[2] - dstExtent[0]) / (srcExtent[2] - srcExtent[0])
  const srcResolutions = srcTileGrid.getResolutions()
  let dstResolutions = srcResolutions.map(r => r * scaleX)

  const tileSizes = srcResolutions.map((_, z) => {
    const src = srcTileGrid.getTileSize(z)
    const srcW = Array.isArray(src) ? src[0] : src
    const srcH = Array.isArray(src) ? src[1] : src
    const factor = Math.max(1, Math.round(targetTileSize / srcW))
    return [srcW * factor, srcH * factor]
  })

  // 뷰 해상도가 타일 그리드 최저 해상도를 초과해도 렌더링되도록
  // 더 거친 해상도 레벨을 추가
  const MAX_SOURCE_TILE_DIM = 2048
  const MIN_SCREEN_PX = 100
  const extW = dstExtent[2] - dstExtent[0]
  const extH = dstExtent[3] - dstExtent[1]
  const maxViewRes = Math.min(extW, extH) / MIN_SCREEN_PX

  let renderTileSizes
  let sourceTileSizes
  let extraCount = 0

  if (dstResolutions[0] < maxViewRes) {
    const baseTile = tileSizes[0]
    const extraResolutions = []
    const extraRenderTileSizes = []
    const extraSourceTileSizes = []

    let r = dstResolutions[0] * 2
    let factor = 2
    while (true) {
      extraResolutions.push(r)
      extraRenderTileSizes.push([baseTile[0], baseTile[1]])
      const cappedW = Math.min(baseTile[0] * factor, MAX_SOURCE_TILE_DIM)
      const cappedH = Math.min(baseTile[1] * factor, MAX_SOURCE_TILE_DIM)
      extraSourceTileSizes.push([cappedW, cappedH])
      if (r >= maxViewRes) break
      r *= 2
      factor *= 2
    }
    extraCount = extraResolutions.length

    // coarsest가 index 0이 되도록 역순 정렬
    extraResolutions.reverse()
    extraRenderTileSizes.reverse()
    extraSourceTileSizes.reverse()

    dstResolutions = [...extraResolutions, ...dstResolutions]
    renderTileSizes = [...extraRenderTileSizes, ...tileSizes]
    sourceTileSizes = [...extraSourceTileSizes, ...tileSizes]
  } else {
    renderTileSizes = tileSizes
    sourceTileSizes = tileSizes
  }

  const dstTileGrid = new TileGrid({
    extent: dstExtent,
    minZoom: srcTileGrid.getMinZoom(),
    resolutions: dstResolutions,
    tileSizes: renderTileSizes
  })

  cogSource.projection = getProjection(viewProjection)
  cogSource.tileGrid = dstTileGrid
  cogSource.tileGridForProjection_ = {}
  cogSource.transformMatrix = null
  cogSource.setTileSizes(sourceTileSizes)

  // 추가 레벨에 대응하는 sourceImagery_ / sourceMasks_ 패딩
  if (extraCount > 0) {
    const imagery = cogSource.sourceImagery_[0]
    const coarsestImage = imagery[0]
    for (let i = 0; i < extraCount; i++) {
      imagery.unshift(coarsestImage)
    }
    const masks = cogSource.sourceMasks_[0]
    for (let i = 0; i < extraCount; i++) {
      masks.unshift(undefined)
    }
  }

  const maxSrcDim = sourceTileSizes.reduce((m, s) => Math.max(m, s[0], s[1]), 0)
  console.log('[DIAG] applyAffineBypass:', {
    from: srcProj.getCode(),
    to: viewProjection,
    scaleX: scaleX.toFixed(6),
    dstResolutions,
    maxViewRes: maxViewRes.toFixed(4),
    extraLevels: extraCount,
    maxSourceTileDim: maxSrcDim,
    transformMatrix: cogSource.transformMatrix,
    sourceImageryLen: cogSource.sourceImagery_[0]?.length
  })
}

export const getMinMaxFromOverview = async (tiff, bands) => {
  const count = await tiff.getImageCount()
  const image = await tiff.getImage(count - 1)
  const rasters = await image.readRasters({ samples: bands.map(b => b - 1) })

  const stats = []
  for (const band of rasters) {
    let min = Infinity, max = -Infinity
    for (let i = 0; i < band.length; i++) {
      const v = band[i]
      if (v === 0) continue
      if (v < min) min = v
      if (v > max) max = v
    }
    if (!isFinite(min) || !isFinite(max)) {
      min = 0
      max = 1
    }
    stats.push({ min, max })
  }
  return { stats, rasters, width: image.getWidth(), height: image.getHeight() }
}

export const detectBands = async (tiff) => {
  const image = await tiff.getImage(0)
  const samplesPerPixel = image.getSamplesPerPixel()
  const photometric = image.fileDirectory.PhotometricInterpretation
  const extraSamples = image.fileDirectory.ExtraSamples

  const alphaCount = extraSamples
    ? extraSamples.filter(v => v === 1 || v === 2).length
    : 0
  const dataBands = samplesPerPixel - alphaCount

  if (photometric === 2 && dataBands >= 3) {
    return { type: 'rgb', bands: [1, 2, 3] }
  }
  if (dataBands >= 3) {
    return { type: 'rgb', bands: [1, 2, 3] }
  }
  return { type: 'gray', bands: [1] }
}

const buildStyle = (bandInfo, stats) => {
  if (bandInfo.type === 'rgb') {
    return {
      color: [
        'array',
        ['/', ['-', ['band', 1], stats[0].min], stats[0].max - stats[0].min],
        ['/', ['-', ['band', 2], stats[1].min], stats[1].max - stats[1].min],
        ['/', ['-', ['band', 3], stats[2].min], stats[2].max - stats[2].min],
        ['/', ['band', 4], 255]
      ]
    }
  }
  const norm = ['/', ['-', ['band', 1], stats[0].min], stats[0].max - stats[0].min]
  return {
    color: ['array', norm, norm, norm, ['/', ['band', 2], 255]]
  }
}

const createCOGSource = (url, bands) => {
  return new GeoTIFFSource({
    sources: [{
      url: url,
      bands: bands,
      nodata: 0
    }],
    normalize: false,
    convertToRGB: false,
    opaque: false,
    sourceOptions: {
      allowFullFile: false
    }
  })
}

export async function createCOGLayer({ url, bands, projectionMode, viewProjection, targetTileSize = 256 }) {
  const tiff = await tiffFromUrl(url)

  const bandInfo = bands
    ? { type: 'rgb', bands }
    : await detectBands(tiff)
  const resolvedBands = bandInfo.bands

  console.log('Band detection:', bandInfo)

  const source = createCOGSource(url, resolvedBands)
  const [cogView, { stats }] = await Promise.all([
    source.getView(),
    getMinMaxFromOverview(tiff, resolvedBands)
  ])
  const cogProjection = cogView.projection
  const cogExtent = cogView.extent

  const imageCount = await tiff.getImageCount()
  const hasInfinity = stats.some(s => !isFinite(s.min) || !isFinite(s.max))
  console.log('[DIAG] createCOGLayer:', {
    imageCount,
    transformMatrix: source.transformMatrix,
    statsValid: !hasInfinity,
    stats,
    sourceImageryLen: source.sourceImagery_?.[0]?.length
  })

  if (projectionMode === 'affine') {
    applyAffineBypass(source, cogView, viewProjection, targetTileSize)
  }

  const extent = cogExtent ? transformExtent(cogExtent, cogProjection, viewProjection) : undefined
  const center = cogView.center ? transform(cogView.center, cogProjection, viewProjection) : undefined

  console.log('COG Info:', {
    cogExtent,
    cogProjection: cogProjection?.getCode(),
    viewExtent: extent,
    viewProjection,
    zoom: cogView.zoom,
    projectionMode
  })
  console.log('Band min/max stats:', stats)

  const layer = new WebGLTileLayer({
    source: source,
    style: buildStyle(bandInfo, stats),
    extent: extent
  })

  return { layer, source, extent, center, zoom: cogView.zoom }
}
