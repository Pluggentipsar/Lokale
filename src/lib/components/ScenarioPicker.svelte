<script lang="ts">
  import type { Scenario } from '$lib/types';

  let {
    scenarios,
    onSelect
  }: {
    scenarios: Scenario[];
    onSelect: (s: Scenario) => void;
  } = $props();

  type Kind = 'roleplay' | 'writing';
  let activeKind = $state<Kind>('roleplay');

  const groups = $derived.by(() => {
    const g: Record<Kind, Record<string, Scenario[]>> = {
      roleplay: {},
      writing: {}
    };
    for (const s of scenarios) {
      const kind: Kind = s.activity_type === 'writing' ? 'writing' : 'roleplay';
      (g[kind][s.level] ??= []).push(s);
    }
    return g;
  });

  const currentLevels = $derived(Object.keys(groups[activeKind]).sort());
  const counts = $derived({
    roleplay: Object.values(groups.roleplay).flat().length,
    writing: Object.values(groups.writing).flat().length
  });

  const labelFor = (k: Kind) =>
    k === 'roleplay' ? 'Rollspel' : 'Skriva';
</script>

<div class="max-w-2xl mx-auto p-6 mt-8">
  <h2 class="font-serif text-2xl mb-1">Vad ska vi göra idag?</h2>
  <p class="text-sm text-(--color-muted) mb-6">
    Välj en aktivitet. Rollspel = prata; Skriva = en kort text med riktad feedback.
  </p>

  <div class="flex gap-2 mb-6 border-b border-(--color-muted)/15">
    {#each ['roleplay', 'writing'] as kind}
      {@const k = kind as Kind}
      <button
        type="button"
        onclick={() => (activeKind = k)}
        class="px-4 py-2 -mb-px border-b-2 transition text-sm
          {activeKind === k
            ? 'border-(--color-accent) text-(--color-ink) font-medium'
            : 'border-transparent text-(--color-muted) hover:text-(--color-ink)'}"
      >
        {labelFor(k)} <span class="text-xs opacity-70">({counts[k]})</span>
      </button>
    {/each}
  </div>

  <div class="space-y-8">
    {#each currentLevels as level}
      <section>
        <h3 class="font-mono text-xs uppercase tracking-wider text-(--color-muted) mb-3">{level}</h3>
        <ul class="grid gap-3">
          {#each groups[activeKind][level] as s}
            <li>
              <button
                type="button"
                onclick={() => onSelect(s)}
                class="w-full text-left p-5 rounded-2xl border border-(--color-muted)/20 hover:border-(--color-accent) hover:bg-(--color-warm) transition"
              >
                <div class="flex items-center justify-between mb-1">
                  <span class="font-serif text-lg">{s.title}</span>
                  <span class="text-xs font-mono text-(--color-muted)">{s.estimated_minutes} min</span>
                </div>
                <p class="text-sm text-(--color-muted)">{s.setting}</p>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}

    {#if currentLevels.length === 0}
      <p class="text-sm text-(--color-muted)">Inga aktiviteter av denna typ ännu.</p>
    {/if}
  </div>
</div>
