<script lang="ts">
  import {
    Recorder,
    transcribe,
    loadVoiceSettings,
    voiceAvailability
  } from '$lib/api/voice';

  let {
    disabled = false,
    onTranscript
  }: {
    disabled?: boolean;
    onTranscript: (text: string) => void;
  } = $props();

  let recorder = new Recorder();
  let recording = $state(false);
  let processing = $state(false);
  let error = $state<string | null>(null);
  let available = $state<boolean | null>(null);

  $effect(() => {
    voiceAvailability().then((a) => (available = a.whisper));
  });

  async function start() {
    if (disabled || processing) return;
    error = null;
    const settings = loadVoiceSettings();
    if (!settings.whisperModelPath) {
      error = 'Lägg till whisper-modellens sökväg i inställningar först.';
      return;
    }
    try {
      await recorder.start();
      recording = true;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Mikrofon-åtkomst nekad?';
    }
  }

  async function stop() {
    if (!recording) return;
    recording = false;
    processing = true;
    try {
      const blob = await recorder.stop();
      const settings = loadVoiceSettings();
      const text = await transcribe(blob, settings);
      if (text.trim()) onTranscript(text.trim());
      else error = 'Inget hördes. Försök igen.';
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      error = msg;
    } finally {
      processing = false;
    }
  }
</script>

<div class="flex flex-col items-end gap-1">
  {#if available === false}
    <span class="text-xs text-(--color-muted)">(rösttranskription ej installerad)</span>
  {:else}
    <button
      type="button"
      onmousedown={start}
      onmouseup={stop}
      onmouseleave={stop}
      ontouchstart={start}
      ontouchend={stop}
      disabled={disabled || processing}
      class="px-4 py-3 rounded-xl border-2 transition select-none
        {recording
          ? 'bg-(--color-accent) border-(--color-accent) text-white'
          : 'border-(--color-muted)/30 text-(--color-ink) hover:border-(--color-accent)'}
        disabled:opacity-40 disabled:cursor-not-allowed"
      title="Håll inne för att tala"
    >
      {#if processing}
        ...
      {:else if recording}
        ● tala nu
      {:else}
        🎤
      {/if}
    </button>
  {/if}
  {#if error}
    <span class="text-xs text-red-500 max-w-xs text-right">{error}</span>
  {/if}
</div>
