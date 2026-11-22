<script setup>
import { onMounted, ref } from 'vue';
import BarChart from '../components/BarChart.vue';
import { dashSummary, dashBreakdown, dashFailing } from '../api/tickets';
import { errorMessage } from '../api/http';

const summary = ref(null);
const breakdown = ref({ by_category: [], by_priority: [], by_location: [] });
const failing = ref([]);
const from = ref('');
const to = ref('');
const error = ref('');

async function load() {
  error.value = '';
  const p = {};
  if (from.value) p.from = new Date(from.value).toISOString();
  if (to.value) p.to = new Date(`${to.value}T23:59:59`).toISOString();
  try {
    [summary.value, breakdown.value, failing.value] = await Promise.all([dashSummary(p), dashBreakdown(p), dashFailing(p).then((d) => d.assets)]);
  } catch (e) { error.value = errorMessage(e); }
}
onMounted(load);
const hours = (h) => (h == null ? '—' : h < 48 ? `${h} h` : `${(h / 24).toFixed(1)} d`);
</script>

<template>
  <main class="mx-auto max-w-6xl p-6">
    <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <h1 class="text-2xl font-bold">Dashboard</h1>
      <form class="flex items-end gap-2 text-sm" @submit.prevent="load">
        <label>From <input v-model="from" type="date" class="rounded-lg border border-slate-300 px-2 py-1" /></label>
        <label>To <input v-model="to" type="date" class="rounded-lg border border-slate-300 px-2 py-1" /></label>
        <button class="rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-700">Apply</button>
      </form>
    </div>
    <p v-if="error" class="mb-3 rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error }}</p>
    <template v-if="summary">
      <div class="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div v-for="c in [['Total', summary.total], ['Open', summary.open], ['Overdue', summary.overdue], ['Resolved', summary.resolved], ['Avg resolution', hours(summary.avg_resolution_hours)]]" :key="c[0]" class="rounded-2xl bg-white p-4 shadow ring-1 ring-slate-200">
          <div class="text-xs uppercase text-slate-500">{{ c[0] }}</div>
          <div class="text-2xl font-bold" :class="c[0] === 'Overdue' && c[1] > 0 ? 'text-red-600' : ''">{{ c[1] }}</div>
        </div>
      </div>
      <div class="mt-6 grid gap-4 md:grid-cols-3">
        <BarChart title="Tickets by category" :rows="breakdown.by_category" />
        <BarChart title="Tickets by priority" :rows="breakdown.by_priority" color="#f59e0b" />
        <BarChart title="Tickets by location" :rows="breakdown.by_location" color="#10b981" />
      </div>
      <div class="mt-6 grid gap-4 md:grid-cols-2">
        <section class="rounded-2xl bg-white p-4 shadow ring-1 ring-slate-200">
          <h2 class="mb-2 font-semibold">Most failure-prone assets</h2>
          <ul class="divide-y divide-slate-100 text-sm">
            <li v-for="a in failing" :key="a.id" class="flex justify-between py-2"><span>{{ a.code }} · {{ a.name }} <span v-if="a.repeat_failure" class="ml-1 rounded bg-red-100 px-1.5 text-xs font-semibold text-red-700">repeat failure</span></span><b>{{ a.ticket_count }}</b></li>
            <li v-if="!failing.length" class="py-2 text-slate-500">No asset-linked tickets yet.</li>
          </ul>
        </section>
        <section class="rounded-2xl bg-white p-4 shadow ring-1 ring-slate-200">
          <h2 class="mb-2 font-semibold">Technician workload</h2>
          <ul class="divide-y divide-slate-100 text-sm">
            <li v-for="w in summary.workload" :key="w.id" class="flex justify-between py-2"><span>{{ w.name }}</span><span>{{ w.active }} active · {{ w.completed }} done</span></li>
            <li v-if="!summary.workload.length" class="py-2 text-slate-500">No technicians yet.</li>
          </ul>
        </section>
      </div>
    </template>
  </main>
</template>
