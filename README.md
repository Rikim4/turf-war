# TURF WAR — Territory Conquest for Runners

Un juego de conquista de territorios en la vida real. Sal a correr rutas circulares, crea polígonos y conquista tu ciudad para tu equipo.

---

## Arquitectura

```
┌─────────────────┐    OAuth 2.0     ┌─────────────────┐
│   Frontend      │ ──────────────── │   Strava API    │
│  React + Vite   │                  └─────────────────┘
│  Mapbox GL JS   │        REST API
│  TanStack Query │ ──────────────── ┌─────────────────┐
└─────────────────┘                  │   Backend       │
                                     │  Express + TS   │
                                     │  Turf.js (geo)  │
                                     └────────┬────────┘
                                              │
                                     ┌────────▼────────┐
                                     │   PostgreSQL    │
                                     │   + PostGIS     │
                                     │   (Supabase)    │
                                     └─────────────────┘
```

## Stack tecnico

| Capa | Tecnologia |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Mapa | Mapbox GL JS v3 |
| Estado | TanStack Query (React Query) |
| Backend | Express + TypeScript |
| Geoespacial | Turf.js + PostGIS (ST_Intersects, ST_Difference, ST_Union) |
| Base de datos | PostgreSQL 15 + PostGIS 3.3 (Supabase) |
| Auth | Strava OAuth 2.0 + JWT |
| Deploy | Docker Compose |

---

## Equipos

Hay 3 equipos compitiendo por el control del mapa:

| Equipo | Poderes | Color |
|--------|---------|-------|
| Equipo Azul | Velocidad, Estrategia | #3B82F6 |
| Equipo Rojo | Fuerza, Resistencia | #EF4444 |
| Equipo Amarillo | Astucia, Territorio | #FACC15 |

- Al registrarte eliges un equipo.
- Puedes cambiar de equipo cada **14 dias** (tus stats personales se resetean al cambiar).
- Los territorios conquistados permanecen en el equipo anterior.

---

## Configuracion inicial

### 1. Clonar y configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con tus valores:

```env
STRAVA_CLIENT_ID=12345          # Tu Client ID de Strava
STRAVA_CLIENT_SECRET=abc123     # Tu Client Secret de Strava
STRAVA_REDIRECT_URI=http://localhost:3001/api/auth/strava/callback
JWT_SECRET=genera_uno_con_openssl_rand_hex_64
VITE_MAPBOX_TOKEN=pk.eyJ1...    # Token publico de Mapbox
DATABASE_URL=postgresql://...    # URL de conexion a PostgreSQL/Supabase
```

### 2. Configurar tu app en Strava

1. Ve a https://www.strava.com/settings/api
2. En **Authorization Callback Domain** pon: `localhost`
3. Guarda el **Client ID** y **Client Secret**

### 3. Obtener token de Mapbox

1. Crea cuenta en https://account.mapbox.com
2. Copia el **Default public token** (empieza por `pk.`)

---

## Arrancar en local (Docker)

```bash
# Levantar todo: base de datos, backend y frontend
docker compose up -d

# Ver logs
docker compose logs -f backend

# Acceder a la app
open http://localhost:5173
```

### Arrancar sin Docker

```bash
# Terminal 1: Base de datos (requiere PostgreSQL + PostGIS instalado)
psql -U postgres -c "CREATE DATABASE turf_war;"
psql -U postgres -d turf_war -f backend/src/db/migrations/001_initial.sql
psql -U postgres -d turf_war -f backend/src/db/migrations/003_follows.sql

# Terminal 2: Backend
cd backend
npm install
npm run dev   # → http://localhost:3001

# Terminal 3: Frontend
cd frontend
npm install
npm run dev   # → http://localhost:5173
```

---

## API Reference

### Auth
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/auth/strava?team=blue\|red\|yellow` | Inicia OAuth con Strava |
| GET | `/api/auth/strava/callback` | Callback OAuth (Strava llama aqui) |
| GET | `/api/auth/me` | Perfil del usuario autenticado |
| GET | `/api/auth/users/:userId` | Perfil publico de un usuario |
| PUT | `/api/auth/profile` | Actualizar nombre, username, foto |
| POST | `/api/auth/change-team` | Cambiar de equipo (bloqueo 14 dias) |

### Territorios
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/territories` | GeoJSON con territorios unidos por equipo (ST_Union) |
| GET | `/api/territories?bbox=lng1,lat1,lng2,lat2` | Filtrado por bounding box |
| GET | `/api/territories/stats` | Stats por equipo + leaderboard |
| GET | `/api/territories/:id` | Territorio por ID |
| GET | `/api/territories/:id/history` | Historial de conquistas |
| GET | `/api/territories/user/:userId` | Territorios de un usuario |

