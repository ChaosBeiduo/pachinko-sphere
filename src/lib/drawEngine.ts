import type { DrawResult } from './types';

/**
 * Fisher-Yates shuffle algorithm to shuffle an array in place.
 * Uses crypto.getRandomValues for better randomness.
 */
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const randomBuffer = new Uint32Array(1);
    crypto.getRandomValues(randomBuffer);
    const j = randomBuffer[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Draws N unique winners from the candidates list.
 * @param candidates The list of candidate names.
 * @param count The number of winners to draw.
 * @returns Object containing winners and remaining candidates.
 */
export function drawWinners(candidates: string[], count: number): DrawResult {
  if (count <= 0) {
    throw new Error('Draw count must be at least 1');
  }
  if (count > candidates.length) {
    throw new Error('Not enough candidates to draw');
  }

  // Shuffle the entire list for fairness
  const shuffled = shuffle(candidates);

  // Pick the first N as winners
  const winners = shuffled.slice(0, count);
  
  // The rest remain
  const remainingCandidates = shuffled.slice(count);

  return {
    winners,
    remainingCandidates
  };
}
