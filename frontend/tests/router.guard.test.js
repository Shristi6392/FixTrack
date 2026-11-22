import { setActivePinia, createPinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import router from '../src/router';
import { useAuthStore } from '../src/stores/auth';

const loginAs = (role) => { const a = useAuthStore(); a.token = 't'; a.user = { id: 1, role }; };

describe('route guards', () => {
  beforeEach(async () => { localStorage.clear(); setActivePinia(createPinia()); await router.replace('/login'); });

  it('redirects anonymous users to login, remembering the target', async () => {
    await router.push('/admin');
    expect(router.currentRoute.value.path).toBe('/login');
    expect(router.currentRoute.value.query.redirect).toBe('/admin');
  });

  it('keeps students out of admin pages and sends them home', async () => {
    loginAs('student');
    await router.push('/admin');
    expect(router.currentRoute.value.path).toBe('/my-tickets');
  });

  it('lets admins in and bounces logged-in users away from /login', async () => {
    loginAs('admin');
    await router.push('/dashboard');
    expect(router.currentRoute.value.path).toBe('/dashboard');
    await router.push('/login');
    expect(router.currentRoute.value.path).toBe('/admin');
  });
});
