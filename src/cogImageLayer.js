import ImageLayer from 'ol/layer/Image'
import ImageCanvasSource from 'ol/source/ImageCanvas'
import { transformExtent } from 'ol/proj'
import { intersects, getIntersection } from 'ol/extent'
import { fromUrl as tiffFromUrl } from 'geotiff'
import { detectBands, getMinMaxFromOverview } from './cogLayer.js'

export async function createCOGImageLayer({ url, viewProjection }) {
  const tiff = await tiffFromUrl(url)

  const [bandInfo, image] = await Promise.all([
    detectBands(tiff),
    tiff.getImage(0)
  ])

  const stats = await getMinMaxFromOverview(tiff, bandInfo.bands)
  const samples = bandInfo.bands.map(b => b - 1)

  // COG native CRS
  const geoKeys = image.getGeoKeys()
  const epsgCode = geoKeys.ProjectedCSTypeGeoKey || geoKeys.GeographicTypeGeoKey || 4326
  const cogCRS = `EPSG:${epsgCode}`

  // COG native extent
  const bbox = image.getBoundingBox()
  const cogExtent = [bbox[0], bbox[1], bbox[2], bbox[3]]
  const viewExtent = transformExtent(cogExtent, cogCRS, viewProjection)

  console.log('COG Image mode:', { cogCRS, cogExtent, viewExtent, bandInfo, stats })

  // Cache & async state
  let cachedCanvas = null
  let cachedExtent = null
  let cachedKey = null
  let debounceTimer = null
  let abortCtrl = null

  const extentKey = (ext, w, h) => `${ext.map(v => v.toFixed(1)).join(',')}_${w}x${h}`

  const loadAndRender = async (extent, size, canvas) => {
    // Abort previous in-flight request
    if (abortCtrl) abortCtrl.abort()
    abortCtrl = new AbortController()
    const { signal } = abortCtrl

    try {
      const reqExtent = transformExtent(extent, viewProjection, cogCRS)

      // Clip to COG bounds
      if (!intersects(reqExtent, cogExtent)) return
      const clipped = getIntersection(reqExtent, cogExtent)

      // Compute pixel dimensions proportional to clipped area
      const fullW = reqExtent[2] - reqExtent[0]
      const fullH = reqExtent[3] - reqExtent[1]
      const clipW = clipped[2] - clipped[0]
      const clipH = clipped[3] - clipped[1]
      const readWidth = Math.max(1, Math.round(size[0] * (clipW / fullW)))
      const readHeight = Math.max(1, Math.round(size[1] * (clipH / fullH)))

      const rasters = await tiff.readRasters({
        bbox: [clipped[0], clipped[1], clipped[2], clipped[3]],
        width: readWidth,
        height: readHeight,
        samples,
        signal
      })

      if (signal.aborted) return

      // Render to canvas
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const imgData = ctx.createImageData(readWidth, readHeight)
      const px = imgData.data
      const pixelCount = readWidth * readHeight

      if (bandInfo.type === 'rgb') {
        const r = rasters[0], g = rasters[1], b = rasters[2]
        const rMin = stats[0].min, rRange = stats[0].max - stats[0].min
        const gMin = stats[1].min, gRange = stats[1].max - stats[1].min
        const bMin = stats[2].min, bRange = stats[2].max - stats[2].min
        for (let i = 0; i < pixelCount; i++) {
          const j = i * 4
          if (r[i] === 0 && g[i] === 0 && b[i] === 0) {
            px[j + 3] = 0 // nodata → transparent
          } else {
            px[j]     = Math.round(((r[i] - rMin) / rRange) * 255)
            px[j + 1] = Math.round(((g[i] - gMin) / gRange) * 255)
            px[j + 2] = Math.round(((b[i] - bMin) / bRange) * 255)
            px[j + 3] = 255
          }
        }
      } else {
        const band = rasters[0]
        const bMin = stats[0].min, bRange = stats[0].max - stats[0].min
        for (let i = 0; i < pixelCount; i++) {
          const j = i * 4
          if (band[i] === 0) {
            px[j + 3] = 0
          } else {
            const v = Math.round(((band[i] - bMin) / bRange) * 255)
            px[j] = v; px[j + 1] = v; px[j + 2] = v; px[j + 3] = 255
          }
        }
      }

      // Draw clipped image at correct offset within the full canvas
      const offCanvas = new OffscreenCanvas(readWidth, readHeight)
      const offCtx = offCanvas.getContext('2d')
      offCtx.putImageData(imgData, 0, 0)

      const offsetX = Math.round(size[0] * ((clipped[0] - reqExtent[0]) / fullW))
      const offsetY = Math.round(size[1] * ((reqExtent[3] - clipped[3]) / fullH))
      ctx.drawImage(offCanvas, offsetX, offsetY)

      // Update cache and trigger re-render
      cachedKey = extentKey(extent, size[0], size[1])
      cachedExtent = extent.slice()
      cachedCanvas = canvas
      source.changed()
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('COG image load error:', err)
    }
  }

  const source = new ImageCanvasSource({
    canvasFunction(extent, resolution, pixelRatio, size, projection) {
      const key = extentKey(extent, size[0], size[1])
      if (cachedKey === key && cachedCanvas) {
        return cachedCanvas
      }

      // Create new canvas, draw cached image at correct position/scale
      const canvas = document.createElement('canvas')
      canvas.width = size[0]
      canvas.height = size[1]

      if (cachedCanvas && cachedExtent) {
        const ctx = canvas.getContext('2d')
        const newW = extent[2] - extent[0]
        const newH = extent[3] - extent[1]
        const dx = (cachedExtent[0] - extent[0]) / newW * size[0]
        const dy = (extent[3] - cachedExtent[3]) / newH * size[1]
        const dw = (cachedExtent[2] - cachedExtent[0]) / newW * size[0]
        const dh = (cachedExtent[3] - cachedExtent[1]) / newH * size[1]
        ctx.drawImage(cachedCanvas, dx, dy, dw, dh)
      }

      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => loadAndRender(extent, size, canvas), 150)

      return canvas
    },
    ratio: 1
  })

  const layer = new ImageLayer({
    source,
    extent: viewExtent
  })

  return { layer, source, extent: viewExtent, center: [(viewExtent[0] + viewExtent[2]) / 2, (viewExtent[1] + viewExtent[3]) / 2] }
}
