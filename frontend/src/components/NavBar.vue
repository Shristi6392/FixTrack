<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const links = computed(() => ({
  student: [{ to: '/report', label: 'Report a problem' }, { to: '/my-tickets', label: 'My tickets' }],
  technician: [{ to: '/jobs', label: 'My jobs' }],
  admin: [{ to: '/admin', label: 'Board' }, { to: '/dashboard', label: 'Dashboard' }, { to: '/pm-schedules', label: 'PM schedules' }],
}[auth.role] || []));

function logout() { auth.logout(); router.push('/login'); }
</script>

<template>
  <header v-if="auth.isLoggedIn" class="flex items-center gap-6 bg-indigo-700 px-6 py-3 text-white">
    <RouterLink :to="auth.homePath" class="text-lg font-bold">FixTrack</RouterLink>
    <nav class="flex flex-1 gap-4 text-sm">
      <RouterLink v-for="l in links" :key="l.to" :to="l.to" class="opacity-90 hover:opacity-100">{{ l.label }}</RouterLink>
    </nav>
    <span class="text-sm opacity-90">{{ auth.user?.name }} · {{ auth.role }}</span>
    <button class="rounded bg-white/15 px-3 py-1 text-sm hover:bg-white/25" @click="logout">Log out</button>
  </header>
</template>
