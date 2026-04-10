import { apiClient } from './client';
import { StatsResponse, Territory, SyncResult } from '../types';

export async function fetchTerritories(
  bbox?: [number, number, number, number]
): Promise<GeoJSON.FeatureCollection> {
  const params = bbox ? { bbox: bbox.join(',') } : {};
  const res = await apiClient.get<GeoJSON.FeatureCollection>('/territories', { params });
  return res.data;
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await apiClient.get<StatsResponse>('/territories/stats');
  return res.data;
}

export async function fetchUserTerritories(userId: string): Promise<Territory[]> {
  const res = await apiClient.get<Territory[]>(`/territories/user/${userId}`);
  return res.data;
}

export async function syncActivity(stravaActivityId: number): Promise<SyncResult> {
  const res = await apiClient.post<SyncResult>(`/activities/sync/${stravaActivityId}`);
  return res.data;
}

export async function syncLatestActivity(): Promise<SyncResult> {
  const res = await apiClient.post<SyncResult>('/activities/sync-latest');
  return res.data;
}

export async function fetchActivities(): Promise<import('../types').Activity[]> {
  const res = await apiClient.get('/activities');
  return res.data;
}
