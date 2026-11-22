<script setup>
import { onMounted, ref, watch } from 'vue';
import TicketTable from '../components/TicketTable.vue';
import { listTickets } from '../api/tickets';
import { STATUSES } from '../constants';
import { errorMessage } from '../api/http';

const tickets = ref([]);
const total = ref(0);
const page = ref(1);
const status = ref('');
const error = ref('');
const limit = 10;

async function load() {
  try {
    const d = await listTickets({ page: page.value, limit, status: status.value || undefined });
    tickets.value = d.tickets; total.value = d.total;
  } catch (e) { error.value = errorMessage(e); }
}
onMounted(load);
watch(status, () => { page.value = 1; load(); });
watch(page, load);
</script>

<template>
  <main class="mx-auto max-w-5xl p-6">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-2xl font-bold">My tickets</h1>
      <RouterLink to="/report" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">+ Report a problem</RouterLink>
    </div>
    <select v-model="status" class="mb-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
      <option value="">All statuses</option>
      <option v-for="s in STATUSES" :key="s">{{ s }}</option>
    </select>
    <p v-if="error" class="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{{ error }}</p>
    <TicketTable :tickets="tickets" />
    <div class="mt-3 flex items-center justify-between text-sm text-slate-600">
      <span>{{ total }} ticket{{ total === 1 ? '' : 's' }}</span>
      <span class="flex gap-2">
        <button :disabled="page <= 1" class="rounded border px-3 py-1 disabled:opacity-40" @click="page--">Prev</button>
        <button :disabled="page * limit >= total" class="rounded border px-3 py-1 disabled:opacity-40" @click="page++">Next</button>
      </span>
    </div>
  </main>
</template>
