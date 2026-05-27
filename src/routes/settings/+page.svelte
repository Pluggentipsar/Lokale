<script lang="ts">
  import { onMount } from 'svelte';
  import { ensureProfile, updateProfile } from '$lib/db';
  import {
    loadVoiceSettings,
    saveVoiceSettings,
    voiceAvailability,
    type VoiceAvailability,
    type VoiceSettings
  } from '$lib/api/voice';

  let displayName = $state('');
  let l1 = $state('sv');
  let targetLevel = $state('A1');
  let saved = $state(false);
  let loading = $state(true);

  let voice = $state<VoiceSettings>(loadVoiceSettings());
  let voiceAvail = $state<VoiceAvailability>({ whisper: false, piper: false });
  let speakAlong = $state(localStorage?.getItem('lokale.speak_along') === '1');

  onMount(async () => {
    const p = await ensureProfile();
    displayName = p.displayName;
    l1 = p.l1;
    targetLevel = p.targetLevel;
    voice = loadVoiceSettings();
    voiceAvail = await voiceAvailability();
    loading = false;
  });

  async function save(e: SubmitEvent) {
    e.preventDefault();
    await updateProfile({ displayName, l1, targetLevel });
    saveVoiceSettings(voice);
    localStorage.setItem('lokale.speak_along', speakAlong ? '1' : '0');
    saved = true;
    setTimeout(() => (saved = false), 2000);
  }
</script>

<div class="max-w-xl mx-auto p-6 space-y-6">
  <h2 class="font-serif text-2xl">Inställningar</h2>

  {#if loading}
    <p class="text-(--color-muted)">Laddar...</p>
  {:else}
    <form onsubmit={save} class="space-y-8">
      <section class="space-y-5">
        <h3 class="font-serif text-lg">Du</h3>

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
      </section>

      <section class="space-y-5">
        <h3 class="font-serif text-lg">Röst (frivilligt)</h3>
        <p class="text-sm text-(--color-muted)">
          Compañero kan transkribera dig via <code>whisper-cli</code> och tala via <code>piper</code>.
          Installera dem separat och peka ut modell-filer nedan.
        </p>

        <div class="flex gap-4 text-sm">
          <span>
            whisper:
            <strong class={voiceAvail.whisper ? 'text-(--color-accent)' : 'text-(--color-muted)'}>
              {voiceAvail.whisper ? 'hittad' : 'ej hittad'}
            </strong>
          </span>
          <span>
            piper:
            <strong class={voiceAvail.piper ? 'text-(--color-accent)' : 'text-(--color-muted)'}>
              {voiceAvail.piper ? 'hittad' : 'ej hittad'}
            </strong>
          </span>
        </div>

        <div>
          <label for="wm" class="block text-sm font-medium mb-2">
            Whisper-modellfil (.bin/.gguf)
          </label>
          <input
            id="wm"
            type="text"
            bind:value={voice.whisperModelPath}
            placeholder="/home/.../models/ggml-small-es.bin"
            class="w-full px-4 py-3 rounded-xl border border-(--color-muted)/30 bg-(--color-bg) font-mono text-sm"
          />
        </div>

        <div>
          <label for="pv" class="block text-sm font-medium mb-2">Piper-röstmodell (.onnx)</label>
          <input
            id="pv"
            type="text"
            bind:value={voice.piperVoicePath}
            placeholder="/home/.../voices/es_ES-davefx-medium.onnx"
            class="w-full px-4 py-3 rounded-xl border border-(--color-muted)/30 bg-(--color-bg) font-mono text-sm"
          />
        </div>

        <div>
          <label for="lang" class="block text-sm font-medium mb-2">Språk för transkription</label>
          <select
            id="lang"
            bind:value={voice.language}
            class="w-full px-4 py-3 rounded-xl border border-(--color-muted)/30 bg-(--color-bg)"
          >
            <option value="es">Spanska</option>
            <option value="auto">Auto-detektera</option>
          </select>
        </div>

        <label class="flex items-center gap-3 text-sm">
          <input type="checkbox" bind:checked={speakAlong} class="accent-(--color-accent)" />
          Läs upp tutorns svar (kräver piper)
        </label>
      </section>

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
