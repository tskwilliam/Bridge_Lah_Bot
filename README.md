# Bridge Lah!

Run `npm install`, then `npm run dev`. Open http://127.0.0.1:5173/ or http://127.0.0.1:5173/dev for the developer gallery.

To try the reshuffle flow with two deliberately weak hands, open http://127.0.0.1:5173/?reshuffleTest=1 and create a game. This local development-only mode enables reshuffling and gives the creator a zero-point hand when they start, then a different zero-point hand after their first reshuffle. Other games keep their normal random deals.

The isolated animation preview is at http://127.0.0.1:5173/dev/reshuffle. Reshuffle sits below a fixed hand. During the two-second shuffle, a card-backed box covers the hand; the new hand appears as the box fades away.

Home has Create game, Leaderboard and Rules buttons, plus Resume game while the current member still has an active local game. All game phases share the same square table and circular playing surface. Every member sees their own profile at the bottom. Before play, the dealer can tap two other profiles to swap their seats. The dealer's hand-drawn × controls remain available throughout the round; kicking a member forfeits and resets the round while preserving the lobby instructions. Any member can Quit using the circular exit button at the top right. Open seats can be filled with sample members, and all four seats must be occupied to start.

Every deal securely shuffles all 52 cards into four unique hands of 13. The local hand is sorted clubs, diamonds, hearts, spades; 2 through A. Select a card, then tap it again to play. Bids strictly increase by level and suit, with no trump after spades. Each turn defaults to the lowest legal bid. Sample opponents make one minimum raise and then pass. Three passes after a bid end the auction. Four opening passes return to the lobby. The completed trick stays visible for 2.2 seconds before its collection animation begins.

Partner selection suggests the highest card in the winning suit absent from the declarer's hand. For no trump, suggestions start with spades; if an entire preferred suit is held, the next strongest available suit is used. A held card cannot be called. Play begins clockwise from declarer; subsequent trick winners lead. Both pairs' targets, per-player trick counts, clockwise dealer rotation, card collection, and early ending are implemented locally. Break trump is an optional pre-game toggle (off by default). When enabled, a player may lead trump only after trump has won a completed trick, or when their hand contains only trumps. Following suit still takes priority. This applies to local and sample players; no-trump contracts are unaffected.

The dealer can also allow reshuffles for hands whose strength is strictly below a selected threshold from 1 to 5. Jacks, queens, kings, and aces score 1, 2, 3, and 4 points; every card beyond four cards in one suit adds another point. Eligible members see Reshuffle beside their hand during bidding. A request is announced, animated, and starts a newly shuffled auction. Session wins appear before and after rounds and feed the Most wins and Win percentage leaderboard views.

Profiles sit slightly outside the table, with usernames close below their avatars and unhighlighted bids and W session totals on their inward-facing side. Trick counts appear during play with a drawn pile-of-cards symbol; the top count sits to the right of the avatar. The lobby centre cycles through the four suit icons, while bidding shows the highest level and suit. Four separate card positions prevent played cards from overlapping. Cards on the table use the original full-resolution images and a clear rank marker; the hand still shows only the card images. Start game and Play another round share the same position and dimensions.

In an ordinary browser, this remains a local sample preview: active players and game progress are stored in that browser's session. Resume appears only for a player still active in a saved game; the game snapshot is discarded after the last player leaves. Local scores and last-started settings stay in the browser.

Inside Telegram, the app uses the Cloudflare Worker in `worker/` as the shared authority. The Worker validates Telegram launch data and group membership, deals the cards once, keeps games and group leaderboards in a Durable Object, and sends updates to all seats over WebSockets. Game links are posted to the group by `@bridge_lah_bot`. The Worker is deployed at `https://bridge-lah.bridge-lah-bot.workers.dev`, with the bot webhook and `/play` direct link configured. The remaining check is a live game with four group members. See [Telegram and Cloudflare setup](docs/telegram-cloudflare.md).

## Artwork and font

- Original cards: `public/cards/<suit>/<initial><rank>.png`; card back: `public/cards/cardback.png`.
- Suit icons: `public/icons/club.png`, `diamond.png`, `heart.png`, `spade.png`.
- Display copies: `public/card-previews`. Regenerate after replacing originals with `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-card-assets.ps1`.
- Font: Bricolage Grotesque, bundled locally in `public/fonts`; SIL Open Font License included as `OFL.txt`. Source: https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque
- Original PNGs are untouched. The overlapping hand displays the card images without additional rank or suit tags. Jokers are preserved but excluded from the 52-card game.

## Main design files

- `src/styles/tokens.css`: colours and bundled font.
- `src/styles/playful.css`: art direction, motion, and square table overrides.
- `src/styles/cards.css` and `src/components/cards/PlayingCard.tsx`: uploaded card designs.
- `src/pages/GameTable.tsx`: table layout and local seating controls.
- `src/game/bidding.ts`, `src/game/round.ts`, and `src/game/deal.ts`: auction, random dealing, hand strength, card sorting, suggestions, trick results, and targets.
- `src/hooks/useTablePreview.ts` and `src/game/memory.ts`: resumable local game state, active membership, per-player settings, and sample opponents.
- `src/LiveApp.tsx`, `src/hooks/useLiveTable.ts`, and `src/game/shared.ts`: Telegram UI connection and authoritative game rules.
- `worker/index.ts`, `worker/room.ts`, and `worker/telegram.ts`: bot webhook, shared game storage, WebSockets, and Telegram validation.

## Checks

`npm run typecheck`, `npm run build`, `npm run worker:check`, and `npm run test:ui` (preview server and Chrome required).

In Chrome, press F12 then Ctrl+Shift+M to preview 390 × 844 or 430 × 932. Animations respect reduced-motion preferences.
