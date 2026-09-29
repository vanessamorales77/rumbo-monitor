/** 1 knot = 1.852 km/h (Traccar reports speed in knots). */
export const KNOTS_TO_KMH = 1.852

export const knotsToKmh = (knots: number): number => Math.round(knots * KNOTS_TO_KMH)
