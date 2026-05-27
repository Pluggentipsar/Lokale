<script lang="ts">
  let {
    question,
    onSubmit
  }: {
    question: string;
    onSubmit: (reflection: string) => void;
  } = $props();

  let reflection = $state('');

  function submit(e: SubmitEvent) {
    e.preventDefault();
    onSubmit(reflection.trim());
  }
</script>

<div class="max-w-xl mx-auto p-6 mt-12">
  <div class="bg-(--color-warm) rounded-2xl p-6 mb-6">
    <p class="text-xs uppercase tracking-wider text-(--color-muted) mb-2">Reflektion</p>
    <p class="font-serif text-lg leading-relaxed">{question}</p>
  </div>

  <form onsubmit={submit} class="space-y-4">
    <!-- svelte-ignore a11y_autofocus -->
    <textarea
      bind:value={reflection}
      rows="5"
      placeholder="Skriv som det känns. Det här är bara för dig."
      class="w-full px-4 py-3 rounded-xl border border-(--color-muted)/30 bg-(--color-bg) focus:outline-none focus:border-(--color-accent) resize-none"
      autofocus
    ></textarea>
    <div class="flex gap-2">
      <button
        type="submit"
        class="flex-1 py-3 rounded-xl bg-(--color-accent) text-white font-medium"
      >
        Klar
      </button>
      <button
        type="button"
        onclick={() => onSubmit('')}
        class="px-4 py-3 rounded-xl text-(--color-muted) hover:text-(--color-ink)"
      >
        Hoppa över
      </button>
    </div>
  </form>
</div>
