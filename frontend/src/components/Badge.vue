<script setup>
defineProps({ text: String, styleClass: String });
</script>

<template>
  <span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="styleClass">{{ text }}</span>
</template>
