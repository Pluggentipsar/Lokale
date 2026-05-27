<script lang="ts">
  import { onMount } from 'svelte';
  import type { ItemWithState, Scenario, Turn } from '$lib/types';
  import { app, MODEL_NAME } from '$lib/state.svelte';
  import { checkOllama, chatStream, extractMeta, type ChatMessage } from '$lib/api/ollama';
  import {
    buildSystemPrompt,
    buildClosingReflectionPrompt,
    buildSessionNotePrompt
  } from '$lib/pedagogy/prompts';
  import { applyReview } from '$lib/pedagogy/fsrs';
  import { ratingsFromMeta } from '$lib/pedagogy/rating';
  import {
    createSession,
    insertEncounter,
    closeSession,
    insertNote,
    ensureProfile,
    ensureItemsForScenario,
    selectDueItems,
    getItemsByRefs,
    listRecentNotes,
    getReviewState,
    updateReviewState,
    type ProfileRecord
  } from '$lib/db';
  import { deriveItemsForScenario, listScenarios } from '$lib/curriculum';
  import { buildIndex, retrieve } from '$lib/rag';

  import OllamaGate from '$lib/components/OllamaGate.svelte';
  import SessionOpen from '$lib/components/SessionOpen.svelte';
  import ChatView from '$lib/components/ChatView.svelte';
  import SessionClose from '$lib/components/SessionClose.svelte';
  import ScenarioPicker from '$lib/components/ScenarioPicker.svelte';

  const scenarios: Scenario[] = listScenarios();
  let scenario = $state<Scenario | null>(null);

  let profile = $state<ProfileRecord | null>(null);

  // Memoiserad index av session-items efter ref för snabb lookup vid meta-uppdatering.
  let itemsByRef = $state<Map<string, ItemWithState>>(new Map());

  onMount(async () => {
    profile = await ensureProfile();
    await runOllamaCheck();
  });

  let indexing = $state(false);
  let indexProgress = $state<{ current: number; total: number } | null>(null);

  async function runOllamaCheck() {
    app.ollama = await checkOllama(MODEL_NAME);
    if (app.ollama.ok) {
      app.phase = 'pick';
      // Kick off curriculum-indexering i bakgrunden. Första sessionen
      // saknar då eventuellt RAG-referenser; nästa har dem. Misslyckas
      // tyst (t.ex. om nomic-embed-text saknas).
      indexing = true;
      buildIndex((current, total) => {
        indexProgress = { current, total };
      })
        .catch((err) => console.warn('Curriculum index build failed:', err))
        .finally(() => {
          indexing = false;
          indexProgress = null;
        });
    }
  }

  function onScenarioPick(s: Scenario) {
    scenario = s;
    app.phase = 'open';
  }

  async function onSessionStart(goal: string, selfRating: number) {
    if (!profile || !scenario) return;
    const currentScenario = scenario;

    // 1. Seeda items för scenariot (idempotent).
    const derived = deriveItemsForScenario(currentScenario);
    await ensureItemsForScenario(derived);

    // 2. Hämta scenariots items med deras review_state.
    const scenarioRefs = derived.map((d) => d.ref);
    const scenarioItems = await getItemsByRefs(scenarioRefs);

    // 3. Komplettera med upp till några due items utanför scenariot
    //    (cross-scenario repetition). Begränsa total mängd så prompten
    //    inte sväller.
    const due = await selectDueItems(20);
    const seenRefs = new Set(scenarioItems.map((i) => i.item.payload['ref'] as string));
    const extra: ItemWithState[] = [];
    for (const d of due) {
      const ref = d.item.payload['ref'] as string;
      if (seenRefs.has(ref)) continue;
      extra.push(d);
      seenRefs.add(ref);
      if (scenarioItems.length + extra.length >= 12) break;
    }
    const sessionItems = [...scenarioItems, ...extra];
    itemsByRef = new Map(
      sessionItems
        .map((iws) => [iws.item.payload['ref'] as string, iws] as const)
        .filter(([ref]) => Boolean(ref))
    );

    const sessionId = await createSession({
      scenarioId: currentScenario.id,
      goal,
      selfRating,
      modelName: MODEL_NAME
    });
    app.session = {
      sessionId,
      scenario: currentScenario,
      goal,
      selfRating,
      turns: [],
      sessionItems
    };
    app.phase = 'chat';

    // Tutorns första turn = scenariots öppningsreplik. Vi låter inte
    // modellen improvisera den — den är pedagogiskt vald.
    const openingTurn: Turn = {
      speaker: 'tutor',
      text: currentScenario.opening_line
    };
    app.appendTurn(openingTurn);
    await insertEncounter({
      sessionId,
      turnIndex: 0,
      speaker: 'tutor',
      text: currentScenario.opening_line
    });
  }

  function assembleChatMessages(turns: Turn[], systemPrompt: string): ChatMessage[] {
    const msgs: ChatMessage[] = [{ role: 'system', content: systemPrompt }];
    for (const t of turns) {
      msgs.push({
        role: t.speaker === 'tutor' ? 'assistant' : 'user',
        content: t.text
      });
    }
    return msgs;
  }

  async function applyMetaToFsrs(meta: NonNullable<Turn['meta']>): Promise<void> {
    const ratings = ratingsFromMeta(meta);
    for (const r of ratings) {
      const item = itemsByRef.get(r.itemRef);
      if (!item) continue;
      const current = await getReviewState(item.item.id);
      if (!current) continue;
      const next = applyReview(current, r.rating);
      await updateReviewState(item.item.id, next);
      // Uppdatera lokal session-state så OLM-vy och statistik är fräscha.
      itemsByRef.set(r.itemRef, {
        item: item.item,
        state: { ...next, item_id: item.item.id }
      });
    }
    if (app.session) {
      app.session.sessionItems = [...itemsByRef.values()];
    }
  }

  async function onStudentSend(text: string) {
    if (!app.session || !profile) return;
    const session = app.session;
    const studentTurn: Turn = { speaker: 'student', text };
    app.appendTurn(studentTurn);

    const turnIndex = session.turns.length - 1;
    await insertEncounter({
      sessionId: session.sessionId,
      turnIndex,
      speaker: 'student',
      text
    });

    const recentNotes = await listRecentNotes(5);

    // RAG: bygg en query från senaste student-yttrandet + scenariot, ta top-3.
    // Misslyckas tyst — RAG är bonus.
    let references: Awaited<ReturnType<typeof retrieve>> = [];
    try {
      const query = `${session.scenario.setting} ${text}`;
      references = await retrieve(query, 3);
    } catch (err) {
      console.warn('RAG retrieve failed:', err);
    }

    const systemPrompt = buildSystemPrompt({
      scenario: session.scenario,
      l1: profile.l1,
      targetLevel: profile.targetLevel,
      goal: session.goal,
      sessionItems: session.sessionItems,
      recentNotes,
      references
    });

    const messages = assembleChatMessages(session.turns, systemPrompt);
    app.isStreaming = true;
    app.pendingTutorText = '';
    let raw = '';
    try {
      raw = await chatStream({
        model: MODEL_NAME,
        messages,
        onToken: (delta) => {
          app.pendingTutorText += delta;
        }
      });
    } catch (err) {
      console.error(err);
      raw = '*(Något gick fel i kontakten med modellen. Försök igen.)*';
    } finally {
      app.isStreaming = false;
    }

    const { display, meta } = extractMeta(raw);
    const tutorTurn: Turn = {
      speaker: 'tutor',
      text: display,
      meta: meta ?? undefined
    };
    app.appendTurn(tutorTurn);
    app.pendingTutorText = '';

    await insertEncounter({
      sessionId: session.sessionId,
      turnIndex: session.turns.length - 1,
      speaker: 'tutor',
      text: display,
      targetItems: meta?.target_items,
      observedErrors: meta?.observed_errors,
      engagement: meta?.engagement ?? null,
      nextMove: meta?.next_move ?? null
    });

    if (meta) {
      await applyMetaToFsrs(meta);
    }
  }

  function transcriptFor(turns: Turn[]): string {
    return turns
      .map((t) => `${t.speaker === 'tutor' ? 'TUTOR' : 'ELEV'}: ${t.text}`)
      .join('\n');
  }

  async function onFinish() {
    if (!app.session || !profile) return;
    app.phase = 'close';
    const prompt = buildClosingReflectionPrompt(transcriptFor(app.session.turns), profile.l1);
    try {
      const q = await chatStream({
        model: MODEL_NAME,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        onToken: () => {}
      });
      app.closingQuestion = q.trim() || fallbackClosingQuestion();
    } catch {
      app.closingQuestion = fallbackClosingQuestion();
    }
  }

  function fallbackClosingQuestion(): string {
    return 'Vad var en sak du sa idag som du inte hade kunnat säga förra veckan?';
  }

  async function onCloseSubmit(reflection: string) {
    if (!app.session) return;
    const session = app.session;
    await closeSession(session.sessionId, reflection);

    const notePrompt = buildSessionNotePrompt(transcriptFor(session.turns), session.goal);
    try {
      const note = await chatStream({
        model: MODEL_NAME,
        messages: [{ role: 'user', content: notePrompt }],
        temperature: 0.3,
        onToken: () => {}
      });
      if (note.trim()) {
        await insertNote(session.sessionId, note.trim(), ['session_summary']);
      }
    } catch {
      /* not critical */
    }

    app.phase = 'done';
  }

  function restart() {
    app.session = null;
    app.pendingTutorText = '';
    app.closingQuestion = '';
    itemsByRef = new Map();
    scenario = null;
    app.phase = 'pick';
  }
