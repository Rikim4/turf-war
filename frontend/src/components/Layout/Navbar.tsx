import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { TEAM_COLORS, TEAM_LABELS } from '../../types';

const MapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
  </svg>
);

const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

export function Navbar() {
  const { user } = useAuth();
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

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* ── Desktop top bar ──────────────────────────────────────── */}
      <nav style={styles.nav}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/app-logo.png" alt="Turf War" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <span style={styles.logo}>TURF WAR</span>
        </Link>

        <div className="desktop-nav" style={styles.links}>
          {navLink('/', 'Mapa')}
          {navLink('/leaderboard', 'Ranking')}
          {user && navLink('/friends', 'Amigos')}
          {user && navLink('/profile', 'Mi Perfil')}
        </div>

        {user ? (
          <div className="desktop-user" style={styles.userInfo}>
            <div style={{ ...styles.teamBadge, backgroundColor: TEAM_COLORS[user.team] }}>
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
          <Link to="/login" className="desktop-user" style={styles.loginBtn}>
            Conectar con Strava
          </Link>
        )}
      </nav>

      {/* ── Mobile bottom tab bar ────────────────────────────────── */}
      <div className="mobile-nav">
        <Link to="/" className={isActive('/') ? 'active' : ''}>
          <MapIcon />
          <span>Mapa</span>
        </Link>
        <Link to="/leaderboard" className={isActive('/leaderboard') ? 'active' : ''}>
          <TrophyIcon />
          <span>Ranking</span>
        </Link>
        {user && (
          <Link to="/friends" className={isActive('/friends') ? 'active' : ''}>
            <UsersIcon />
            <span>Amigos</span>
          </Link>
        )}
        <Link to={user ? '/profile' : '/login'} className={isActive('/profile') || isActive('/login') ? 'active' : ''}>
          <UserIcon />
          <span>{user ? 'Perfil' : 'Login'}</span>
        </Link>
      </div>
    </>
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
