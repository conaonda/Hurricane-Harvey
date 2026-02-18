import { Map, View } from 'ol'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import { defaults as defaultControls } from 'ol/control'
import { transform } from 'ol/proj'
import { createCOGLayer } from './cogLayer.js'
import 'ol/ol.css'

const COG_URL = 'https://storage.googleapis.com/pdd-stac/disasters/hurricane-harvey/0831/SkySat_20170831T195552Z_RGB.tif'

const urlParams = new URLSearchParams(window.location.search)
const PROJECTION_MODE = urlParams.get('mode') || 'affine'  // 'affine' | 'reproject'

const loadingEl = document.getElementById('loading')
const errorEl = document.getElementById('error')

const showLoading = () => loadingEl.classList.add('active')
const hideLoading = () => loadingEl.classList.remove('active')

const showError = (message) => {
  errorEl.textContent = message
  errorEl.classList.add('active')
  hideLoading()
}

const initMap = async () => {
  showLoading()

  try {
    const viewProjection = 'EPSG:3857'

    const { layer: cogLayer, source: cogSource, extent, center, zoom } =
      await createCOGLayer({ url: COG_URL, projectionMode: PROJECTION_MODE, viewProjection })

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

    const osmLayer = new TileLayer({
      source: new OSM(),
      opacity: 0.3
    })

    const view = new View({
      projection: viewProjection,
      center: center,
      zoom: zoom || 12,
      minZoom: 8,
      maxZoom: 20
    })

    const map = new Map({
      target: 'map',
      layers: [osmLayer, cogLayer],
      view: view,
      controls: defaultControls({
        zoom: true,
        rotate: true,
        attribution: true
      })
    })

    if (extent) {
      map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 1000
      })
    }

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
    const mapCoordsEl = document.getElementById('map-coords')
    const wgs84CoordsEl = document.getElementById('wgs84-coords')

    map.on('pointermove', (event) => {
      const coord = event.coordinate

      if (coord) {
        const mapX = coord[0].toFixed(2)
        const mapY = coord[1].toFixed(2)
        mapCoordsEl.textContent = `X: ${mapX}, Y: ${mapY}`

        try {
          const lonLat = transform(coord, viewProjection, 'EPSG:4326')
          const lon = lonLat[0].toFixed(6)
          const lat = lonLat[1].toFixed(6)
          wgs84CoordsEl.textContent = `경도: ${lon}°, 위도: ${lat}°`
        } catch (e) {
          wgs84CoordsEl.textContent = '변환 불가'
        }
      }
    })

    console.log('Map initialized successfully')

    // Expose to window for testing
    window.map = map
    window.cogSource = cogSource

  } catch (error) {
    console.error('Initialization error:', error)
    showError(`지도 초기화 중 오류 발생: ${error.message}`)
  }
}

document.addEventListener('DOMContentLoaded', initMap)
