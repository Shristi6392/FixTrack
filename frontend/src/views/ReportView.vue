<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { CATEGORIES, PRIORITIES } from '../constants';
import { createTicket, uploadPhoto, listLocations, listAssets } from '../api/tickets';
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

function onFile(e) {
  const f = e.target.files[0];
  if (f && f.size > 5 * 1024 * 1024) { error.value = 'Photo must be 5 MB or smaller'; e.target.value = ''; photo.value = null; return; }
  error.value = ''; photo.value = f || null;
}

async function submit() {
  error.value = ''; loading.value = true;
  try {
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
      <p v-if="error" class="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error }}</p>
      <button :disabled="loading" class="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
        {{ loading ? 'Submitting…' : 'Submit ticket' }}
      </button>
    </form>
  </main>
</template>
