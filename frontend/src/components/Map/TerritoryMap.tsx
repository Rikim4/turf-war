import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { TerritoryProperties, TEAM_LABELS } from '../../types';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface TerritoryMapProps {
  geojson: GeoJSON.FeatureCollection | null;
  onTerritoryClick?: (props: TerritoryProperties) => void;
}

const SOURCE_ID = 'territories';

const TEAM_LAYERS = [
  { team: 'blue',   color: '#3B82F6' },
  { team: 'red',    color: '#EF4444' },
  { team: 'yellow', color: '#FACC15' },
] as const;

export function TerritoryMap({ geojson, onTerritoryClick }: TerritoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const popupRef     = useRef<mapboxgl.Popup | null>(null);

  // Always keep a ref to the latest geojson so the 'load' callback can read it
  const geojsonRef = useRef<GeoJSON.FeatureCollection | null>(null);
  geojsonRef.current = geojson;

  // ── Initialize map ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [2.154007, 41.390205], // Fallback: Barcelona
      zoom: 5,
      attributionControl: false,
      logoPosition: 'bottom-right',
    });

    // Centrar en la ubicación real del usuario en cuanto cargue el mapa
    map.on('load', () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            map.flyTo({
              center: [pos.coords.longitude, pos.coords.latitude],
              zoom: 13,
              speed: 1.4,
            });
          },
          () => {
            // Permiso denegado o error → mantener fallback Barcelona
          },
          { timeout: 15000, maximumAge: 0, enableHighAccuracy: true }
        );
      }
    });

    mapRef.current = map; // Set immediately so update effect can reference it

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      'top-right'
    );
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      // ── Source: use latest geojson if already available ──────────────────
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: geojsonRef.current ?? { type: 'FeatureCollection', features: [] },
      });

      // ── One fill + outline layer per team ────────────────────────────────
      TEAM_LAYERS.forEach(({ team, color }) => {
        map.addLayer({
          id: `fill-${team}`,
          type: 'fill',
          source: SOURCE_ID,
          filter: ['==', ['get', 'team'], team],
          paint: {
            'fill-color': color,
            'fill-opacity': 0.35,
          },
        });

        map.addLayer({
          id: `outline-${team}`,
          type: 'line',
          source: SOURCE_ID,
          filter: ['==', ['get', 'team'], team],
          paint: {
            'line-color': color,
            'line-width': 2,
            'line-opacity': 1,
          },
        });
      });

      // ── Hover ────────────────────────────────────────────────────────────
      TEAM_LAYERS.forEach(({ team }) => {
        map.on('mouseenter', `fill-${team}`, () => {
          map.getCanvas().style.cursor = 'pointer';
          map.setPaintProperty(`fill-${team}`, 'fill-opacity', 0.55);
        });
        map.on('mouseleave', `fill-${team}`, () => {
          map.getCanvas().style.cursor = '';
          map.setPaintProperty(`fill-${team}`, 'fill-opacity', 0.35);
        });
      });

      // ── Click popup ──────────────────────────────────────────────────────
      TEAM_LAYERS.forEach(({ team, color }) => {
        map.on('click', `fill-${team}`, (e) => {
          if (!e.features?.length) return;
          const props = e.features[0].properties as TerritoryProperties;
          if (popupRef.current) popupRef.current.remove();

          const area = Number(props.totalAreaM2) || 0;
          const areaText = `${(area / 1_000_000).toFixed(2)} km²`;

          const date = props.lastConqueredAt
            ? new Date(props.lastConqueredAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—';

          const TEAM_IMG: Record<string, string> = {
            blue:   '/team-blue.png',
            red:    '/team-red.png',
            yellow: '/team-yellow.png',
          };
          const POWERS: Record<string, string> = {
            blue:   '⚡ Velocidad · 🧠 Estrategia',
            red:    '💪 Fuerza · 🔥 Resistencia',
            yellow: '🦊 Astucia · 🗺️ Territorio',
          };

          popupRef.current = new mapboxgl.Popup({ closeButton: true, maxWidth: '260px', className: 'turf-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-family:system-ui,sans-serif;background:#111827;border-radius:12px;overflow:hidden;min-width:220px;">
                <div style="position:relative;">
                  <img src="${TEAM_IMG[team]}" alt="${TEAM_LABELS[props.team]}" style="width:100%;display:block;max-height:110px;object-fit:cover;object-position:center top;" />
                  <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,#111827);height:40px;"></div>
                </div>
                <div style="padding:12px 14px;display:flex;gap:10px;">
                  <div style="flex:1;background:${color}15;border:1px solid ${color}33;border-radius:8px;padding:8px 10px;text-align:center;">
                    <div style="font-size:15px;font-weight:800;color:#f9fafb;">${areaText}</div>
                    <div style="font-size:10px;color:#6b7280;margin-top:2px;">Territorio total</div>
                  </div>
                  <div style="flex:1;background:${color}15;border:1px solid ${color}33;border-radius:8px;padding:8px 10px;text-align:center;">
                    <div style="font-size:15px;font-weight:800;color:#f9fafb;">${props.territoryCount ?? 0}</div>
                    <div style="font-size:10px;color:#6b7280;margin-top:2px;">Zonas</div>
                  </div>
                </div>
                <div style="padding:0 14px 12px;font-size:11px;color:#6b7280;display:flex;align-items:center;gap:5px;">
                  <span>🏁</span>
                  <span>Última conquista: <strong style="color:#9ca3af;">${date}</strong></span>
                </div>
              </div>
            `)
            .addTo(map);

          onTerritoryClick?.(props);
        });
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update source data whenever geojson prop changes ──────────────────────
  useEffect(() => {
    if (!geojson) return;
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (src) src.setData(geojson);
    };

    // If style already loaded and source exists → apply immediately
    // Otherwise wait for 'load' (which will read geojsonRef.current directly)
    if (map.isStyleLoaded()) {
      apply();
    }
    // No else needed: map 'load' already reads geojsonRef.current
  }, [geojson]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
    />
  );
}
