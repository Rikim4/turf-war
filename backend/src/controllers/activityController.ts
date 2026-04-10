import { Request, Response } from 'express';
import { getActivity, getAthleteActivities } from '../services/stravaService';
import { processConquest } from '../services/territoryService';
import { decodePolyline, isCircularRoute } from '../utils/polylineDecoder';
import { query, queryOne } from '../config/database';

type Team = 'blue' | 'red' | 'yellow';

// ─── Helper: process a single Strava activity ─────────────────────────────────
async function processSingleActivity(
  userId: string,
  team: Team,
  act: Awaited<ReturnType<typeof getAthleteActivities>>[number]
) {
  // Rechazar actividades en cinta o indoor
  if (act.trainer) return { indoor: true };

  if (!act.map?.summary_polyline) return null;

  const existing = await queryOne(
    'SELECT id, territory_id, is_circular FROM activities WHERE strava_activity_id = $1',
    [act.id]
  );
  if (existing) return { alreadySynced: true, ...existing };

  // Obtener la actividad detallada para usar la polyline completa (más precisa)
  const detailed = await getActivity(userId, act.id);
  const polylineStr = detailed.map?.polyline || detailed.map?.summary_polyline || act.map.summary_polyline;

  const points = decodePolyline(polylineStr);
  const { circular, gapM } = isCircularRoute(points);

  const activityRow = await queryOne<{ id: string }>(
    `INSERT INTO activities
       (strava_activity_id, user_id, name, distance_m, moving_time_s,
        total_elevation_m, start_lat, start_lng, summary_polyline, is_circular, circularity_gap_m)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (strava_activity_id) DO NOTHING
     RETURNING id`,
    [
      act.id, userId, act.name, act.distance, act.moving_time,
      act.total_elevation_gain,
      act.start_latlng?.[0] ?? null,
      act.start_latlng?.[1] ?? null,
      polylineStr, circular, gapM,
    ]
  );

  if (!activityRow) return null;

  let conquest = null;
  if (circular && points.length >= 4) {
    conquest = await processConquest(userId, team, activityRow.id, points);
  }

  return {
    stravaActivityId: act.id,
    name: act.name,
    isCircular: circular,
    gapM,
    conquest,
  };
}

/**
 * POST /api/activities/sync-latest
 * Syncs ONLY the most recent running activity from Strava.
 */
export async function syncLatestActivity(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  // Leer equipo actual de la BD (no del JWT, que puede estar desactualizado)
  const dbUser = await queryOne<{ team: Team }>('SELECT team FROM users WHERE id = $1', [userId]);
  if (!dbUser) { res.status(401).json({ error: 'Usuario no encontrado' }); return; }
  const team = dbUser.team;

  // Fetch the last 10 activities and find the most recent Run
  const activities = await getAthleteActivities(userId, 1, 10);
  const latestRun = activities.find((a) =>
    ['Run', 'VirtualRun', 'TrailRun'].includes(a.type)
  );

  if (!latestRun) {
    res.json({ message: 'No se encontró ninguna carrera reciente en Strava.' });
    return;
  }

  const result = await processSingleActivity(userId, team, latestRun);

  if (!result) {
    res.json({ message: 'La carrera no pudo procesarse.' });
    return;
  }

  if ('indoor' in result) {
    res.json({ message: 'La carrera es en cinta o indoor. Solo se conquista territorio en carreras al aire libre.' });
    return;
  }

  if ('alreadySynced' in result) {
    res.json({
      message: 'Esta carrera ya estaba sincronizada.',
      activity: result,
    });
    return;
  }

  if (!result.isCircular) {
    res.json({
      message: 'Carrera sincronizada, pero no es circular. No se conquista territorio.',
      activity: { name: result.name, isCircular: false, gapM: result.gapM },
    });
    return;
  }

  if (!result.conquest) {
    res.json({
      message: 'Ruta circular, pero el área es demasiado pequeña (mín. 1 hectárea).',
      activity: { name: result.name, isCircular: true },
    });
    return;
  }

  res.json({
    message: '¡Territorio conquistado!',
    activity: { name: result.name, isCircular: true },
    conquest: result.conquest,
  });
}

/**
 * POST /api/activities/sync/:stravaActivityId
 * Manually sync a specific Strava activity by ID.
 */
