<script lang="ts">
  import { onMount } from 'svelte';
  import { ensureProfile, updateProfile } from '$lib/db';

  let displayName = $state('');
  let l1 = $state('sv');
  let targetLevel = $state('A1');
  let saved = $state(false);
  let loading = $state(true);

  onMount(async () => {
    const p = await ensureProfile();
    displayName = p.displayName;
    l1 = p.l1;
    targetLevel = p.targetLevel;
    loading = false;
  });

  async function save(e: SubmitEvent) {
    e.preventDefault();
    await updateProfile({ displayName, l1, targetLevel });
    saved = true;
    setTimeout(() => (saved = false), 2000);
  }
</script>

<div class="max-w-xl mx-auto p-6 space-y-6">
  <h2 class="font-serif text-2xl">Inställningar</h2>

  {#if loading}
    <p class="text-(--color-muted)">Laddar...</p>
  {:else}
    <form onsubmit={save} class="space-y-5">
      <div>
        <label for="name" class="block text-sm font-medium mb-2">Namn</label>
        <input
          id="name"
          type="text"
          bind:value={displayName}
          class="w-full px-4 py-3 rounded-xl border border-(--color-muted)/30 bg-(--color-bg) focus:outline-none focus:border-(--color-accent)"
        />
      </div>

      <div>
        <label for="l1" class="block text-sm font-medium mb-2">
          Modersmål <span class="text-(--color-muted) font-normal">(tutorn växlar hit när det behövs)</span>
        </label>
        <select
          id="l1"
          bind:value={l1}
          class="w-full px-4 py-3 rounded-xl border border-(--color-muted)/30 bg-(--color-bg)"
        >
          <option value="sv">Svenska</option>
          <option value="en">English</option>
          <option value="da">Dansk</option>
          <option value="no">Norsk</option>
          <option value="fi">Suomi</option>
        </select>
      </div>

      <div>
        <label for="level" class="block text-sm font-medium mb-2">Nivå</label>
        <select
          id="level"
          bind:value={targetLevel}
          class="w-full px-4 py-3 rounded-xl border border-(--color-muted)/30 bg-(--color-bg)"
        >
          <option value="A1">A1 — nybörjare</option>
          <option value="A2">A2 — grundläggande</option>
          <option value="B1">B1 — självständig</option>
        </select>
      </div>

      <button
        type="submit"
        class="px-5 py-3 rounded-xl bg-(--color-accent) text-white font-medium"
      >
        Spara
      </button>

      {#if saved}
        <span class="ml-3 text-sm text-(--color-muted)">Sparat.</span>
      {/if}
    </form>
  {/if}
</div>
