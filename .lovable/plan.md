# Notificare unică pentru proprietar când chiriașul anulează/suspendă o serie recurentă

## 1. Ce poate face chiriașul (verificat în cod)

`src/components/renter/BookingDetailsRenter.tsx` — dialogul „Cum vrei să anulezi?” are exact 3 opțiuni (`CancelMode = "single" | "future" | "suspend"`), fără opțiune „toată seria”:

- `single` (implicit) → `cancel_booking({ p_booking_id, p_guest_email })` — anulează doar sesiunea din ziua respectivă.
- `future` → `cancel_booking_and_future({ p_booking_id, p_owner_override: false })`.
- `suspend` → `suspend_recurrence_until({ p_recurrence_id, p_until_date: untilDate, p_owner_override: false })` — data de reluare aleasă din Popover + Calendar.

Pentru rezervările fără `recurrence_id` se folosește `AlertDialog`-ul simplu și tot `cancel_booking`.

## 2. Se trimite vreun email către proprietar? (verificat)

Nu. `executeRecurringChoice()` și `handleSimpleCancel()` fac doar RPC + `toast` + `onCancelled()` + `onClose()`. Nu există niciun `supabase.functions.invoke(...)` în fișier (singurul import Supabase e clientul extern). Deci, după ce `send-owner-notification` a fost făcut să sară peste rândurile recurente la UPDATE, anulările de serie făcute de chiriaș ajung la proprietar de **zero** ori. Confirmă exact golul descris.

## 3. Există un tip de email orientat spre proprietar pentru serii?

În codul acestui repo, toate apelurile explicite merg către `send-booking-email` cu tipuri orientate spre chiriaș: `recurring-created`, `recurring-approved`, `recurring-ended` (cu `reason`: `refused` / `suspended` / `cancelled_future` / `cancelled_one`). Nu există niciun apel explicit către `send-owner-notification` în frontend — acea funcție e declanșată din backend (webhook pe `bookings`).

Notă de acuratețe: codul sursă al funcțiilor `send-booking-email` și `send-owner-notification` **nu se află în acest proiect** (în `supabase/functions/` există doar `send-contact-email`); rulează în proiectul Supabase extern. Deci nu pot confirma din cod ce tipuri acceptă exact fiecare funcție. Primul pas al implementării este verificarea handler-ului `send-owner-notification` / `send-booking-email` în proiectul extern pentru a decide dacă adăugăm un tip nou sau reutilizăm unul existent.

## 4. Ce informații îi trebuie proprietarului

Într-un singur email:

- cine: numele + emailul chiriașului (din rândurile seriei / `guest_email`);
- ce serie: sala, ziua săptămânii și intervalul orar (din `recurrences`, formatabile cu `describeRecurrence` din `src/lib/recurrence-series.ts`);
- ce s-a întâmplat: „anulat de la data X înainte” / „suspendat până la data X (se reia pe X)” / „anulată doar sesiunea din data X”;
- când s-a întâmplat + link către `/panou/sali/{id}/calendar`.

## 5. Unde intră apelul și ce mecanism

Locul: în `executeRecurringChoice()` din `BookingDetailsRenter.tsx`, în blocul `if (ok)` (simetric cu `performBulkCancel()` din `panou.sali.$id.calendar.tsx`) — un singur apel fire-and-forget per acțiune, cu `void` + `.catch(console.warn)`, deci nu blochează UI-ul.

Mecanism recomandat: **un tip nou orientat spre proprietar în `send-booking-email`**, nu un event nou în `send-owner-notification`. Motive: `send-booking-email` primește deja `recurrenceId` și știe să rezolve seria întreagă dintr-un singur id (folosit deja pentru `recurring-approved` / `recurring-ended`), în timp ce `send-owner-notification` e orientată pe rând-de-rezervare și e declanșată din webhook — exact modelul care a produs cele 10-11 emailuri.

Payload propus:

```ts
{
  type: "recurring-ended-owner",
  recurrenceId: booking.recurrence_id,
  reason: mode === "suspend" ? "suspended"
        : mode === "future"  ? "cancelled_future"
        : "cancelled_one",
  date: mode === "suspend" ? untilDate : booking.booking_date,
  actor: "renter",
}
```

Pentru `mode === "single"` pe o rezervare recurentă: se trimite tot un singur email cu `reason: "cancelled_one"`. Pentru rezervările nerecurente nu se schimbă nimic — rămâne pe webhook-ul existent.

## Pași de implementare

1. În proiectul backend extern: inspectat `send-booking-email` și adăugat ramura `recurring-ended-owner` — destinatar = emailul proprietarului sălii, conținut = punctul 4, un singur email per apel.
2. În `src/components/renter/BookingDetailsRenter.tsx`: adăugat apelul unic în `if (ok)` din `executeRecurringChoice()`.
3. Verificat că `send-owner-notification` continuă să sară peste rândurile recurente la UPDATE (altfel revin duplicatele).
4. Build + test manual pe cele 3 scenarii (o sesiune / viitoare / suspendare): exact 1 email la proprietar, 0 duplicate.
