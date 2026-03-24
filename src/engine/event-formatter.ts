/**
 * Format GameEvents into human-readable action log strings.
 */

import type { GameEvent, Card } from '@/types';

/**
 * Format a card as a short string, e.g. "Ah", "Kd", "10s".
 */
function formatCard(card: Card): string {
  const rankMap: Record<number, string> = {
    14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: '10',
    9: '9', 8: '8', 7: '7', 6: '6', 5: '5',
    4: '4', 3: '3', 2: '2',
  };
  const suitMap: Record<string, string> = {
    spades: 's', hearts: 'h', diamonds: 'd', clubs: 'c',
  };
  return `${rankMap[card.rank] ?? '?'}${suitMap[card.suit] ?? '?'}`;
}

/**
 * Format a player name from its ID.
 * Player IDs are like "p0", "p1", etc.
 * Names are tracked externally; this uses the raw player name passed in.
 */
function getPlayerLabel(playerId: string, playerNames: Map<string, string>): string {
  return playerNames.get(playerId) ?? playerId;
}

/**
 * Format a GameEvent into a human-readable string for the action log.
 *
 * @param event The game event to format
 * @param playerNames Optional map from playerId to display name
 * @returns Formatted string, or null if the event should not appear in the log
 */
export function formatEvent(
  event: GameEvent,
  playerNames: Map<string, string> = new Map(),
): string | null {
  const p = event.payload;

  switch (p.type) {
    case 'HAND_START': {
      return `--- Hand #${p.handNumber} | Level ${p.blindLevel.level}: ${p.blindLevel.sb}/${p.blindLevel.bb}${p.blindLevel.ante ? ` Ante ${p.blindLevel.ante}` : ''} ---`;
    }

    case 'POST_BLIND': {
      const name = getPlayerLabel(p.playerId, playerNames);
      const blindLabel = p.blindType === 'SB' ? 'SB' : p.blindType === 'BB' ? 'BB' : 'Ante';
      return `${name} posts ${blindLabel} ${p.amount}`;
    }

    case 'DEAL_HOLE':
      // Only log for human player (cards revealed)
      return null;

    case 'DEAL_COMMUNITY': {
      const cards = p.cards.map(formatCard).join(' ');
      const streetLabel = p.street.charAt(0) + p.street.slice(1).toLowerCase();
      return `--- ${streetLabel}: ${cards} ---`;
    }

    case 'PLAYER_ACTION': {
      const name = getPlayerLabel(p.playerId, playerNames);
      switch (p.action) {
        case 'FOLD':
          return `${name} folds`;
        case 'CHECK':
          return `${name} checks`;
        case 'CALL':
          return `${name} calls ${p.amount}`;
        case 'BET':
          return `${name} bets ${p.amount}${p.isAllIn ? ' (all-in)' : ''}`;
        case 'RAISE':
          return `${name} raises to ${p.amount}${p.isAllIn ? ' (all-in)' : ''}`;
        default:
          return null;
      }
    }

    case 'UNCALLED_RETURN': {
      const name = getPlayerLabel(p.playerId, playerNames);
      return `${name} uncalled bet returned: ${p.amount}`;
    }

    case 'AWARD_POT': {
      if (p.payouts.length === 1) {
        const name = getPlayerLabel(p.payouts[0]!.playerId, playerNames);
        return `${name} wins ${p.payouts[0]!.amount}`;
      }
      const parts = p.payouts.map((pw) => `${getPlayerLabel(pw.playerId, playerNames)} ${pw.amount}`);
      return `Split pot: ${parts.join(', ')}`;
    }

    case 'PLAYER_ELIMINATED': {
      const name = getPlayerLabel(p.playerId, playerNames);
      const ordinal = getOrdinal(p.finishPosition);
      return `${name} eliminated (${ordinal})${p.payout > 0 ? ` - wins ${p.payout}` : ''}`;
    }

    case 'BLIND_LEVEL_UP': {
      return `Level up: ${p.sb}/${p.bb}${p.ante ? ` Ante ${p.ante}` : ''}`;
    }

    case 'TOURNAMENT_END': {
      return `=== Tournament Complete ===`;
    }

    case 'SHOWDOWN': {
      if (p.reveals.length === 0) return `--- Showdown ---`;
      const lines: string[] = ['--- Showdown ---'];
      for (const r of p.reveals) {
        const name = getPlayerLabel(r.playerId, playerNames);
        const cards = r.cards.map(formatCard).join(' ');
        const desc = r.handDescription || getHandRankName(r.handRank);
        lines.push(`  ${name}: [${cards}] ${desc}`);
      }
      return lines.join('\n');
    }

    default:
      return null;
  }
}

/**
 * Convert a numeric hand rank to a human-readable name.
 * Hand ranks: 1=Royal Flush .. 10=High Card (lower = better)
 */
function getHandRankName(rank: number): string {
  const names: Record<number, string> = {
    1: 'Royal Flush',
    2: 'Straight Flush',
    3: 'Four of a Kind',
    4: 'Full House',
    5: 'Flush',
    6: 'Straight',
    7: 'Three of a Kind',
    8: 'Two Pair',
    9: 'One Pair',
    10: 'High Card',
  };
  return names[rank] ?? `Rank ${rank}`;
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
function getOrdinal(n: number): string {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffix[(v - 20) % 10] ?? suffix[v] ?? suffix[0]!);
}
