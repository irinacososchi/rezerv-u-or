# Email către client la seria recurentă creată de proprietar

## Raport (confirmat din cod)

- Variabila există și se numește `recurrenceId` (`let recurrenceId: string | null = null;`), declarată înainte de bucla de insert și rămâne disponibilă după buclă. E setată doar când `isRecurrent && allDates.length > 1`.
- Bucla de insert peste `allDates` folosește același `recurrenceId` pentru toate sesiunile; după buclă avem `inserted` (datele inserate cu succes) și `skipped`.
- `guest_email` primește `manualEmail.trim()` sau placeholder `noemail+<timestamp>@rezervari.intern`.
- Nu există niciun apel `send-booking-email` în `handleManualBooking` — deci seria recurentă nu trimite nimic.
- Calea rezervării simple (non-recurente) rămâne complet neatinsă: nu adaug niciun apel explicit acolo.

Despre punctul 5: da, tipul `recurring-created` trimite și email către proprietar („cerere recurentă de aprobat"), deci proprietarul va primi un email redundant pentru propria rezervare. Nu inventez un tip nou în funcția externă; raportez doar acest efect.

## Plan

1. Calculez o singură dată, înainte de insert: `const clientEmail = manualEmail.trim();` și un flag `canEmailClient` = nu e gol, nu conține `@rezervari.intern`, nu începe cu `noemail+`.
2. După buclă, după `setManualSubmitting(false)` și după verificarea `inserted.length === 0`: dacă `recurrenceId` există și `canEmailClient`, invoc o singură dată, fire-and-forget:
   `void supabase.functions.invoke("send-booking-email", { body: { type: "recurring-created", recurrenceId } }).catch(console.warn)`
3. Dacă `recurrenceId` există dar emailul nu e utilizabil: toast informativ „Clientul nu are email — nu a fost trimisă nicio notificare."
4. Fără apel pentru rezervarea simplă (webhook-ul o acoperă deja) și fără modificări de status, prețuri sau alt flux.

## Detalii tehnice

- Fișier atins: doar `src/routes/panou.sali.$id.calendar.tsx`, funcția `handleManualBooking`.
- Placeholder-ul folosit la insert rămâne cum e; doar notificarea se decide pe baza `clientEmail`.
