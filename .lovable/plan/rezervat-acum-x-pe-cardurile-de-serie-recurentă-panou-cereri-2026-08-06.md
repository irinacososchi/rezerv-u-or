# „Rezervat: acum X” pe cardurile de serie recurentă (panou/cereri)

## Ce există azi

- Cardurile ne-recurente din `src/routes/panou.cereri.tsx` (liniile 552 și 660) afișează timpul prin
  componenta `<BookingTimestamps createdAt={b.created_at} updatedAt={b.updated_at} />`.
- `src/components/booking-timestamps.tsx` folosește `formatRelativeRo` din `src/lib/format-time.ts`
  (formatter custom în română: „acum 5 minute”, „acum 2 ore”, „acum 3 zile”), cu prefix „Rezervat:”
  și tooltip cu data absolută. Stil: `text-xs text-muted-foreground`.
- `RecurringGroupCard` nu afișează niciun timp de creare.
- Datele vin din `bookings_full` cu `select("*")`, deci `created_at` există deja pe fiecare rând;
  tipul `Booking` din `group-recurring-bookings.ts` are index signature, deci câmpul e accesibil
  fără modificări de query.

## Modificare (un singur fișier)

`src/components/owner/recurring-group-card.tsx`:

- Import `BookingTimestamps`.
- Calculează `seriesCreatedAt` = cel mai vechi `created_at` dintre sesiunile grupate
  (ignoră valorile lipsă; dacă nu există niciuna, nu se randează nimic).
- Randează `<BookingTimestamps createdAt={seriesCreatedAt} className="mt-1" />` imediat sub linia
  „Preț lunar”, în interiorul blocului de detalii, deasupra butoanelor Aprobă/Refuză.
- Nu se transmite `updatedAt` — pe serie se afișează doar „Rezervat: acum X”.

## Ce NU se schimbă

Cardurile ne-recurente, logica de aprobare/refuz, gruparea, restul cardului recurent.

## Verificare

Build, apoi confirmare vizuală că un card de serie afișează „Rezervat: acum X” sub „Preț lunar”,
cu exact același format și stil ca pe cardurile simple.
