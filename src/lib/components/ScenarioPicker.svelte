<script lang="ts">
  import type { Scenario } from '$lib/types';

  let {
    scenarios,
    onSelect
  }: {
    scenarios: Scenario[];
    onSelect: (s: Scenario) => void;
  } = $props();
</script>

<div class="max-w-2xl mx-auto p-6 mt-8">
  <h2 class="font-serif text-2xl mb-1">Vad ska vi göra idag?</h2>
  <p class="text-sm text-(--color-muted) mb-6">Välj ett scenario. Du kan göra samma flera gånger.</p>

  <ul class="grid gap-3">
    {#each scenarios as s}
      <li>
        <button
          type="button"
          onclick={() => onSelect(s)}
          class="w-full text-left p-5 rounded-2xl border border-(--color-muted)/20 hover:border-(--color-accent) hover:bg-(--color-warm) transition"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="font-serif text-lg">{s.title}</span>
            <span class="text-xs font-mono text-(--color-muted)">{s.level} · {s.estimated_minutes} min</span>
          </div>
          <p class="text-sm text-(--color-muted)">{s.setting}</p>
        </button>
      </li>
    {/each}
  </ul>
</div>
