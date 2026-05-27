<script lang="ts">
  import type { Turn } from '$lib/types';

  let { turn, streaming = false }: { turn: Turn; streaming?: boolean } = $props();

  const isTutor = $derived(turn.speaker === 'tutor');
</script>

<div class="flex {isTutor ? 'justify-start' : 'justify-end'} my-2">
  <div
    class="max-w-[80%] px-4 py-3 rounded-2xl whitespace-pre-wrap leading-relaxed"
    class:bg-(--color-tutor)={isTutor}
    class:bg-(--color-student)={!isTutor}
  >
    <div class="text-[10px] uppercase tracking-wider text-(--color-muted) mb-1">
      {isTutor ? 'Compañero' : 'du'}
    </div>
    <div class="text-(--color-ink)">
      {turn.text}{#if streaming}<span class="inline-block w-2 h-4 align-middle bg-(--color-muted) ml-1 animate-pulse"></span>{/if}
    </div>
  </div>
</div>
