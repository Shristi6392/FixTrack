<script setup>
import { onMounted, ref } from 'vue';
import { listSchedules, createSchedule, updateSchedule, deleteSchedule, listAssets } from '../api/tickets';
import { errorMessage } from '../api/http';

const schedules = ref([]);
const assets = ref([]);
const error = ref('');
const blank = () => ({ asset_id: '', title: '', frequency: 'weekly', next_run_at: new Date(Date.now() + 864e5).toISOString().slice(0, 16) });
const form = ref(blank());
const fmt = (d) => new Date(d).toLocaleString();

async function load() { try { schedules.value = await listSchedules(); } catch (e) { error.value = errorMessage(e); } }
onMounted(async () => { try { assets.value = await listAssets(); } catch (e) { error.value = errorMessage(e); } load(); });

async function add() {
  error.value = '';
  try {
    await createSchedule({ ...form.value, asset_id: Number(form.value.asset_id), next_run_at: new Date(form.value.next_run_at).toISOString() });
    form.value = blank(); await load();
  } catch (e) { error.value = errorMessage(e); }
}
async function toggle(s) { try { await updateSchedule(s.id, { active: !s.active }); await load(); } catch (e) { error.value = errorMessage(e); } }
async function remove(s) {
  if (!confirm(`Delete schedule "${s.title}"?`)) return;
  try { await deleteSchedule(s.id); await load(); } catch (e) { error.value = errorMessage(e); }
}
</script>

<template>
  <main class="mx-auto max-w-5xl p-6">
    <h1 class="mb-4 text-2xl font-bold">Preventive maintenance schedules</h1>
    <p v-if="error" class="mb-3 rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error }}</p>
    <form class="mb-6 grid gap-3 rounded-2xl bg-white p-4 shadow ring-1 ring-slate-200 sm:grid-cols-5" @submit.prevent="add">
      <select v-model="form.asset_id" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="" disabled>Asset…</option><option v-for="a in assets" :key="a.id" :value="a.id">{{ a.code }} · {{ a.name }}</option></select>
      <input v-model="form.title" required minlength="2" placeholder="Task, e.g. Clean AC filter" class="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
      <select v-model="form.frequency" class="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option>daily</option><option>weekly</option><option>monthly</option></select>
      <input v-model="form.next_run_at" type="datetime-local" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <button class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 sm:col-span-5 sm:w-40">Add schedule</button>
    </form>
    <div class="overflow-x-auto rounded-2xl bg-white shadow ring-1 ring-slate-200">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-100 text-xs uppercase text-slate-500"><tr><th class="p-3">Task</th><th class="p-3">Asset</th><th class="p-3">Frequency</th><th class="p-3">Next run</th><th class="p-3">State</th><th class="p-3" /></tr></thead>
        <tbody>
          <tr v-for="s in schedules" :key="s.id" class="border-t border-slate-100">
            <td class="p-3 font-medium">{{ s.title }}</td><td class="p-3">{{ s.asset_code }}</td><td class="p-3">{{ s.frequency }}</td><td class="p-3">{{ fmt(s.next_run_at) }}</td>
            <td class="p-3">{{ s.active ? 'Active' : 'Paused' }}</td>
            <td class="space-x-3 p-3 text-right"><button class="text-indigo-700 hover:underline" @click="toggle(s)">{{ s.active ? 'Pause' : 'Resume' }}</button><button class="text-red-600 hover:underline" @click="remove(s)">Delete</button></td>
          </tr>
          <tr v-if="!schedules.length"><td colspan="6" class="p-6 text-center text-slate-500">No schedules yet.</td></tr>
        </tbody>
      </table>
    </div>
  </main>
</template>
