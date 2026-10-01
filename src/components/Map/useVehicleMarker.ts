import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import L from 'leaflet'
import type { DeviceStatus } from '../../api'
import { prefersReducedMotion } from '../../utils/motion'

const GLIDE_MS = 1_800
const DEFAULT_ZOOM = 15

const SIZE = 56

const markerHtml = `
<div class="vehicle-marker__rotor">
  <svg viewBox="0 0 56 56" width="${SIZE}" height="${SIZE}" aria-hidden="true" focusable="false">
    <circle class="vehicle-marker__halo" cx="28" cy="28" r="26" />
    <circle class="vehicle-marker__disc" cx="28" cy="28" r="17" pathLength="100" />
    <path class="vehicle-marker__arrow" d="M28 14 L37 39 L28 33 L19 39 Z" />
  </svg>
</div>`

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

interface Params {
  containerRef: RefObject<HTMLDivElement | null>
  latitude: number | null
  longitude: number | null
  course: number
  status: DeviceStatus
  label: string
  /** When this changes (e.g. another vehicle is selected) the marker jumps instead of gliding. */
  snapKey: number | null
  /** ISO time of the fix. A long silence between two fixes means we do not know the path in between. */
  fixTime: string | null
}

/** Tile source. Defaults to OpenStreetMap's public servers, fine for a demo; set VITE_TILE_URL for real traffic. */
const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION =
  import.meta.env.VITE_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

/** Positions kept in the trail behind the marker (several minutes at one fix every 5-10 s). */
const TRAIL_FIXES = 40
/** Closer than this (m) counts as "has not moved": no new leg, so a parked vehicle leaves no trail. */
const SAME_SPOT_M = 1

interface Trail {
  /** Where the vehicle has been, oldest first. The last item is where it is heading. */
  fixes: L.LatLng[]
  /** One line per leg between two fixes; the last one is the head, redrawn every frame while the marker glides. */
  segments: L.Polyline[]
}

const emptyTrail = (): Trail => ({ fixes: [], segments: [] })

function clearTrail(trail: Trail, from?: L.LatLng) {
  trail.segments.forEach((segment) => segment.remove())
  trail.segments = []
  trail.fixes = from ? [from] : []
}

/**
 * The vehicle is at `from` and heads to `to`: add a leg and fade the older ones.
 * Returns false when it has not moved, in which case nothing changes.
 */
function extendTrail(map: L.Map, trail: Trail, from: L.LatLng, to: L.LatLng): boolean {
  const { fixes } = trail
  if (fixes.length === 0) fixes.push(from)
  else if (fixes[fixes.length - 1].distanceTo(from) > SAME_SPOT_M) {
    // A glide may be cut short by the next fix: the trail goes through where the marker really is.
    // If the marker has not moved at all (animation paused in a background tab) that spot is the
    // previous fix, so the unreached one is dropped instead of piling up copies of the same point.
    const behind = fixes[fixes.length - 2]
    if (behind && behind.distanceTo(from) <= SAME_SPOT_M) fixes.pop()
    else fixes[fixes.length - 1] = from
  }
  if (fixes[fixes.length - 1].distanceTo(to) <= SAME_SPOT_M) return false

  fixes.push(to)
  if (fixes.length > TRAIL_FIXES) fixes.shift()

  const legs = fixes.length - 1
  while (trail.segments.length < legs) {
    trail.segments.push(L.polyline([], { className: 'vehicle-trail', interactive: false, weight: 5, lineCap: 'round' }).addTo(map))
  }
  while (trail.segments.length > legs) trail.segments.shift()?.remove()
  trail.segments.forEach((segment, i) => {
    // The head starts as a point and grows with the marker; older legs are complete and fainter.
    segment.setLatLngs(i === legs - 1 ? [fixes[i], fixes[i]] : [fixes[i], fixes[i + 1]])
    segment.setStyle({ opacity: 0.1 + 0.75 * ((i + 1) / legs) })
  })
  return true
}

function growTrailHead(trail: Trail, point: L.LatLng) {
  const from = trail.fixes[trail.fixes.length - 2]
  if (from) trail.segments[trail.segments.length - 1]?.setLatLngs([from, point])
}

