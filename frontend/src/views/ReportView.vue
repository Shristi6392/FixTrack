<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { CATEGORIES, PRIORITIES } from '../constants';
import { createTicket, uploadPhoto, listLocations, listAssets, suggestTriage, checkDuplicates } from '../api/tickets';
import { errorMessage } from '../api/http';

const router = useRouter();
const form = ref({ title: '', description: '', category: 'Other', priority: 'Medium', location_id: '', asset_id: '' });
const photo = ref(null);
const locations = ref([]);
const assets = ref([]);
const error = ref('');
const loading = ref(false);

// Show locations as "Block A › Floor 1 › Room 101".
const locationOptions = computed(() => {
  const byId = Object.fromEntries(locations.value.map((l) => [l.id, l]));
  const path = (l) => (l.parent_id && byId[l.parent_id] ? `${path(byId[l.parent_id])} › ${l.name}` : l.name);
  return locations.value.map((l) => ({ id: l.id, label: path(l) })).sort((a, b) => a.label.localeCompare(b.label));
});

onMounted(async () => {
  try { [locations.value, assets.value] = await Promise.all([listLocations(), listAssets()]); } catch (e) { error.value = errorMessage(e); }
});

const visibleAssets = computed(() => assets.value.filter((a) => !form.value.location_id || a.location_id === Number(form.value.location_id)));
watch(() => form.value.location_id, () => { form.value.asset_id = ''; });

// AI suggestion is optional: any failure just hides it, the form keeps working.
const suggestion = ref(null);
const suggesting = ref(false);
const aiMessage = ref('');
async function suggest() {
  suggestion.value = null; aiMessage.value = ''; suggesting.value = true;
  try {
    const d = await suggestTriage(form.value.title, form.value.description);
    if (d.available) suggestion.value = d.suggestion; else aiMessage.value = 'No AI suggestion available right now — choose manually.';
  } catch { aiMessage.value = 'No AI suggestion available right now — choose manually.'; } finally { suggesting.value = false; }
}
function applySuggestion() {
  form.value.category = suggestion.value.category; form.value.priority = suggestion.value.priority; suggestion.value = null;
}

function onFile(e) {
  const f = e.target.files[0];
  if (f && f.size > 5 * 1024 * 1024) { error.value = 'Photo must be 5 MB or smaller'; e.target.value = ''; photo.value = null; return; }
  error.value = ''; photo.value = f || null;
}

const duplicates = ref([]);
const skipDuplicateCheck = ref(false);

async function submit() {
  error.value = ''; loading.value = true;
  try {
    // Duplicate check is best-effort and runs once; "Submit anyway" skips it.
    if (!skipDuplicateCheck.value) {
      try {
        duplicates.value = await checkDuplicates({ title: form.value.title, description: form.value.description, location_id: form.value.location_id ? Number(form.value.location_id) : null });
      } catch { duplicates.value = []; }
      if (duplicates.value.length) { skipDuplicateCheck.value = true; return; }
    }
    const t = await createTicket({
      ...form.value,
      location_id: form.value.location_id ? Number(form.value.location_id) : null,
      asset_id: form.value.asset_id ? Number(form.value.asset_id) : null,
    });
    // A failed photo upload must not lose the ticket that was already created.
    if (photo.value) { try { await uploadPhoto(t.id, photo.value); } catch { /* ticket exists; photo can be re-added */ } }
    router.push('/my-tickets');
  } catch (e) { error.value = errorMessage(e); } finally { loading.value = false; }
}
</script>

<template>
  <main class="mx-auto max-w-2xl p-6">
    <h1 class="mb-4 text-2xl font-bold">Report a problem</h1>
    <form class="space-y-4 rounded-2xl bg-white p-6 shadow ring-1 ring-slate-200" @submit.prevent="submit">
      <label class="block text-sm font-medium">Title
        <input v-model="form.title" required minlength="3" maxlength="200" placeholder="e.g. Ceiling fan not working" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label class="block text-sm font-medium">Description
        <textarea v-model="form.description" rows="4" maxlength="5000" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" :disabled="suggesting || form.title.length < 3" class="rounded-lg border border-indigo-300 px-3 py-1.5 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50" @click="suggest">
          {{ suggesting ? 'Thinking…' : '✨ Suggest category & priority' }}
        </button>
        <span v-if="aiMessage" class="text-slate-500">{{ aiMessage }}</span>
      </div>
      <div v-if="suggestion" class="rounded-lg bg-indigo-50 p-3 text-sm ring-1 ring-indigo-200">
        Suggested: <b>{{ suggestion.category }}</b> · <b>{{ suggestion.priority }}</b> <span class="text-slate-500">({{ suggestion.reason }})</span>
        <button type="button" class="ml-3 font-semibold text-indigo-700 hover:underline" @click="applySuggestion">Apply</button>
        <button type="button" class="ml-2 text-slate-500 hover:underline" @click="suggestion = null">Dismiss</button>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <label class="block text-sm font-medium">Category
          <select v-model="form.category" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option v-for="c in CATEGORIES" :key="c">{{ c }}</option></select>
        </label>
        <label class="block text-sm font-medium">Priority
          <select v-model="form.priority" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option v-for="p in PRIORITIES" :key="p">{{ p }}</option></select>
        </label>
        <label class="block text-sm font-medium">Location
          <select v-model="form.location_id" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="">— not specified —</option>
            <option v-for="l in locationOptions" :key="l.id" :value="l.id">{{ l.label }}</option>
          </select>
        </label>
        <label class="block text-sm font-medium">Asset (optional)
          <select v-model="form.asset_id" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="">— none —</option>
            <option v-for="a in visibleAssets" :key="a.id" :value="a.id">{{ a.code }} · {{ a.name }}</option>
          </select>
        </label>
      </div>
      <label class="block text-sm font-medium">Photo (JPEG, PNG or WebP, max 5 MB)
        <input type="file" accept="image/jpeg,image/png,image/webp" class="mt-1 block w-full text-sm" @change="onFile" />
      </label>
      <div v-if="duplicates.length" class="rounded-lg bg-amber-50 p-3 text-sm ring-1 ring-amber-300">
        <p class="font-semibold text-amber-800">This might already be reported:</p>
        <ul class="mt-1 list-disc pl-5"><li v-for="d in duplicates" :key="d.id">{{ d.title }} <span class="text-slate-500">({{ d.status }})</span></li></ul>
        <p class="mt-1 text-slate-600">If it's the same problem you don't need a new ticket. Otherwise press "Submit anyway".</p>
      </div>
      <p v-if="error" class="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error }}</p>
      <button :disabled="loading" class="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
        {{ loading ? 'Submitting…' : skipDuplicateCheck && duplicates.length ? 'Submit anyway' : 'Submit ticket' }}
      </button>
    </form>
  </main>
</template>
