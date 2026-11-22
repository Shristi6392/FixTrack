import { defineStore } from 'pinia';
import http from '../api/http';

const safe = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export const HOME_BY_ROLE = { student: '/my-tickets', technician: '/jobs', admin: '/admin' };

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: safe.get('ft_token'),
    user: JSON.parse(safe.get('ft_user') || 'null'),
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    role: (s) => s.user?.role,
    homePath: (s) => HOME_BY_ROLE[s.user?.role] || '/login',
  },
  actions: {
    _set({ token, user }) {
      this.token = token; this.user = user;
      safe.set('ft_token', token); safe.set('ft_user', JSON.stringify(user));
    },
    async login(email, password) {
      this._set((await http.post('/auth/login', { email, password })).data);
    },
    async register(name, email, password) {
      this._set((await http.post('/auth/register', { name, email, password })).data);
    },
    async fetchMe() {
      const { data } = await http.get('/auth/me');
      this.user = data.user; safe.set('ft_user', JSON.stringify(data.user));
    },
    logout() {
      this.token = null; this.user = null;
      safe.del('ft_token'); safe.del('ft_user');
    },
  },
});
