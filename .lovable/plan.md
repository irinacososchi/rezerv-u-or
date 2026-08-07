# Adaugă log-uri de diagnostic în handleManualBooking

## Obiectiv
Adaugă trei console.log-uri în `src/routes/panou.sali.$id.calendar.tsx`, în funcția `handleManualBooking`, pentru a verifica de ce/dacă ajunge la apelul `send-booking-email` de tip `recurring-approved`.

## Modificări

1. Înainte de blocul `if (recurrenceId)` (linia ~2615), adaugă:
   ```ts
   console.log("MANUAL BOOKING EMAIL CHECK", { recurrenceId, canEmailClient, clientEmail, insertedLength: inserted.length });
   ```
2. În interiorul `if (recurrenceId)`, înainte de `if (canEmailClient)`, adaugă:
   ```ts
   console.log("recurrenceId truthy, will attempt email");
   ```
3. În interiorul `if (canEmailClient)`, înainte de apelul `send-booking-email`, adaugă:
   ```ts
   console.log("calling send-booking-email recurring-approved", recurrenceId);
   ```

## Restricții
- Nu se schimbă alt cod, logica, statusul sau prețurile.
- După editare se rulează build-ul pentru verificare.