### Actividades
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/activities` | Lista de actividades del usuario |
| POST | `/api/activities/sync-latest` | Sincroniza la ultima carrera de Strava |
| POST | `/api/activities/sync/:stravaActivityId` | Sincroniza una actividad especifica |
| GET/POST | `/api/activities/webhook` | Webhook de Strava (tiempo real) |

### Social
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/social/search?q=username` | Buscar usuarios por nombre |
| POST | `/api/social/follow/:userId` | Seguir a un usuario |
| DELETE | `/api/social/follow/:userId` | Dejar de seguir |
| GET | `/api/social/:userId/followers` | Lista de seguidores |
| GET | `/api/social/:userId/following` | Lista de seguidos |
| GET | `/api/social/:userId/counts` | Contadores seguidores/seguidos |

---

## Mecanica del juego

### Deteccion de ruta circular

Una ruta es "circular" cuando la distancia entre el punto de inicio y el punto final cumple **cualquiera** de estas condiciones:

```
distancia(inicio, fin) < 500 metros
  OR
distancia(inicio, fin) < 5% de la distancia total de la ruta
```

### Generacion del poligono

1. Se obtiene la **polyline detallada** de Strava (alta precision) con fallback a `summary_polyline`.
2. Se simplifica con el algoritmo **Ramer-Douglas-Peucker** (tolerancia 5m) para reducir vertices manteniendo precision.
3. Se cierra el anillo (se repite el primer punto al final).
4. Si la ruta se auto-intersecta, se usa el **convex hull** como fallback.
5. Area minima requerida: **10.000 m2** (1 hectarea).

### Conquista de territorio

```sql
-- Se buscan territorios enemigos que se SOLAPAN con el nuevo poligono
SELECT * FROM territories
WHERE ST_Intersects(ST_GeomFromEWKT($newPolygon), polygon)
  AND team != $myTeam
```

La conquista funciona con **solapamiento parcial** (ST_Intersects):

- El nuevo territorio se crea completo con toda el area de la ruta.
- Los territorios enemigos solapados se **recortan** con `ST_Difference`: solo conservan la parte no conquistada.
- Si un territorio enemigo queda completamente dentro del nuevo, se elimina.
- Los territorios del mismo equipo se **fusionan visualmente** en el mapa con `ST_Union` (max 3 features).

### Validaciones

- Solo se procesan carreras al aire libre (se descartan actividades en cinta / indoor).
- Rate limiting: maximo 5 sincronizaciones cada 10 minutos por usuario.
- El equipo del usuario se lee de la base de datos (no del JWT) para evitar datos desactualizados.

### Estructura de la base de datos

```
users              → Jugadores (strava_id, team, tokens, stats)
activities         → Carreras sincronizadas (polyline, is_circular)
territories        → Poligonos conquistados (PostGIS GEOMETRY)
territory_history  → Audit log de cambios de propietario
follows            → Grafo social (follower_id → following_id)

Views:
  team_stats       → Stats agregados por equipo (COUNT, SUM area)
  leaderboard      → Ranking de jugadores con territorios del equipo actual
```

---

## Webhook de Strava (tiempo real)

Para recibir notificaciones automaticas cuando un usuario termina una carrera:

```bash
# Registrar el webhook (solo una vez)
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -d client_id=TU_CLIENT_ID \
  -d client_secret=TU_CLIENT_SECRET \
  -d callback_url=https://TU_DOMINIO/api/activities/webhook \
  -d verify_token=TU_WEBHOOK_VERIFY_TOKEN
```

En desarrollo, usa [ngrok](https://ngrok.com) para exponer el puerto local:
```bash
ngrok http 3001
# Usa la URL de ngrok como callback_url
```

---

## Paginas de la app

| Ruta | Descripcion |
|------|-------------|
| `/` | Mapa principal con territorios y boton de conquista |
| `/login` | Seleccion de equipo + login con Strava |
| `/leaderboard` | Ranking por equipos y top runners |
| `/profile` | Perfil propio: stats, actividades, territorios |
| `/profile/:userId` | Perfil publico de otro usuario |
| `/friends` | Buscar usuarios, seguidores, seguidos |

---

## Roadmap / Proximas features

- [ ] WebSockets para actualizacion del mapa en tiempo real
- [ ] Notificaciones push cuando te roban un territorio
- [ ] Modo movil (React Native / PWA)
- [ ] Alianzas entre equipos
- [ ] Territorios con nivel de defensa (mas dificiles de conquistar cuanto mas se refuerzan)
- [ ] Estadisticas historicas y graficos de evolucion
