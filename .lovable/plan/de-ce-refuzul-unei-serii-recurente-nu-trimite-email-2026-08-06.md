# De ce refuzul unei serii recurente nu trimite email

## Constatări (fără modificări)

**1. Unde se refuză seria.** Butonul „Refuză seria" din `RecurringGroupCard` apelează `onRefuseAll(groupId)`, care e legat în două locuri:
- `src/routes/panou.cereri.tsx:533` și `:610` → `bulkUpdateStatus({ groupId, groupedBy, recurrenceId }, "refuzată")`
- `src/routes/panou.dashboard.tsx:331` → aceeași semnătură, funcție duplicată

**2/3. Emailul lipsește complet.** În ambele copii ale `bulkUpdateStatus` (cereri `:303-351`, dashboard `:187-236`) există un singur bloc de email, gardat explicit:

```ts
if (newStatus === "confirmată") { ... invoke("send-booking-email", { type: "recurring-approved", recurrenceId }) }
```

Nu există nicio ramură pentru `"refuzată"`. Refuzul face doar `update({ status: "refuzată" })` pe rândurile în așteptare, apoi `refetch()`. Deci nu e vorba de o eroare sau de o cale diferită — apelul `recurring-ended` / `reason: "refused"` pur și simplu nu e scris nicăieri în frontend (`rg` pe tot `src/` nu găsește niciun `recurring-ended`).

**4. Nu trece prin altă cale.** Refuzul e exact același `update` bulk pe tabelul `bookings` ca aprobarea. Dacă webhook-ul de email sare peste rândurile recurente (pentru a evita spam-ul per-sesiune), atunci — da — apelul explicit din frontend e singura sursă posibilă de email, și el lipsește.

**5. Trigger-ul `trg_notify_recurring_refused`.** Nu îl pot verifica din acest mediu: baza e proiectul Supabase extern (`src/integrations/supabase/external-client.ts`), la care instrumentele de interogare nu au acces. Ipoteza consistentă cu simptomul raportat (notificare in-app apare, email nu) este că trigger-ul scrie doar în `notifications`; confirm asta la implementare printr-un test real. Oricum, trigger-ul nu poate trimite emailul — funcția edge trebuie invocată.

**6. Duplicare.** Da, `bulkUpdateStatus` e duplicată în `panou.cereri.tsx` și `panou.dashboard.tsx`, dar aici duplicarea nu ascunde diferența: **niciuna** dintre cele două nu trimite email la refuz. Deci refuzul e rupt din ambele pagini, nu doar dintr-una.

## Cauza exactă

Frontend-ul nu invocă niciodată `send-booking-email` cu `type: "recurring-ended"` / `reason: "refused"`. Blocul de email din `bulkUpdateStatus` e condiționat strict pe `newStatus === "confirmată"`.

## Modificări propuse (când aprobi)

1. În `src/routes/panou.cereri.tsx`, în `bulkUpdateStatus`: extrag rezolvarea lui `recurrenceId` (azi doar în ramura de aprobare) înainte de `if`, apoi adaug o ramură `else if (newStatus === "refuzată" && recurrenceId)` care face fire-and-forget:
   `invoke("send-booking-email", { body: { type: "recurring-ended", recurrenceId, reason: "refused" } })` cu `.catch(console.warn)`.
2. Aceeași modificare, identică, în `src/routes/panou.dashboard.tsx` (sursa `pendingList` în loc de `bookings`).
3. Un singur email per serie, ca la aprobare — inclusiv pe ramura „Refuză selecția" (`filter.ids`), unde `recurrenceId` se deduce din primul rând selectat cu `recurrence_id`.
4. Fără atingerea rezervărilor simple: gardarea pe `recurrenceId` non-null păstrează comportamentul actual pentru non-recurente.

## Verificare
- Typecheck + build.
- Refuz al unei serii din Cereri și din Dashboard → chiriașul primește emailul de refuz o singură dată; aprobarea rămâne neschimbată.
