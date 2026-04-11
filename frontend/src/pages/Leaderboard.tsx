import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchStats } from '../api/territories';
import { TEAM_COLORS, TEAM_LABELS, LeaderboardEntry, Team } from '../types';

function formatArea(m2: number): string {
  return `${(m2 / 1_000_000).toFixed(2)} km²`;
}

const MEDAL = ['🥇', '🥈', '🥉'];
const TEAMS: Team[] = ['blue', 'red', 'yellow'];

const TEAM_ICONS: Record<Team, string> = {
  blue:   '🔵',
  red:    '🔴',
  yellow: '🟡',
};

const TEAM_IMAGES: Record<Team, string> = {
  blue:   '/team-blue.png',
  red:    '/team-red.png',
  yellow: '/team-yellow.png',
};

const TEAM_POWERS: Record<Team, { icon: string; label: string }[]> = {
  blue:   [{ icon: '⚡', label: 'Velocidad' }, { icon: '🧠', label: 'Estrategia' }],
  red:    [{ icon: '💪', label: 'Fuerza' },    { icon: '🔥', label: 'Resistencia' }],
  yellow: [{ icon: '🦊', label: 'Astucia' },   { icon: '🗺️', label: 'Territorio' }],
};

export function LeaderboardPage() {
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 60_000,
  });

  const totalArea = data?.teams.reduce((s, t) => s + t.total_area_m2, 0) ?? 1;

  // Filter leaderboard by selected team (or show all)
  const filtered = activeTeam
    ? (data?.leaderboard ?? []).filter((e) => e.team === activeTeam)
    : (data?.leaderboard ?? []);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Ranking Global</h1>

        {/* ── Team cards (clickable) ─────────────────────────────────────── */}
        {data && (
          <div className="teams-grid" style={styles.teamsGrid}>
            {TEAMS.map((team) => {
              const stats  = data.teams.find((t) => t.team === team);
              const pct    = stats ? ((stats.total_area_m2 / totalArea) * 100).toFixed(1) : '0';
              const active = activeTeam === team;
              const color  = TEAM_COLORS[team];

              return (
                <button
                  key={team}
                  onClick={() => setActiveTeam(active ? null : team)}
                  style={{
                    ...styles.teamCard,
                    borderColor: active ? color : `${color}44`,
                    background:  active ? `${color}22` : `${color}0d`,
                    boxShadow:   active ? `0 0 0 2px ${color}` : 'none',
                    cursor: 'pointer',
                    transform: active ? 'scale(1.02)' : 'scale(1)',
                  }}
                >
                  {/* Active indicator */}
                  {active && (
                    <div style={{ ...styles.activeBadge, background: color }}>
                      ✓ Seleccionado
                    </div>
                  )}

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

                  <div style={styles.teamStat}>
                    {stats ? formatArea(stats.total_area_m2) : '—'}
                  </div>
                  <div style={styles.teamPct}>{pct}% del mapa</div>
                  <div style={styles.teamZones}>
                    {stats?.territory_count ?? 0} zonas ·{' '}
                    {(data.leaderboard ?? []).filter((e) => e.team === team).length} runners
                  </div>

                  <div style={styles.barTrack}>
                    <div style={{ ...styles.barFill, width: `${pct}%`, backgroundColor: color }} />
                  </div>

                  <div style={{ ...styles.clickHint, color: active ? color : '#6b7280' }}>
                    {active ? 'Click para ver todos' : 'Click para ver runners →'}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Leaderboard header ─────────────────────────────────────────── */}
        <div style={styles.subtitleRow}>
          <h2 style={styles.subtitle}>
            {activeTeam ? (
              <>
                <span style={{ color: TEAM_COLORS[activeTeam] }}>{TEAM_ICONS[activeTeam]} {TEAM_LABELS[activeTeam]}</span>
                {' — Top Runners'}
              </>
            ) : 'Top Runners — Global'}
          </h2>
          {activeTeam && (
            <button onClick={() => setActiveTeam(null)} style={styles.clearBtn}>
              ✕ Ver todos
            </button>
          )}
        </div>

        {isLoading && <p style={styles.loadingText}>Cargando...</p>}

        {/* ── Runner rows ────────────────────────────────────────────────── */}
        {filtered.map((entry: LeaderboardEntry, i: number) => (
          <div
            key={entry.id}
            onClick={() => navigate(`/profile/${entry.id}`)}
            style={{
              ...styles.row,
              borderColor: activeTeam
                ? `${TEAM_COLORS[activeTeam]}33`
                : 'rgba(255,255,255,0.07)',
              cursor: 'pointer',
            }}
          >
            <span style={styles.rank}>
              {i < 3 ? MEDAL[i] : `#${i + 1}`}
            </span>
            <img
              src={entry.profile_picture}
              alt={entry.username}
              style={{
                ...styles.avatar,
                borderColor: `${TEAM_COLORS[entry.team]}66`,
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  `https://ui-avatars.com/api/?name=${entry.firstname}&background=random&color=fff`;
              }}
            />
            <div style={styles.entryInfo}>
              <div style={styles.entryName}>
                {entry.firstname} {entry.lastname}
              </div>
              <div style={styles.entryMeta}>@{entry.username}</div>
            </div>

            {/* Only show team pill when viewing global ranking */}
            {!activeTeam && (
              <div style={{ ...styles.teamPill, backgroundColor: TEAM_COLORS[entry.team] }}>
                {TEAM_ICONS[entry.team]} {TEAM_LABELS[entry.team]}
              </div>
            )}

            <div style={styles.areaCol}>
              <div style={{ ...styles.areaValue, color: TEAM_COLORS[entry.team] }}>
                {formatArea(entry.total_area_m2)}
              </div>
              <div style={styles.areaLabel}>{entry.territory_count} zonas</div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && !isLoading && (
          <p style={styles.emptyText}>
            {activeTeam
              ? `Aún no hay runners en ${TEAM_LABELS[activeTeam]}. ¡Únete al equipo!`
              : 'Aún no hay territorios conquistados. ¡Sé el primero!'}
          </p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:      { minHeight: '100vh', background: '#0a0a0a', paddingTop: 72, paddingBottom: 80 },
  container: { maxWidth: 760, margin: '0 auto', padding: '32px 24px' },
  title:     { fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 28, letterSpacing: '-0.01em' },

  teamsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 40 } as React.CSSProperties,

  teamCard: {
    border: '1px solid',
    borderRadius: 16,
    padding: '20px 16px',
    textAlign: 'left',
    transition: 'all 0.2s ease',
    position: 'relative',
    overflow: 'hidden',
    background: 'none',
  },
  activeBadge: {
    position: 'absolute',
    top: 10, right: 10,
    fontSize: 10, fontWeight: 700,
    color: '#fff',
    padding: '2px 8px',
    borderRadius: 20,
  },
  teamName:  { fontSize: 14, fontWeight: 700, marginBottom: 8, margin: '0 0 8px' },
  teamStat:  { fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 2 },
  teamPct:   { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  teamZones: { fontSize: 11, color: '#6b7280', marginBottom: 12 },
  barTrack:  { height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 },
  barFill:   { height: '100%', borderRadius: 2, transition: 'width 0.5s ease' },
  clickHint:   { fontSize: 11, fontWeight: 500, marginTop: 4 },
  powersRow:   { display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  powerBadge:  { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, border: '1px solid' },

  subtitleRow:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)' },
  subtitle:     { fontSize: 18, fontWeight: 700, color: '#e5e7eb', margin: 0 },
  clearBtn:     { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#9ca3af', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer' },

  loadingText: { color: '#6b7280', fontSize: 14 },
  emptyText:   { color: '#6b7280', fontSize: 13, fontStyle: 'italic', padding: '24px 0', textAlign: 'center' },

  row: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid',
    borderRadius: 12,
    marginBottom: 8,
    transition: 'border-color 0.2s',
  },
  rank:      { fontSize: 16, width: 32, textAlign: 'center', flexShrink: 0, color: '#9ca3af' },
  avatar:    { width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid' },
  entryInfo: { flex: 1, minWidth: 0 },
  entryName: { fontSize: 14, fontWeight: 600, color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  entryMeta: { fontSize: 11, color: '#6b7280' },
  teamPill:  { fontSize: 11, fontWeight: 700, color: '#fff', padding: '3px 10px', borderRadius: 20, flexShrink: 0 },
  areaCol:   { textAlign: 'right', flexShrink: 0 },
  areaValue: { fontSize: 14, fontWeight: 700 },
  areaLabel: { fontSize: 11, color: '#6b7280' },
};
