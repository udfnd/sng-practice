import type { Card } from '@/types';
import { createFullDeckEncoded, fromEncoded } from './card';
import { type PrngState, nextInt, seedFromString, generateRandomSeed } from './prng';

export interface Deck {
  /** Cards remaining in the deck (encoded integers). */
  cards: number[];
  /** The seed used for this deck's shuffle. */
  seed: string;
}

/**
 * Create and shuffle a new 52-card deck using seeded PRNG.
 * If no seed is provided, a random seed is generated.
 */
export async function createDeck(seed?: string): Promise<Deck> {
  const actualSeed = seed ?? generateRandomSeed();
  const state = await seedFromString(actualSeed);
  const cards = createFullDeckEncoded();
  fisherYatesShuffle(cards, state);
  return { cards, seed: actualSeed };
}

/**
 * Fisher-Yates shuffle (in-place) using seeded PRNG.
 * Produces a uniformly random permutation.
 */
function fisherYatesShuffle(arr: number[], state: PrngState): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = nextInt(state, i + 1);
    const temp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = temp;
  }
}

/**
 * Deal one card from the deck.
 * Returns the Card object and removes it from the deck.
 * Throws if deck is empty.
 */
export function dealOne(deck: Deck): Card {
  const encoded = deck.cards.pop();
  if (encoded === undefined) {
    throw new Error('Deck is empty — cannot deal.');
  }
  return fromEncoded(encoded);
}

/**
 * Deal multiple cards from the deck.
 */
export function dealMany(deck: Deck, count: number): Card[] {
  if (deck.cards.length < count) {
    throw new Error(`Not enough cards: need ${count}, have ${deck.cards.length}.`);
  }
  const cards: Card[] = [];
  for (let i = 0; i < count; i++) {
    cards.push(dealOne(deck));
  }
  return cards;
}

/**
 * Number of cards remaining in the deck.
 */
export function cardsRemaining(deck: Deck): number {
  return deck.cards.length;
}
