<script setup>
import { onMounted, ref } from 'vue';
import Badge from '../components/Badge.vue';
import { listTickets, setStatus } from '../api/tickets';
import { STATUS_STYLE, PRIORITY_STYLE } from '../constants';
import { errorMessage } from '../api/http';

const tickets = ref([]);
const showDone = ref(false);
const error = ref('');

async function load() {
  try { tickets.value = (await listTickets({ limit: 100 })).tickets; } catch (e) { error.value = errorMessage(e); }
}
onMounted(load);

const NEXT = { Assigned: ['Start work', 'In Progress'], Reopened: ['Start work', 'In Progress'], 'In Progress': ['Mark resolved', 'Resolved'] };
const isOpenJob = (t) => !['Resolved', 'Closed'].includes(t.status);
const visible = () => tickets.value.filter((t) => showDone.value || isOpenJob(t));

async function advance(t) {
  error.value = '';
  try { await setStatus(t.id, NEXT[t.status][1]); await load(); } catch (e) { error.value = errorMessage(e); }
}
</script>

<template>
  <main class="mx-auto max-w-4xl p-6">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-2xl font-bold">My jobs</h1>
      <label class="text-sm text-slate-600"><input v-model="showDone" type="checkbox" class="mr-1" />Show finished</label>
    </div>
    <p v-if="error" class="mb-3 rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error }}</p>
    <ul class="space-y-3">
      <li v-for="t in visible()" :key="t.id" class="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow ring-1 ring-slate-200">
        <div>
          <RouterLink :to="`/tickets/${t.id}`" class="font-semibold text-indigo-700 hover:underline">#{{ t.id }} · {{ t.title }}</RouterLink>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Badge :text="t.priority" :style-class="PRIORITY_STYLE[t.priority]" /><Badge :text="t.status" :style-class="STATUS_STYLE[t.status]" />
            <span>{{ t.category }}</span><span v-if="t.location_name">· {{ t.location_name }}</span>
          </div>
        </div>
        <button v-if="NEXT[t.status]" class="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700" @click="advance(t)">{{ NEXT[t.status][0] }}</button>
      </li>
      <li v-if="!visible().length" class="rounded-2xl bg-white p-6 text-center text-slate-500 shadow ring-1 ring-slate-200">No jobs assigned to you.</li>
    </ul>
  </main>
</template>