/** Silence longer than this between two fixes: the path in between is unknown, so the marker jumps and the trail restarts
 *  instead of drawing a straight "flight" across the blocks. */
const JUMP_GAP_MS = 60_000
/** Safety net: if the tiles never report in (offline, blocked), the loading cover goes away anyway. */
const TILES_TIMEOUT_MS = 8_000
/** Share of the remaining distance the map covers per frame when it catches up with the vehicle after being moved by hand. */
const CATCH_UP = 0.2
const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

/**
 * Owns the Leaflet map + marker. The marker glides between fixes with requestAnimationFrame, the map keeps it in the
 * centre while it moves, and the arrow turns the short way round.
 * The operator can still look around (drag, arrow keys): the map comes back to the vehicle as soon as the next position
 * arrives, never in the middle of a drag. Returns `mapReady`: true once the tiles around the vehicle have loaded.
 */
export function useVehicleMarker({ containerRef, latitude, longitude, course, status, label, snapKey, fixTime }: Params) {
  const snapKeyRef = useRef(snapKey)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const rotorRef = useRef<HTMLElement | null>(null)
  const headingRef = useRef(0)
  const frameRef = useRef(0)
  const currentRef = useRef<L.LatLng | null>(null)
  const lastFixMsRef = useRef<number | null>(null)
  const trailRef = useRef<Trail>(emptyTrail())
  const tilesTimerRef = useRef<number | undefined>(undefined)
  /** The operator moved the map by hand since the last fix. */
  const lookingRef = useRef(false)
  const draggingRef = useRef(false)
  /** The map is off-centre after being moved by hand and eases back instead of jumping. */
  const catchUpRef = useRef(false)
  const [tilesReady, setTilesReady] = useState(false)

  /** Keeps the vehicle in the middle of the map (unless the operator is looking around). */
  const centre = useCallback((point: L.LatLng, zoom?: number) => {
    const map = mapRef.current
    if (!map || lookingRef.current) return
    const z = zoom ?? map.getZoom()
    if (catchUpRef.current && !prefersReducedMotion()) {
      const here = map.getCenter()
      const gapPx = map.latLngToContainerPoint(point).distanceTo(map.getSize().divideBy(2))
      if (gapPx > 2) {
        map.setView(L.latLng(here.lat + (point.lat - here.lat) * CATCH_UP, here.lng + (point.lng - here.lng) * CATCH_UP), z, { animate: false })
        return
      }
      catchUpRef.current = false
    }
    map.setView(point, z, { animate: false })
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    // Every zoom gesture zooms around the map centre, which is where the vehicle sits:
    // zooming in on the cursor would push the vehicle off-screen.
    const map = L.map(container, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: 'center',
      doubleClickZoom: 'center',
      touchZoom: 'center',
    }).setView([4.711, -74.0721], 3)
    const zoom = L.control.zoom({ position: 'bottomright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map)
    // Leaflet draws the zoom buttons as <a role="button">, which only react to Enter. A button must also answer to Space.
    zoom.getContainer()?.addEventListener('keydown', (event) => {
      if (event.key !== ' ') return
      event.preventDefault() // otherwise the page scrolls
      if (!event.repeat) (event.target as HTMLElement).click()
    })
    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map)
    tileLayerRef.current = L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map)
    // The operator's intent is detected when it STARTS: while the vehicle glides we centre every frame,
    // which would otherwise cancel the pan in progress.
    map.on('dragstart', () => {
      lookingRef.current = true
      draggingRef.current = true
    })
    map.on('dragend', () => {
      draggingRef.current = false
    })
    map.on('keydown', (event) => {
      const { key, target } = (event as L.LeafletKeyboardEvent).originalEvent
      // Leaflet only pans when the map itself has focus; arrows on the zoom buttons do not move anything.
      if (target === map.getContainer() && ARROW_KEYS.includes(key)) lookingRef.current = true
    })
    mapRef.current = map
    return () => {
      cancelAnimationFrame(frameRef.current)
      window.clearTimeout(tilesTimerRef.current)
      map.remove()
      mapRef.current = null
      tileLayerRef.current = null
      markerRef.current = null
      currentRef.current = null
      trailRef.current = emptyTrail()
    }
  }, [containerRef])

  // Position: create the marker on first fix, glide on the following ones.
  useEffect(() => {
    const map = mapRef.current
    if (!map || latitude === null || longitude === null) return
    const target = L.latLng(latitude, longitude)

    if (!markerRef.current) {
      const icon = L.divIcon({ className: 'vehicle-marker', html: markerHtml, iconSize: [SIZE, SIZE], iconAnchor: [SIZE / 2, SIZE / 2] })
      // Not focusable: it has no action, and its description is in the status card and the label below.
      markerRef.current = L.marker(target, { icon, keyboard: false }).addTo(map)
      rotorRef.current = markerRef.current.getElement()?.querySelector('.vehicle-marker__rotor') ?? null
      currentRef.current = target
      clearTrail(trailRef.current, target)
      centre(target, DEFAULT_ZOOM)
      // The map is "ready" once the tiles around the vehicle (not the world view it starts from) have loaded.
      const reveal = () => {
        window.clearTimeout(tilesTimerRef.current)
        setTilesReady(true)
      }
      tileLayerRef.current?.once('load', reveal)
      tilesTimerRef.current = window.setTimeout(reveal, TILES_TIMEOUT_MS)
      return
    }

    const start = currentRef.current ?? target
    const switchedVehicle = snapKeyRef.current !== snapKey
    snapKeyRef.current = snapKey
    const fixMs = fixTime ? Date.parse(fixTime) : null
    const gapMs = fixMs !== null && lastFixMsRef.current !== null ? fixMs - lastFixMsRef.current : 0
    lastFixMsRef.current = fixMs
    const jumped = switchedVehicle || gapMs > JUMP_GAP_MS
    // A new position has arrived: if the operator moved the map, it comes back to the vehicle now (not mid-drag).
    if (lookingRef.current && !draggingRef.current) {
      lookingRef.current = false
      catchUpRef.current = !switchedVehicle
    }
    // No glide when the animation cannot run (reduced motion, or a hidden tab where requestAnimationFrame is paused:
    // the marker would stay behind while fixes keep arriving) nor after a long silence.
    if (jumped || prefersReducedMotion() || document.hidden) {
      cancelAnimationFrame(frameRef.current)
      markerRef.current.setLatLng(target)
      currentRef.current = target
      if (jumped) clearTrail(trailRef.current, target)
      else if (extendTrail(map, trailRef.current, start, target)) growTrailHead(trailRef.current, target)
      catchUpRef.current = false
      centre(target)
      return
    }

    const moved = extendTrail(map, trailRef.current, start, target)

    cancelAnimationFrame(frameRef.current)
    const begin = performance.now()
    const step = (time: number) => {
      const t = Math.min(1, (time - begin) / GLIDE_MS)
      const k = easeInOut(t)
      const point = L.latLng(start.lat + (target.lat - start.lat) * k, start.lng + (target.lng - start.lng) * k)
      markerRef.current?.setLatLng(point)
      currentRef.current = point
      if (moved) growTrailHead(trailRef.current, point)
      centre(point)
      if (t < 1) frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
  }, [latitude, longitude, snapKey, fixTime, centre])

  // Heading: accumulate the shortest signed delta so 350° → 10° turns 20°, not 340°.
  useEffect(() => {
    const delta = ((course - headingRef.current + 540) % 360) - 180
    headingRef.current += delta
    rotorRef.current?.style.setProperty('--heading', `${headingRef.current}deg`)
  }, [course, latitude])

  // Status colour + accessible name.
  useEffect(() => {
    const element = markerRef.current?.getElement()
    if (!element) return
    element.classList.remove('vehicle-marker--online', 'vehicle-marker--offline', 'vehicle-marker--unknown')
    element.classList.add(`vehicle-marker--${status}`)
    element.setAttribute('role', 'img')
    element.setAttribute('aria-label', label)
  }, [status, label, latitude])

  // With no position there is nothing to wait for: the map can be shown as it is.
  return { mapReady: tilesReady || latitude === null }
}
