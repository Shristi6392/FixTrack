<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import Badge from '../components/Badge.vue';
import { STATUS_STYLE, PRIORITY_STYLE } from '../constants';
import { getTicket, getEvents, getComments, addComment, getAttachments, setStatus } from '../api/tickets';
import { useAuthStore } from '../stores/auth';
import { errorMessage } from '../api/http';

const route = useRoute();
const auth = useAuthStore();
const id = route.params.id;
const ticket = ref(null);
const events = ref([]);
const comments = ref([]);
const attachments = ref([]);
const newComment = ref('');
const internal = ref(false);
const error = ref('');
const fmt = (d) => new Date(d).toLocaleString();

async function load() {
  try {
    ticket.value = await getTicket(id);
    [events.value, comments.value, attachments.value] = await Promise.all([getEvents(id), getComments(id), getAttachments(id)]);
  } catch (e) { error.value = e.response?.status === 404 ? 'Ticket not found' : errorMessage(e); }
}
onMounted(load);

// Actions offered to the current user for the current status (server enforces the same rules).
const actions = computed(() => {
  if (!ticket.value) return [];
  const s = ticket.value.status; const r = auth.role;
  const out = [];
  if ((r === 'technician' || r === 'admin') && s === 'Assigned') out.push({ label: 'Start work', to: 'In Progress' });
  if ((r === 'technician' || r === 'admin') && s === 'In Progress') out.push({ label: 'Mark resolved', to: 'Resolved' });
  if ((r === 'technician' || r === 'admin') && s === 'Reopened') out.push({ label: 'Start work', to: 'In Progress' });
  if ((r === 'student' || r === 'admin') && s === 'Resolved') out.push({ label: 'Confirm fixed', to: 'Closed' }, { label: 'Reopen', to: 'Reopened', danger: true });
  return out;
});

async function change(to) {
  try { await setStatus(id, to); await load(); } catch (e) { error.value = errorMessage(e); }
}
async function postComment() {
  if (!newComment.value.trim()) return;
  try {
    comments.value.push(await addComment(id, newComment.value.trim(), internal.value));
    newComment.value = ''; internal.value = false;
  } catch (e) { error.value = errorMessage(e); }
}
const describe = (e) => {
  if (e.event_type === 'created') return 'created the ticket';
  if (e.event_type === 'status_changed') return `changed status ${e.old_value} → ${e.new_value}`;
  if (e.event_type === 'assigned') return 'assigned a technician';
  if (e.event_type === 'reassigned') return 'reassigned the ticket';
  if (e.event_type === 'attachment_added') return 'added a photo';
  return e.event_type;
};
</script>

<template>
  <main class="mx-auto max-w-4xl p-6">
    <p v-if="error" class="mb-3 rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error }}</p>
    <template v-if="ticket">
      <div class="rounded-2xl bg-white p-6 shadow ring-1 ring-slate-200">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <h1 class="text-2xl font-bold">#{{ ticket.id }} · {{ ticket.title }}</h1>
          <div class="flex gap-2"><Badge :text="ticket.priority" :style-class="PRIORITY_STYLE[ticket.priority]" /><Badge :text="ticket.status" :style-class="STATUS_STYLE[ticket.status]" /><Badge v-if="ticket.is_overdue" text="Overdue" style-class="bg-red-600 text-white" /></div>
        </div>
        <p class="mt-3 whitespace-pre-line text-slate-700">{{ ticket.description || 'No description.' }}</p>
        <dl class="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt class="text-slate-500">Category</dt><dd>{{ ticket.category }}</dd></div>
          <div><dt class="text-slate-500">Location</dt><dd>{{ ticket.location_name || '—' }}</dd></div>
          <div><dt class="text-slate-500">Asset</dt><dd>{{ ticket.asset_code || '—' }}</dd></div>
          <div><dt class="text-slate-500">Reported by</dt><dd>{{ ticket.requester_name }}</dd></div>
          <div><dt class="text-slate-500">Assigned to</dt><dd>{{ ticket.assignee_name || 'Unassigned' }}</dd></div>
          <div><dt class="text-slate-500">Created</dt><dd>{{ fmt(ticket.created_at) }}</dd></div>
          <div><dt class="text-slate-500">SLA due</dt><dd :class="ticket.is_overdue ? 'font-semibold text-red-600' : ''">{{ ticket.due_at ? fmt(ticket.due_at) : '—' }}</dd></div>
        </dl>
        <div v-if="attachments.length" class="mt-4 flex gap-3">
          <a v-for="a in attachments" :key="a.id" :href="`/api${a.url}`" target="_blank"><img :src="`/api${a.url}`" alt="Ticket photo" class="h-24 rounded-lg ring-1 ring-slate-200" /></a>
        </div>
        <div v-if="actions.length" class="mt-5 flex gap-3">
          <button v-for="a in actions" :key="a.to" class="rounded-lg px-4 py-2 text-sm font-semibold text-white" :class="a.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'" @click="change(a.to)">{{ a.label }}</button>
        </div>
      </div>

      <div class="mt-6 grid gap-6 md:grid-cols-2">
        <section class="rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200">
          <h2 class="mb-3 font-semibold">Comments</h2>
          <ul class="space-y-3">
            <li v-for="c in comments" :key="c.id" class="rounded-lg p-3 text-sm" :class="c.is_internal ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-slate-50'">
              <div class="mb-1 text-xs text-slate-500">{{ c.author_name }} ({{ c.author_role }}) · {{ fmt(c.created_at) }}<span v-if="c.is_internal" class="ml-2 font-semibold text-amber-700">internal note</span></div>
              {{ c.body }}
            </li>
            <li v-if="!comments.length" class="text-sm text-slate-500">No comments yet.</li>
          </ul>
          <form class="mt-4 space-y-2" @submit.prevent="postComment">
            <textarea v-model="newComment" rows="2" maxlength="2000" placeholder="Write a comment…" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <div class="flex items-center justify-between">
              <label v-if="auth.role !== 'student'" class="text-sm text-slate-600"><input v-model="internal" type="checkbox" class="mr-1" />Internal note</label><span v-else />
              <button class="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">Post</button>
            </div>
          </form>
        </section>

        <section class="rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200">
          <h2 class="mb-3 font-semibold">History</h2>
          <ol class="space-y-2 border-l-2 border-indigo-200 pl-4 text-sm">
            <li v-for="e in events" :key="e.id"><span class="font-medium">{{ e.actor_name || 'System' }}</span> {{ describe(e) }}<div class="text-xs text-slate-500">{{ fmt(e.created_at) }}</div></li>
          </ol>
        </section>
      </div>
    </template>
  </main>
</template>
