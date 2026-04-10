import polyline from '@mapbox/polyline';

// [lng, lat] — GeoJSON convention
export type LngLat = [number, number];

/**
 * Decodes a Google Encoded Polyline string (as returned by Strava)
 * into an array of [longitude, latitude] pairs (GeoJSON order).
 */
export function decodePolyline(encoded: string): LngLat[] {
  if (!encoded) return [];
  // @mapbox/polyline returns [lat, lng] pairs → we swap to [lng, lat] for GeoJSON
  const latLngPairs = polyline.decode(encoded);
  return latLngPairs.map(([lat, lng]) => [lng, lat]);
}

/**
 * Haversine distance between two [lng, lat] points, in meters.
 */
export function haversineDistance(a: LngLat, b: LngLat): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinDLng * sinDLng;

  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Total route length in meters (sum of segment distances).
 */
export function totalRouteLength(points: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Determines whether a route is "circular".
 * A route is considered circular when the straight-line distance between
 * the first and last GPS point is small relative to the total route length.
 *
 * Thresholds (configurable):
 *  - Absolute max gap: 500 m
 *  - Relative max gap: 5% of total distance
 */
export function isCircularRoute(
  points: LngLat[],
  absoluteThresholdM = 500,
  relativeThreshold = 0.05
): { circular: boolean; gapM: number } {
  if (points.length < 3) return { circular: false, gapM: Infinity };

  const gapM = haversineDistance(points[0], points[points.length - 1]);
  const totalM = totalRouteLength(points);

  const circular =
    gapM <= absoluteThresholdM || gapM <= totalM * relativeThreshold;

  return { circular, gapM };
}

/**
 * Simplifies a point array using the Ramer–Douglas–Peucker algorithm.
 * Reduces the number of vertices while preserving the shape.
 * toleranceM is in meters.
 */
export function simplifyPoints(points: LngLat[], toleranceM = 10): LngLat[] {
  if (points.length <= 2) return points;

  // Convert tolerance from meters to degrees (approximate)
  const toleranceDeg = toleranceM / 111320;

  return rdp(points, toleranceDeg);
}

function rdp(points: LngLat[], epsilon: number): LngLat[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;

  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, maxIdx + 1), epsilon);
    const right = rdp(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

function perpendicularDistance(point: LngLat, start: LngLat, end: LngLat): number {
  const [x0, y0] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;

  const num = Math.abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1);
  const den = Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2);

  return den === 0 ? 0 : num / den;
}
