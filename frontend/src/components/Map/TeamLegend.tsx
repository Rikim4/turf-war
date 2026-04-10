import { TeamStats, TEAM_COLORS, TEAM_LABELS, Team } from '../../types';

interface TeamLegendProps {
  stats: TeamStats[];
}

function formatArea(m2: number): string {
  return `${(m2 / 1_000_000).toFixed(2)} km²`;
}

const TEAMS: Team[] = ['blue', 'red', 'yellow'];

export function TeamLegend({ stats }: TeamLegendProps) {
  const statsMap = Object.fromEntries(stats.map((s) => [s.team, s])) as Record<Team, TeamStats | undefined>;

  const totalArea = stats.reduce((sum, s) => sum + s.total_area_m2, 0) || 1;

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Territorios</h3>
      {TEAMS.map((team) => {
        const s = statsMap[team];
        const pct = s ? ((s.total_area_m2 / totalArea) * 100).toFixed(1) : '0';
        return (
          <div key={team} style={styles.row}>
            <div
              style={{
                ...styles.dot,
                backgroundColor: TEAM_COLORS[team],
              }}
            />
            <div style={styles.info}>
              <span style={styles.teamName}>{TEAM_LABELS[team]}</span>
              <span style={styles.area}>{s ? formatArea(s.total_area_m2) : '—'}</span>
            </div>
            <div style={styles.barTrack}>
              <div
                style={{
                  ...styles.barFill,
                  width: `${pct}%`,
                  backgroundColor: TEAM_COLORS[team],
                }}
              />
            </div>
            <span style={styles.pct}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 72,
    right: 16,
    background: 'rgba(10,10,10,0.88)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: '14px 16px',
    minWidth: 200,
    zIndex: 100,
  },
  title: {
    fontSize: 11,
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 12,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 80,
  },
  teamName: {
    fontSize: 12,
    fontWeight: 600,
    color: '#e5e7eb',
  },
  area: {
    fontSize: 10,
    color: '#6b7280',
  },
  barTrack: {
    flex: 1,
    height: 4,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.5s ease',
  },
  pct: {
    fontSize: 11,
    color: '#9ca3af',
    minWidth: 32,
    textAlign: 'right',
  },
};
