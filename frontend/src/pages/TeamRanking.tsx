import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchStats } from '../api/territories';
import { TEAM_COLORS, TEAM_LABELS, LeaderboardEntry, Team } from '../types';

function formatArea(m2: number): string {
  return `${(m2 / 1_000_000).toFixed(2)} km²`;
}

const MEDAL = ['🥇', '🥈', '🥉'];

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

export function TeamRankingPage() {
  const { team } = useParams<{ team: string }>();
  const navigate = useNavigate();

  const validTeam = (['blue', 'red', 'yellow'] as Team[]).includes(team as Team) ? (team as Team) : null;

  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 60_000,
  });

  if (!validTeam) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <p style={{ color: '#6b7280' }}>Equipo no válido.</p>
        </div>
      </div>
    );
  }

  const color = TEAM_COLORS[validTeam];
  const stats = data?.teams.find((t) => t.team === validTeam);
  const totalArea = data?.teams.reduce((s, t) => s + t.total_area_m2, 0) ?? 1;
  const pct = stats ? ((stats.total_area_m2 / totalArea) * 100).toFixed(1) : '0';
  const filtered = (data?.leaderboard ?? []).filter((e) => e.team === validTeam);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* ── Back button ──────────────────────────────────────────── */}
        <button onClick={() => navigate('/leaderboard')} style={styles.backBtn}>
          ← Volver al ranking
        </button>

        {/* ── Team header ──────────────────────────────────────────── */}
        <div style={{ ...styles.teamHeader, borderColor: `${color}44`, background: `${color}0d` }}>
          <img
            src={TEAM_IMAGES[validTeam]}
            alt={TEAM_LABELS[validTeam]}
            style={styles.teamImg}
          />
          <div style={{ flex: 1 }}>
            <h1 style={{ ...styles.teamName, color }}>{TEAM_LABELS[validTeam]}</h1>
            <div style={styles.powersRow}>
              {TEAM_POWERS[validTeam].map((p) => (
                <span key={p.label} style={{ ...styles.powerBadge, color, borderColor: `${color}44`, background: `${color}15` }}>
                  {p.icon} {p.label}
                </span>
              ))}
            </div>
            <div style={styles.statsRow}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{stats ? formatArea(stats.total_area_m2) : '—'}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{pct}% del mapa</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{stats?.territory_count ?? 0}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>zonas</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{filtered.length}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>runners</div>
              </div>
            </div>
            <div style={styles.barTrack}>
              <div style={{ ...styles.barFill, width: `${pct}%`, backgroundColor: color }} />
            </div>
          </div>
        </div>

        {/* ── Runners list ──────────────────────────────────────────── */}
        <h2 style={styles.subtitle}>Top Runners</h2>

        {isLoading && <p style={{ color: '#6b7280', fontSize: 14 }}>Cargando...</p>}

        {filtered.map((entry: LeaderboardEntry, i: number) => (
          <div
            key={entry.id}
            onClick={() => navigate(`/profile/${entry.id}`)}
            style={{ ...styles.row, borderColor: `${color}33`, cursor: 'pointer' }}
          >
            <span style={styles.rank}>{i < 3 ? MEDAL[i] : `#${i + 1}`}</span>
            <img
              src={entry.profile_picture}
              alt={entry.username}
              style={{ ...styles.avatar, borderColor: `${color}66` }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${entry.firstname}&background=random&color=fff`;
              }}
            />
            <div style={styles.entryInfo}>
              <div style={styles.entryName}>{entry.firstname} {entry.lastname}</div>
              <div style={styles.entryMeta}>@{entry.username}</div>
            </div>
            <div style={styles.areaCol}>
              <div style={{ ...styles.areaValue, color }}>{formatArea(entry.total_area_m2)}</div>
              <div style={styles.areaLabel}>{entry.territory_count} zonas</div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && !isLoading && (
          <p style={{ color: '#6b7280', fontSize: 13, fontStyle: 'italic', padding: '24px 0', textAlign: 'center' }}>
            Aún no hay runners en {TEAM_LABELS[validTeam]}. ¡Únete al equipo!
          </p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0a0a0a', paddingTop: 72, paddingBottom: 80 },
  container: { maxWidth: 760, margin: '0 auto', padding: '24px 24px' },

  backBtn: {
    background: 'none', border: 'none', color: '#9ca3af', fontSize: 14,
    cursor: 'pointer', padding: '8px 0', marginBottom: 16, fontWeight: 500,
  },

  teamHeader: {
    display: 'flex', gap: 20, padding: 20, borderRadius: 16,
    border: '1px solid', marginBottom: 32, alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  teamImg: { width: 120, borderRadius: 12, objectFit: 'cover', aspectRatio: '1', flexShrink: 0 },
  teamName: { fontSize: 22, fontWeight: 800, margin: '0 0 8px' },
  powersRow: { display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  powerBadge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, border: '1px solid' },
  statsRow: { display: 'flex', gap: 24, marginBottom: 12 },
  barTrack: { height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2, transition: 'width 0.5s ease' },

  subtitle: { fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)' },

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
  areaCol: { textAlign: 'right', flexShrink: 0 },
  areaValue: { fontSize: 14, fontWeight: 700 },
  areaLabel: { fontSize: 11, color: '#6b7280' },
};
