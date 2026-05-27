/**
 * Översätter tutorns metadata till en FSRS-rating per item.
 *
 * Heuristik:
 * - Item finns i observed_errors → Again (1)
 * - Item finns i target_items, engagement=passive → Hard (2)
 * - Item finns i target_items, engagement=active → Good (3)
 * - Item finns i target_items, engagement=constructive → Easy (4)
 *
 * Fel överstyr engagemang: om eleven gjorde fel på itemet räknas det
 * som lapse oavsett hur engagerade de var i övrigt.
 *
 * Detta är medvetet förenklat. Förfinas i M3+ när vi har data att
 * kalibrera mot.
 */

import type { FsrsRating } from './fsrs';
import type { Engagement, TutorMeta } from '$lib/types';

export interface RatingForItem {
  itemRef: string;
  rating: FsrsRating;
  isLapse: boolean;
}

export function ratingsFromMeta(meta: TutorMeta): RatingForItem[] {
  const errorRefs = new Set(meta.observed_errors.map(stripErrorSubpath));

  return meta.target_items.map((ref) => {
    const isLapse = errorRefs.has(ref) || errorRefs.has(stripErrorSubpath(ref));
    if (isLapse) {
      return { itemRef: ref, rating: 'again', isLapse: true };
    }
    return {
      itemRef: ref,
      rating: ratingFromEngagement(meta.engagement),
      isLapse: false
    };
  });
}

function ratingFromEngagement(e: Engagement): FsrsRating {
  switch (e) {
    case 'passive':
      return 'hard';
    case 'active':
      return 'good';
    case 'constructive':
      return 'easy';
  }
}

/**
 * "ser_estar/location" → "ser_estar". Vi matchar errors mot item-refs
 * på grov nivå eftersom tutorn skriver tagg-stil ("ser_estar/location")
 * medan item-refs är "grammar:ser_estar".
 */
function stripErrorSubpath(s: string): string {
  return s.split('/')[0];
}
