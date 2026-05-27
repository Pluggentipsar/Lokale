<script lang="ts">
  import type { Turn } from '$lib/types';
  import ChatTurn from './ChatTurn.svelte';
  import PushToTalk from './PushToTalk.svelte';

  let {
    turns,
    pendingTutorText,
    isStreaming,
    onSend,
    onFinish
  }: {
    turns: Turn[];
    pendingTutorText: string;
    isStreaming: boolean;
    onSend: (text: string) => void;
    onFinish: () => void;
  } = $props();

  let input = $state('');
  let scrollEl: HTMLDivElement;

  // Auto-scroll till botten när det kommer nya turns eller streaming-text.
  $effect(() => {
    void turns.length;
    void pendingTutorText;
    if (scrollEl) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    }
  });

  function submit(e?: SubmitEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (text.length === 0 || isStreaming) return;
    input = '';
    onSend(text);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }
</script>

<div class="flex flex-col h-full max-w-2xl mx-auto w-full">
  <div bind:this={scrollEl} class="flex-1 overflow-y-auto px-4 py-6">
    {#each turns as turn, i (i)}
      <ChatTurn {turn} />
    {/each}
    {#if isStreaming && pendingTutorText}
      <ChatTurn turn={{ speaker: 'tutor', text: pendingTutorText }} streaming />
    {/if}
  </div>

  <form
    onsubmit={submit}
    class="border-t border-(--color-muted)/20 p-4 flex items-end gap-2"
  >
    <textarea
      bind:value={input}
      onkeydown={onKey}
      rows="2"
      placeholder="Skriv på spanska... (försök själv först)"
      disabled={isStreaming}
      class="flex-1 px-4 py-3 rounded-xl border border-(--color-muted)/30 bg-(--color-bg) focus:outline-none focus:border-(--color-accent) resize-none disabled:opacity-50"
    ></textarea>
    <div class="flex flex-col gap-2 items-end">
      <button
        type="submit"
        disabled={isStreaming || input.trim().length === 0}
        class="px-5 py-3 rounded-xl bg-(--color-accent) text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Skicka
      </button>
      <PushToTalk
        disabled={isStreaming}
        onTranscript={(text) => onSend(text)}
      />
      <button
        type="button"
        onclick={onFinish}
        disabled={isStreaming}
        class="px-5 py-2 rounded-xl text-xs text-(--color-muted) hover:text-(--color-ink) disabled:opacity-40"
      >
        Klar för idag
      </button>
    </div>
  </form>
</div>
