import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { fetchUserTerritories } from '../api/territories';
import { useAuth } from '../hooks/useAuth';
import { TEAM_COLORS, TEAM_LABELS, Team } from '../types';

interface PublicUser {
  id: string;
  username: string;
  firstname: string;
  lastname: string;
  profile_picture: string;
  team: Team;
  territories_won: number;
  territories_lost: number;
  total_area_m2: number;
  territory_count: number;
  created_at: string;
}

function formatArea(m2: number): string {
  return `${(m2 / 1_000_000).toFixed(2)} km²`;
}

const TEAM_IMAGES: Record<Team, string> = {
  blue:   '/team-blue.png',
  red:    '/team-red.png',
  yellow: '/team-yellow.png',
};

export function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const isOwnProfile = me?.id === userId;

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['public-profile', userId],
    queryFn: async () => {
      const res = await apiClient.get<PublicUser>(`/auth/users/${userId}`);
      return res.data;
    },
    enabled: !!userId,
  });

  const { data: territories } = useQuery({
    queryKey: ['user-territories', userId],
    queryFn: () => fetchUserTerritories(userId!),
    enabled: !!userId,
  });

  const { data: counts } = useQuery({
    queryKey: ['follow-counts', userId],
    queryFn: async () => {
      const res = await apiClient.get<{ followers: number; following: number }>(`/social/${userId}/counts`);
      return res.data;
    },
    enabled: !!userId,
  });

  // Is current user following this profile?
  const { data: followingList } = useQuery({
    queryKey: ['following', me?.id],
    queryFn: async () => {
      const res = await apiClient.get<{ id: string }[]>(`/social/${me!.id}/following`);
      return res.data;
    },
    enabled: !!me && !isOwnProfile,
  });
  const isFollowing = followingList?.some((u) => u.id === userId) ?? false;

  const followMutation = useMutation({
    mutationFn: async () => {
      if (isFollowing) {
        await apiClient.delete(`/social/follow/${userId}`);
      } else {
        await apiClient.post(`/social/follow/${userId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['following', me?.id] });
      queryClient.invalidateQueries({ queryKey: ['follow-counts', userId] });
    },
  });

  if (isLoading) return (
    <div style={styles.page}>
      <div style={{ color: '#6b7280', textAlign: 'center', paddingTop: 80 }}>Cargando perfil...</div>
    </div>
  );

  if (isError || !user) return (
    <div style={styles.page}>
      <div style={{ color: '#ef4444', textAlign: 'center', paddingTop: 80 }}>Usuario no encontrado.</div>
    </div>
  );

  const teamColor = TEAM_COLORS[user.team];
  const fallbackPhoto = `https://ui-avatars.com/api/?name=${user.firstname}&background=random&color=fff&size=80`;
  const wlRatio = user.territories_lost === 0 ? '∞' : (user.territories_won / user.territories_lost).toFixed(1);

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* Back button */}
        <button onClick={() => navigate(-1)} style={styles.backBtn}>
          ← Volver
        </button>

        {/* Header */}
        <div style={styles.header}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img
              src={user.profile_picture}
              alt={user.username}
              style={{ ...styles.avatar, borderColor: teamColor }}
              onError={(e) => { (e.target as HTMLImageElement).src = fallbackPhoto; }}
            />
            <img src={TEAM_IMAGES[user.team]} alt="" style={styles.teamBadgeImg} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h1 style={styles.name}>{user.firstname} {user.lastname}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ ...styles.teamBadge, backgroundColor: teamColor }}>{TEAM_LABELS[user.team]}</span>
                  <span style={styles.username}>@{user.username}</span>
                </div>
                <div style={{ fontSize: 11, color: '#4b5563', marginTop: 6 }}>
                  Miembro desde {new Date(user.created_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </div>
              </div>

              {/* Follow button */}
              {!isOwnProfile && me && (
                <button
                  onClick={() => followMutation.mutate()}
                  disabled={followMutation.isPending}
                  style={{
                    ...styles.followBtn,
                    background: isFollowing ? 'rgba(255,255,255,0.06)' : teamColor,
                    color: isFollowing ? '#9ca3af' : '#fff',
                    border: isFollowing ? '1px solid rgba(255,255,255,0.15)' : 'none',
                  }}
                >
                  {isFollowing ? '✓ Siguiendo' : '+ Seguir'}
                </button>
              )}
            </div>

            {/* Followers / following counters */}
            <div style={styles.counters}>
              <span
                style={styles.counter}
                onClick={() => navigate(`/profile/${userId}/followers`)}
              >
                <strong style={{ color: '#fff' }}>{counts?.followers ?? 0}</strong>
                <span style={{ color: '#6b7280' }}> seguidores</span>
              </span>
              <span style={{ color: '#374151' }}>·</span>
              <span
                style={styles.counter}
                onClick={() => navigate(`/profile/${userId}/following`)}
              >
                <strong style={{ color: '#fff' }}>{counts?.following ?? 0}</strong>
                <span style={{ color: '#6b7280' }}> siguiendo</span>
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={styles.statsGrid}>
          {[
            { label: 'Territorio total',   value: formatArea(user.total_area_m2) },
            { label: 'Zonas conquistadas', value: user.territories_won },
            { label: 'Zonas perdidas',     value: user.territories_lost },
            { label: 'W/L Ratio',          value: wlRatio },
          ].map((s) => (
            <div key={s.label} style={styles.statCard}>
              <div style={{ ...styles.statValue, color: teamColor }}>{s.value}</div>
              <div style={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Territories */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Territorios conquistados ({territories?.length ?? 0})</h2>
          {!territories?.length && (
            <p style={styles.emptyText}>Este runner aún no ha conquistado ningún territorio.</p>
          )}
          <div style={styles.list}>
            {territories?.slice(0, 20).map((t) => (
              <div key={t.id} style={styles.territoryRow}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: teamColor, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={styles.activityName}>{t.activity_name || 'Territorio conquistado'}</div>
                  <div style={styles.activityMeta}>
                    {formatArea(t.area_m2)} · {new Date(t.conquered_at).toLocaleDateString('es-ES')}
                    {t.distance_m && ` · ${(t.distance_m / 1000).toFixed(1)} km`}
                  </div>
                </div>
                {t.strava_activity_id && (
                  <a href={`https://www.strava.com/activities/${t.strava_activity_id}`} target="_blank" rel="noopener noreferrer" style={styles.stravaLink}>
                    Ver en Strava →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:         { minHeight: '100vh', background: '#0a0a0a', paddingTop: 72 },
  container:    { maxWidth: 720, margin: '0 auto', padding: '32px 24px' },
  backBtn:      { background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', marginBottom: 24, padding: 0 },
  header:       { display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 32 },
  avatar:       { width: 80, height: 80, borderRadius: '50%', border: '3px solid', objectFit: 'cover', display: 'block' },
  teamBadgeImg: { position: 'absolute', bottom: -6, right: -6, width: 30, height: 30, objectFit: 'contain', borderRadius: '50%' },
  name:         { fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 },
  teamBadge:    { padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#fff' },
  username:     { fontSize: 13, color: '#6b7280' },
  followBtn:    { borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 },
  counters:     { display: 'flex', gap: 12, marginTop: 10, alignItems: 'center' },
  counter:      { fontSize: 13, cursor: 'pointer' },
  statsGrid:    { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 },
  statCard:     { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 12px', textAlign: 'center' },
  statValue:    { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  statLabel:    { fontSize: 11, color: '#6b7280' },
  section:      { marginBottom: 36 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#e5e7eb', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' },
  emptyText:    { fontSize: 13, color: '#6b7280', fontStyle: 'italic', padding: '16px 0' },
  list:         { display: 'flex', flexDirection: 'column', gap: 8 },
  territoryRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 },
  activityName: { fontSize: 13, fontWeight: 600, color: '#e5e7eb', marginBottom: 2 },
  activityMeta: { fontSize: 11, color: '#6b7280' },
  stravaLink:   { fontSize: 11, color: '#FC4C02', textDecoration: 'none', marginLeft: 'auto', flexShrink: 0 },
};
