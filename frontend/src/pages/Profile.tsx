import { useState, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../api/client';
import { fetchUserTerritories, fetchActivities, syncLatestActivity } from '../api/territories';
import { updateProfile } from '../api/auth';
import { TEAM_COLORS, TEAM_LABELS } from '../types';

function FollowCounters({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['follow-counts', userId],
    queryFn: async () => {
      const res = await apiClient.get<{ followers: number; following: number }>(`/social/${userId}/counts`);
      return res.data;
    },
  });
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 10, alignItems: 'center' }}>
      <span style={{ fontSize: 13, cursor: 'pointer' }} onClick={() => navigate('/friends')}>
        <strong style={{ color: '#fff' }}>{data?.followers ?? 0}</strong>
        <span style={{ color: '#6b7280' }}> seguidores</span>
      </span>
      <span style={{ color: '#374151' }}>·</span>
      <span style={{ fontSize: 13, cursor: 'pointer' }} onClick={() => navigate('/friends')}>
        <strong style={{ color: '#fff' }}>{data?.following ?? 0}</strong>
        <span style={{ color: '#6b7280' }}> siguiendo</span>
      </span>
    </div>
  );
}

function formatArea(m2: number): string {
  return `${(m2 / 1_000_000).toFixed(2)} km²`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [editing, setEditing]   = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({ firstname: '', lastname: '', username: '', profile_picture: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user) return null;

  const teamColor = TEAM_COLORS[user.team];

  const { data: territories } = useQuery({
    queryKey: ['user-territories', user.id],
    queryFn: () => fetchUserTerritories(user.id),
  });

  const { data: activities } = useQuery({
    queryKey: ['activities'],
    queryFn: fetchActivities,
  });

  const syncMutation = useMutation({
    mutationFn: syncLatestActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['user-territories', user.id] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      // Refetch fresh user from server → updates both React Query cache y Zustand
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await queryClient.refetchQueries({ queryKey: ['me'] });
      setEditing(false);
      setSaveError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al guardar';
      setSaveError(msg);
    },
  });

  // ── Open edit mode ──────────────────────────────────────────────────────────
  function startEdit() {
    setForm({
      firstname: user!.firstname || '',
      lastname:  user!.lastname  || '',
      username:  user!.username  || '',
      profile_picture: user!.profile_picture || '',
    });
    setSaveError('');
    setEditing(true);
  }

  // ── Photo upload → base64 ───────────────────────────────────────────────────
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setSaveError('La foto no puede superar 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, profile_picture: reader.result as string }));
    reader.readAsDataURL(file);
  }

  function handleSave() {
    profileMutation.mutate({
      firstname:       form.firstname.trim() || undefined,
      lastname:        form.lastname.trim()  || undefined,
      username:        form.username.trim()  || undefined,
      profile_picture: form.profile_picture  || undefined,
    });
  }

  // ── Preview photo in edit mode ──────────────────────────────────────────────
  const photoSrc = editing ? (form.profile_picture || user.profile_picture) : user.profile_picture;
  const fallbackPhoto = `https://ui-avatars.com/api/?name=${user.firstname}&background=random&color=fff&size=80`;

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={styles.header}>
          {/* Avatar with edit overlay */}
          <div style={styles.avatarWrapper} onClick={() => editing && fileInputRef.current?.click()}>
            <img
              src={photoSrc}
              alt={user.username}
              style={{ ...styles.avatar, borderColor: teamColor, cursor: editing ? 'pointer' : 'default' }}
              onError={(e) => { (e.target as HTMLImageElement).src = fallbackPhoto; }}
            />
            {editing && (
              <div style={styles.avatarOverlay}>
                <span style={{ fontSize: 20 }}>📷</span>
                <span style={{ fontSize: 11, marginTop: 2 }}>Cambiar</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
          </div>

          <div style={{ flex: 1 }}>
            {editing ? (
              /* ── Edit mode ─────────────────────────────────────────────── */
              <div style={styles.editForm}>
                <div style={styles.nameRow}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Nombre</label>
                    <input
                      style={styles.input}
                      value={form.firstname}
                      onChange={(e) => setForm((f) => ({ ...f, firstname: e.target.value }))}
                      placeholder="Nombre"
                      maxLength={50}
                    />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Apellido</label>
                    <input
                      style={styles.input}
                      value={form.lastname}
                      onChange={(e) => setForm((f) => ({ ...f, lastname: e.target.value }))}
                      placeholder="Apellido"
                      maxLength={50}
                    />
                  </div>
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Username</label>
                  <div style={styles.usernameInput}>
                    <span style={styles.atSign}>@</span>
                    <input
                      style={{ ...styles.input, paddingLeft: 28, flex: 1 }}
                      value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') }))}
                      placeholder="tu_username"
                      maxLength={30}
                    />
                  </div>
                  <span style={styles.hint}>Solo letras, números y guiones bajos (3-30 caracteres)</span>
                </div>
                {saveError && <p style={styles.errorText}>{saveError}</p>}
                <div style={styles.editActions}>
                  <button
                    onClick={handleSave}
                    disabled={profileMutation.isPending}
                    style={styles.saveBtn}
                  >
                    {profileMutation.isPending ? 'Guardando...' : '✓ Guardar cambios'}
                  </button>
                  <button onClick={() => { setEditing(false); setSaveError(''); }} style={styles.cancelBtn}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              /* ── View mode ─────────────────────────────────────────────── */
              <div>
                <h1 style={styles.name}>{user.firstname} {user.lastname}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ ...styles.teamBadge, backgroundColor: teamColor }}>
                    {TEAM_LABELS[user.team]}
                  </span>
                  <span style={styles.username}>@{user.username}</span>
                  <button onClick={startEdit} style={styles.editBtn}>
                    ✏️ Editar perfil
                  </button>
                </div>
                <FollowCounters userId={user.id} /></div>
            )}
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <div style={styles.statsGrid}>
          {[
            { label: 'Territorio total',    value: formatArea(user.total_area_m2) },
            { label: 'Zonas conquistadas',  value: user.territories_won },
            { label: 'Zonas perdidas',      value: user.territories_lost },
            { label: 'W/L Ratio',           value: user.territories_lost === 0 ? '∞' : (user.territories_won / user.territories_lost).toFixed(1) },
          ].map((s) => (
            <div key={s.label} style={styles.statCard}>
              <div style={{ ...styles.statValue, color: teamColor }}>{s.value}</div>
              <div style={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Team lock ─────────────────────────────────────────────────────── */}
        {user.teamLocked && (
          <div style={{ ...styles.lockBanner, borderColor: `${teamColor}44`, background: `${teamColor}11` }}>
            <span style={{ fontSize: 20 }}>🔒</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>
                Equipo bloqueado durante {user.teamLockDaysRemaining} día{user.teamLockDaysRemaining !== 1 ? 's' : ''} más
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                Podrás cambiar de equipo el {new Date(user.teamUnlocksAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
        )}

        {/* ── Sync ──────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            style={{ ...styles.syncBtn, opacity: syncMutation.isPending ? 0.7 : 1 }}
          >
            {syncMutation.isPending ? 'Sincronizando...' : '🔄 Sincronizar última carrera de Strava'}
          </button>
          {syncMutation.isSuccess && (
            <p style={{ fontSize: 12, color: '#10b981', marginTop: 8 }}>✓ Sincronización completada</p>
          )}
        </div>

        {/* ── Activities ────────────────────────────────────────────────────── */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Mis actividades</h2>
          {!activities?.length && <p style={styles.emptyText}>Sin actividades. Sincroniza tus carreras de Strava.</p>}
          <div style={styles.list}>
            {activities?.slice(0, 15).map((act) => (
              <div key={act.id} style={styles.activityRow}>
                <div style={styles.activityLeft}>
                  <span style={styles.activityIcon}>{act.is_circular ? '🏆' : '🏃'}</span>
                  <div>
                    <div style={styles.activityName}>{act.name || 'Carrera'}</div>
                    <div style={styles.activityMeta}>
                      {(act.distance_m / 1000).toFixed(2)} km · {formatTime(act.moving_time_s)}
                      {act.total_elevation_m > 0 && ` · ↑${Math.round(act.total_elevation_m)}m`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {act.is_circular && (() => {
                    const actTeamColor = act.conquered_team ? TEAM_COLORS[act.conquered_team as keyof typeof TEAM_COLORS] : teamColor;
                    return <span style={{ ...styles.badge, background: `${actTeamColor}33`, color: actTeamColor }}>Circular ✓</span>;
                  })()}
                  {act.territory_id && act.conquered_team && (
                    <span style={{ ...styles.badge, background: `${TEAM_COLORS[act.conquered_team as keyof typeof TEAM_COLORS]}22`, color: TEAM_COLORS[act.conquered_team as keyof typeof TEAM_COLORS] }}>
                      {TEAM_LABELS[act.conquered_team as keyof typeof TEAM_LABELS]}
                    </span>
                  )}
                  {!act.is_circular && <span style={styles.badgeGray}>No circular</span>}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Territories ───────────────────────────────────────────────────── */}
        <section style={styles.section}>
          {(() => {
            const teamTerritories = territories?.filter((t) => t.team === user.team);
            return (<>
          <h2 style={styles.sectionTitle}>Mis territorios ({teamTerritories?.length ?? 0})</h2>
          {!teamTerritories?.length && (
            <p style={styles.emptyText}>Sin territorios. Sal a correr una ruta circular para conquistar tu primera zona.</p>
          )}
          <div style={styles.list}>
            {teamTerritories?.slice(0, 20).map((t) => {
              const tColor = TEAM_COLORS[t.team] || teamColor;
              return (
              <div key={t.id} style={styles.territoryRow}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: tColor, flexShrink: 0 }} />
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
              );
            })}
          </div>
            </>);
          })()}
        </section>

        {/* ── Logout ────────────────────────────────────────────────────────── */}
        <div style={styles.logoutSection}>
          <div style={styles.logoutDivider} />
          <button
            onClick={() => { logout(); navigate('/login'); }}
            style={styles.logoutBtn}
          >
            Cerrar sesión
          </button>
        </div>

      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page:       { minHeight: '100vh', background: '#0a0a0a', paddingTop: 72 },
  container:  { maxWidth: 720, margin: '0 auto', padding: '32px 24px' },
  header:     { display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 32 },
  avatarWrapper: {
    position: 'relative', flexShrink: 0,
    width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
  },
  avatar: {
    width: 80, height: 80, borderRadius: '50%',
    border: '3px solid', objectFit: 'cover', display: 'block',
  },
  avatarOverlay: {
    position: 'absolute', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 11, fontWeight: 600,
    borderRadius: '50%',
  },
  name:      { fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 },
  teamBadge: { padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#fff' },
  username:  { fontSize: 13, color: '#6b7280' },
  editBtn:   {
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
    color: '#9ca3af', padding: '4px 12px', borderRadius: 8,
    cursor: 'pointer', fontSize: 12, fontWeight: 500,
  },
  editForm:  { display: 'flex', flexDirection: 'column', gap: 12, width: '100%' },
  nameRow:   { display: 'flex', gap: 12 },
  fieldGroup:{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  label:     { fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8, padding: '8px 12px', color: '#fff',
    fontSize: 14, outline: 'none', width: '100%',
  },
  usernameInput: { position: 'relative', display: 'flex', alignItems: 'center' },
  atSign: {
    position: 'absolute', left: 10, color: '#6b7280',
    fontSize: 14, pointerEvents: 'none', zIndex: 1,
  },
  hint:      { fontSize: 11, color: '#6b7280', marginTop: 2 },
  errorText: { fontSize: 12, color: '#ef4444', margin: 0 },
  editActions: { display: 'flex', gap: 8, marginTop: 4 },
  saveBtn: {
    background: '#3B82F6', color: '#fff', border: 'none',
    borderRadius: 8, padding: '9px 20px', fontSize: 13,
    fontWeight: 600, cursor: 'pointer',
  },
  cancelBtn: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    color: '#9ca3af', borderRadius: 8, padding: '9px 16px',
    fontSize: 13, cursor: 'pointer',
  },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 },
  statCard:  { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 12px', textAlign: 'center' },
  statValue: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#6b7280' },
  lockBanner: { display: 'flex', alignItems: 'center', gap: 12, border: '1px solid', borderRadius: 12, padding: '14px 16px', marginBottom: 20 },
  syncBtn: { background: '#FC4C02', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' },
  section:      { marginBottom: 36 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#e5e7eb', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' },
  emptyText:    { fontSize: 13, color: '#6b7280', fontStyle: 'italic', padding: '16px 0' },
  list:         { display: 'flex', flexDirection: 'column', gap: 8 },
  activityRow:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, gap: 12 },
  territoryRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 },
  activityLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  activityIcon: { fontSize: 20, flexShrink: 0 },
  activityName: { fontSize: 13, fontWeight: 600, color: '#e5e7eb', marginBottom: 2 },
  activityMeta: { fontSize: 11, color: '#6b7280' },
  badge:        { fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20 },
  badgeGray:    { fontSize: 11, color: '#6b7280', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 20 },
  stravaLink:   { fontSize: 11, color: '#ffffff', textDecoration: 'none', marginLeft: 'auto', flexShrink: 0 },
  logoutSection: { marginBottom: 36 },
  logoutDivider: { height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 24 },
  logoutBtn: {
    width: '100%',
    background: 'transparent',
    border: '1px solid #ef444466',
    color: '#ef4444',
    borderRadius: 12,
    padding: '13px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
};
