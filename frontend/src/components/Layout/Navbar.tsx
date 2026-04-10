import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { TEAM_COLORS, TEAM_LABELS } from '../../types';

export function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      style={{
        color: location.pathname === to ? '#fff' : '#9ca3af',
        textDecoration: 'none',
        fontWeight: location.pathname === to ? 600 : 400,
        fontSize: 14,
        transition: 'color 0.2s',
      }}
    >
      {label}
    </Link>
  );

  return (
    <nav style={styles.nav}>
      {/* Logo */}
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src="/app-logo.png" alt="Turf War" style={{ width: 32, height: 32, objectFit: 'contain' }} />
        <span style={styles.logo}>TURF WAR</span>
      </Link>

      {/* Nav links */}
      <div style={styles.links}>
        {navLink('/', 'Mapa')}
        {navLink('/leaderboard', 'Ranking')}
        {user && navLink('/friends', 'Amigos')}
        {user && navLink('/profile', 'Mi Perfil')}
      </div>

      {/* User info */}
      {user ? (
        <div style={styles.userInfo}>
          <div
            style={{
              ...styles.teamBadge,
              backgroundColor: TEAM_COLORS[user.team],
            }}
          >
            {TEAM_LABELS[user.team]}
          </div>
          <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <img
              src={user.profile_picture}
              alt={user.username}
              style={{ ...styles.avatar, cursor: 'pointer' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${user.firstname}`;
              }}
            />
            <span style={{ ...styles.username, color: '#e5e7eb' }}>{user.firstname}</span>
          </Link>
        </div>
      ) : (
        <Link to="/login" style={styles.loginBtn}>
          Conectar con Strava
        </Link>
      )}
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    height: 56,
    background: 'rgba(10, 10, 10, 0.95)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    gap: 32,
  },
  logo: {
    fontSize: 16,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '0.1em',
  },
  links: {
    display: 'flex',
    gap: 24,
    flex: 1,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  teamBadge: {
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid rgba(255,255,255,0.2)',
  },
  username: {
    fontSize: 14,
    color: '#d1d5db',
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#9ca3af',
    padding: '4px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  loginBtn: {
    background: '#FC4C02',
    color: '#fff',
    padding: '6px 16px',
    borderRadius: 8,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
  },
};
