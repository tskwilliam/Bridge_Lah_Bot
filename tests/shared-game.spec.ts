import { expect, test } from '@playwright/test';
import { applySharedAction, advanceSharedGame, newSharedGame, sharedView, type SharedPlayer } from '../src/game/shared';
import { legalCards } from '../src/game/round';

const players: SharedPlayer[] = ['one', 'two', 'three', 'four'].map((id, index) => ({ id, username: `@${id}`, initials: String(index + 1) }));

test('one server deal gives four private hands and one clockwise trick', () => {
  let now = 100_000;
  let game = newSharedGame('game-1', -1001234, players[0], { breakTrump: false, reshuffleEnabled: false, reshuffleThreshold: 4 }, now);
  for (const player of players.slice(1)) game = applySharedAction(game, player.id, { type: 'join', player }, ++now);
  expect(() => applySharedAction(game, players[1].id, { type: 'start' }, ++now)).toThrow('Only the dealer');
  game = applySharedAction(game, players[0].id, { type: 'start' }, ++now);
  expect(game.hands.map(hand => hand.length)).toEqual([13, 13, 13, 13]);
  expect(new Set(game.hands.flat().map(card => card.id)).size).toBe(52);
  for (let seat = 0; seat < 4; seat++) {
    const view = sharedView(game, players[seat].id);
    expect(view.seats[0]?.id).toBe(players[seat].id);
    expect(view.cards).toEqual(game.hands[seat]);
    expect(view).not.toHaveProperty('hands');
  }
  game = applySharedAction(game, players[0].id, { type: 'bid', bid: { level: 1, suit: 'clubs' } }, ++now);
  for (const player of players.slice(1)) game = applySharedAction(game, player.id, { type: 'bid', bid: null }, ++now);
  expect(game.phase).toBe('partner');
  game = applySharedAction(game, players[0].id, { type: 'partner', card: game.partner }, ++now);
  expect(game.playTurn).toBe(1);
  for (let seat = 1; seat <= 4; seat++) {
    const current = seat % 4;
    const card = legalCards(game.hands[current], game.plays)[0];
    expect(() => applySharedAction(game, players[(current + 1) % 4].id, { type: 'play', cardId: card.id }, ++now)).toThrow('not your turn');
    game = applySharedAction(game, players[current].id, { type: 'play', cardId: card.id }, ++now);
  }
  expect(game.trickStatus).toBe('holding');
  game = advanceSharedGame(game, now + 2200);
  expect(game.trickStatus).toBe('collecting');
  game = advanceSharedGame(game, now + 2950);
  expect(game.counts.reduce((sum, value) => sum + value, 0)).toBe(1);
  expect(game.plays).toHaveLength(0);
});
