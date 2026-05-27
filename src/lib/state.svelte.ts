/**
 * Global app-state med Svelte 5 runes. Hålls medvetet litet i M0 —
 * en state machine över sessionsfaser och en lista turns.
 */

import type { OllamaStatus, SessionContext, Turn } from '$lib/types';

export type Phase = 'init' | 'open' | 'chat' | 'close' | 'done';

export const MODEL_NAME = 'gemma3:4b';

interface AppState {
  phase: Phase;
  ollama: OllamaStatus | null;
  session: SessionContext | null;
  pendingTutorText: string;
  isStreaming: boolean;
  closingQuestion: string;
}

function createState() {
  let phase = $state<Phase>('init');
  let ollama = $state<OllamaStatus | null>(null);
  let session = $state<SessionContext | null>(null);
  let pendingTutorText = $state<string>('');
  let isStreaming = $state<boolean>(false);
  let closingQuestion = $state<string>('');

  return {
    get phase() {
      return phase;
    },
    set phase(v: Phase) {
      phase = v;
    },
    get ollama() {
      return ollama;
    },
    set ollama(v: OllamaStatus | null) {
      ollama = v;
    },
    get session() {
      return session;
    },
    set session(v: SessionContext | null) {
      session = v;
    },
    get pendingTutorText() {
      return pendingTutorText;
    },
    set pendingTutorText(v: string) {
      pendingTutorText = v;
    },
    get isStreaming() {
      return isStreaming;
    },
    set isStreaming(v: boolean) {
      isStreaming = v;
    },
    get closingQuestion() {
      return closingQuestion;
    },
    set closingQuestion(v: string) {
      closingQuestion = v;
    },
    appendTurn(t: Turn) {
      if (!session) return;
      session.turns = [...session.turns, t];
    }
  };
}

export const app = createState();
