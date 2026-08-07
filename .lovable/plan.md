# Email către client la rezervarea manuală făcută de proprietar

## Raport (ce am putut confirma din cod)

- Există un singur insert de rezervare manuală: `handleManualBooking` în `src/routes/panou.sali.$id.calendar.tsx`, linia 2565, în bucla peste `allDates`. Statusul trimis este hardcodat `"confirmată"` (linia 2581).
- Emailul clientului merge în `guest_email`; când `manualEmail` e gol se scrie placeholder `noemail+<timestamp>@rezervari.intern` (liniile 2570 și, pentru serie, `recurrences.created_by_email` la linia 2541).
- În `handleManualBooking` NU există nicio invocare de `send-booking-email`.
- Apelurile existente către `send-booking-email` din aplicație folosesc doar tipuri de serie: `recurring-created` (`rezerva.$slug.tsx`), `recurring-approved` și `recurring-ended` (`panou.cereri.tsx`, `panou.dashboard.tsx`).

**Ce NU pot confirma din acest repo:** dacă există un webhook pe INSERT în `bookings` care trimite automat email la o rezervare „confirmată" cu `guest_email` real, și dacă acel webhook filtrează adresele placeholder. Funcția `send-booking-email` rulează în proiectul backend extern și codul ei nu se află în acest repo, deci nu pot să o citesc. Nu afirm că webhook-ul acoperă (sau nu) cazul rezervării simple — asta se verifică la pasul 1.

## Plan

1. **Verificare înainte de orice apel explicit.** Creez o rezervare manuală simplă de test cu o adresă reală de test și verific dacă ajunge un email fără ca noi să apelăm ceva. Rezultatul decide pasul 3:
   - dacă webhook-ul trimite deja → nu adaug apel explicit pentru rezervarea simplă (evit dublura);
   - dacă nu trimite → adaug un apel explicit pentru cazul simplu.
2. **Gardă pentru adrese false (indiferent de rezultat).** Calculez o singură dată emailul clientului înainte de insert și îl folosesc peste tot. Consider adresa „nefolosibilă" dacă e goală, conține `@rezervari.intern` sau începe cu `noemail+`. În acest caz nu se trimite nimic și afișez toast: „Clientul nu are email — nu a fost trimisă nicio notificare."
3. **Rezervare simplă.** Conform rezultatului pasului 1, fie mă bazez pe webhook, fie invoc `send-booking-email` o singură dată după insertul reușit, fire-and-forget (`void ... .catch(console.warn)`), fără să blochez crearea rezervării.
4. **Serie recurentă creată de proprietar.** Un singur email pe serie, nu unul pe sesiune: după ce inserturile s-au terminat cu succes, invoc `send-booking-email` cu `recurrenceId`, refolosind tipul de serie deja folosit în aplicație pentru serii create (`recurring-created`), tot fire-and-forget. Dacă la pasul 1 se dovedește că webhook-ul emite deja câte un email per rând recurent, raportez asta și ajustăm ca să nu apară dubluri.
5. **Fără tipuri inventate.** Nu introduc un tip nou de email în funcția externă; folosesc doar tipurile pe care aplicația le trimite deja.

## Detalii tehnice

- Fișier atins: doar `src/routes/panou.sali.$id.calendar.tsx`, funcția `handleManualBooking`.
- Extrag `const clientEmail = manualEmail.trim()` și un `const placeholderEmail = ...` folosit pentru insert; notificarea se face doar pe baza `clientEmail`.
- Emailul se trimite după bucla de insert, doar dacă `inserted.length > 0`.
- Nu modific statusul, prețurile, fluxul chiriașului sau aprobările din Cereri/Dashboard.
