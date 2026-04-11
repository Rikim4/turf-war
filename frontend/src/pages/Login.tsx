import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getStravaAuthUrl } from '../api/auth';
import { Team, TEAM_COLORS, TEAM_LABELS } from '../types';

const TEAMS: Team[] = ['blue', 'red', 'yellow'];

const TEAM_IMAGES: Record<Team, string> = {
  blue:   '/team-blue.png',
  red:    '/team-red.png',
  yellow: '/team-yellow.png',
};

const TEAM_DESC: Record<Team, string> = {
  blue: 'Velocidad y estrategia',
  red: 'Fuerza y resistencia',
  yellow: 'Astucia y territorio',
};

export function LoginPage() {
  const { isAuthenticated } = useAuth();
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleJoin = () => {
    if (!selectedTeam) return;
    window.location.href = getStravaAuthUrl(selectedTeam);
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoArea}>
          <img src="/app-logo.png" alt="Turf War" style={styles.logoImg} />
          <p style={styles.subtitle}>Conquista tu ciudad. Kilómetro a kilómetro.</p>
        </div>

        {/* Team selection */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Elige tu equipo</h2>
          <p style={styles.sectionNote}>Esta decisión es permanente. Elige con sabiduría.</p>

          <div className="login-teams-grid" style={styles.teamsGrid}>
            {TEAMS.map((team) => (
              <button
                key={team}
                onClick={() => setSelectedTeam(team)}
                style={{
                  ...styles.teamCard,
                  borderColor:
                    selectedTeam === team
                      ? TEAM_COLORS[team]
                      : 'rgba(255,255,255,0.1)',
                  background:
                    selectedTeam === team
                      ? `${TEAM_COLORS[team]}22`
                      : 'rgba(255,255,255,0.03)',
                  transform: selectedTeam === team ? 'scale(1.03)' : 'scale(1)',
                }}
              >
                <img
                  src={TEAM_IMAGES[team]}
                  alt={TEAM_LABELS[team]}
                  style={{
                    ...styles.teamImg,
                    filter: selectedTeam === team ? 'none' : 'brightness(0.65) grayscale(0.3)',
                  }}
                />
                <span style={styles.teamDesc}>{TEAM_DESC[team]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Strava connect button */}
        <button
          onClick={handleJoin}
          disabled={!selectedTeam}
          style={{
            ...styles.stravaBtn,
            opacity: selectedTeam ? 1 : 0.4,
            cursor: selectedTeam ? 'pointer' : 'not-allowed',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
          Conectar con Strava
          {selectedTeam && (
            <span
              style={{
                marginLeft: 8,
                background: TEAM_COLORS[selectedTeam],
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {TEAM_LABELS[selectedTeam]}
            </span>
          )}
        </button>

        {/* How it works */}
        <div style={styles.howItWorks}>
          <h3 style={styles.howTitle}>Cómo jugar</h3>
          <div style={styles.steps}>
            {[
              { icon: '🏃', text: 'Sal a correr una ruta circular' },
              { icon: '🗺️', text: 'Tu recorrido se convierte en un polígono' },
              { icon: '🎨', text: 'El área queda pintada con el color de tu equipo' },
              { icon: '⚔️', text: 'Rodea zonas enemigas para conquistarlas' },
            ].map((step, i) => (
              <div key={i} style={styles.step}>
                <span style={styles.stepIcon}>{step.icon}</span>
                <span style={styles.stepText}>{step.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(ellipse at center, #111827 0%, #0a0a0a 100%)',
    padding: 24,
  },
  card: {
    background: 'rgba(17,24,39,0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: '40px 36px',
    maxWidth: 480,
    width: '100%',
    backdropFilter: 'blur(20px)',
  },
  logoArea: {
    textAlign: 'center',
    marginBottom: 36,
  },
  logoImg: {
    width: 160,
    height: 160,
    objectFit: 'contain',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#e5e7eb',
    marginBottom: 4,
  },
  sectionNote: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
  },
  teamsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
  },
  teamCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px 6px',
    border: '2px solid',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    gap: 6,
  },
  teamImg: {
    width: '100%',
    aspectRatio: '1',
    objectFit: 'cover',
    borderRadius: 8,
    transition: 'filter 0.2s ease',
  },
  teamDesc: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
  },
  stravaBtn: {
    width: '100%',
    background: '#FC4C02',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px 20px',
    fontSize: 15,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 28,
    transition: 'opacity 0.2s, transform 0.1s',
  },
  howItWorks: {
    borderTop: '1px solid rgba(255,255,255,0.08)',
    paddingTop: 20,
  },
  howTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 12,
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  stepIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
    flexShrink: 0,
  },
  stepText: {
    fontSize: 13,
    color: '#9ca3af',
  },
};
