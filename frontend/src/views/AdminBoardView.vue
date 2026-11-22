<script setup>
import { onMounted, ref, watch } from 'vue';
import Badge from '../components/Badge.vue';
import { listTickets, listUsers, assignTicket } from '../api/tickets';
import { CATEGORIES, PRIORITIES, STATUSES, STATUS_STYLE, PRIORITY_STYLE } from '../constants';
import { errorMessage } from '../api/http';

const tickets = ref([]);
const technicians = ref([]);
const total = ref(0);
const page = ref(1);
const limit = 15;
const filters = ref({ q: '', status: '', priority: '', category: '', overdue: '' });
const error = ref('');

async function load() {
  try {
    const params = Object.fromEntries(Object.entries(filters.value).filter(([, v]) => v));
    const d = await listTickets({ ...params, page: page.value, limit });
    tickets.value = d.tickets; total.value = d.total;
  } catch (e) { error.value = errorMessage(e); }
}
onMounted(async () => {
  try { technicians.value = (await listUsers('technician')).filter((u) => u.is_active); } catch (e) { error.value = errorMessage(e); }
  load();
});
let timer;
watch(filters, () => { clearTimeout(timer); timer = setTimeout(() => { page.value = 1; load(); }, 250); }, { deep: true });
watch(page, load);

async function assign(t, assigneeId) {
  if (!assigneeId) return;
  error.value = '';
  try { await assignTicket(t.id, Number(assigneeId)); await load(); } catch (e) { error.value = errorMessage(e); }
}
</script>

<template>
  <main class="mx-auto max-w-7xl p-6">
    <h1 class="mb-4 text-2xl font-bold">Admin board</h1>
    <div class="mb-3 flex flex-wrap gap-2 text-sm">
      <input v-model="filters.q" placeholder="Search title or description" class="w-64 rounded-lg border border-slate-300 px-3 py-1.5" />
      <select v-model="filters.status" class="rounded-lg border border-slate-300 px-3 py-1.5"><option value="">All statuses</option><option v-for="s in STATUSES" :key="s">{{ s }}</option></select>
      <select v-model="filters.priority" class="rounded-lg border border-slate-300 px-3 py-1.5"><option value="">All priorities</option><option v-for="p in PRIORITIES" :key="p">{{ p }}</option></select>
      <select v-model="filters.category" class="rounded-lg border border-slate-300 px-3 py-1.5"><option value="">All categories</option><option v-for="c in CATEGORIES" :key="c">{{ c }}</option></select>
      <select v-model="filters.overdue" class="rounded-lg border border-slate-300 px-3 py-1.5"><option value="">Overdue or not</option><option value="true">Overdue only</option><option value="false">Not overdue</option></select>
    </div>
    <p v-if="error" class="mb-3 rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error }}</p>
    <div class="overflow-x-auto rounded-2xl bg-white shadow ring-1 ring-slate-200">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-100 text-xs uppercase text-slate-500">
          <tr><th class="p-3">#</th><th class="p-3">Title</th><th class="p-3">Category</th><th class="p-3">Priority</th><th class="p-3">Status</th><th class="p-3">Reported by</th><th class="p-3">Assigned to</th></tr>
        </thead>
        <tbody>
          <tr v-for="t in tickets" :key="t.id" class="border-t border-slate-100">
            <td class="p-3 text-slate-400">{{ t.id }}</td>
            <td class="p-3 font-medium"><RouterLink :to="`/tickets/${t.id}`" class="text-indigo-700 hover:underline">{{ t.title }}</RouterLink></td>
            <td class="p-3">{{ t.category }}</td>
            <td class="p-3"><Badge :text="t.priority" :style-class="PRIORITY_STYLE[t.priority]" /></td>
            <td class="p-3"><Badge :text="t.status" :style-class="STATUS_STYLE[t.status]" /><Badge v-if="t.is_overdue" text="Overdue" style-class="ml-1 bg-red-600 text-white" /></td>
            <td class="p-3">{{ t.requester_name }}</td>
            <td class="p-3">
              <select v-if="!['Resolved', 'Closed'].includes(t.status)" :value="t.assignee_id || ''" class="rounded border border-slate-300 px-2 py-1" @change="assign(t, $event.target.value)">
                <option value="">Unassigned</option>
                <option v-for="u in technicians" :key="u.id" :value="u.id">{{ u.name }}</option>
              </select>
              <span v-else>{{ t.assignee_name || '—' }}</span>
            </td>
          </tr>
          <tr v-if="!tickets.length"><td colspan="7" class="p-6 text-center text-slate-500">No tickets match.</td></tr>
        </tbody>
      </table>
    </div>
    <div class="mt-3 flex items-center justify-between text-sm text-slate-600">
      <span>{{ total }} ticket{{ total === 1 ? '' : 's' }}</span>
      <span class="flex gap-2">
        <button :disabled="page <= 1" class="rounded border px-3 py-1 disabled:opacity-40" @click="page--">Prev</button>
        <button :disabled="page * limit >= total" class="rounded border px-3 py-1 disabled:opacity-40" @click="page++">Next</button>
      </span>
    </div>
  </main>
</template>
