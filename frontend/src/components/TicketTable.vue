<script setup>
import Badge from './Badge.vue';
import { STATUS_STYLE, PRIORITY_STYLE } from '../constants';

defineProps({ tickets: { type: Array, required: true } });
const fmt = (d) => new Date(d).toLocaleDateString();
</script>

<template>
  <div class="overflow-x-auto rounded-2xl bg-white shadow ring-1 ring-slate-200">
    <table class="w-full text-left text-sm">
      <thead class="bg-slate-100 text-xs uppercase text-slate-500">
        <tr><th class="p-3">#</th><th class="p-3">Title</th><th class="p-3">Category</th><th class="p-3">Priority</th><th class="p-3">Status</th><th class="p-3">Location</th><th class="p-3">Created</th></tr>
      </thead>
      <tbody>
        <tr v-for="t in tickets" :key="t.id" class="border-t border-slate-100 hover:bg-slate-50">
          <td class="p-3 text-slate-400">{{ t.id }}</td>
          <td class="p-3 font-medium"><RouterLink :to="`/tickets/${t.id}`" class="text-indigo-700 hover:underline">{{ t.title }}</RouterLink></td>
          <td class="p-3">{{ t.category }}</td>
          <td class="p-3"><Badge :text="t.priority" :style-class="PRIORITY_STYLE[t.priority]" /></td>
          <td class="p-3"><Badge :text="t.status" :style-class="STATUS_STYLE[t.status]" /><Badge v-if="t.is_overdue" text="Overdue" style-class="ml-1 bg-red-600 text-white" /></td>
          <td class="p-3">{{ t.location_name || '—' }}</td>
          <td class="p-3">{{ fmt(t.created_at) }}</td>
        </tr>
        <tr v-if="!tickets.length"><td colspan="7" class="p-6 text-center text-slate-500">No tickets found.</td></tr>
      </tbody>
    </table>
  </div>
</template>
