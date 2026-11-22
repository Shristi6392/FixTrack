<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AuthCard from '../components/AuthCard.vue';
import { useAuthStore } from '../stores/auth';
import { errorMessage } from '../api/http';

const auth = useAuthStore();
const router = useRouter();
const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = ''; loading.value = true;
  try {
    await auth.register(name.value, email.value, password.value);
    router.push(auth.homePath);
  } catch (e) { error.value = errorMessage(e); } finally { loading.value = false; }
}
</script>

<template>
  <AuthCard>
    <template #subtitle>Create a student account.</template>
    <form class="space-y-4" @submit.prevent="submit">
      <label class="block text-sm font-medium">Name
        <input v-model="name" required minlength="2" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label class="block text-sm font-medium">Email
        <input v-model="email" type="email" required class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label class="block text-sm font-medium">Password (min 8 characters)
        <input v-model="password" type="password" required minlength="8" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <p v-if="error" class="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error }}</p>
      <button :disabled="loading" class="w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
        {{ loading ? 'Creating…' : 'Register' }}
      </button>
    </form>
    <p class="mt-4 text-center text-sm text-slate-500">Have an account? <RouterLink to="/login" class="text-indigo-600 hover:underline">Sign in</RouterLink></p>
  </AuthCard>
</template>