export async function syncActivity(req: Request, res: Response): Promise<void> {
  const { stravaActivityId } = req.params;
  const userId = req.user!.userId;

  // Leer equipo actual de la BD (no del JWT, que puede estar desactualizado)
  const dbUser = await queryOne<{ team: Team }>('SELECT team FROM users WHERE id = $1', [userId]);
  if (!dbUser) { res.status(401).json({ error: 'Usuario no encontrado' }); return; }
  const team = dbUser.team;

  const existing = await queryOne(
    'SELECT id, territory_id FROM activities WHERE strava_activity_id = $1 AND user_id = $2',
    [stravaActivityId, userId]
  );
  if (existing) {
    res.json({ message: 'Activity already synced', activity: existing });
    return;
  }

  const stravaActivity = await getActivity(userId, parseInt(stravaActivityId, 10));
  const polylineStr = stravaActivity.map?.summary_polyline;
  const points = polylineStr ? decodePolyline(polylineStr) : [];
  const { circular, gapM } = isCircularRoute(points);

  const activityRow = await queryOne<{ id: string }>(
    `INSERT INTO activities
       (strava_activity_id, user_id, name, distance_m, moving_time_s, elapsed_time_s,
        total_elevation_m, start_lat, start_lng, summary_polyline, is_circular, circularity_gap_m)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (strava_activity_id) DO NOTHING
     RETURNING id`,
    [
      stravaActivity.id, userId, stravaActivity.name, stravaActivity.distance,
      stravaActivity.moving_time, stravaActivity.elapsed_time,
      stravaActivity.total_elevation_gain,
      stravaActivity.start_latlng?.[0] ?? null,
      stravaActivity.start_latlng?.[1] ?? null,
      polylineStr ?? null, circular, gapM,
    ]
  );

  if (!activityRow) { res.json({ message: 'Activity already exists' }); return; }
  if (!circular || points.length < 4) {
    res.json({ message: 'Not circular — no territory conquered', activity: { id: activityRow.id, isCircular: circular, gapM } });
    return;
  }

  const conquest = await processConquest(userId, team, activityRow.id, points);
  if (!conquest) {
    res.json({ message: 'Polygon area too small', activity: { id: activityRow.id } });
    return;
  }

  res.json({ message: 'Territory conquered!', conquest });
}

/**
 * GET /api/activities
 * List the authenticated user's activities.
 */
export async function listActivities(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
  const offset = parseInt(req.query.offset as string || '0', 10);

  const activities = await query(
    `SELECT a.id, a.strava_activity_id, a.name, a.distance_m,
            a.moving_time_s, a.total_elevation_m, a.is_circular,
            a.circularity_gap_m, a.territory_id, a.created_at,
            t.team AS conquered_team
     FROM activities a
     LEFT JOIN territories t ON t.id = a.territory_id
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  res.json(activities);
}

/**
 * GET/POST /api/activities/webhook
 * Strava webhook endpoint for real-time activity notifications.
 */
export async function stravaWebhook(req: Request, res: Response): Promise<void> {
  if (req.method === 'GET') {
    const { 'hub.verify_token': verifyToken, 'hub.challenge': challenge } = req.query;
    if (verifyToken === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
      res.json({ 'hub.challenge': challenge });
    } else {
      res.status(403).json({ error: 'Verify token mismatch' });
    }
    return;
  }

  const { object_type, aspect_type, object_id, owner_id } = req.body;
  if (object_type !== 'activity' || aspect_type !== 'create') { res.sendStatus(200); return; }

  const user = await queryOne<{ id: string; team: string }>(
    'SELECT id, team FROM users WHERE strava_id = $1',
    [owner_id]
  );
  if (!user) { res.sendStatus(200); return; }

  try {
    const stravaActivity = await getActivity(user.id, object_id);
    const polylineStr = stravaActivity.map?.summary_polyline;
    if (!polylineStr) { res.sendStatus(200); return; }

    const points = decodePolyline(polylineStr);
    const { circular, gapM } = isCircularRoute(points);

    const activityRow = await queryOne<{ id: string }>(
      `INSERT INTO activities
         (strava_activity_id, user_id, name, distance_m, moving_time_s,
          total_elevation_m, start_lat, start_lng, summary_polyline, is_circular, circularity_gap_m)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (strava_activity_id) DO NOTHING
       RETURNING id`,
      [
        stravaActivity.id, user.id, stravaActivity.name, stravaActivity.distance,
        stravaActivity.moving_time, stravaActivity.total_elevation_gain,
        stravaActivity.start_latlng?.[0] ?? null,
        stravaActivity.start_latlng?.[1] ?? null,
        polylineStr, circular, gapM,
      ]
    );

    if (activityRow && circular && points.length >= 4) {
      await processConquest(user.id, user.team as Team, activityRow.id, points);
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }

  res.sendStatus(200);
}
