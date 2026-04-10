import { Request, Response } from 'express';
import { env } from '../config/env';
import { exchangeCode } from '../services/stravaService';
import { queryOne, query } from '../config/database';
import { signToken } from '../utils/jwt';

type Team = 'blue' | 'red' | 'yellow';

const STRAVA_SCOPES = 'read,activity:read_all';
const TEAM_LOCK_DAYS = 14;

/**
 * GET /api/auth/strava?team=blue|red|yellow
 * Redirige al usuario a la página de autorización OAuth de Strava.
 * El equipo elegido viaja codificado en el parámetro "state".
 */
export async function stravaOAuthRedirect(req: Request, res: Response): Promise<void> {
  const team = req.query.team as Team;
  const validTeams: Team[] = ['blue', 'red', 'yellow'];

  if (!team || !validTeams.includes(team)) {
    res.status(400).json({ error: 'El parámetro team debe ser blue, red o yellow' });
    return;
  }

  const state = Buffer.from(JSON.stringify({ team })).toString('base64url');

  const params = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    redirect_uri: env.STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: STRAVA_SCOPES,
    state,
  });

  res.redirect(`https://www.strava.com/oauth/authorize?${params.toString()}`);
}

/**
 * GET /api/auth/strava/callback
 * Callback OAuth de Strava. Crea o actualiza el usuario y devuelve un JWT.
 */
export async function stravaCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query;

  if (error) {
    res.redirect(`${env.FRONTEND_URL}/login?error=strava_denied`);
    return;
  }

  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing authorization code' });
    return;
  }

  let chosenTeam: Team = 'blue';
  try {
    if (state && typeof state === 'string') {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      if (['blue', 'red', 'yellow'].includes(decoded.team)) {
        chosenTeam = decoded.team;
      }
    }
  } catch {
    // Equipo por defecto
  }

  try {
    const tokenData = await exchangeCode(code);
    const { athlete, access_token, refresh_token, expires_at } = tokenData;

    // ¿Usuario ya registrado?
    const existing = await queryOne<{ id: string; team: Team }>(
      'SELECT id, team FROM users WHERE strava_id = $1',
      [athlete.id]
    );

    let userId: string;
    let team: Team;

    if (existing) {
      // Usuario existente: SOLO actualiza tokens OAuth — nunca sobreescribe
      // el nombre, username ni foto que el usuario haya personalizado
      team = existing.team;
      userId = existing.id;
      await query(
        `UPDATE users
           SET access_token = $1, refresh_token = $2,
               token_expires_at = to_timestamp($3),
               updated_at = NOW()
         WHERE id = $4`,
        [access_token, refresh_token, expires_at, userId]
      );
    } else {
      // Nuevo usuario: crea con el equipo elegido y registra la fecha de selección
      team = chosenTeam;
      const row = await queryOne<{ id: string }>(
        `INSERT INTO users
           (strava_id, username, firstname, lastname, profile_picture,
            team, team_selected_at, access_token, refresh_token, token_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, to_timestamp($9))
         RETURNING id`,
        [
          athlete.id,
          athlete.username || `runner_${athlete.id}`,
          athlete.firstname, athlete.lastname, athlete.profile,
          team, access_token, refresh_token, expires_at,
        ]
      );
      if (!row) throw new Error('Failed to create user');
      userId = row.id;
    }

    const jwt = signToken({ userId, stravaId: athlete.id, team });
    res.redirect(`${env.FRONTEND_URL}/auth/success?token=${jwt}&team=${team}`);
  } catch (err: unknown) {
    console.error('Strava callback error:', err);
    res.redirect(`${env.FRONTEND_URL}/login?error=auth_failed`);
  }
}

/**
 * GET /api/auth/me
 * Devuelve el perfil del usuario autenticado, incluyendo info del bloqueo de equipo.
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await queryOne<{
    id: string; team: Team; team_selected_at: string;
    [key: string]: unknown;
  }>(
    `SELECT id, strava_id, username, firstname, lastname, profile_picture,
            team, COALESCE(team_selected_at, created_at) AS team_selected_at,
            total_area_m2, territories_won, territories_lost, created_at
     FROM users WHERE id = $1`,
    [req.user!.userId]
  );

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Calcula días restantes de bloqueo
  const selectedAt = new Date(user.team_selected_at || user.created_at as string);
  const unlockAt = new Date(selectedAt.getTime() + TEAM_LOCK_DAYS * 24 * 60 * 60 * 1000);
  const msRemaining = unlockAt.getTime() - Date.now();
  const daysLocked = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

  res.json({
    ...user,
    teamLocked: daysLocked > 0,
    teamLockDaysRemaining: daysLocked,
    teamUnlocksAt: unlockAt.toISOString(),
  });
}

/**
 * GET /api/auth/users/:userId
 * Devuelve el perfil público de cualquier usuario (sin datos sensibles).
 */
