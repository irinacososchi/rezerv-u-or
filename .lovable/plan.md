# Rezervările manuale ale proprietarului: status + email către client

## Ce am găsit în cod (verificat)

**1. Unde se creează rezervarea manuală**
Există un singur loc: `src/routes/panou.sali.$id.calendar.tsx`, funcția `handleManualBooking` (liniile ~2469-2620), afișată în dialogul „Rezervare manuală" din calendarul sălii. Dashboard-ul nu creează rezervări.

**2. Ce trimite**
NU folosește `create_booking` și nici alt RPC. Face `supabase.from("bookings").insert({...})` direct, câte un rând pentru fiecare dată (pentru serii recurente creează întâi un rând în `recurrences`, apoi inserează sesiunile în buclă).

**3. Statusul trimis din frontend**
Insertul trimite explicit `status: "confirmată"` (linia 2581). Nu citește `room.booking_type` nicăieri pe această cale. Deci frontend-ul cere deja „confirmată".

Concluzie importantă: dacă în realitate rezervarea apare „în așteptare", cauza NU este în codul frontend — este în baza de date (trigger BEFORE INSERT sau politică care rescrie statusul în funcție de `booking_type`). Baza este proiectul Supabase extern (`src/integrations/supabase/external-client.ts`), la care nu am acces de interogare din acest mediu, deci nu pot confirma trigger-ul de aici. Prima etapă a implementării este verificarea acestui lucru.

**4. Emailul clientului**
`ClientSelect` atașează `owner_client_id`. La selectarea clientului, `handleManualClientChange` (liniile 420-439) citește `name, phone, email` din tabelul `clients` și pre-completează câmpurile formularului. Deci **da**, clientul are un câmp `email` propriu în tabelul `clients`, iar el ajunge pe rezervare în `guest_email`.

**Problema:** dacă clientul nu are email, insertul scrie un email fals:
`guest_email: manualEmail.trim() || "noemail+<timestamp>@rezervari.intern"`
Un email trimis acolo va da bounce și, prin infrastructura de suprimare, poate strica reputația de expeditor.

**5. Emailuri azi**
În tot frontend-ul, `send-booking-email` este invocat doar în: `rezerva.$slug.tsx` (recurring-created), `panou.cereri.tsx` și `panou.dashboard.tsx` (aprobare/refuz serie). **Nicio invocare după rezervarea manuală.** Dacă există un webhook pe insert în baza externă, nu îl pot verifica de aici.

**6. Dacă statusul devine „confirmată"**
Emailul ajunge la client doar dacă `guest_email` este unul real. Cu placeholder-ul `@rezervari.intern` nu trebuie trimis nimic.

## Plan de implementare (după aprobare)

1. **Verificare în baza externă** (primul pas, obligatoriu): creez o rezervare manuală de test și verific statusul rezultat. Dacă e „în așteptare", inspectez trigger-ele pe `bookings` din proiectul extern. Fără acest pas nu pot ști dacă remedierea e în DB sau nicăieri.
2. **Forțarea statusului „confirmată"**: dacă un trigger rescrie statusul după `booking_type`, îl excluc pentru rândurile create de proprietar (condiție: `auth.uid() = room.owner_id`, sau un `owner_client_id` non-null). Recomand condiția pe `owner_id`, ca autoritate reală, nu un flag trimis din client (care ar putea fi falsificat). Aceasta e singura modificare de bază de date.
3. **Email către client la rezervare manuală**: după insert reușit în `handleManualBooking`, invoc `send-booking-email` o singură dată:
   - rezervare simplă → un email cu detaliile rezervării confirmate;
   - serie recurentă → un singur email pe serie (ca la aprobarea seriei), nu unul pe sesiune;
   - fire-and-forget, cu `.catch(console.warn)` — un email eșuat nu blochează crearea.
4. **Fără email fals**: trimit doar dacă `manualEmail` este completat și nu este placeholder-ul `@rezervari.intern`. Separat, curăț placeholder-ul din insert dacă schema permite `guest_email` null — altfel îl las, dar nu trimit niciodată către el.
5. **Feedback în UI**: toast-ul de succes menționează dacă emailul a fost trimis sau dacă clientul nu are adresă („Clientul nu are email — nu a fost trimisă nicio notificare").

## Detalii tehnice

- Fișier atins în frontend: `src/routes/panou.sali.$id.calendar.tsx` (doar `handleManualBooking`).
- Tipul emailului: refolosesc tipul existent de confirmare din funcția edge `send-booking-email`; la pasul 1 verific ce tipuri acceptă, ca să nu inventez unul nou.
- Nu ating fluxul chiriașului (`rezerva.$slug.tsx`) și nici aprobările din Cereri/Dashboard.
