<script lang="ts">
  import { onMount } from 'svelte';
  import {
    listAllItemsWithState,
    listSummaryNotes,
    updateReviewState,
    getProgressStats,
    type ProgressStats
  } from '$lib/db';
  import { markKnown } from '$lib/pedagogy/fsrs';
  import type { ItemWithState, NoteRecord } from '$lib/types';

  let items = $state<ItemWithState[]>([]);
  let notes = $state<NoteRecord[]>([]);
  let stats = $state<ProgressStats | null>(null);
  let loading = $state(true);

  onMount(async () => {
    await load();
  });

  async function load() {
    loading = true;
    [items, notes, stats] = await Promise.all([
      listAllItemsWithState(),
      listSummaryNotes(20),
      getProgressStats()
    ]);
    loading = false;
  }

  const engagementTotal = $derived(
    stats
      ? stats.averageEngagement.passive +
          stats.averageEngagement.active +
          stats.averageEngagement.constructive
      : 0
  );

  function pct(n: number, total: number): string {
    if (total === 0) return '0%';
    return Math.round((n / total) * 100) + '%';
  }

  type Bucket = 'new' | 'learning' | 'review' | 'relearning';

  const grouped = $derived.by(() => {
    const g: Record<Bucket, ItemWithState[]> = {
      new: [],
      learning: [],
      review: [],
      relearning: []
    };
    for (const i of items) {
      g[i.state.state].push(i);
    }
    return g;
  });

  function labelFor(item: ItemWithState): string {
    const t = item.item.item_type;
    if (t === 'vocab') return String(item.item.payload['lemma'] ?? item.item.payload['ref']);
    return String(item.item.payload['ref']);
  }

  function dueLabel(iws: ItemWithState): string {
    const now = Date.now();
    const due = new Date(iws.state.due_at).getTime();
    const diffMs = due - now;
    const diffH = Math.round(diffMs / (1000 * 60 * 60));
    const diffD = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (Math.abs(diffH) < 24) {
      if (diffH <= 0) return 'förfallen';
      return `om ${diffH} h`;
    }
    if (diffD <= 0) return `förfallen sedan ${-diffD} d`;
    return `om ${diffD} d`;
  }

  function masteryDots(iws: ItemWithState): string {
    // Snabb visuell heuristik baserat på stability.
    const s = iws.state.stability;
    if (s < 1) return '○○○○';
    if (s < 7) return '●○○○';
    if (s < 30) return '●●○○';
    if (s < 90) return '●●●○';
    return '●●●●';
  }

  async function onMarkKnown(iws: ItemWithState) {
    const next = markKnown(iws.state);
    await updateReviewState(iws.item.id, next);
    await load();
  }

  function shortDate(iso: string): string {
    return iso.slice(0, 10);
  }
</script>