</script>

{#if app.phase === 'init' || (app.ollama && !app.ollama.ok)}
  <OllamaGate status={app.ollama} onRetry={runOllamaCheck} />
{:else if app.phase === 'pick'}
  <ScenarioPicker {scenarios} onSelect={onScenarioPick} />
  {#if indexing}
    <p class="text-center text-xs text-(--color-muted) mt-4">
      Bygger curriculum-index{indexProgress
        ? ` (${indexProgress.current}/${indexProgress.total})`
        : '...'}
    </p>
  {/if}
{:else if app.phase === 'open' && scenario}
  <SessionOpen {scenario} onStart={onSessionStart} />
{:else if app.phase === 'chat' && app.session}
  <ChatView
    turns={app.session.turns}
    pendingTutorText={app.pendingTutorText}
    isStreaming={app.isStreaming}
    onSend={onStudentSend}
    onFinish={onFinish}
  />
{:else if app.phase === 'close'}
  <SessionClose
    question={app.closingQuestion || 'Vad lärde du dig idag?'}
    onSubmit={onCloseSubmit}
  />
{:else if app.phase === 'done'}
  <div class="max-w-xl mx-auto p-6 mt-12 text-center">
    <h2 class="font-serif text-2xl mb-3">Tack för idag.</h2>
    <p class="text-(--color-muted) mb-6">Vi ses snart igen.</p>
    <div class="flex gap-3 justify-center">
      <button
        onclick={restart}
        class="px-5 py-3 rounded-xl bg-(--color-accent) text-white font-medium"
      >
        Ny session
      </button>
      <a
        href="/progress"
        class="px-5 py-3 rounded-xl border border-(--color-muted)/30 text-(--color-ink) font-medium"
      >
        Se progress
      </a>
    </div>
  </div>
{/if}
