# Recurență doar pe un singur interval + eliminarea inserării cu prețuri din browser

Scop: recurența săptămânală devine posibilă doar pentru un singur interval într-o singură zi. Bucla veche care insera rezervări cu prețuri calculate în browser dispare complet, iar utilizatorul primește un mesaj explicit dacă încearcă recurență cu mai multe intervale.

## 1. Pagina sălii (`src/routes/sali.$slug.tsx`)

- Checkbox-ul "Rezervă recurent (săptămânal)" se afișează doar când selecția are exact un interval într-o singură zi: condiția devine `summary && !summary.isMultiDay && summary.days[0].intervals.length === 1`.
- Efectul existent de reset (care azi dezactivează recurența la trecerea în multi-zi) se extinde: dacă ziua selectată ajunge să aibă 2+ intervale, `isRecurrent` devine `false` și `recurrenceDates` se golește.
- Când selecția are 2+ intervale într-o zi, în locul checkbox-ului apare nota:
  "Recurența săptămânală e disponibilă doar pentru un singur interval. Pentru mai multe intervale, fă câte o rezervare recurentă separată pentru fiecare."
- Nota existentă pentru multi-zi rămâne neschimbată.
- `recurrentActive` la navigare primește aceeași condiție de un singur interval, ca dublă protecție înainte de a trimite `recurrent=true` în URL.

## 2. Pagina de finalizare (`src/routes/rezerva.$slug.tsx`)

- Se șterge integral blocul legacy (aprox. liniile 1247–1400): array-ul `results`, bucla per-interval cu calculul de preț în browser (`intervalSubtotal`, `intervalDiscount`, `intervalTotal`, `intervalPricePerHour`), `payload`-ul, `supabase.from("bookings").insert(payload)`, interogarea de `reference`, `alert()`-ul, invocarea de email pe `recurrenceId` (mereu `null` acolo) și navigarea finală.
- În locul lui, imediat după ramura recurentă cu un interval, se adaugă garda:
  - dacă `isRecurrent && parsedSlots.length > 1` (sau `isMultiDay`), nu se inserează nimic: `setSubmitting(false)`, `setSubmitError(...)` plus `toast.error(...)` cu textul:
    "Recurența săptămânală se poate face doar pentru un singur interval. Pentru mai multe intervale, fă câte o rezervare recurentă separată pentru fiecare interval."
  - apoi `return`.
- Se adaugă și o ieșire de siguranță la final, pentru orice formă neacoperită de cele trei ramuri RPC: `setSubmitting(false)` + mesaj generic de reîncercare, fără nicio scriere în baza de date.
- Se elimină log-urile de debug rămase: `"=== HANDLE SUBMIT START ==="`, toate `"=== EARLY RETURN ==="`, `"=== DEBUG SUBMIT ==="`, `"=== PAYLOAD CHEI ==="`, `"=== INSERT BOOKING RESULT ==="`. Mesajele de eroare vizibile utilizatorului rămân neschimbate.
- Se curăță variabilele rămase fără utilizare după ștergere (`recurrenceId`, `recurrenceDateCount`, `isRecurrenceCheckout`, `renterId`, `applyVoucher`, `bookingGroupId` — se păstrează doar cele folosite de ramurile RPC) și importurile devenite inutile.

## Ce NU se schimbă

- Apelurile `create_booking` (single și multi-slot ne-recurent) și `create_recurring_booking` (recurent cu un interval).
- Update-urile de metadate fără preț (`payment_method`, câmpuri de factură, `booking_group_id`).
- Verificările de disponibilitate, `check_recurring_conflict`, avertizările de suprapunere, backend-ul și funcțiile din bază.

## Verificare finală

- Căutare în `rezerva.$slug.tsx`: zero apeluri `supabase.from("bookings").insert(...)`; zero câmpuri `price_per_hour` / `subtotal` / `discount_amount` / `total_amount` trimise către bază (rămân doar în afișarea din interfață).
- Toate cele trei căi de creare trec exclusiv prin RPC-uri.
- Cazul recurent cu mai multe intervale afișează mesajul explicativ, fără nicio scriere.
- Build după implementare.
