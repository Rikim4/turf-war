import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * Landing page after Strava OAuth callback.
 * The backend redirects here with ?token=JWT&team=blue|red|yellow
 */
export function AuthSuccessPage() {
  const [params] = useSearchParams();
  const { setToken } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      setToken(token);
      navigate('/', { replace: true });
    } else {
      navigate('/login?error=auth_failed', { replace: true });
    }
  }, [params, setToken, navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: '#fff',
        fontSize: 18,
      }}
    >
      Conectando con Strava...
    </div>
  );
}
