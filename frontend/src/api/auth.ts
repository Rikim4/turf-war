import { apiClient } from './client';
import { User, Team } from '../types';

export function getStravaAuthUrl(team: Team): string {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  return `${apiUrl}/api/auth/strava?team=${team}`;
}

export async function fetchMe(): Promise<User> {
  const res = await apiClient.get<User>('/auth/me');
  return res.data;
}

export async function updateProfile(data: {
  firstname?: string;
  lastname?: string;
  username?: string;
  profile_picture?: string;
}): Promise<{ message: string; user: Partial<User> }> {
  const res = await apiClient.put('/auth/profile', data);
  return res.data;
}
