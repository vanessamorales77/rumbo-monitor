import { useEffect, useRef, type RefObject } from 'react'
import L from 'leaflet'
import type { DeviceStatus } from '../../api'

const GLIDE_MS = 1_800
const DEFAULT_ZOOM = 15

const markerHtml = `
<div class="vehicle-marker__rotor">
  <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">
    <circle class="vehicle-marker__halo" cx="24" cy="24" r="22" />
    <circle class="vehicle-marker__disc" cx="24" cy="24" r="14" />
    <path class="vehicle-marker__arrow" d="M24 11 L32 32 L24 27 L16 32 Z" />
  </svg>
</div>`

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface Params {
  containerRef: RefObject<HTMLDivElement | null>
  latitude: number | null
  longitude: number | null
  course: number
  status: DeviceStatus
  label: string
}

/**
 * Owns the Leaflet map + marker. The marker glides between fixes with requestAnimationFrame,
 * the map follows it while it moves, and the arrow turns the short way round.
 */
export function useVehicleMarker({ containerRef, latitude, longitude, course, status, label }: Params) {
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const rotorRef = useRef<HTMLElement | null>(null)
  const headingRef = useRef(0)
  const frameRef = useRef(0)
  const currentRef = useRef<L.LatLng | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const map = L.map(container, { zoomControl: true, attributionControl: true }).setView([4.711, -74.0721], 3)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    mapRef.current = map
    return () => {
      cancelAnimationFrame(frameRef.current)
      map.remove()
      mapRef.current = null
      markerRef.current = null
      currentRef.current = null
    }
  }, [containerRef])

  // Position: create the marker on first fix, glide on the following ones.
  useEffect(() => {
    const map = mapRef.current
    if (!map || latitude === null || longitude === null) return
    const target = L.latLng(latitude, longitude)

    if (!markerRef.current) {
      const icon = L.divIcon({ className: 'vehicle-marker', html: markerHtml, iconSize: [48, 48], iconAnchor: [24, 24] })
      markerRef.current = L.marker(target, { icon, keyboard: true, alt: label }).addTo(map)
      rotorRef.current = markerRef.current.getElement()?.querySelector('.vehicle-marker__rotor') ?? null
      currentRef.current = target
      map.setView(target, DEFAULT_ZOOM, { animate: false })
      return
    }

    const start = currentRef.current ?? target
    if (prefersReducedMotion()) {
      markerRef.current.setLatLng(target)
      map.setView(target, map.getZoom(), { animate: false })
      currentRef.current = target
      return
    }

    cancelAnimationFrame(frameRef.current)
    const begin = performance.now()
    const step = (time: number) => {
      const t = Math.min(1, (time - begin) / GLIDE_MS)
      const k = easeInOut(t)
      const point = L.latLng(start.lat + (target.lat - start.lat) * k, start.lng + (target.lng - start.lng) * k)
      markerRef.current?.setLatLng(point)
      map.setView(point, map.getZoom(), { animate: false })
      currentRef.current = point
      if (t < 1) frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
  }, [latitude, longitude, label])

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
}
