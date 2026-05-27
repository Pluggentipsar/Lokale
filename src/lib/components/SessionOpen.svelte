<script lang="ts">
  import type { Scenario } from '$lib/types';

  let {
    scenario,
    onStart
  }: {
    scenario: Scenario;
    onStart: (goal: string, selfRating: number) => void;
  } = $props();

  let goal = $state('');
  let selfRating = $state(3);

  function submit() {
    if (goal.trim().length === 0) return;
    onStart(goal.trim(), selfRating);
  }
</script>

<div class="max-w-xl mx-auto p-6 mt-12">
  <div class="bg-(--color-warm) rounded-2xl p-6 mb-6">
    <h2 class="font-serif text-2xl mb-2">{scenario.title}</h2>
    <p class="text-sm text-(--color-muted) mb-1">Nivå {scenario.level} · ca {scenario.estimated_minutes} min</p>
    <p class="text-sm mt-3">{scenario.setting}</p>
  </div>

  <form
    onsubmit={(e) => {
      e.preventDefault();
      submit();
    }}
    class="space-y-6"
  >
    <div>
      <label for="goal" class="block text-sm font-medium mb-2">
        Vad vill du öva idag? <span class="text-(--color-muted) font-normal">(ett ord, en känsla, en situation)</span>
      </label>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        id="goal"
        type="text"
        bind:value={goal}
        maxlength="80"
        placeholder="t.ex. att kunna beställa utan att panika"
        class="w-full px-4 py-3 rounded-xl border border-(--color-muted)/30 bg-(--color-bg) focus:outline-none focus:border-(--color-accent)"
        autofocus
      />
    </div>

    <div>
      <label for="rating" class="block text-sm font-medium mb-2">
        Hur säker känner du dig på spanska idag?
      </label>
      <div class="flex items-center gap-3">
        <input
          id="rating"
          type="range"
          min="1"
          max="5"
          step="1"
          bind:value={selfRating}
          class="flex-1 accent-(--color-accent)"
        />
        <span class="font-mono text-lg w-8 text-center">{selfRating}</span>
      </div>
      <div class="flex justify-between text-xs text-(--color-muted) mt-1">
        <span>osäker</span>
        <span>säker</span>
      </div>
    </div>

    <button
      type="submit"
      disabled={goal.trim().length === 0}
      class="w-full py-3 rounded-xl bg-(--color-accent) text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
    >
      Börja
    </button>
  </form>
</div>
