<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  let { children } = $props();
</script>

<div class="min-h-screen flex flex-col">
  <header class="px-6 py-4 border-b border-(--color-muted)/20 flex items-center justify-between">
    <a href="/" class="block">
      <h1 class="font-serif text-xl text-(--color-accent)">Compañero</h1>
      <p class="text-xs text-(--color-muted)">Lokal spansklärare — A1</p>
    </a>
    <nav class="flex gap-4 text-sm">
      <a
        href="/"
        class="hover:text-(--color-accent)"
        class:font-medium={page.route.id === '/'}
      >
        Session
      </a>
      <a
        href="/progress"
        class="hover:text-(--color-accent)"
        class:font-medium={page.route.id === '/progress'}
      >
        Progress
      </a>
      <a
        href="/settings"
        class="hover:text-(--color-accent)"
        class:font-medium={page.route.id === '/settings'}
      >
        Inställningar
      </a>
    </nav>
  </header>
  <main class="flex-1 flex flex-col">
    {@render children?.()}
  </main>
</div>
