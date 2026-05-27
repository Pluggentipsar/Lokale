<script lang="ts">
  import { onMount } from 'svelte';
  import type { Scenario, Turn } from '$lib/types';
  import { app, MODEL_NAME } from '$lib/state.svelte';
  import { checkOllama, chatStream, extractMeta, type ChatMessage } from '$lib/api/ollama';
  import {
    buildSystemPrompt,
    buildClosingReflectionPrompt,
    buildSessionNotePrompt
  } from '$lib/pedagogy/prompts';
  import {
    createSession,
    insertEncounter,
    closeSession,
    insertNote,
    ensureProfile
  } from '$lib/db';

  import OllamaGate from '$lib/components/OllamaGate.svelte';
  import SessionOpen from '$lib/components/SessionOpen.svelte';
  import ChatView from '$lib/components/ChatView.svelte';
  import SessionClose from '$lib/components/SessionClose.svelte';

  // M0: ett hårdkodat scenario. M1 introducerar urval.
  import cafeScenarioRaw from '../../curriculum/scenarios/cafe_a1.json?raw';
  const scenario: Scenario = JSON.parse(cafeScenarioRaw);

  let profile = $state<{ l1: string; targetLevel: string } | null>(null);

  onMount(async () => {
    profile = await ensureProfile();
    await runOllamaCheck();
  });

  async function runOllamaCheck() {
    app.ollama = await checkOllama(MODEL_NAME);
    if (app.ollama.ok) {
      app.phase = 'open';
    }
  }

  async function onSessionStart(goal: string, selfRating: number) {
    if (!profile) return;
    const sessionId = await createSession({
      scenarioId: scenario.id,
      goal,
      selfRating,
      modelName: MODEL_NAME
    });
    app.session = {
      sessionId,
      scenario,
      goal,
      selfRating,
      turns: []
    };
    app.phase = 'chat';

    // Tutorns första turn = scenariots öppningsreplik. Vi låter inte
    // modellen improvisera den — den är pedagogiskt vald.
    const openingTurn: Turn = {
      speaker: 'tutor',
      text: scenario.opening_line
    };
    app.appendTurn(openingTurn);
    await insertEncounter({
      sessionId,
      turnIndex: 0,
      speaker: 'tutor',
      text: scenario.opening_line
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

    const systemPrompt = buildSystemPrompt({
      scenario: session.scenario,
      l1: profile.l1,
      targetLevel: profile.targetLevel,
      goal: session.goal,
      dueItems: [],
      recentNotes: []
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
  }

  function transcriptFor(turns: Turn[]): string {
    return turns
      .map((t) => `${t.speaker === 'tutor' ? 'TUTOR' : 'ELEV'}: ${t.text}`)
      .join('\n');
  }

  async function onFinish() {
    if (!app.session) return;
    app.phase = 'close';
    // Be modellen formulera en reflektionsfråga utifrån just denna session.
    const prompt = buildClosingReflectionPrompt(transcriptFor(app.session.turns));
    try {
      const q = await chatStream({
        model: MODEL_NAME,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        onToken: () => {
          /* ignorera streaming för denna lilla generation */
        }
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

    // Be modellen skriva en intern note. Tyst, ej visad i M0.
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
      // Inte kritiskt om note-genereringen misslyckas.
    }

    app.phase = 'done';
  }

  function restart() {
    app.session = null;
    app.pendingTutorText = '';
    app.closingQuestion = '';
    app.phase = 'open';
  }
</script>

{#if app.phase === 'init' || (app.ollama && !app.ollama.ok)}
  <OllamaGate status={app.ollama} onRetry={runOllamaCheck} />
{:else if app.phase === 'open'}
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
    <button
      onclick={restart}
      class="px-5 py-3 rounded-xl bg-(--color-accent) text-white font-medium"
    >
      Ny session
    </button>
  </div>
{/if}
