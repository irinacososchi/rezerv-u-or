# Mărire fereastră date calendar sală de la 60 la 130 zile

## Locația query-ului

Fișier: `src/routes/sali.$slug.tsx`, în `useEffect`‑ul de încărcare al paginii (începe la linia ~236).

## Constanta partajată

Se introduce o constantă la nivel de modul (deasupra componentei) pentru ca query‑ul și bucla `fullyBookedDays` să rămână sincronizate:

```tsx
const CALENDAR_WINDOW_DAYS = 130;
```

## CHANGE 1 — Query‑ul de rezervări pentru calendar

### Înainte

```tsx
const today = new Date();
const todayISO = formatDateISO(today);
const sixtyISO = formatDateISO(addDays(today, 60));

const [photosRes, schedRes, priceRes, bookRes] =
  await Promise.all([
    ...
    supabase
      .from("bookings")
      .select("booking_date, start_time, end_time, status")
      .eq("room_id", roomData.id)
      .gte("booking_date", todayISO)
      .lte("booking_date", sixtyISO)
      .not("status", "in", '("refuzată","anulată","expirată")'),
  ]);
```

### După

```tsx
const today = new Date();
const todayISO = formatDateISO(today);
const horizonISO = formatDateISO(addDays(today, CALENDAR_WINDOW_DAYS));

const [photosRes, schedRes, priceRes, bookRes] =
  await Promise.all([
    ...
    supabase
      .from("bookings")
      .select("booking_date, start_time, end_time, status")
      .eq("room_id", roomData.id)
      .gte("booking_date", todayISO)
      .lte("booking_date", horizonISO)
      .not("status", "in", '("refuzată","anulată","expirată")'),
  ]);
```

## CHANGE 2 — Extinderea buclei `fullyBookedDays`

### Înainte

```tsx
for (let offset = 0; offset <= 60; offset++) {
```

### După

```tsx
for (let offset = 0; offset <= CALENDAR_WINDOW_DAYS; offset++) {
```

## Confirmări

- **Acesta este singurul query `.from("bookings")` din fișier.** Căutarea cu `rg` a găsit doar linia 289.
- **Același rezultat `bookRes` alimentează atât `fullyBookedDays`, cât și calculul de slot‑uri ocupate.**
  - `setBookings((bookRes.data ?? []) as Booking[])` populează starea `bookings`.
  - `fullyBookedDays` useMemo iterează `for (const b of bookings)` (linia 360).
  - Slot‑urile zilei active filtrează `bookings.filter((b) => b.booking_date === iso)` (linia 437).
- **Logica de greying rămâne identică** — doar domeniul buclei se extinde de la 60 la 130 zile, folosind aceeași constantă ca query‑ul.

## Ce NU se schimbă

- Lower bound rămâne `todayISO` (`gte("booking_date", todayISO)`).
- Statusul excluderii rămâne `not("status", "in", '("refuzată","anulată","expirată")')`.
- Coloanele selectate rămân aceleași.
- Alte query-uri din fișier (poze, orar, tarife) rămân neschimbate.
- Algoritmii `isDayDisabled`, `isDayFullyBooked` și calculul `busy` al sloturilor rămân neschimbate.

## Verificare după implementare

- Build fără erori.
- Confirmare că `CALENDAR_WINDOW_DAYS` este folosită în ambele locuri (query bound și buclă).
- Confirmare că niciun alt loc din fișier nu mai folosește valoarea 60 pentru fereastra de rezervări.
