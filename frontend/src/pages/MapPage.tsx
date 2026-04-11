import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TerritoryMap } from '../components/Map/TerritoryMap';
import { TeamLegend } from '../components/Map/TeamLegend';
import { fetchTerritories, fetchStats, syncLatestActivity } from '../api/territories';
import { useAuth } from '../hooks/useAuth';
import { TerritoryProperties, TEAM_COLORS } from '../types';

export function MapPage() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTerritory, setSelectedTerritory] = useState<TerritoryProperties | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const { data: geojson, isLoading: mapLoading } = useQuery({
    queryKey: ['territories'],
    queryFn: () => fetchTerritories(),
    refetchInterval: 30_000, // Refresh every 30 seconds
  });

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 30_000,
  });

  const syncMutation = useMutation({
    mutationFn: syncLatestActivity,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['territories'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });

      if (data.conquest) {
        showToast('¡Territorio conquistado! 🏆', 'success');
      } else {
        showToast(data.message, 'info');
      }
    },
    onError: () => showToast('Error al sincronizar actividad', 'error'),
  });

  const showToast = useCallback(
    (message: string, type: 'success' | 'info' | 'error') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
    },
    []
  );

  const toastColors = {
    success: '#10b981',
    info: '#6b7280',
    error: '#ef4444',
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Map */}
      <TerritoryMap
        geojson={geojson ?? null}
        onTerritoryClick={setSelectedTerritory}
      />

      {/* Loading overlay */}
      {mapLoading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.loadingSpinner} />
          <span style={{ color: '#9ca3af', fontSize: 13 }}>Cargando territorios...</span>
        </div>
      )}

      {/* Team Legend */}
      {stats && <TeamLegend stats={stats.teams} />}

      {/* Sync button (only for logged-in users) */}
      {isAuthenticated && user && (
        <div style={styles.syncPanel}>
          {/* User info — centrado y pequeño */}
          <div style={styles.userRow}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: TEAM_COLORS[user.team], flexShrink: 0 }} />
            <span style={styles.userLabel}>{user.firstname}</span>
            <span style={styles.statChip}>{user.territories_won} territorios</span>
          </div>

          {/* Botón principal */}
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            style={styles.syncBtn}
          >
            {syncMutation.isPending ? (
              <>
                <div style={styles.btnSpinner} />
                Conquistando...
              </>
            ) : (
              <>
                ⚔️ Conquistar nuevo territorio
              </>
            )}
          </button>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div
          style={{
            ...styles.toast,
            borderLeftColor: toastColors[toast.type],
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loadingOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    pointerEvents: 'none',
  },
  loadingSpinner: {
    width: 28,
    height: 28,
    border: '3px solid rgba(255,255,255,0.1)',
    borderTop: '3px solid #fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  syncPanel: {
    position: 'absolute',
    bottom: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(10,10,10,0.90)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minWidth: 260,
    zIndex: 100,
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  userLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#9ca3af',
  },
  statChip: {
    fontSize: 10,
    color: '#6b7280',
    background: 'rgba(255,255,255,0.06)',
    padding: '2px 7px',
    borderRadius: 20,
  },
  syncBtn: {
    background: '#FC4C02',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnSpinner: {
    width: 12,
    height: 12,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid #fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  toast: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    background: 'rgba(10,10,10,0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderLeft: '4px solid',
    borderRadius: 10,
    padding: '12px 18px',
    fontSize: 13,
    fontWeight: 500,
    color: '#e5e7eb',
    zIndex: 200,
    maxWidth: 320,
    animation: 'fadeIn 0.2s ease',
  },
};
