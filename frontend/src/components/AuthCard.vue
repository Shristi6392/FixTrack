<template>
  <main class="flex min-h-screen items-center justify-center p-4">
    <div class="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200">
      <h1 class="text-2xl font-bold text-indigo-700">FixTrack</h1>
      <p class="mb-6 text-sm text-slate-500"><slot name="subtitle" /></p>
      <slot />
    </div>
  </main>
</template>
