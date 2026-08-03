# De ce „BULK UPDATE running" nu apare: butonul apăsat e cel din Dashboard

## Raport (1-3 + întrebarea despre groupId)

**1. Prop-ul `onApproveAll` din `panou.cereri.tsx`** — identic pe desktop (linia 531) și mobil (linia 606):

```tsx
onApproveAll={(gid) => bulkUpdateStatus({ groupId: gid, groupedBy: item.groupedBy, recurrenceId: item.recurrenceId }, "confirmată")}
```

**2. `RecurringGroupCard`**: prop tipat `onApproveAll: (groupId: string) => Promise<void>`, apelat în `handleApproveAll`:

```tsx
console.log("APROBA TOT CLICKED", groupId);
setProcessing(true);
try { await onApproveAll(groupId); } finally { setProcessing(false); }
```

**3. Există DOUĂ funcții `bulkUpdateStatus`, în componente diferite:**

- `src/routes/panou.cereri.tsx:303` — cea nouă, cu logul „BULK UPDATE running", cu `groupedBy` / `recurrence_id` și emailul de aprobare.
- `src/routes/panou.dashboard.tsx:187` — o copie veche, **fără log**, **fără `groupedBy`**, care filtrează mereu `.eq("booking_group_id", filter.groupId)` și nu trimite niciun email.

Dashboard-ul randează același `RecurringGroupCard` (linia 282) cu `onApproveAll={(gid) => bulkUpdateStatus({ groupId: gid }, "confirmată")}` — versiunea veche. Deci: click pe Dashboard → „APROBA TOT CLICKED" apare (logul e în componentă), „BULK UPDATE running" nu apare (logul e doar în Cereri), iar update-ul filtrează pe `booking_group_id`, care e NULL la seriile noi → 0 rânduri modificate, cererea rămâne în așteptare, fără eroare. Nu e stale closure și nu se aruncă nicio excepție.

**`bea5837e…`**: e un `recurrence_id`. Seriile create prin `create_recurring_booking` au `recurrence_id` dar `booking_group_id` NULL, iar `groupRecurringBookings` folosește cheia `recurrence_id ?? booking_group_id`, deci `item.groupedBy === "recurrence_id"` este corect. Doar Dashboard-ul ignoră acest câmp. (Confirm valoarea exactă în baza de date la execuție.)

## Modificări propuse

### `src/routes/panou.dashboard.tsx`
- `bulkUpdateStatus` primește aceeași semnătură ca în Cereri: `{ groupId?, groupedBy?, recurrenceId?, ids? }`.
- Filtrează pe `recurrence_id` când `groupedBy === "recurrence_id"`, altfel pe `booking_group_id`. Se păstrează garda `.eq("status", "în așteptare")`.
- Trimite emailul `send-booking-email` (`type: "recurring-approved"`, `recurrenceId`) la aprobare reușită, o singură dată per serie, fire-and-forget cu `.catch` — la fel ca în Cereri.
- Cele patru callback-uri ale cardului transmit `item.groupedBy` și `item.recurrenceId`.
- Log de diagnostic `console.log("BULK UPDATE running (dashboard)", filter, newStatus)` pe prima linie.

### Loguri cerute (punctele 4-5), păstrate temporar
- În ambele randări din `panou.cereri.tsx` ȘI în cea din `panou.dashboard.tsx`, corpul lui `onApproveAll` devine o funcție cu `console.log("onApproveAll PROP CALLED", gid)` urmat de `try { await bulkUpdateStatus(...) } catch (err) { console.log("onApproveAll THREW", err) }`.
- Logurile existente „APROBA TOT CLICKED" și „BULK UPDATE running" rămân.

## Verificare
- Typecheck + build.
- Aprobarea seriilor recurente funcționează identic din Cereri și din Dashboard; rezervările simple rămân neatinse.
