# Email către client la seria recurentă creată de proprietar

## Raport (confirmat din cod)

- Variabila se numește `recurrenceId` (`let recurrenceId: string | null = null;`), declarată înainte de bucla de insert și disponibilă după buclă. E setată doar când `isRecurrent && allDates.length > 1`.
- Toate sesiunile din buclă partajează același `recurrenceId`; după buclă avem `inserted` și `skipped`.
- `guest_email` primește `manualEmail.trim()` sau placeholder `noemail+<timestamp>@rezervari.intern`.
- Nu există niciun apel `send-booking-email` în `handleManualBooking`, deci seria recurentă nu trimite nimic clientului.
- Rezervarea simplă (non-recurentă) e acoperită de webhook-ul de INSERT și rămâne neatinsă.

## Plan

1. Înainte de insert, o singură dată:
   - `const clientEmail = manualEmail.trim();`
   - `const canEmailClient = clientEmail !== "" && !clientEmail.includes("@rezervari.intern") && !clientEmail.startsWith("noemail+");`
2. După bucla de insert, dacă `recurrenceId` există, `inserted.length > 0` și `canEmailClient`, invoc o singură dată, fire-and-forget:
   `void supabase.functions.invoke("send-booking-email", { body: { type: "recurring-approved", recurrenceId } }).catch(console.warn)`
   Folosesc `recurring-approved` (nu `recurring-created`) pentru că seria e deja confirmată: clientul primește „seria a fost confirmată, se reînnoiește lunar", iar proprietarul nu primește niciun email redundant de aprobare.
3. Dacă `recurrenceId` există dar emailul nu e utilizabil: toast „Clientul nu are email — nu a fost trimisă nicio notificare."
4. Fără niciun apel pentru rezervarea simplă (webhook-ul o acoperă deja).
5. Fără modificări de status, prețuri sau alte fluxuri.

## Detalii tehnice

- Fișier atins: doar `src/routes/panou.sali.$id.calendar.tsx`, funcția `handleManualBooking`.
- Placeholder-ul rămâne cum e la insert; doar decizia de notificare folosește `clientEmail`.
