import axios from 'axios';
import { env } from '../config/env';
import { queryOne, query } from '../config/database';

const STRAVA_BASE = 'https://www.strava.com/api/v3';

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: StravaAthlete;
}

export interface StravaAthlete {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  profile: string; // Profile picture URL
  email?: string;
}

export interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  trainer: boolean;   // true = cinta / indoor
  start_latlng: [number, number] | [];
  map: {
    polyline?: string;          // Detailed polyline (only on individual activity fetch)
    summary_polyline: string;   // Simplified polyline (always available)
  };
}

/**
 * Exchange a Strava authorization code for tokens.
 */
export async function exchangeCode(code: string): Promise<StravaTokenResponse> {
  const response = await axios.post<StravaTokenResponse>(
    'https://www.strava.com/oauth/token',
    {
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }
  );
  return response.data;
}

/**
 * Refresh an expired Strava access token using the refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
}> {
  const response = await axios.post(
    'https://www.strava.com/oauth/token',
    {
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }
  );
  return response.data;
}

/**
 * Returns a valid access token for a user, refreshing if expired.
 */
export async function getValidToken(userId: string): Promise<string> {
  const user = await queryOne<{
    access_token: string;
    refresh_token: string;
    token_expires_at: Date;
  }>(
    'SELECT access_token, refresh_token, token_expires_at FROM users WHERE id = $1',
    [userId]
  );

  if (!user) throw new Error('User not found');

  const expiresAt = new Date(user.token_expires_at).getTime();
  const nowMs = Date.now();
  const bufferMs = 5 * 60 * 1000; // 5 minutes buffer

  if (expiresAt - nowMs > bufferMs) {
    return user.access_token;
  }

  // Token expired — refresh it
  const refreshed = await refreshAccessToken(user.refresh_token);

  await query(
    `UPDATE users
       SET access_token = $1, refresh_token = $2, token_expires_at = to_timestamp($3)
     WHERE id = $4`,
    [refreshed.access_token, refreshed.refresh_token, refreshed.expires_at, userId]
  );

  return refreshed.access_token;
}

/**
 * Fetch a single activity from Strava by ID.
 */
export async function getActivity(
  userId: string,
  stravaActivityId: number
): Promise<StravaActivity> {
  const token = await getValidToken(userId);
  const response = await axios.get<StravaActivity>(
    `${STRAVA_BASE}/activities/${stravaActivityId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

/**
 * Fetch the authenticated athlete's recent activities.
 */
export async function getAthleteActivities(
  userId: string,
  page = 1,
  perPage = 30
): Promise<StravaActivity[]> {
  const token = await getValidToken(userId);
  const response = await axios.get<StravaActivity[]>(
    `${STRAVA_BASE}/athlete/activities`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { page, per_page: perPage },
    }
  );
  return response.data;
}

/**
 * Subscribe to Strava webhooks for real-time activity updates.
 * Call this once when setting up the server.
 */
export async function subscribeToWebhook(callbackUrl: string): Promise<void> {
  try {
    const response = await axios.post(
      'https://www.strava.com/api/v3/push_subscriptions',
      {
        client_id: env.STRAVA_CLIENT_ID,
        client_secret: env.STRAVA_CLIENT_SECRET,
        callback_url: callbackUrl,
        verify_token: env.STRAVA_WEBHOOK_VERIFY_TOKEN,
      }
    );
    console.log('Strava webhook subscription created:', response.data);
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      // Subscription might already exist
      console.warn('Strava webhook subscription warning:', err.response?.data);
    }
  }
}
