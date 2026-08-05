# Mărire fereastră date calendar sală de la 60 la 130 zile

## Locația query-ului

Fișier: `src/routes/sali.$slug.tsx`, în `useEffect`‑ul de încărcare al paginii (începe la linia ~236).

## Query-ul actual (exact)

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

## Confirmări

- **Acesta este singurul query `.from("bookings")` din fișier.** Căutarea cu `rg` a găsit doar linia 289.
- **Același rezultat `bookRes` alimentează atât `fullyBookedDays`, cât și calculul de slot‑uri ocupate.**
  - `setBookings((bookRes.data ?? []) as Booking[])` populează starea `bookings`.
  - `fullyBookedDays` useMemo iterează `for (const b of bookings)` (linia 360).
  - Slot‑urile active zilei filtrează `bookings.filter((b) => b.booking_date === iso)` (linia 437).
- **Limita superioară este acum literal 60 de zile**, calculată prin `addDays(today, 60)` și apoi `formatDateISO`.

## Schimbarea propusă (doar limita superioară)

```text
ÎNAINTE:
  const sixtyISO = formatDateISO(addDays(today, 60));

DUPĂ:
  const oneThirtyISO = formatDateISO(addDays(today, 130));
```

Și, în același query:

```text
ÎNAINTE:
  .lte("booking_date", sixtyISO)

DUPĂ:
  .lte("booking_date", oneThirtyISO)
```

## Ce NU se schimbă

- Lower bound rămâne `todayISO` (`gte("booking_date", todayISO)`).
- Statusul excluderii rămâne `not("status", "in", '("refuzată","anulată","expirată")')`.
- Coloanele selectate rămân aceleași.
- Alte query-uri din fișier (poze, orar, tarife) rămân neschimbate.
- Logica de greying/disable (`fullyBookedDays` useMemo, `isDayDisabled`, `isDayFullyBooked`, calculul `busy` al sloturilor) rămâne neschimbată, conform cerinței. Se observă că `fullyBookedDays` iterează doar `offset = 0..60`, deci va beneficia de noile date doar pentru primele 60 de zile; instrucțiunea interzice modificarea acestei bucle.

## Verificare după implementare

- Build fără erori.
- Confirmare că doar linia de calcul a datei de final și linia `.lte` au fost modificate.
