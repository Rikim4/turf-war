import { Request, Response } from 'express';
import { getTerritoriesGeoJSON, getTeamStats } from '../services/territoryService';
import { query, queryOne } from '../config/database';

/**
 * GET /api/territories
 * Returns all territory polygons as a GeoJSON FeatureCollection.
 * Supports optional bbox query: ?bbox=minLng,minLat,maxLng,maxLat
 */
export async function getTerritories(req: Request, res: Response): Promise<void> {
  let bbox: [number, number, number, number] | undefined;

  if (req.query.bbox) {
    const parts = (req.query.bbox as string).split(',').map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      bbox = parts as [number, number, number, number];
    }
  }

  const geoJSON = await getTerritoriesGeoJSON(bbox);
  res.json(geoJSON);
}

/**
 * GET /api/territories/stats
 * Returns team-level statistics (territory count, total area).
 */
export async function getStats(req: Request, res: Response): Promise<void> {
  const city = req.query.city as string | undefined;

  if (city) {
    const [teamStats, leaderboard] = await Promise.all([
      query(
        `SELECT u.team,
                COUNT(DISTINCT t.id)::int AS territory_count,
                COALESCE(SUM(t.area_m2), 0) AS total_area_m2,
                COALESCE(SUM(t.area_m2), 0) / 1000000.0 AS total_area_km2
         FROM users u
         LEFT JOIN territories t ON t.owner_id = u.id AND t.team = u.team
         WHERE u.city = $1
         GROUP BY u.team`,
        [city]
      ),
      query(
        `SELECT id, username, firstname, lastname, profile_picture,
                team, territory_count, total_area_m2, territories_won, territories_lost
         FROM leaderboard
         WHERE id IN (SELECT id FROM users WHERE city = $1)
         LIMIT 20`,
        [city]
      ),
    ]);
    res.json({ teams: teamStats, leaderboard });
    return;
  }

  const [teamStats, leaderboard] = await Promise.all([
    getTeamStats(),
    query(
      `SELECT id, username, firstname, lastname, profile_picture,
              team, territory_count, total_area_m2, territories_won, territories_lost
       FROM leaderboard
       LIMIT 20`
    ),
  ]);

  res.json({ teams: teamStats, leaderboard });
}

/**
 * GET /api/territories/:id
 * Returns a single territory with details.
 */
export async function getTerritoryById(req: Request, res: Response): Promise<void> {
  const territory = await queryOne(
    `SELECT t.id, t.team, t.area_m2, t.conquered_at,
            u.id AS owner_id, u.username, u.firstname, u.lastname, u.profile_picture,
            ST_AsGeoJSON(t.polygon) AS polygon_geojson
     FROM territories t
     JOIN users u ON u.id = t.owner_id
     WHERE t.id = $1`,
    [req.params.id]
  );

  if (!territory) {
    res.status(404).json({ error: 'Territory not found' });
    return;
  }

  res.json(territory);
}

/**
 * GET /api/territories/:id/history
 * Returns the ownership history of a territory.
 */
export async function getTerritoryHistory(req: Request, res: Response): Promise<void> {
  const history = await query(
    `SELECT
       th.id,
       th.previous_team,
       th.new_team,
       th.changed_at,
       prev.username AS previous_username,
       next.username AS new_username
     FROM territory_history th
     LEFT JOIN users prev ON prev.id = th.previous_owner
     JOIN users next ON next.id = th.new_owner
     WHERE th.territory_id = $1
     ORDER BY th.changed_at DESC`,
    [req.params.id]
  );

  res.json(history);
}

/**
 * GET /api/territories/user/:userId
 * Returns all territories owned by a specific user.
 */
export async function getUserTerritories(req: Request, res: Response): Promise<void> {
  const territories = await query(
    `SELECT t.id, t.team, t.area_m2, t.conquered_at,
            ST_AsGeoJSON(t.polygon) AS polygon_geojson,
            a.name AS activity_name, a.distance_m, a.strava_activity_id
     FROM territories t
     LEFT JOIN activities a ON a.id = t.activity_id
     WHERE t.owner_id = $1
     ORDER BY t.conquered_at DESC`,
    [req.params.userId]
  );

  res.json(territories);
}
