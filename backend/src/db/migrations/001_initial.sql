-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  strava_id         BIGINT UNIQUE NOT NULL,
  username          VARCHAR(255) NOT NULL,
  firstname         VARCHAR(255),
  lastname          VARCHAR(255),
  email             VARCHAR(255),
  profile_picture   TEXT,
  team              VARCHAR(10) NOT NULL CHECK (team IN ('blue', 'red', 'yellow')),
  -- Strava OAuth tokens (stored encrypted in production)
  access_token      TEXT,
  refresh_token     TEXT,
  token_expires_at  TIMESTAMPTZ,
  total_area_m2     FLOAT DEFAULT 0,
  territories_won   INTEGER DEFAULT 0,
  territories_lost  INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ACTIVITIES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  strava_activity_id   BIGINT UNIQUE NOT NULL,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 VARCHAR(500),
  distance_m           FLOAT,
  moving_time_s        INTEGER,
  elapsed_time_s       INTEGER,
  total_elevation_m    FLOAT,
  start_lat            FLOAT,
  start_lng            FLOAT,
  summary_polyline     TEXT,
  is_circular          BOOLEAN DEFAULT FALSE,
  circularity_gap_m    FLOAT,          -- Distance between start and end points
  territory_id         UUID,           -- Set after territory is created
  processed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TERRITORIES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS territories (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team           VARCHAR(10) NOT NULL CHECK (team IN ('blue', 'red', 'yellow')),
  -- PostGIS polygon in WGS84 (SRID 4326)
  polygon        GEOMETRY(POLYGON, 4326) NOT NULL,
  area_m2        FLOAT NOT NULL,
  -- Source activity
  activity_id    UUID REFERENCES activities(id) ON DELETE SET NULL,
  conquered_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index for fast geographic queries
CREATE INDEX IF NOT EXISTS territories_polygon_idx
  ON territories USING GIST (polygon);

CREATE INDEX IF NOT EXISTS territories_team_idx
  ON territories (team);

CREATE INDEX IF NOT EXISTS territories_owner_idx
  ON territories (owner_id);

-- ─── TERRITORY HISTORY ───────────────────────────────────────────────────────
-- Audit log of all ownership changes
CREATE TABLE IF NOT EXISTS territory_history (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  territory_id   UUID NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  previous_team  VARCHAR(10) CHECK (previous_team IN ('blue', 'red', 'yellow')),
  previous_owner UUID REFERENCES users(id) ON DELETE SET NULL,
  new_team       VARCHAR(10) NOT NULL CHECK (new_team IN ('blue', 'red', 'yellow')),
  new_owner      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id    UUID REFERENCES activities(id) ON DELETE SET NULL,
  changed_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TEAM STATS VIEW ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW team_stats AS
SELECT
  team,
  COUNT(*) AS territory_count,
  SUM(area_m2) AS total_area_m2,
  SUM(area_m2) / 1000000.0 AS total_area_km2
FROM territories
GROUP BY team;

-- ─── LEADERBOARD VIEW ────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  u.id,
  u.username,
  u.firstname,
  u.lastname,
  u.profile_picture,
  u.team,
  COUNT(t.id) AS territory_count,
  COALESCE(SUM(t.area_m2), 0) AS total_area_m2,
  u.territories_won,
  u.territories_lost
FROM users u
LEFT JOIN territories t ON t.owner_id = u.id
GROUP BY u.id, u.username, u.firstname, u.lastname, u.profile_picture,
         u.team, u.territories_won, u.territories_lost
ORDER BY total_area_m2 DESC;

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER territories_updated_at
  BEFORE UPDATE ON territories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
