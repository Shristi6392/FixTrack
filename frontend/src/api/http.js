import axios from 'axios';

const http = axios.create({ baseURL: '/api' });

// Attach the JWT to every request; on 401 clear the session and go to login.
// Store/router are loaded lazily to avoid circular imports.
http.interceptors.request.use(async (config) => {
  const { useAuthStore } = await import('../stores/auth');
  const token = useAuthStore().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (r) => r,
  async (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && !url.startsWith('/auth/login')) {
      const { useAuthStore } = await import('../stores/auth');
      const store = useAuthStore();
      if (store.token) {
        store.logout();
        const { default: router } = await import('../router');
        router.push('/login');
      }
    }
    return Promise.reject(err);
  }
);

export const errorMessage = (e) =>
  e.response?.data?.details?.map((d) => `${d.path}: ${d.message}`).join(', ') || e.response?.data?.error || e.message;

export default http;
