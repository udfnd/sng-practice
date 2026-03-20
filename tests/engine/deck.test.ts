import { describe, it, expect } from 'vitest';
import { createDeck, dealOne, dealMany, cardsRemaining } from '@/engine/deck';

describe('Deck', () => {
  it('should create a deck with 52 cards', async () => {
    const deck = await createDeck('deck-test-seed');
    expect(cardsRemaining(deck)).toBe(52);
  });

  it('should contain all 52 unique cards', async () => {
    const deck = await createDeck('unique-test');
    const unique = new Set(deck.cards);
    expect(unique.size).toBe(52);
    for (let i = 0; i < 52; i++) {
      expect(unique.has(i)).toBe(true);
    }
  });

  it('should shuffle cards (not in original order)', async () => {
    const deck = await createDeck('shuffle-test');
    const isIdentical = deck.cards.every((c, i) => c === i);
    // Extremely unlikely (1/52!) that shuffle produces identity permutation
    expect(isIdentical).toBe(false);
  });

  it('should produce deterministic shuffle from same seed', async () => {
    const deck1 = await createDeck('determinism');
    const deck2 = await createDeck('determinism');
    expect(deck1.cards).toEqual(deck2.cards);
  });

  it('should produce different shuffles from different seeds', async () => {
    const deck1 = await createDeck('seed-alpha');
    const deck2 = await createDeck('seed-beta');
    expect(deck1.cards).not.toEqual(deck2.cards);
  });

  it('should record the seed used', async () => {
    const deck = await createDeck('my-seed');
    expect(deck.seed).toBe('my-seed');
  });

  it('should generate a random seed when none provided', async () => {
    const deck = await createDeck();
    expect(deck.seed).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('dealOne', () => {
  it('should deal a valid card', async () => {
    const deck = await createDeck('deal-test');
    const card = dealOne(deck);
    expect(card.encoded).toBeGreaterThanOrEqual(0);
    expect(card.encoded).toBeLessThanOrEqual(51);
    expect(card.suit).toBeDefined();
    expect(card.rank).toBeGreaterThanOrEqual(2);
    expect(card.rank).toBeLessThanOrEqual(14);
  });

  it('should reduce deck size by 1', async () => {
    const deck = await createDeck('reduce-test');
    dealOne(deck);
    expect(cardsRemaining(deck)).toBe(51);
  });

  it('should throw when deck is empty', async () => {
    const deck = await createDeck('empty-test');
    // Deal all 52
    for (let i = 0; i < 52; i++) {
      dealOne(deck);
    }
    expect(() => dealOne(deck)).toThrow('Deck is empty');
  });
});

describe('dealMany', () => {
  it('should deal the requested number of cards', async () => {
    const deck = await createDeck('many-test');
    const cards = dealMany(deck, 5);
    expect(cards).toHaveLength(5);
    expect(cardsRemaining(deck)).toBe(47);
  });

  it('should deal unique cards', async () => {
    const deck = await createDeck('unique-deal');
    const cards = dealMany(deck, 10);
    const encodedSet = new Set(cards.map((c) => c.encoded));
    expect(encodedSet.size).toBe(10);
  });

  it('should throw when not enough cards', async () => {
    const deck = await createDeck('insufficient');
    dealMany(deck, 50);
    expect(() => dealMany(deck, 5)).toThrow('Not enough cards');
  });
});

describe('Deck determinism across multiple operations', () => {
  it('should deal identical cards from two decks with same seed', async () => {
    const deck1 = await createDeck('replay-seed');
    const deck2 = await createDeck('replay-seed');

    const hand1 = dealMany(deck1, 9); // 2 hole + 5 community + 2 burn
    const hand2 = dealMany(deck2, 9);

    for (let i = 0; i < 9; i++) {
      expect(hand1[i]!.encoded).toBe(hand2[i]!.encoded);
    }
  });
});
