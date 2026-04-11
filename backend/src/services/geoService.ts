import * as turf from '@turf/turf';
import { LngLat, simplifyPoints } from '../utils/polylineDecoder';

export type Team = 'blue' | 'red' | 'yellow';

export interface TerritoryRow {
  id: string;
  owner_id: string;
  team: Team;
  polygon: string; // GeoJSON string from PostGIS
  area_m2: number;
}

/**
 * Converts a decoded GPS track into a valid GeoJSON Polygon.
 *
 * Strategy:
 *  1. Simplify the point array (reduce vertex count).
 *  2. Close the ring by appending the first point at the end.
 *  3. Compute the convex hull as a fallback to guarantee a valid polygon.
 *     The actual route shape is used when it forms a simple (non-self-intersecting) polygon.
 */
export function buildPolygonFromRoute(
  points: LngLat[],
  useConvexHull = false
): turf.Feature<turf.Polygon> | null {
  if (points.length < 4) return null;

  const simplified = simplifyPoints(points, 5); // 5m tolerance — high precision

  if (simplified.length < 4) return null;

  if (useConvexHull) {
    const pointCollection = turf.featureCollection(
      simplified.map((p) => turf.point(p))
    );
    const hull = turf.convex(pointCollection);
    return hull as turf.Feature<turf.Polygon> | null;
  }

  // Close the ring
  const ring: LngLat[] = [...simplified];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push(first);
  }

  try {
    const polygon = turf.polygon([ring]);

    // Validate: reject self-intersecting routes (e.g. out-and-back)
    const kinks = turf.kinks(polygon);
    if (kinks.features.length > 0) {
      // A self-intersecting route (ida y vuelta) does not enclose real territory
      return null;
    }

    return polygon;
  } catch {
    return null;
  }
}

/**
 * Returns the area of a polygon in square meters.
 */
export function polygonAreaM2(polygon: turf.Feature<turf.Polygon>): number {
  return turf.area(polygon);
}

/**
 * Converts a Turf polygon to a PostGIS-compatible WKT string.
 */
export function polygonToWKT(polygon: turf.Feature<turf.Polygon>): string {
  const coords = polygon.geometry.coordinates[0];
  const points = coords.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
  return `SRID=4326;POLYGON((${points}))`;
}

/**
 * Checks whether polygonA fully contains polygonB using Turf.js.
 */
export function polygonContains(
  outer: turf.Feature<turf.Polygon>,
  inner: turf.Feature<turf.Polygon>
): boolean {
  return turf.booleanContains(outer, inner);
}

/**
 * Checks whether two polygons overlap (intersect) at all.
 */
export function polygonsOverlap(
  a: turf.Feature<turf.Polygon>,
  b: turf.Feature<turf.Polygon>
): boolean {
  return turf.booleanOverlap(a, b) || turf.booleanContains(a, b);
}

/**
 * Parses a GeoJSON string (from PostGIS ST_AsGeoJSON) into a Turf polygon.
 */
export function parseGeoJsonPolygon(
  geoJsonStr: string
): turf.Feature<turf.Polygon> | null {
  try {
    const geom = JSON.parse(geoJsonStr);
    return turf.feature(geom) as turf.Feature<turf.Polygon>;
  } catch {
    return null;
  }
}

/**
 * Returns a human-readable area string (m² or km²).
 */
export function formatArea(areaM2: number): string {
  if (areaM2 >= 1_000_000) {
    return `${(areaM2 / 1_000_000).toFixed(2)} km²`;
  }
  return `${Math.round(areaM2).toLocaleString()} m²`;
}
