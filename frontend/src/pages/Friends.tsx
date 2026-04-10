import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { TEAM_COLORS, TEAM_LABELS, Team } from '../types';

interface SocialUser {
  id: string;
  username: string;
  firstname: string;
  lastname: string;
  profile_picture: string;
  team: Team;
  total_area_m2: number;
  territories_won: number;
  is_following: boolean;
}

function formatArea(m2: number): string {
  return `${(m2 / 1_000_000).toFixed(2)} km²`;
}

export function FriendsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'search' | 'following' | 'followers'>('following');

  // Search results
  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ['user-search', search],
    queryFn: async () => {
      const res = await apiClient.get<SocialUser[]>('/social/search', { params: { q: search } });
      return res.data;
    },
    enabled: search.trim().length >= 2,
    staleTime: 10_000,
  });

  // Following list
  const { data: following } = useQuery({
    queryKey: ['following', user?.id],
    queryFn: async () => {
      const res = await apiClient.get<SocialUser[]>(`/social/${user!.id}/following`);
      return res.data;
    },
    enabled: !!user,
  });

  // Followers list
  const { data: followers } = useQuery({
    queryKey: ['followers', user?.id],
    queryFn: async () => {
      const res = await apiClient.get<SocialUser[]>(`/social/${user!.id}/followers`);
      return res.data;
    },
    enabled: !!user,
  });

  const followMutation = useMutation({
    mutationFn: async ({ userId, isFollowing }: { userId: string; isFollowing: boolean }) => {
      if (isFollowing) {
        await apiClient.delete(`/social/follow/${userId}`);
      } else {
        await apiClient.post(`/social/follow/${userId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-search'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['follow-counts'] });
    },
  });

  const displayList: SocialUser[] = search.trim().length >= 2
    ? (searchResults ?? [])
    : tab === 'following'
    ? (following ?? [])
    : (followers ?? []);

  const isSearchMode = search.trim().length >= 2;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Amigos</h1>

        {/* Search bar */}
        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            style={styles.searchInput}
            placeholder="Buscar por @username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
          {search && (
            <button onClick={() => setSearch('')} style={styles.clearSearch}>✕</button>
          )}
        </div>

        {/* Tabs (only when not searching) */}
        {!isSearchMode && (
          <div style={styles.tabs}>
            <button
              onClick={() => setTab('following')}
              style={{ ...styles.tab, ...(tab === 'following' ? styles.tabActive : {}) }}
            >
              Siguiendo ({following?.length ?? 0})
            </button>
            <button
              onClick={() => setTab('followers')}
              style={{ ...styles.tab, ...(tab === 'followers' ? styles.tabActive : {}) }}
            >
              Seguidores ({followers?.length ?? 0})
            </button>
          </div>
        )}

        {isSearchMode && searching && (
          <p style={styles.hint}>Buscando...</p>
        )}
        {isSearchMode && !searching && searchResults?.length === 0 && (
          <p style={styles.hint}>No se encontraron usuarios con ese username.</p>
        )}
        {!isSearchMode && displayList.length === 0 && (
          <p style={styles.hint}>
            {tab === 'following'
              ? 'Aún no sigues a nadie. ¡Busca runners por su @username!'
              : 'Aún no te sigue nadie.'}
          </p>
        )}

        {/* User list */}
        <div style={styles.list}>
          {displayList.map((u) => {
            const color = TEAM_COLORS[u.team];
            return (
              <div key={u.id} style={styles.row}>
                <img
                  src={u.profile_picture}
                  alt={u.username}
                  style={{ ...styles.avatar, borderColor: `${color}88` }}
                  onClick={() => navigate(`/profile/${u.id}`)}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      `https://ui-avatars.com/api/?name=${u.firstname}&background=random&color=fff`;
                  }}
                />
                <div style={styles.info} onClick={() => navigate(`/profile/${u.id}`)}>
                  <div style={styles.name}>{u.firstname} {u.lastname}</div>
                  <div style={styles.meta}>
                    <span style={styles.username}>@{u.username}</span>
                    <span style={{ ...styles.teamBadge, background: color }}>{TEAM_LABELS[u.team]}</span>
                  </div>
                  <div style={styles.stats}>{formatArea(u.total_area_m2)}</div>
                </div>
                {u.id !== user?.id && (
                  <button
                    onClick={() => followMutation.mutate({ userId: u.id, isFollowing: u.is_following })}
                    disabled={followMutation.isPending}
                    style={{
                      ...styles.followBtn,
                      background: u.is_following ? 'rgba(255,255,255,0.06)' : color,
                      color: u.is_following ? '#9ca3af' : '#fff',
                      border: u.is_following ? '1px solid rgba(255,255,255,0.15)' : 'none',
                    }}
                  >
                    {u.is_following ? 'Siguiendo' : '+ Seguir'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:        { minHeight: '100vh', background: '#0a0a0a', paddingTop: 72 },
  container:   { maxWidth: 600, margin: '0 auto', padding: '32px 24px' },
  title:       { fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 24 },
  searchWrap:  { position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 24 },
  searchIcon:  { position: 'absolute', left: 14, fontSize: 16, pointerEvents: 'none' },
  searchInput: {
    width: '100%', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
    padding: '12px 40px 12px 42px', color: '#fff', fontSize: 14, outline: 'none',
  },
  clearSearch: { position: 'absolute', right: 14, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14 },
  tabs:        { display: 'flex', gap: 8, marginBottom: 20 },
  tab:         { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280', borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  tabActive:   { background: 'rgba(255,255,255,0.12)', color: '#fff', borderColor: 'rgba(255,255,255,0.25)' },
  hint:        { color: '#6b7280', fontSize: 13, fontStyle: 'italic', padding: '16px 0' },
  list:        { display: 'flex', flexDirection: 'column', gap: 10 },
  row:         { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 },
  avatar:      { width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', border: '2px solid', flexShrink: 0, cursor: 'pointer' },
  info:        { flex: 1, minWidth: 0, cursor: 'pointer' },
  name:        { fontSize: 14, fontWeight: 600, color: '#e5e7eb' },
  meta:        { display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 },
  username:    { fontSize: 12, color: '#6b7280' },
  teamBadge:   { fontSize: 10, fontWeight: 700, color: '#fff', padding: '2px 8px', borderRadius: 20 },
  stats:       { fontSize: 11, color: '#4b5563', marginTop: 3 },
  followBtn:   { flexShrink: 0, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
};
