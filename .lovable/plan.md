# De ce nu pleacă emailul către proprietar la rezervările simple

## Ce am verificat (fapte confirmate)

Frontend (`src/routes/rezerva.$slug.tsx`), singurul loc unde se creează rezervări:

- Ramura **recurentă** (linia ~1072): după `create_recurring_booking` reușit, frontendul apelează explicit
  `supabase.functions.invoke("send-booking-email", { type: "recurring-created", recurrenceId })`.
- Ramura **single-slot** (linia ~1099) și ramura **multi-slot** (linia ~1174): după `create_booking`
  se face doar un `update` de metadate (payment_method, facturare, booking_group_id) și apoi navigare
  spre `/confirmare`. **Niciun apel de email, către nimeni.**
- În tot `src/` există exact 3 apeluri `send-booking-email`: rezerva (recurring-created),
  panou.cereri (recurring-approved), panou.dashboard (recurring-approved). Toate sunt pe fluxul recurent.

Backend: ambele funcții există și răspund pe proiect (`send-owner-notification` și `send-booking-email`
răspund 400 la body gol, deci sunt deployate). Codul lor nu e în acest repo (`supabase/functions/`
conține doar `send-contact-email`), deci logica lor internă și eventualele triggere din bază
nu pot fi citite din proiect.

## Concluzie (cauza)

Diferența nu vine din baza de date, ci din frontend: **fluxul recurent își trimite singur emailul,
fluxul ne-recurent nu apelează nimic**. Dacă notificarea proprietarului pentru rezervările simple ar fi
venit dintr-un trigger pe `bookings`, ea ar funcționa și acum, indiferent de RPC — deci fie triggerul
lipsește/filtrează, fie n-a existat niciodată o notificare pentru ne-recurent pe calea actuală.

Ce **nu** pot confirma fără acces la baza externă: dacă există un trigger pe `bookings` care cheamă
`send-owner-notification` prin `pg_net`, dacă filtrează `is_recurring`, și dacă vechea inserare directă
din browser îl declanșa. Nota anterioară („send-owner-notification sare peste rândurile recurente ca să
nu spameze") sugerează că exista un trigger gândit pentru ne-recurent; dacă e așa, el fie nu mai există,
fie condiția lui nu se mai potrivește cu rândurile inserate de `create_booking` (de ex. funcția RPC e
`SECURITY DEFINER` și triggerul filtrează după rol/status, sau statusul inițial diferă).

## Pași de verificare propuși (înainte de orice fix)

1. Inspectarea bazei externe: `pg_trigger` pe `public.bookings` + sursa funcțiilor de trigger,
   pentru a vedea dacă există un apel `net.http_post` către `send-owner-notification` și ce condiții are.
2. Logurile funcției `send-owner-notification` din ultimele zile: dacă are invocări, triggerul rulează
   și problema e în interiorul funcției; dacă nu are niciuna, nu e apelat deloc.
3. Sursa `create_booking` vs `create_recurring_booking`: dacă vreuna apelează notificarea intern.

## Fix propus (după verificare)

Varianta minimă și simetrică cu recurentul: în `rezerva.$slug.tsx`, după `create_booking` reușit
(ambele ramuri, single și multi-slot), apel fire-and-forget
`supabase.functions.invoke("send-owner-notification", { bookingId })` — o singură dată pe grup la
multi-slot — cu `.catch` care doar loghează, fără să blocheze navigarea spre `/confirmare`.

Dacă verificarea 1/2 arată că triggerul din bază există și doar filtrează greșit, fixul corect e în bază
(ajustarea condiției triggerului), nu în frontend — ca să acopere și rezervările create în afara UI-ului.