<div class="max-w-3xl mx-auto p-6 space-y-8">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="font-serif text-2xl">Min progress</h2>
      <p class="text-sm text-(--color-muted)">
        Detta är vad Compañero tror om dig. Du har sista ordet.
      </p>
    </div>
    <a href="/" class="text-sm text-(--color-muted) hover:text-(--color-ink)">← tillbaka</a>
  </div>

  {#if loading}
    <p class="text-(--color-muted)">Laddar...</p>
  {:else}
    <!-- Stats -->
    {#if stats && stats.totalSessions > 0}
      <section class="grid grid-cols-3 gap-3">
        <div class="p-4 bg-(--color-warm) rounded-xl">
          <div class="text-xs text-(--color-muted) uppercase tracking-wider mb-1">Sessioner totalt</div>
          <div class="font-serif text-2xl">{stats.totalSessions}</div>
          {#if stats.sessionsThisWeek > 0}
            <div class="text-xs text-(--color-muted) mt-1">{stats.sessionsThisWeek} senaste 7 dagarna</div>
          {/if}
        </div>
        <div class="p-4 bg-(--color-warm) rounded-xl">
          <div class="text-xs text-(--color-muted) uppercase tracking-wider mb-1">Turns</div>
          <div class="font-serif text-2xl">{stats.totalTurns}</div>
        </div>
        <div class="p-4 bg-(--color-warm) rounded-xl">
          <div class="text-xs text-(--color-muted) uppercase tracking-wider mb-1">Engagemang</div>
          {#if engagementTotal > 0}
            <div class="text-sm space-y-0.5 mt-1">
              <div class="flex justify-between"><span>konstruktivt</span><span class="font-mono">{pct(stats.averageEngagement.constructive, engagementTotal)}</span></div>
              <div class="flex justify-between"><span>aktivt</span><span class="font-mono">{pct(stats.averageEngagement.active, engagementTotal)}</span></div>
              <div class="flex justify-between text-(--color-muted)"><span>passivt</span><span class="font-mono">{pct(stats.averageEngagement.passive, engagementTotal)}</span></div>
            </div>
          {:else}
            <div class="text-sm text-(--color-muted) mt-1">ingen data än</div>
          {/if}
        </div>
      </section>

      {#if stats.topObservedErrors.length > 0 || stats.toughestItems.length > 0}
        <section class="grid sm:grid-cols-2 gap-4">
          {#if stats.topObservedErrors.length > 0}
            <div class="p-4 rounded-xl border border-(--color-muted)/15">
              <h3 class="font-serif text-base mb-3">Vanligaste felmönster</h3>
              <ul class="space-y-1 text-sm">
                {#each stats.topObservedErrors as e}
                  <li class="flex justify-between font-mono">
                    <span class="truncate">{e.tag}</span>
                    <span class="text-(--color-muted)">{e.count}×</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if stats.toughestItems.length > 0}
            <div class="p-4 rounded-xl border border-(--color-muted)/15">
              <h3 class="font-serif text-base mb-3">Hårdast nötter</h3>
              <ul class="space-y-1 text-sm">
                {#each stats.toughestItems as t}
                  <li class="flex justify-between">
                    <span class="truncate">{t.lemma ?? t.ref}</span>
                    <span class="text-(--color-muted) font-mono">{t.lapses} lapses</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </section>
      {/if}
    {/if}

    <!-- Items per state -->
    {#each ['review', 'learning', 'relearning', 'new'] as bucket}
      {@const list = grouped[bucket as 'review' | 'learning' | 'relearning' | 'new']}
      {#if list.length > 0}
        <section>
          <h3 class="font-serif text-lg mb-3 capitalize">{bucket}</h3>
          <ul class="divide-y divide-(--color-muted)/15 border border-(--color-muted)/15 rounded-xl overflow-hidden">
            {#each list as iws}
              <li class="flex items-center gap-3 px-4 py-3 bg-(--color-bg)">
                <span class="font-mono text-xs text-(--color-muted) w-12">{iws.item.item_type}</span>
                <span class="font-medium flex-1">{labelFor(iws)}</span>
                <span class="font-mono text-sm text-(--color-accent)">{masteryDots(iws)}</span>
                <span class="text-xs text-(--color-muted) w-20 text-right">{dueLabel(iws)}</span>
                <button
                  onclick={() => onMarkKnown(iws)}
                  class="text-xs px-2 py-1 rounded-md border border-(--color-muted)/30 hover:bg-(--color-warm)"
                  title="Markera som något du redan kan"
                >
                  jag kan
                </button>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}

    {#if items.length === 0}
      <p class="text-(--color-muted)">
        Inga items än. Starta en session så börjar det fyllas på.
      </p>
    {/if}

    <!-- Notes -->
    <section>
      <h3 class="font-serif text-lg mb-3">Lärartidsbok</h3>
      {#if notes.length === 0}
        <p class="text-(--color-muted) text-sm">
          Inga noteringar än. Varje session avslutas med en kort sammanfattning från tutorn.
        </p>
      {:else}
        <ul class="space-y-3">
          {#each notes as n}
            <li class="bg-(--color-warm) rounded-xl p-4">
              <div class="text-xs text-(--color-muted) mb-1">{shortDate(n.created_at)}</div>
              <p class="text-sm leading-relaxed">{n.body}</p>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</div>
