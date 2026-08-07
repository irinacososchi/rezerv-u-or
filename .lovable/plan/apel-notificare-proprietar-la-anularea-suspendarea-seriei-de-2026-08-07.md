# Apel notificare proprietar la anularea/suspendarea seriei de către chiriaș

## Modificare

Fișier: `src/components/renter/BookingDetailsRenter.tsx`

În `executeRecurringChoice()`, în blocul `if (ok)` care rulează după succesul RPC-ului, adăugăm un singur apel fire-and-forget către `send-booking-email` cu noul tip `recurring-ended-owner`.

```ts
void supabase.functions
  .invoke("send-booking-email", {
    body: {
      type: "recurring-ended-owner",
      recurrenceId: booking.recurrence_id,
      reason:
        mode === "suspend" ? "suspended"
        : mode === "future" ? "cancelled_future"
        : "cancelled_one",
      date: mode === "suspend" ? untilDate : booking.booking_date,
    },
  })
  .catch(console.warn);
```

## Reguli

- Apelul se adaugă doar pentru rezervări recurente (cazul în care `booking.recurrence_id` există, iar funcția este apelată pe ramura recurentă). Căile non-recurente (nerecurente) nu sunt atinse — notificarea proprietarului pentru ele rămâne pe webhookul existent.
- Doar un singur apel per acțiune, `void` + `.catch`, fără blocarea UI.
- Nu se modifică `performBulkCancel` din `panou.sali.$id.calendar.tsx` (proprietarul are deja logica sa).
- Se folosesc variabilele din scope: `booking.recurrence_id`, `booking.booking_date`, `mode`, `untilDate`.
- Dacă `booking` este nul (verificare existentă), apelul nu se execută.

## Verificare

Build după modificare. Rezultat așteptat: pentru fiecare acțiune de anulare/suspendare a unei serii recurente făcute din `/panou/orarul-meu`, proprietarul primește exact un email (`recurring-ended-owner`) cu motivul și data corecte; chiriașul nu primește duplicate.