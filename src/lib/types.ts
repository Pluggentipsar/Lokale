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

export type ItemType = 'vocab' | 'grammar' | 'pattern';

export interface ItemRecord {
  id: number;
  item_type: ItemType;
  payload: Record<string, unknown>;
  level: string;
  tags: string[];
  source: string | null;
}

export interface ReviewStateNew {
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: 'new' | 'learning' | 'review' | 'relearning';
  last_review: string | null;
  due_at: string;
}

export interface ReviewState extends ReviewStateNew {
  item_id: number;
}

export interface ItemWithState {
  item: ItemRecord;
  state: ReviewState;
}

export interface NoteRecord {
  id: number;
  session_id: number | null;
  created_at: string;
  body: string;
  tags: string[];
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
  target_items: Array<ScenarioTargetItem>;
  stretch_items?: Array<{ ref: string; trigger?: string }>;
  branches?: Array<{ when: string; barista_followups?: string[] }>;
  exit_signals: string[];
  notes_for_tutor: string;
}

export interface ScenarioTargetItem {
  ref: string;
  lemmas?: string[];
  note?: string;
  examples?: string[];
}

export interface SessionContext {
  sessionId: number;
  scenario: Scenario;
  goal: string;
  selfRating: number;
  turns: Turn[];
  /** items som ingår denna session, med tutor-prompt-id (item:NN). */
  sessionItems: ItemWithState[];
}

export interface OllamaStatus {
  ok: boolean;
  reachable: boolean;
  modelAvailable: boolean;
  modelName: string;
  message: string;
}

