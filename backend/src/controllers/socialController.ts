import { Request, Response } from 'express';
import { query, queryOne } from '../config/database';

/**
 * GET /api/social/search?q=username
 * Busca usuarios por username (búsqueda parcial).
 */
export async function searchUsers(req: Request, res: Response): Promise<void> {
  const q = ((req.query.q as string) ?? '').trim();
  if (q.length < 2) {
    res.status(400).json({ error: 'Escribe al menos 2 caracteres para buscar.' });
    return;
  }

  const currentUserId = req.user?.userId;

  const users = await query<{
    id: string; username: string; firstname: string; lastname: string;
    profile_picture: string; team: string;
    territories_won: number; total_area_m2: number;
    is_following: boolean;
  }>(
    `SELECT
       u.id, u.username, u.firstname, u.lastname, u.profile_picture,
       u.team, u.territories_won, u.total_area_m2,
       EXISTS(
         SELECT 1 FROM follows f
         WHERE f.follower_id = $2 AND f.following_id = u.id
       ) AS is_following
     FROM users u
     WHERE u.username ILIKE $1
       AND u.id != $2
     ORDER BY u.username
     LIMIT 20`,
    [`%${q}%`, currentUserId ?? '00000000-0000-0000-0000-000000000000']
  );

  res.json(users);
}

/**
 * POST /api/social/follow/:userId
 * Sigue a un usuario.
 */
export async function followUser(req: Request, res: Response): Promise<void> {
  const followerId  = req.user!.userId;
  const followingId = req.params.userId;

  if (followerId === followingId) {
    res.status(400).json({ error: 'No puedes seguirte a ti mismo.' });
    return;
  }

  const target = await queryOne('SELECT id FROM users WHERE id = $1', [followingId]);
  if (!target) { res.status(404).json({ error: 'Usuario no encontrado.' }); return; }

  await query(
    `INSERT INTO follows (follower_id, following_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [followerId, followingId]
  );

  res.json({ message: 'Ahora sigues a este usuario.' });
}

/**
 * DELETE /api/social/follow/:userId
 * Deja de seguir a un usuario.
 */
export async function unfollowUser(req: Request, res: Response): Promise<void> {
  const followerId  = req.user!.userId;
  const followingId = req.params.userId;

  await query(
    'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
    [followerId, followingId]
  );

  res.json({ message: 'Has dejado de seguir a este usuario.' });
}

/**
 * GET /api/social/:userId/followers
 * Lista de usuarios que siguen a :userId.
 */
export async function getFollowers(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const currentUserId = req.user?.userId;

  const followers = await query<{
    id: string; username: string; firstname: string; lastname: string;
    profile_picture: string; team: string; total_area_m2: number; is_following: boolean;
  }>(
    `SELECT
       u.id, u.username, u.firstname, u.lastname, u.profile_picture,
       u.team, u.total_area_m2,
       EXISTS(
         SELECT 1 FROM follows f2
         WHERE f2.follower_id = $2 AND f2.following_id = u.id
       ) AS is_following
     FROM follows f
     JOIN users u ON u.id = f.follower_id
     WHERE f.following_id = $1
     ORDER BY f.created_at DESC`,
    [userId, currentUserId ?? '00000000-0000-0000-0000-000000000000']
  );

  res.json(followers);
}

/**
 * GET /api/social/:userId/following
 * Lista de usuarios a los que :userId sigue.
 */
export async function getFollowing(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const currentUserId = req.user?.userId;

  const following = await query<{
    id: string; username: string; firstname: string; lastname: string;
    profile_picture: string; team: string; total_area_m2: number; is_following: boolean;
  }>(
    `SELECT
       u.id, u.username, u.firstname, u.lastname, u.profile_picture,
       u.team, u.total_area_m2,
       EXISTS(
         SELECT 1 FROM follows f2
         WHERE f2.follower_id = $2 AND f2.following_id = u.id
       ) AS is_following
     FROM follows f
     JOIN users u ON u.id = f.following_id
     WHERE f.follower_id = $1
     ORDER BY f.created_at DESC`,
    [userId, currentUserId ?? '00000000-0000-0000-0000-000000000000']
  );

  res.json(following);
}

/**
 * GET /api/social/:userId/counts
 * Devuelve contadores de seguidores y seguidos.
 */
export async function getFollowCounts(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  const [followersRow, followingRow] = await Promise.all([
    queryOne<{ count: string }>('SELECT COUNT(*)::int AS count FROM follows WHERE following_id = $1', [userId]),
    queryOne<{ count: string }>('SELECT COUNT(*)::int AS count FROM follows WHERE follower_id = $1',  [userId]),
  ]);

  res.json({
    followers: Number(followersRow?.count ?? 0),
    following: Number(followingRow?.count ?? 0),
  });
}
