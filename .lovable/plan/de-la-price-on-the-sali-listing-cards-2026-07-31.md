# "De la" price on the /sali listing cards

Show a "starting from" hourly price on each room card in the rooms listing, sourced from the active pricing rules, with a clean fallback when a room has no pricing.

## What changes for the user

- Each card on /sali shows `de la 80 RON/oră` instead of the current price range.
- Rooms with no active pricing rules show `Preț la cerere`.
- Prices show no trailing decimals (80, not 80.00).
- If the price lookup fails entirely, cards still render — they just fall back to `Preț la cerere`.
- Everything else on the card (photo, name, address, inactive badge, "Vezi detalii") stays as it is.

## How it works

1. On the /sali page, after the room list loads, run a single query against the `active_pricing_rules` view filtered with `.in("room_id", ids)` for all listed rooms, selecting `room_id, price_per_hour, currency, is_active`.
2. Reduce the rows client-side into a map `room_id -> { minPrice, currency }`, keeping the lowest `price_per_hour` per room and its currency (default `RON`).
3. The whole fetch is wrapped in try/catch; on error or empty result the map stays empty and every card falls back to `Preț la cerere`.
4. `RoomCard` receives an optional `priceFrom?: { min: number; currency: string } | null` prop and renders:
   - given a value: `de la {formatted} {currency}` + `/oră`
   - otherwise: `Preț la cerere`
   The existing `priceMin/priceMax` fields on `Room` stay untouched so the home page and favorites page keep their current behaviour.

## Scope

- `src/routes/sali.index.tsx` — grouped price query + map, pass prop to cards.
- `src/components/room-card.tsx` — new optional prop and price rendering only.

No changes to dependencies, route tree, search params, other routes, or the shared `Room` type. No security or dependency work.
