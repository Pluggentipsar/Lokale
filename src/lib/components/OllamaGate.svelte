<script lang="ts">
  import type { OllamaStatus } from '$lib/types';

  let {
    status,
    onRetry
  }: {
    status: OllamaStatus | null;
    onRetry: () => void;
  } = $props();
</script>

<div class="max-w-xl mx-auto p-6 mt-12">
  <div class="bg-(--color-warm) rounded-2xl p-6">
    <h2 class="font-serif text-2xl mb-3">Kontrollerar Ollama...</h2>
    {#if !status}
      <p class="text-(--color-muted)">Söker efter Ollama på localhost:11434</p>
    {:else if !status.reachable}
      <p class="mb-3">Kan inte nå Ollama. Den behöver vara igång lokalt.</p>
      <ol class="text-sm space-y-2 mb-4 text-(--color-muted) list-decimal list-inside">
        <li>Installera Ollama från <code>ollama.com</code></li>
        <li>Starta den (på Mac/Win öppnas en bakgrundsapp; på Linux: <code>ollama serve</code>)</li>
        <li>Klicka försök igen</li>
      </ol>
    {:else if !status.modelAvailable}
      <p class="mb-3">Ollama är igång men modellen <code>{status.modelName}</code> saknas.</p>
      <p class="text-sm text-(--color-muted) mb-2">Kör i terminalen:</p>
      <pre class="bg-black/5 dark:bg-white/5 rounded-lg p-3 text-sm font-mono">ollama pull {status.modelName}</pre>
    {/if}

    <button
      onclick={onRetry}
      class="mt-4 px-5 py-2 rounded-xl bg-(--color-accent) text-white font-medium"
    >
      Försök igen
    </button>

    {#if status}
      <p class="text-xs text-(--color-muted) mt-4">{status.message}</p>
    {/if}
  </div>
</div>
