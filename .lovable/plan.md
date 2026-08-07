# Email unic la anularea/suspendarea unei serii recurente de către proprietar

## Ce am verificat în cod

- `src/routes/panou.sali.$id.calendar.tsx`, componenta `BookingDetails`:
  - `recurrenceInfo` (state, liniile 1290-1295) conține `{ total, index, id, frequency }` → id-ul recurenței este `recurrenceInfo.id`.
  - `cancelScope` (linia 1297) are exact trei valori: `"this" | "future" | "suspend"`. Nu există opțiune „anulează toată seria”.
  - `cancelUntilDate` (linia 1298) este data de reluare pentru suspendare.
  - Data apariției curente este `entry.booking_date` (tipul `Entry`, linia 166).
- `performBulkCancel()` (1443-1482) apelează RPC-ul potrivit cu `p_owner_override: true`, setează `ok` și `successMsg`, iar la final face doar `toast` + `onChanged()` + `onClose()`. **Nu există niciun apel către `send-booking-email`** pe această cale.

Confirmare la întrebarea din cerere: `cancelScope === "this"` este exact cazul „doar această apariție” → `reason: "cancelled_one"`. Nu există buton de anulare a întregii serii în acest dialog, deci `"cancelled"` rămâne doar ca fallback.

## Modificarea

Un singur `if (ok)` extins în `performBulkCancel()`, înainte de `toast.success(...)`:

```ts
if (ok) {
  void supabase.functions
    .invoke("send-booking-email", {
      body: {
        type: "recurring-ended",
        recurrenceId: recurrenceInfo.id,
        reason:
          cancelScope === "suspend" ? "suspended"
          : cancelScope === "future" ? "cancelled_future"
          : cancelScope === "this" ? "cancelled_one"
          : "cancelled",
        date: cancelScope === "suspend" ? cancelUntilDate : entry.booking_date,
      },
    })
    .catch(console.warn);
  toast.success(successMsg);
  ...
}
```

- Un singur apel per acțiune, fire-and-forget (`void` + `.catch`), nu blochează UI-ul.
- `date` = data de reluare la suspendare, altfel `entry.booking_date` (apariția curentă).
- Nimic altceva nu se schimbă: RPC-urile, `p_owner_override`, toast-urile, calea chiriașului din `BookingDetailsRenter.tsx` rămân neatinse.

## Verificare

Build după modificare. Rezultat așteptat: „viitoare” → 1 email „anulat începând cu data X” la chiriaș, 0 la proprietar; „suspendă” → 1 email cu data reluării; „doar această sesiune” → 1 email cu data sesiunii. Fără cele 10-11 emailuri.
