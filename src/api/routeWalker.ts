/** Walks a polyline of real road coordinates at a given distance, looping at the end. */

export type LatLon = readonly [lat: number, lon: number]

export interface RoutePoint {
  lat: number
  lon: number
  /** Degrees clockwise from north. */
  bearing: number
}

export interface Walker {
  /** Route length in metres. */
  total: number
  at: (distanceM: number) => RoutePoint
}

const EARTH_RADIUS_M = 6_371_000
const toRad = (deg: number) => (deg * Math.PI) / 180
const toDeg = (rad: number) => (rad * 180) / Math.PI

function haversine(a: LatLon, b: LatLon): number {
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

function bearingBetween(a: LatLon, b: LatLon): number {
  const dLon = toRad(b[1] - a[1])
  const y = Math.sin(dLon) * Math.cos(toRad(b[0]))
  const x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) - Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

export function createWalker(points: readonly LatLon[]): Walker {
  const cumulative = [0]
  for (let i = 1; i < points.length; i += 1) {
    cumulative.push(cumulative[i - 1] + haversine(points[i - 1], points[i]))
  }
  const total = cumulative[cumulative.length - 1]

  return {
    total,
    at(distanceM) {
      const d = ((distanceM % total) + total) % total
      // Binary search for the segment containing d.
      let lo = 0
      let hi = cumulative.length - 1
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (cumulative[mid] <= d) lo = mid
        else hi = mid
      }
      const span = cumulative[hi] - cumulative[lo] || 1
      const t = (d - cumulative[lo]) / span
      const a = points[lo]
      const b = points[hi]
      return {
        lat: a[0] + (b[0] - a[0]) * t,
        lon: a[1] + (b[1] - a[1]) * t,
        bearing: bearingBetween(a, b),
      }
    },
  }
}
