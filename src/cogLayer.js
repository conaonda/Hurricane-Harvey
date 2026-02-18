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
  const dstResolutions = srcResolutions.map(r => r * scaleX)

  const tileSizes = srcResolutions.map((_, z) => {
    const src = srcTileGrid.getTileSize(z)
    const srcW = Array.isArray(src) ? src[0] : src
    const srcH = Array.isArray(src) ? src[1] : src
    const factor = Math.max(1, Math.round(targetTileSize / srcW))
    return [srcW * factor, srcH * factor]
  })

  const dstTileGrid = new TileGrid({
    extent: dstExtent,
    minZoom: srcTileGrid.getMinZoom(),
    resolutions: dstResolutions,
    tileSizes: tileSizes
  })

  cogSource.projection = getProjection(viewProjection)
  cogSource.tileGrid = dstTileGrid
  cogSource.tileGridForProjection_ = {}
  cogSource.setTileSizes(tileSizes)

  console.log('Affine bypass applied:', {
    from: srcProj.getCode(),
    to: viewProjection,
    scaleX: scaleX.toFixed(6),
    tileSizes: tileSizes,
    resolutions: dstResolutions,
    transformMatrix: cogSource.transformMatrix
  })
}

const getMinMaxFromOverview = async (tiff, bands) => {
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
    stats.push({ min, max })
  }
  return stats
}

const detectBands = async (tiff) => {
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
  const [cogView, stats] = await Promise.all([
    source.getView(),
    getMinMaxFromOverview(tiff, resolvedBands)
  ])
  const cogProjection = cogView.projection
  const cogExtent = cogView.extent

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