export async function getPublicProfile(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  const user = await queryOne<{
    id: string; username: string; firstname: string; lastname: string;
    profile_picture: string; team: Team;
    territories_won: number; territories_lost: number; total_area_m2: number;
    territory_count: number; created_at: string;
  }>(
    `SELECT u.id, u.username, u.firstname, u.lastname, u.profile_picture,
            u.team, u.territories_won, u.territories_lost, u.total_area_m2,
            COUNT(t.id)::int AS territory_count, u.created_at
     FROM users u
     LEFT JOIN territories t ON t.owner_id = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  );

  if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
  res.json(user);
}

/**
 * PUT /api/auth/profile
 * Actualiza el nombre, username y foto de perfil del usuario.
 */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const { firstname, lastname, username, profile_picture } = req.body as {
    firstname?: string;
    lastname?: string;
    username?: string;
    profile_picture?: string;
  };

  // ── Validaciones ──────────────────────────────────────────────────────────
  if (firstname !== undefined && (typeof firstname !== 'string' || firstname.trim().length < 1 || firstname.trim().length > 50)) {
    res.status(400).json({ error: 'El nombre debe tener entre 1 y 50 caracteres' });
    return;
  }
  if (lastname !== undefined && (typeof lastname !== 'string' || lastname.trim().length > 50)) {
    res.status(400).json({ error: 'El apellido no puede superar 50 caracteres' });
    return;
  }
  if (username !== undefined) {
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
      res.status(400).json({ error: 'El username debe tener 3-30 caracteres: letras, números y guiones bajos' });
      return;
    }
    // Check uniqueness
    const taken = await queryOne(
      'SELECT id FROM users WHERE username = $1 AND id != $2',
      [username.trim(), userId]
    );
    if (taken) {
      res.status(409).json({ error: 'Ese username ya está en uso' });
      return;
    }
  }
  if (profile_picture !== undefined) {
    // Accept URL or base64 data URL
    const isUrl = typeof profile_picture === 'string' && (profile_picture.startsWith('http') || profile_picture.startsWith('data:image'));
    if (!isUrl) {
      res.status(400).json({ error: 'La foto debe ser una URL válida o imagen en base64' });
      return;
    }
  }

  // ── Build update query dynamically ───────────────────────────────────────
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (firstname !== undefined)      { fields.push(`firstname = $${idx++}`);       values.push(firstname.trim()); }
  if (lastname !== undefined)       { fields.push(`lastname = $${idx++}`);        values.push(lastname.trim()); }
  if (username !== undefined)       { fields.push(`username = $${idx++}`);        values.push(username.trim()); }
  if (profile_picture !== undefined){ fields.push(`profile_picture = $${idx++}`); values.push(profile_picture); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No hay campos para actualizar' });
    return;
  }

  fields.push(`updated_at = NOW()`);
  values.push(userId);

  const updated = await queryOne(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, username, firstname, lastname, profile_picture`,
    values
  );

  res.json({ message: 'Perfil actualizado', user: updated });
}

/**
 * POST /api/auth/change-team
 * Cambia el equipo del usuario, respetando el bloqueo de 14 días.
 */
export async function changeTeam(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { team } = req.body as { team: Team };
  const validTeams: Team[] = ['blue', 'red', 'yellow'];

  if (!team || !validTeams.includes(team)) {
    res.status(400).json({ error: 'El equipo debe ser blue, red o yellow' });
    return;
  }

  const user = await queryOne<{ team: Team; team_selected_at: string }>(
    'SELECT team, team_selected_at FROM users WHERE id = $1',
    [userId]
  );

  if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
  if (user.team === team) { res.status(400).json({ error: 'Ya perteneces a ese equipo' }); return; }

  // Verificar bloqueo de 14 días
  const selectedAt = new Date(user.team_selected_at);
  const unlockAt = new Date(selectedAt.getTime() + TEAM_LOCK_DAYS * 24 * 60 * 60 * 1000);
  const daysRemaining = Math.ceil((unlockAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  if (daysRemaining > 0) {
    res.status(403).json({
      error: `No puedes cambiar de equipo durante ${TEAM_LOCK_DAYS} días. Faltan ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}.`,
      daysRemaining,
      unlockAt: unlockAt.toISOString(),
    });
    return;
  }

  // Cambio permitido — resetear stats personales (los territorios quedan en el equipo anterior)
  await query(
    `UPDATE users
     SET team = $1, team_selected_at = NOW(), updated_at = NOW(),
         territories_won = 0, territories_lost = 0, total_area_m2 = 0
     WHERE id = $2`,
    [team, userId]
  );

  const newJwt = signToken({ userId, stravaId: req.user!.stravaId, team });
  res.json({ message: `Equipo cambiado a ${team}`, team, token: newJwt });
}
