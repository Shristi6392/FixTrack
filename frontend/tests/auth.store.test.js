import { setActivePinia, createPinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/api/http', () => ({ default: { post: vi.fn(), get: vi.fn() }, errorMessage: (e) => e.message }));
import http from '../src/api/http';
import { useAuthStore } from '../src/stores/auth';

describe('auth store', () => {
  beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); vi.clearAllMocks(); });

  it('login stores token and user, and computes the home path by role', async () => {
    http.post.mockResolvedValue({ data: { token: 'tok', user: { id: 1, name: 'Ann', role: 'technician' } } });
    const a = useAuthStore();
    await a.login('a@b.com', 'password123');
    expect(http.post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: 'password123' });
    expect(a.isLoggedIn).toBe(true);
    expect(a.homePath).toBe('/jobs');
    expect(localStorage.getItem('ft_token')).toBe('tok');
  });

  it('logout clears everything', async () => {
    http.post.mockResolvedValue({ data: { token: 't', user: { id: 1, role: 'admin' } } });
    const a = useAuthStore();
    await a.login('a@b.com', 'x');
    a.logout();
    expect(a.isLoggedIn).toBe(false);
    expect(a.user).toBeNull();
    expect(localStorage.getItem('ft_token')).toBeNull();
  });

  it('failed login leaves the store logged out', async () => {
    http.post.mockRejectedValue(new Error('Invalid email or password'));
    const a = useAuthStore();
    await expect(a.login('a@b.com', 'bad')).rejects.toThrow('Invalid');
    expect(a.isLoggedIn).toBe(false);
  });
});
