# Recurring price preview shows 2x on the room page

## Findings (no code changed)

### 1. Where the preview price is computed

`src/routes/sali.$slug.tsx`, in the `summary` memo (~line 668):

```
const dayTotal = sorted.reduce(
  (sum, s) => sum + getPriceForSlot(ds.date, s, pricing),
  0,
);
```

`sorted` is the list of selected **30-minute** slot keys. `getPriceForSlot` (line 144) returns `getPriceForSlotDetailed(...).price`, and that helper (line 109) returns:

```
price: Number(winner?.price_per_hour ?? 0)
```

i.e. the raw **hourly** rate — with no conversion to the 30-minute slot granularity.

### 2. Trace for 13:00-14:00 at 90 RON/h

- `SLOT_GRANULARITY_MINUTES = 30`, so the selection is 2 slots: `13:00`, `13:30`.
- Each slot contributes `90` (the full hourly rate).
- `dayTotal = 90 + 90 = 180`, `summary.total = 180`, displayed as "Total 180 RON".
- Correct value: `2 x (90 x 30/60) = 90`.

### 3. Which of the two mistakes it is

It charges `price_per_hour` per 30-minute segment instead of `price_per_hour * 0.5`. Equivalently, each 30-minute slot is billed as a full hour. `summary.totalHours` is likewise a *slot count*, not hours (the UI compensates elsewhere by multiplying by `SLOT_GRANULARITY_MINUTES`), but the money math does not compensate.

### 4. "Preț lunar" / "Luna curentă"

Same doubled number propagated. In the recurring preview block (~line 1462) each occurrence date adds `summary.total` into `monthMap`:

```
monthMap.set(key, (monthMap.get(key) ?? 0) + summary.total);
```

So 5 occurrences x 180 = 900 instead of 5 x 90 = 450, and "Luna curentă" is the same sum restricted to the start month. There is no second bug — one doubled per-slot price feeds everything, including the `total` passed forward in the URL to `/rezerva`.

### 5. The checkout / confirmation side is correct

`src/routes/rezerva.$slug.tsx` has its own copy of the helpers (lines 155-168) which **do** prorate:

```
return r ? (Number(r.price_per_hour) * SLOT_GRANULARITY_MINUTES) / 60 : 0;
```

and the actual amounts written to the database come from the `create_booking` / `create_recurring_booking` RPCs (server-side). So only the preview in `sali.$slug.tsx` is wrong.

## Proposed fix

Single-line change in `src/routes/sali.$slug.tsx`, `getPriceForSlotDetailed`:

```
price: winner ? (Number(winner.price_per_hour) * SLOT_GRANULARITY_MINUTES) / 60 : 0,
```

This matches the `rezerva.$slug.tsx` helper exactly, and fixes `summary.total`, "Preț lunar", "Luna curentă", and the `total` handed to the checkout URL in one place.

### One decision to confirm

The slot-grid tooltip (~line 1148) currently shows `${slotPricing.price} RON · ${label}` for a hovered 30-minute cell. After the fix that tooltip would read `45 RON · zi` (price of that half-hour) instead of `90 RON · zi` (hourly rate). Options:

- A: leave it using the new prorated value (45 RON for a half-hour cell) — consistent, but reads like a cheaper rate.
- B: keep the tooltip showing the hourly rate, labelled `90 RON/oră · zi`.

Default: B, since the tooltip communicates a rate, not a charge.
