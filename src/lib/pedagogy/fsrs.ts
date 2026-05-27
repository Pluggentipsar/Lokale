/**
 * FSRS-omslag. Vi använder ts-fsrs-biblioteket men exponerar bara den
 * lilla yta vi behöver, så att övrig kod inte måste känna till FSRS-
 * detaljerna.
 *
 * Vår "rating" härleds ur tutorns metadata (engagement + observed_errors)
 * — eleven betygsätter aldrig sig själv explicit. Se rating.ts.
 */

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card,
  type FSRS,
  type Grade
} from 'ts-fsrs';

import type { ReviewState, ReviewStateNew } from '$lib/types';

// Vi använder defaults. Senare kan vi optimera dessa per elev från historiken.
const PARAMS = generatorParameters({
  enable_fuzz: true,
  enable_short_term: true
});

let _scheduler: FSRS | null = null;
function scheduler(): FSRS {
  if (!_scheduler) _scheduler = fsrs(PARAMS);
  return _scheduler;
}

/** Ny item som aldrig setts. */
export function newReviewState(): ReviewStateNew {
  const card = createEmptyCard();
  return cardToState(card);
}

function cardToState(card: Card): ReviewStateNew {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: stateFromFsrs(card.state),
    last_review: card.last_review ? card.last_review.toISOString() : null,
    due_at: card.due.toISOString()
  };
}

function stateToCard(s: ReviewState): Card {
  return {
    due: new Date(s.due_at),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    reps: s.reps,
    lapses: s.lapses,
    state: stateToFsrs(s.state),
    last_review: s.last_review ? new Date(s.last_review) : undefined
  } as Card;
}

function stateFromFsrs(n: number): ReviewState['state'] {
  // ts-fsrs: 0=New, 1=Learning, 2=Review, 3=Relearning
  return (['new', 'learning', 'review', 'relearning'] as const)[n] ?? 'new';
}

function stateToFsrs(s: ReviewState['state']): number {
  return { new: 0, learning: 1, review: 2, relearning: 3 }[s];
}

export type FsrsRating = 'again' | 'hard' | 'good' | 'easy';

function ratingToFsrs(r: FsrsRating): Grade {
  return { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy }[r] as Grade;
}

/**
 * Tillämpa en review på existerande state. Returnerar nytt state.
 */
export function applyReview(
  prev: ReviewState,
  rating: FsrsRating,
  reviewAt: Date = new Date()
): ReviewStateNew {
  const card = stateToCard(prev);
  const out = scheduler().next(card, reviewAt, ratingToFsrs(rating));
  return cardToState(out.card);
}

/**
 * "Jag kan det här redan" — eleven övermarkerar något som redan kunnat.
 * Vi gör en Easy-review med ett par dagars elapsed för att skicka
 * intervall framåt utan att ljuga om aktivitet.
 */
export function markKnown(prev: ReviewState): ReviewStateNew {
  return applyReview(prev, 'easy');
}
