import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/api/http', () => ({
  default: { post: vi.fn(), get: vi.fn() },
  errorMessage: (e) => e.response?.data?.error || e.message,
}));
import http from '../src/api/http';
import Badge from '../src/components/Badge.vue';
import TicketTable from '../src/components/TicketTable.vue';
import LoginView from '../src/views/LoginView.vue';
import router from '../src/router';

describe('Badge', () => {
  it('renders text with the given classes', () => {
    const w = mount(Badge, { props: { text: 'High', styleClass: 'bg-orange-100' } });
    expect(w.text()).toBe('High');
    expect(w.classes()).toContain('bg-orange-100');
  });
});

describe('TicketTable', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  const mk = (o) => ({ id: 1, title: 'Fan broken', category: 'Electrical', priority: 'High', status: 'Open', location_name: 'Room 1', created_at: '2026-01-01T00:00:00Z', ...o });

  it('lists tickets and flags overdue ones', () => {
    const w = mount(TicketTable, { props: { tickets: [mk({}), mk({ id: 2, title: 'Late tap', is_overdue: true })] }, global: { plugins: [router] } });
    expect(w.findAll('tbody tr')).toHaveLength(2);
    expect(w.text()).toContain('Fan broken');
    expect(w.text().match(/Overdue/g)).toHaveLength(1);
  });

  it('shows an empty state', () => {
    const w = mount(TicketTable, { props: { tickets: [] }, global: { plugins: [router] } });
    expect(w.text()).toContain('No tickets found');
  });
});

describe('LoginView', () => {
  beforeEach(async () => { localStorage.clear(); setActivePinia(createPinia()); vi.clearAllMocks(); await router.replace('/login'); });

  it('shows the server error on a failed login', async () => {
    http.post.mockRejectedValue({ response: { data: { error: 'Invalid email or password' } } });
    const w = mount(LoginView, { global: { plugins: [router] } });
    await w.find('input[type=email]').setValue('a@b.com');
    await w.find('input[type=password]').setValue('wrong');
    await w.find('form').trigger('submit.prevent');
    await flushPromises();
    expect(w.find('[role=alert]').text()).toBe('Invalid email or password');
  });

  it('navigates to the role home page after a successful login', async () => {
    http.post.mockResolvedValue({ data: { token: 't', user: { id: 1, name: 'Sam', role: 'student' } } });
    const w = mount(LoginView, { global: { plugins: [router] } });
    await w.find('input[type=email]').setValue('s@b.com');
    await w.find('input[type=password]').setValue('password123');
    await w.find('form').trigger('submit.prevent');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/my-tickets'));
  });
});
