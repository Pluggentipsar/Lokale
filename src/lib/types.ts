export type Speaker = 'student' | 'tutor';

export type Engagement = 'passive' | 'active' | 'constructive';

export type NextMove =
  | 'continue'
  | 'hint'
  | 'worked_example'
  | 'check_understanding';

export interface TutorMeta {
  target_items: string[];
  observed_errors: string[];
  engagement: Engagement;
  next_move: NextMove;
}

export interface Turn {
  speaker: Speaker;
  text: string;
  meta?: TutorMeta;
}

export interface Scenario {
  id: string;
  title: string;
  level: string;
  estimated_minutes: number;
  setting: string;
  tutor_role: string;
  opening_line: string;
  success_criteria: string[];
  target_items: Array<{ ref: string; lemmas?: string[]; note?: string; examples?: string[] }>;
  stretch_items?: Array<{ ref: string; trigger?: string }>;
  branches?: Array<{ when: string; barista_followups?: string[] }>;
  exit_signals: string[];
  notes_for_tutor: string;
}

export interface SessionContext {
  sessionId: number;
  scenario: Scenario;
  goal: string;
  selfRating: number;
  turns: Turn[];
}

export interface OllamaStatus {
  ok: boolean;
  reachable: boolean;
  modelAvailable: boolean;
  modelName: string;
  message: string;
}
