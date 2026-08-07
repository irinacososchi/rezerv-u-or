# Rezervările manuale ale proprietarului: status „confirmată" + email către client

## Ce e confirmat în cod

- Există un singur insert de rezervare în tot frontend-ul: `src/routes/panou.sali.$id.calendar.tsx`, linia 2565, în bucla din `handleManualBooking`. Nu există căi separate pentru interval simplu / multiplu / mai multe zile.
- Statusul trimis este hardcodat `status: "confirmată"` (linia 2581). Nicio variabilă, nicio citire a `room.booking_type`.
- Mai multe rânduri apar doar când e bifat „recurent" (`generateWeeklyDatesHorizonISO`); o rezervare pe o zi inserează exact un rând.
- Emailul clientului ajunge pe rezervare ca `guest_email`, pre-completat din tabelul `clients`. Când lipsește, se scrie un placeholder `noemail+<timestamp>@rezervari.intern`.
- Nicio invocare de `send-booking-email` după rezervarea manuală.

Situația raportată: și seriile recurente, și rezervările simple apar „în așteptare". Pentru cele recurente explicația e `force_recurring_pending`. Pentru cele simple, frontend-ul trimite deja „confirmată", deci cauza este în baza de date (externă) și trebuie identificată înainte de orice remediere.

## Plan

1. **Verificare în baza externă (primul pas).** Creez o rezervare manuală simplă de test și citesc rândul rezultat. Inspectez toate trigger-ele și regulile pe `bookings` din proiectul extern, plus eventuale politici/valori implicite pe coloana `status`. Fără această confirmare nu propun o modificare oarbă.
2. **Serii recurente create de proprietar → confirmate direct.** Ajustez `force_recurring_pending` astfel încât să nu forțeze „în așteptare" când rândul e creat de proprietarul sălii. Condiția se bazează pe autoritate reală (`auth.uid()` = `owner_id`-ul sălii), nu pe un flag trimis din client. Fluxul chiriașului rămâne neschimbat: seriile cerute de chiriaș cer în continuare aprobare.
3. **Rezervări simple.** Dacă pasul 1 arată un al doilea mecanism care rescrie statusul, îl corectez cu aceeași condiție de proprietar. Dacă se dovedește că rândurile simple sunt de fapt „confirmată", raportez asta și nu modific nimic acolo.
4. **Email către client la rezervarea manuală.** După insert reușit, invoc `send-booking-email` o singură dată: un email pentru rezervarea simplă, un singur email pe serie pentru cele recurente. Trimiterea e fire-and-forget — un email eșuat nu blochează crearea rezervării.
5. **Fără emailuri false.** Nu trimit nimic către adresele placeholder `@rezervari.intern`. Toast-ul de succes spune explicit „Clientul nu are email — nu a fost trimisă nicio notificare" în acel caz.

## Detalii tehnice

- Frontend atins: doar `handleManualBooking` din `src/routes/panou.sali.$id.calendar.tsx`.
- Bază de date: modificare la trigger-ul `force_recurring_pending` din proiectul Supabase extern, cu excepție pentru proprietarul sălii.
- Tipul de email: refolosesc un tip existent din funcția `send-booking-email` (verificat la pasul 1), fără a inventa unul nou.
- Nu ating fluxul chiriașului din `rezerva.$slug.tsx` și nici aprobările din Cereri/Dashboard.
