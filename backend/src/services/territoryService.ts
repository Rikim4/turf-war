import * as turf from '@turf/turf';
import { query, queryOne } from '../config/database';
import {
  buildPolygonFromRoute,
  polygonAreaM2,
  polygonToWKT,
  parseGeoJsonPolygon,
  Team,
} from './geoService';
import { LngLat } from '../utils/polylineDecoder';

export interface ConquestResult {
  territoryId: string;
  areaM2: number;
  stolenCount: number;  // How many enemy territories were captured
  stolenFrom: Team[];   // Which teams lost territory
}

/**
 * Core game mechanic: process a circular run and conquer territory.
 *
 * Algorithm:
 *  1. Build a polygon from the GPS route.
 *  2. Find all existing territories (any team) whose polygon is
 *     FULLY CONTAINED within the new polygon.
 *  3. Transfer those territories to the new team.
 *  4. Persist the new territory polygon.
 *  5. Update user stats.
 */
export async function processConquest(
  userId: string,
  team: Team,
  activityId: string,
  routePoints: LngLat[]
): Promise<ConquestResult | null> {
  const polygon = buildPolygonFromRoute(routePoints);
  if (!polygon) return null;

  const areaM2 = polygonAreaM2(polygon);

  // Minimum area threshold: 10,000 m² (1 hectare) to avoid tiny loops
  if (areaM2 < 10_000) return null;

  const wkt = polygonToWKT(polygon);

  // ── Find enemy territories that overlap with new polygon ────────────────
  const overlappingTerritories = await query<{
    id: string;
    team: Team;
    owner_id: string;
    area_m2: number;
    polygon_geojson: string;
  }>(
    `SELECT
       t.id,
       t.team,
       t.owner_id,
       t.area_m2,
       ST_AsGeoJSON(t.polygon) AS polygon_geojson
     FROM territories t
     WHERE ST_Intersects(ST_GeomFromEWKT($1), t.polygon)
       AND t.team != $2`,
    [wkt, team]
  );

  // ── Recortar territorios enemigos (ST_Difference) ─────────────────────────
  const stolenFrom: Team[] = [];
  for (const enemy of overlappingTerritories) {
    // Record history
    await query(
      `INSERT INTO territory_history
         (territory_id, previous_team, previous_owner, new_team, new_owner, activity_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [enemy.id, enemy.team, enemy.owner_id, team, userId, activityId]
    );

    // Recortar: quitar la zona conquistada del territorio enemigo
    const remainingResult = await queryOne<{
      remaining_geojson: string | null;
      remaining_area: number | null;
      is_empty: boolean;
    }>(
      `SELECT
         CASE WHEN ST_IsEmpty(ST_Difference(t.polygon, ST_GeomFromEWKT($1)))
              THEN NULL
              ELSE ST_AsGeoJSON(ST_Difference(t.polygon, ST_GeomFromEWKT($1)))
         END AS remaining_geojson,
         CASE WHEN ST_IsEmpty(ST_Difference(t.polygon, ST_GeomFromEWKT($1)))
              THEN 0
              ELSE ST_Area(ST_Difference(t.polygon, ST_GeomFromEWKT($1))::geography)
         END AS remaining_area,
         ST_IsEmpty(ST_Difference(t.polygon, ST_GeomFromEWKT($1))) AS is_empty
       FROM territories t
       WHERE t.id = $2`,
      [wkt, enemy.id]
    );

    if (!remainingResult || remainingResult.is_empty) {
      // Territorio enemigo completamente conquistado → eliminarlo
      await query('DELETE FROM territories WHERE id = $1', [enemy.id]);
    } else {
      // Territorio enemigo parcialmente conquistado → actualizar con la parte restante
      await query(
        `UPDATE territories
           SET polygon = ST_GeomFromGeoJSON($1),
               area_m2 = $2,
               updated_at = NOW()
         WHERE id = $3`,
        [remainingResult.remaining_geojson, remainingResult.remaining_area, enemy.id]
      );
    }

    // Actualizar stats del dueño anterior
    const areaLost = enemy.area_m2 - (remainingResult?.remaining_area ?? 0);
    await query(
      `UPDATE users
         SET territories_lost = territories_lost + 1,
             total_area_m2 = GREATEST(0, total_area_m2 - $1)
       WHERE id = $2`,
      [areaLost, enemy.owner_id]
    );

    stolenFrom.push(enemy.team);
  }

  // ── Create new territory ──────────────────────────────────────────────────
  const newTerritory = await queryOne<{ id: string }>(
    `INSERT INTO territories (owner_id, team, polygon, area_m2, activity_id)
     VALUES ($1, $2, ST_GeomFromEWKT($3), $4, $5)
     RETURNING id`,
    [userId, team, wkt, areaM2, activityId]
  );

  if (!newTerritory) throw new Error('Failed to create territory');

  // Link activity → territory
  await query(
    `UPDATE activities SET territory_id = $1, processed_at = NOW() WHERE id = $2`,
    [newTerritory.id, activityId]
  );

  // ── Update user stats ─────────────────────────────────────────────────────
  await query(
    `UPDATE users
       SET territories_won = territories_won + 1,
           total_area_m2   = total_area_m2 + $1
     WHERE id = $2`,
    [areaM2, userId]
  );

  return {
    territoryId: newTerritory.id,
    areaM2,
    stolenCount: overlappingTerritories.length,
    stolenFrom,
  };
}

/**
 * Fetches territory polygons for the map as a GeoJSON FeatureCollection.
 * Same-team polygons are merged with ST_Union so overlapping territories
 * of the same colour appear as a single unified shape on the map.
 * Returns at most 3 features (one per team).
 * Optionally filters by bounding box [minLng, minLat, maxLng, maxLat].
 */
export async function getTerritoriesGeoJSON(
  bbox?: [number, number, number, number]
): Promise<GeoJSON.FeatureCollection> {
  let rows: Array<{
    team: Team;
    polygon_geojson: string;
    territory_count: number;
    total_area_m2: number;
    last_conquered_at: string;
  }>;

  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    rows = await query(
      `SELECT
         team,
         ST_AsGeoJSON(ST_Union(polygon)) AS polygon_geojson,
         COUNT(*)::int                   AS territory_count,
         SUM(area_m2)                    AS total_area_m2,
         MAX(conquered_at)               AS last_conquered_at
       FROM territories
       WHERE polygon && ST_MakeEnvelope($1, $2, $3, $4, 4326)
       GROUP BY team`,
      [minLng, minLat, maxLng, maxLat]
    );
  } else {
    rows = await query(
      `SELECT
         team,
         ST_AsGeoJSON(ST_Union(polygon)) AS polygon_geojson,
         COUNT(*)::int                   AS territory_count,
         SUM(area_m2)                    AS total_area_m2,
         MAX(conquered_at)               AS last_conquered_at
       FROM territories
       GROUP BY team`
    );
  }

  const features: GeoJSON.Feature[] = rows.map((row) => ({
    type: 'Feature',
    id: row.team,
    geometry: JSON.parse(row.polygon_geojson),
    properties: {
      team:             row.team,
      territoryCount:   row.territory_count,
      totalAreaM2:      Number(row.total_area_m2),
      lastConqueredAt:  row.last_conquered_at,
    },
  }));

  return { type: 'FeatureCollection', features };
}

/**
 * Get team statistics.
 */
export async function getTeamStats(): Promise<
  Array<{ team: Team; territory_count: number; total_area_m2: number; total_area_km2: number }>
> {
  return query(
    `SELECT team, territory_count, total_area_m2, total_area_km2 FROM team_stats`
  );
}
