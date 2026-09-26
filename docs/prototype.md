# Local behaviour and boundaries

See README.md for the current interaction model, asset paths, and commands.

Authoritative local calculations are in `src/game/bidding.ts` and `src/game/round.ts`. Auction calls must be on-turn and strictly higher, equal/lower bids are ignored, three passes finish an auction with a bid, and four opening passes return to waiting. Both the UI and auction state validate bid order. A sample opponent raises once at the lowest legal value so the local user can experience a second bidding turn.

The called card is owned by exactly one seat in the sample deal. Suggestions skip cards the declarer holds. The first lead is the next clockwise seat, as specified by the user. Players follow suit; trick resolution accounts for trump. After a hold and collection animation, one trick is added once and the target calculation may end the round early. The dealer rotates clockwise with the actual seating order on Play again.

No final trump-leading restrictions, wash criteria, remote networking, Telegram sharing, identity verification, backend, or AI strategy is included. Leaderboard entries are sample data and do not change after local rounds. Rules use the confirmed user specifications plus the brief overview linked from the rules page: https://en.wikipedia.org/wiki/Singaporean_bridge .

Tests cover all bid boundaries including no trump, invalid auction turns, passes, hand ordering, partner suggestions, trick winners, target thresholds, PNG loading, seat removal/refill, dealer permissions, clockwise first lead, stable square/circle dimensions, rules navigation, and early ending on 390px and 430px layouts.
