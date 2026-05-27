<script lang="ts">
  import { onMount } from 'svelte';
  import { listSessions, type SessionRow } from '$lib/db';
  import { getScenario } from '$lib/curriculum';

  let sessions = $state<SessionRow[]>([]);
  let loading = $state(true);

  onMount(async () => {
    sessions = await listSessions();
    loading = false;
  });

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function scenarioTitle(id: string | null): string {
    if (!id) return '—';
    return getScenario(id)?.title ?? id;
  }
</script>

<div class="max-w-3xl mx-auto p-6 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="font-serif text-2xl">Historik</h2>
      <p class="text-sm text-(--color-muted)">Alla dina tidigare sessioner.</p>
    </div>
    <a href="/" class="text-sm text-(--color-muted) hover:text-(--color-ink)">← tillbaka</a>
  </div>

  {#if loading}
    <p class="text-(--color-muted)">Laddar...</p>
  {:else if sessions.length === 0}
    <p class="text-(--color-muted)">Du har inte gjort några sessioner än. Starta en så dyker den upp här.</p>
  {:else}
    <ul class="space-y-2">
      {#each sessions as s}
        <li>
          <a
            href="/history/{s.id}"
            class="block p-4 rounded-xl border border-(--color-muted)/20 hover:border-(--color-accent) hover:bg-(--color-warm) transition"
          >
            <div class="flex items-baseline justify-between gap-3 mb-1">
              <span class="font-serif">{scenarioTitle(s.scenario_id)}</span>
              <span class="text-xs font-mono text-(--color-muted)">{formatDate(s.started_at)}</span>
            </div>
            <div class="flex items-center gap-3 text-xs text-(--color-muted)">
              <span>{s.encounter_count} turns</span>
              {#if s.ended_at}
                <span>· avslutad</span>
              {:else}
                <span>· pågående/avbruten</span>
              {/if}
              {#if s.goal}
                <span class="truncate flex-1">· mål: "{s.goal}"</span>
              {/if}
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>
