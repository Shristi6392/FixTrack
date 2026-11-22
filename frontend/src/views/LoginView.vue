<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AuthCard from '../components/AuthCard.vue';
import { useAuthStore } from '../stores/auth';
import { errorMessage } from '../api/http';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = ''; loading.value = true;
  try {
    await auth.login(email.value, password.value);
    router.push(route.query.redirect || auth.homePath);
  } catch (e) { error.value = errorMessage(e); } finally { loading.value = false; }
}
</script>

<template>
  <AuthCard>
    <template #subtitle>Sign in to report or manage maintenance issues.</template>
    <form class="space-y-4" @submit.prevent="submit">
      <label class="block text-sm font-medium">Email
        <input v-model="email" type="email" required autocomplete="email" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label class="block text-sm font-medium">Password
        <input v-model="password" type="password" required autocomplete="current-password" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <p v-if="error" class="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error }}</p>
      <button :disabled="loading" class="w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
    <p class="mt-4 text-center text-sm text-slate-500">New here? <RouterLink to="/register" class="text-indigo-600 hover:underline">Create an account</RouterLink></p>
  </AuthCard>
</template>
