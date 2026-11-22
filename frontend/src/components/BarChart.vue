<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const props = defineProps({ title: String, rows: { type: Array, default: () => [] }, color: { type: String, default: '#4f46e5' } });
const canvas = ref(null);
let chart;

function draw() {
  chart?.destroy();
  chart = new Chart(canvas.value, {
    type: 'bar',
    data: { labels: props.rows.map((r) => r.label), datasets: [{ data: props.rows.map((r) => r.count), backgroundColor: props.color, borderRadius: 4 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  });
}
onMounted(draw);
watch(() => props.rows, draw, { deep: true });
onBeforeUnmount(() => chart?.destroy());
</script>

<template>
  <div class="rounded-2xl bg-white p-4 shadow ring-1 ring-slate-200">
    <h3 class="mb-2 text-sm font-semibold text-slate-600">{{ title }}</h3>
    <canvas ref="canvas" height="160" />
  </div>
</template>
