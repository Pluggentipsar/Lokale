<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<div class="min-h-screen flex flex-col">
  <header class="px-6 py-4 border-b border-(--color-muted)/20">
    <h1 class="font-serif text-xl text-(--color-accent)">Compañero</h1>
    <p class="text-xs text-(--color-muted)">Lokal spansklärare — A1</p>
  </header>
  <main class="flex-1 flex flex-col">
    {@render children?.()}
  </main>
</div>
