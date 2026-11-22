import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

export const routes = [
  { path: '/', redirect: () => { const a = useAuthStore(); return a.isLoggedIn ? a.homePath : '/login'; } },
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { guest: true } },
  { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue'), meta: { guest: true } },
  { path: '/report', name: 'report', component: () => import('../views/ReportView.vue'), meta: { requiresAuth: true, roles: ['student'] } },
  { path: '/my-tickets', name: 'my-tickets', component: () => import('../views/MyTicketsView.vue'), meta: { requiresAuth: true, roles: ['student'] } },
  { path: '/tickets/:id', name: 'ticket-detail', component: () => import('../views/TicketDetailView.vue'), meta: { requiresAuth: true } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFoundView.vue') },
];

const router = createRouter({ history: createWebHistory(), routes });

// Route guard: protected pages need a token and (optionally) one of meta.roles.
router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.guest && auth.isLoggedIn) return auth.homePath;
  if (to.meta.requiresAuth && !auth.isLoggedIn) return { path: '/login', query: { redirect: to.fullPath } };
  if (to.meta.roles && !to.meta.roles.includes(auth.role)) return auth.homePath;
});

export default router;
