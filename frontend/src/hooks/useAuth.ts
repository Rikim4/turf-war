import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { fetchMe } from '../api/auth';
import axios from 'axios';

export function useAuth() {
  const { token, user, setUser, logout, isAuthenticated } = useAuthStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Actualiza el store cuando llegan datos frescos del servidor
  useEffect(() => {
    if (data) setUser(data);
  }, [data, setUser]);

  // Solo logout en 401 Unauthorized — no en errores de servidor (500, red, etc.)
  useEffect(() => {
    if (!error) return;
    const status = axios.isAxiosError(error) ? error.response?.status : null;
    if (status === 401) logout();
  }, [error, logout]);

  return {
    user: data ?? user ?? null,
    token,
    isLoading: !!token && isLoading && !user,
    isAuthenticated: isAuthenticated(),
    logout,
  };
}
