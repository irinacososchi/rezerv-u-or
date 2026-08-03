# Fix aprobare serii recurente: grupare și update după `recurrence_id`

Seriile noi create prin `create_recurring_booking` au `recurrence_id`, dar nu și `booking_group_id`. Gruparea în card, aprobarea în masă și emailul de aprobare depind toate de `booking_group_id`, deci se rup: sesiunile apar ca rânduri individuale, iar update-ul în masă nu ar atinge nicio linie.

## Modificări

### 1. `src/lib/group-recurring-bookings.ts`
- Cheie de grupare stabilă: `recurrence_id ?? booking_group_id`.
- Un rând intră în grup dacă `is_recurring === true` ȘI există cel puțin una dintre cele două coloane. Restul rămân `singles` (nemodificat).
- `BookingItem` de tip `recurring_group` primește două câmpuri noi: `recurrenceId: string | null` și `groupedBy: "recurrence_id" | "booking_group_id"`, ca fluxul de aprobare să știe pe ce coloană să filtreze.
- Seriile vechi (doar `booking_group_id`) continuă să se grupeze prin fallback.

### 2. `src/routes/panou.cereri.tsx` — `bulkUpdateStatus`
- Semnătura filtrului devine `{ groupId?: string; groupedBy?: "recurrence_id" | "booking_group_id"; recurrenceId?: string | null; ids?: string[] }`.
- Update-ul filtrează pe `recurrence_id` când grupul e nou, altfel pe `booking_group_id`. Se păstrează garda `.eq("status", "în așteptare")`.
- Callback-urile `onApproveAll` / `onRefuseAll` din ambele randări (tabel desktop + listă mobil) transmit `groupedBy` și `recurrenceId` din item.

### 3. Email de aprobare
- După update reușit cu `newStatus === "confirmată"` pe un grup recurent, `recurrenceId` se ia din item (sau, ca fallback, din primul booking al grupului cu `recurrence_id`).
- `supabase.functions.invoke("send-booking-email", { body: { type: "recurring-approved", recurrenceId } })`, fire-and-forget cu `.catch` care loghează.
- Funcționează identic pentru serii noi și vechi (ambele au `recurrence_id` pe rânduri).

### 4. Ramura de refuz
- În codul actual nu există niciun apel de email pe refuz (`newStatus === "refuzată"`), deci nu e nimic de reparat acolo; nu adaug email nou. Rezolvarea coloanei de filtrare (punctul 2) se aplică însă și refuzului, ca „Refuză seria” să funcționeze pentru seriile noi.

### 5. Loguri temporare
- Logurile `APPROVE RECURRING …` nu au ajuns niciodată în fișier (aplicarea a fost întreruptă), deci nu e nimic de șters. Confirm asta după modificare.

### 6. „Aprobă selecția” (`filter.ids`)
- Adaug rezolvarea seriei și pe această ramură: din id-urile selectate se caută în state primul rând cu `recurrence_id` și, dacă statusul nou e `confirmată`, se trimite exact un email pentru serie. Deci da, aprobarea prin selecție va trimite emailul o singură dată.

## Verificare
- Typecheck + build.
- Verific că `RecurringGroupCard` și ceilalți consumatori ai `groupRecurringBookings` (dashboard, rezervări) compilează cu noul tip — câmpurile adăugate sunt aditive, nu se schimbă `groupId`/`bookings`.
- Aprobarea rezervărilor simple și comportamentul existent al refuzului rămân neatinse.
