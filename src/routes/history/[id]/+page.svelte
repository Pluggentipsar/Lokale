<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import {
    listSessions,
    listEncounters,
    listSessionNotes,
    deleteSession,
    type EncounterRow,
    type SessionRow
  } from '$lib/db';
  import type { NoteRecord } from '$lib/types';
  import { getScenario } from '$lib/curriculum';
  import { goto } from '$app/navigation';

  const sessionId = $derived(Number(page.params.id));

  let session = $state<SessionRow | null>(null);
  let encounters = $state<EncounterRow[]>([]);
  let notes = $state<NoteRecord[]>([]);
  let loading = $state(true);
  let confirmingDelete = $state(false);
  let deleting = $state(false);

  async function doDelete() {
    deleting = true;
    try {
      await deleteSession(sessionId);
      await goto('/history');
    } finally {
      deleting = false;
    }
  }

  onMount(async () => {
    await load();
  });

  async function load() {
    loading = true;
    const all = await listSessions();
    session = all.find((s) => s.id === sessionId) ?? null;
    if (session) {
      [encounters, notes] = await Promise.all([
        listEncounters(session.id),
        listSessionNotes(session.id)
      ]);
    }
    loading = false;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString('sv-SE');
  }
</script>

<div class="max-w-3xl mx-auto p-6 space-y-6">
  <div class="flex items-center justify-between">
    <a href="/history" class="text-sm text-(--color-muted) hover:text-(--color-ink)">← historik</a>
    {#if session}
      {#if !confirmingDelete}
        <button
          type="button"
          onclick={() => (confirmingDelete = true)}
          class="text-xs px-3 py-1 rounded-md text-(--color-muted) hover:text-red-500"
        >
          radera session
        </button>
      {:else}
        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={doDelete}
            disabled={deleting}
            class="text-xs px-3 py-1 rounded-md bg-red-500 text-white disabled:opacity-50"
          >
            {deleting ? 'raderar...' : 'ja, radera'}
          </button>
          <button
            type="button"
            onclick={() => (confirmingDelete = false)}
            disabled={deleting}
            class="text-xs px-3 py-1 rounded-md text-(--color-muted)"
          >
            avbryt
          </button>
        </div>
      {/if}
    {/if}
  </div>

  {#if loading}
    <p class="text-(--color-muted)">Laddar...</p>
  {:else if !session}
    <p class="text-(--color-muted)">Session #{sessionId} hittades inte.</p>
  {:else}
    <header class="space-y-1">
      <h2 class="font-serif text-2xl">
        {getScenario(session.scenario_id ?? '')?.title ?? session.scenario_id}
      </h2>
      <p class="text-sm text-(--color-muted)">
        {formatDate(session.started_at)}
        {#if session.ended_at}
          – avslutad {formatDate(session.ended_at)}
        {/if}
        · {encounters.length} turns
        {#if session.model_name}
          · modell: <code>{session.model_name}</code>
        {/if}
      </p>
      {#if session.goal}
        <p class="text-sm">
          <span class="text-(--color-muted)">Mål:</span> {session.goal}
        </p>
      {/if}
      {#if session.closing_reflection}
        <p class="text-sm">
          <span class="text-(--color-muted)">Reflektion:</span> {session.closing_reflection}
        </p>
      {/if}
    </header>

    <section>
      <h3 class="font-serif text-lg mb-3">Konversation</h3>
      <ul class="space-y-2">
        {#each encounters as e}
          <li
            class="p-3 rounded-xl"
            class:bg-(--color-tutor)={e.speaker === 'tutor'}
            class:bg-(--color-student)={e.speaker === 'student'}
          >
            <div class="text-[10px] uppercase tracking-wider text-(--color-muted) mb-1">
              {e.speaker === 'tutor' ? 'Compañero' : 'du'} · turn {e.turn_index}
            </div>
            <div class="whitespace-pre-wrap text-sm leading-relaxed">{e.text}</div>
            {#if e.engagement || (e.target_items && e.target_items.length) || (e.observed_errors && e.observed_errors.length)}
              <div class="mt-2 text-[11px] font-mono text-(--color-muted) space-y-0.5">
                {#if e.engagement}<div>engagement: {e.engagement}</div>{/if}
                {#if e.next_move}<div>next_move: {e.next_move}</div>{/if}
                {#if e.target_items && e.target_items.length}
                  <div>target: {e.target_items.join(', ')}</div>
                {/if}
                {#if e.observed_errors && e.observed_errors.length}
                  <div>errors: {e.observed_errors.join(', ')}</div>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </section>

    {#if notes.length > 0}
      <section>
        <h3 class="font-serif text-lg mb-3">Noteringar från sessionen</h3>
        <ul class="space-y-2">
          {#each notes as n}
            <li class="p-3 bg-(--color-warm) rounded-xl">
              <div class="text-[10px] uppercase tracking-wider text-(--color-muted) mb-1">
                {n.tags.length ? n.tags.join(', ') : 'note'}
              </div>
              <p class="text-sm whitespace-pre-wrap leading-relaxed">{n.body}</p>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</div>
