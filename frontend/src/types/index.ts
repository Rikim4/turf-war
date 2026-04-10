export type Team = 'blue' | 'red' | 'yellow';

export const TEAM_COLORS: Record<Team, string> = {
  blue: '#3B82F6',
  red: '#EF4444',
  yellow: '#FACC15',
};

export const TEAM_COLORS_FILL: Record<Team, string> = {
  blue: '#60A5FA',
  red: '#F87171',
  yellow: '#FDE047',
};

export const TEAM_LABELS: Record<Team, string> = {
  blue: 'Equipo Azul',
  red: 'Equipo Rojo',
  yellow: 'Equipo Amarillo',
};

export interface User {
  id: string;
  strava_id: number;
  username: string;
  firstname: string;
  lastname: string;
  profile_picture: string;
  team: Team;
  team_selected_at: string;
  teamLocked: boolean;
  teamLockDaysRemaining: number;
  teamUnlocksAt: string;
  total_area_m2: number;
  territories_won: number;
  territories_lost: number;
  created_at: string;
}

export interface TerritoryProperties {
  team: Team;
  territoryCount: number;
  totalAreaM2: number;
  lastConqueredAt: string;
}

export interface Territory {
  id: string;
  team: Team;
  owner_id: string;
  username: string;
  profile_picture: string;
  area_m2: number;
  conquered_at: string;
  polygon_geojson: string;
  activity_name?: string;
  distance_m?: number;
  strava_activity_id?: number;
}

export interface TeamStats {
  team: Team;
  territory_count: number;
  total_area_m2: number;
  total_area_km2: number;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  firstname: string;
  lastname: string;
  profile_picture: string;
  team: Team;
  territory_count: number;
  total_area_m2: number;
  territories_won: number;
  territories_lost: number;
}

export interface StatsResponse {
  teams: TeamStats[];
  leaderboard: LeaderboardEntry[];
}

export interface Activity {
  id: string;
  strava_activity_id: number;
  name: string;
  distance_m: number;
  moving_time_s: number;
  total_elevation_m: number;
  is_circular: boolean;
  circularity_gap_m: number;
  territory_id: string | null;
  conquered_team: Team | null;
  created_at: string;
}

export interface ConquestResult {
  territoryId: string;
  areaM2: number;
  stolenCount: number;
  stolenFrom: Team[];
}

export interface SyncResult {
  message: string;
  activity?: { id: string; isCircular: boolean };
  conquest?: ConquestResult;
}
