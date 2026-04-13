import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchStats } from '../api/territories';
import { apiClient } from '../api/client';
import { TEAM_COLORS, TEAM_LABELS, LeaderboardEntry, Team, StatsResponse } from '../types';

function formatArea(m2: number): string {
  return `${(m2 / 1_000_000).toFixed(2)} km²`;
}

const MEDAL = ['🥇', '🥈', '🥉'];
const TEAMS: Team[] = ['blue', 'red', 'yellow'];

const TEAM_IMAGES: Record<Team, string> = {
  blue: '/team-blue.png',
  red: '/team-red.png',
  yellow: '/team-yellow.png',
};

const TEAM_POWERS: Record<Team, { icon: string; label: string }[]> = {
  blue: [{ icon: '⚡', label: 'Velocidad' }, { icon: '🧠', label: 'Estrategia' }],
  red: [{ icon: '💪', label: 'Fuerza' }, { icon: '🔥', label: 'Resistencia' }],
  yellow: [{ icon: '🦊', label: 'Astucia' }, { icon: '🗺️', label: 'Territorio' }],
};

type TabType = 'global' | 'municipal';

function useUserCity(enabled: boolean) {
  const [city, setCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (!enabled || attempted.current || !navigator.geolocation) return;
    attempted.current = true;
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
          const resp = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?types=place,locality&language=es&access_token=${mapboxToken}`
          );
          const data = await resp.json();
          const placeName = data.features?.[0]?.text || null;
          setCity(placeName);
        } catch {
          setCity(null);
        }
        setLoading(false);
      },
      () => { setCity(null); setLoading(false); },
      { timeout: 15000, maximumAge: 300000, enableHighAccuracy: true }
    );
  }, [enabled]);

  return { city, loading };
}

export function LeaderboardPage() {
  const [tab, setTab] = useState<TabType>('global');
  const navigate = useNavigate();
  const { city, loading: cityLoading } = useUserCity(tab === 'municipal');

  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 60_000,
  });

  const { data: cityData } = useQuery({
    queryKey: ['stats-city', city],
    queryFn: async (): Promise<StatsResponse> => {
      const res = await apiClient.get<StatsResponse>(`/territories/stats?city=${encodeURIComponent(city!)}`);
      return res.data;
    },
    enabled: tab === 'municipal' && !!city,
    refetchInterval: 60_000,
  });

  const activeData = tab === 'municipal' && city ? cityData : data;
  const totalArea = activeData?.teams.reduce((s, t) => s + t.total_area_m2, 0) ?? 1;
  const leaderboard = activeData?.leaderboard ?? [];

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* ── Tabs ──────────────────────────────────────────────────── */}
        <div style={styles.tabsRow}>
          <button
            onClick={() => setTab('global')}
            style={{ ...styles.tab, ...(tab === 'global' ? styles.tabActive : {}) }}
          >
            Ranking Global
          </button>
          <button
            onClick={() => setTab('municipal')}
            style={{ ...styles.tab, ...(tab === 'municipal' ? styles.tabActive : {}) }}
          >
            Mi Municipio
          </button>
        </div>

        {tab === 'municipal' && (
          <div style={styles.cityBanner}>
            {cityLoading ? '📍 Detectando ubicación...' : city ? `📍 ${city}` : '📍 No se pudo detectar tu municipio'}
          </div>
        )}

        {/* ── Team cards → navigate to team page ────────────────────── */}
        {activeData && (
          <div className="teams-grid" style={styles.teamsGrid}>
            {TEAMS.map((team) => {
              const stats = activeData.teams.find((t) => t.team === team);
              const pct = stats ? ((stats.total_area_m2 / totalArea) * 100).toFixed(1) : '0';
              const color = TEAM_COLORS[team];
              const runners = (activeData.leaderboard ?? []).filter((e) => e.team === team).length;

              return (
                <button
                  key={team}
                  onClick={() => navigate(`/leaderboard/${team}`)}
                  style={{ ...styles.teamCard, borderColor: `${color}44`, background: `${color}0d`, cursor: 'pointer' }}
                >
                  <img
                    src={TEAM_IMAGES[team]}
                    alt={TEAM_LABELS[team]}
                    style={{ width: '100%', borderRadius: 10, marginBottom: 10, objectFit: 'cover', aspectRatio: '16/9' }}
                  />

                  <div style={styles.powersRow}>
                    {TEAM_POWERS[team].map((p) => (
                      <span key={p.label} style={{ ...styles.powerBadge, color, borderColor: `${color}44`, background: `${color}15` }}>
                        {p.icon} {p.label}
                      </span>
                    ))}
                  </div>

                  <div style={styles.teamStat}>{stats ? formatArea(stats.total_area_m2) : '—'}</div>
                  <div style={styles.teamPct}>{pct}% del mapa</div>
                  <div style={styles.teamZones}>{stats?.territory_count ?? 0} zonas · {runners} runners</div>

                  <div style={styles.barTrack}>
                    <div style={{ ...styles.barFill, width: `${pct}%`, backgroundColor: color }} />
                  </div>

                  <div style={{ ...styles.clickHint, color: '#6b7280' }}>Ver ranking del equipo →</div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Leaderboard ───────────────────────────────────────────── */}
        <div style={styles.subtitleRow}>
          <h2 style={styles.subtitle}>
            {tab === 'municipal'
              ? `Top Runners — ${city || 'Municipio'}`
              : 'Top Runners — Global'}
          </h2>
        </div>

        {isLoading && <p style={styles.loadingText}>Cargando...</p>}

        {leaderboard.map((entry: LeaderboardEntry, i: number) => (
          <div
            key={entry.id}
            onClick={() => navigate(`/profile/${entry.id}`)}
            style={{ ...styles.row, borderColor: 'rgba(255,255,255,0.07)', cursor: 'pointer' }}
          >
            <span style={styles.rank}>{i < 3 ? MEDAL[i] : `#${i + 1}`}</span>
            <img
              src={entry.profile_picture}
              alt={entry.username}
              style={{ ...styles.avatar, borderColor: `${TEAM_COLORS[entry.team]}66` }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${entry.firstname}&background=random&color=fff`;
              }}
            />
            <div style={styles.entryInfo}>
              <div style={styles.entryName}>{entry.firstname} {entry.lastname}</div>
              <div style={styles.entryMeta}>@{entry.username}</div>
            </div>
            <div style={{ ...styles.teamPill, backgroundColor: TEAM_COLORS[entry.team] }}>
              {TEAM_LABELS[entry.team]}
            </div>
            <div style={styles.areaCol}>
              <div style={{ ...styles.areaValue, color: TEAM_COLORS[entry.team] }}>{formatArea(entry.total_area_m2)}</div>
              <div style={styles.areaLabel}>{entry.territory_count} zonas</div>
            </div>
          </div>
        ))}

        {leaderboard.length === 0 && !isLoading && (
          <p style={styles.emptyText}>
            {tab === 'municipal' && city
              ? `Aún no hay runners en ${city}. ¡Sé el primero!`
              : 'Aún no hay territorios conquistados. ¡Sé el primero!'}
          </p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0a0a0a', paddingTop: 72, paddingBottom: 80 },
  container: { maxWidth: 760, margin: '0 auto', padding: '32px 24px' },

  tabsRow: {
    display: 'flex', gap: 4, marginBottom: 24,
    background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4,
  },
  tab: {
    flex: 1, padding: '10px 16px', border: 'none', borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    background: 'transparent', color: '#6b7280', transition: 'all 0.2s',
  },
  tabActive: {
    background: 'rgba(255,255,255,0.1)', color: '#fff',
  },
  cityBanner: {
    fontSize: 13, color: '#9ca3af', marginBottom: 20, padding: '8px 14px',
    background: 'rgba(255,255,255,0.04)', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.08)',
  },

  teamsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 40 } as React.CSSProperties,

  teamCard: {
    border: '1px solid', borderRadius: 16, padding: '20px 16px',
    textAlign: 'left', transition: 'all 0.2s ease',
    position: 'relative', overflow: 'hidden', background: 'none',
  },
  teamStat: { fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 2 },
  teamPct: { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  teamZones: { fontSize: 11, color: '#6b7280', marginBottom: 12 },
  barTrack: { height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 },
  barFill: { height: '100%', borderRadius: 2, transition: 'width 0.5s ease' },
  clickHint: { fontSize: 11, fontWeight: 500, marginTop: 4 },
  powersRow: { display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  powerBadge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, border: '1px solid' },

  subtitleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)' },
  subtitle: { fontSize: 18, fontWeight: 700, color: '#e5e7eb', margin: 0 },

  loadingText: { color: '#6b7280', fontSize: 14 },
  emptyText: { color: '#6b7280', fontSize: 13, fontStyle: 'italic', padding: '24px 0', textAlign: 'center' },

  row: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 16px', background: 'rgba(255,255,255,0.03)',
    border: '1px solid', borderRadius: 12, marginBottom: 8,
    transition: 'border-color 0.2s',
  },
  rank: { fontSize: 16, width: 32, textAlign: 'center', flexShrink: 0, color: '#9ca3af' },
  avatar: { width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid' },
  entryInfo: { flex: 1, minWidth: 0 },
  entryName: { fontSize: 14, fontWeight: 600, color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  entryMeta: { fontSize: 11, color: '#6b7280' },
  teamPill: { fontSize: 11, fontWeight: 700, color: '#fff', padding: '3px 10px', borderRadius: 20, flexShrink: 0 },
  areaCol: { textAlign: 'right', flexShrink: 0 },
  areaValue: { fontSize: 14, fontWeight: 700 },
  areaLabel: { fontSize: 11, color: '#6b7280' },
};
