<script lang="ts">
  import type { Turn } from '$lib/types';

  let { turn, streaming = false }: { turn: Turn; streaming?: boolean } = $props();

  const isTutor = $derived(turn.speaker === 'tutor');
  let showMeta = $state(false);
</script>

<div class="flex {isTutor ? 'justify-start' : 'justify-end'} my-2">
  <div
    class="max-w-[80%] px-4 py-3 rounded-2xl whitespace-pre-wrap leading-relaxed"
    class:bg-(--color-tutor)={isTutor}
    class:bg-(--color-student)={!isTutor}
  >
    <div class="text-[10px] uppercase tracking-wider text-(--color-muted) mb-1 flex items-center justify-between gap-2">
      <span>{isTutor ? 'Compañero' : 'du'}</span>
      {#if turn.meta}
        <button
          type="button"
          onclick={() => (showMeta = !showMeta)}
          class="text-[10px] text-(--color-muted) hover:text-(--color-ink) underline-offset-2 hover:underline"
          title="Se vad tutorn noterade"
        >
          {showMeta ? 'dölj' : 'noteringar'}
        </button>
      {/if}
    </div>
    <div class="text-(--color-ink)">
      {turn.text}{#if streaming}<span class="inline-block w-2 h-4 align-middle bg-(--color-muted) ml-1 animate-pulse"></span>{/if}
    </div>

    {#if showMeta && turn.meta}
      <div class="mt-3 pt-3 border-t border-(--color-muted)/20 text-xs space-y-1.5 font-mono">
        <div>
          <span class="text-(--color-muted)">target_items:</span>
          {turn.meta.target_items.length === 0
            ? '—'
            : turn.meta.target_items.join(', ')}
        </div>
        <div>
          <span class="text-(--color-muted)">observed_errors:</span>
          {turn.meta.observed_errors.length === 0
            ? '—'
            : turn.meta.observed_errors.join(', ')}
        </div>
        <div>
          <span class="text-(--color-muted)">engagement:</span> {turn.meta.engagement}
        </div>
        <div>
          <span class="text-(--color-muted)">next_move:</span> {turn.meta.next_move}
        </div>
      </div>
    {/if}
  </div>
</div>
