# Zile complet indisponibile — dezactivare la nivel de zi în calendarul sălii

## Raport (situația actuală)

**1. Cum decide calendarul dacă o zi e selectabilă**
`isDayDisabled(date)` din `src/routes/sali.$slug.tsx` verifică doar două lucruri:
- data e în trecut (înainte de azi, ora 00:00) → dezactivată;
- ziua săptămânii nu există în `scheduleByDay` (adică nu există rând `weekly_schedule` cu `is_available = true` pentru acea zi) → dezactivată.

Nu se uită deloc la rezervări/blocări. De aceea o zi plină arată în continuare activă.

**2. Cum se decid sloturile dintr-o zi**
În `useMemo` „slots", doar pentru ziua activă (cea pe care ai dat click):
- se ia programul zilei (`open_time` → `close_time`), se generează sloturi de 30 min;
- `busy = true` dacă vreo rezervare din acea zi se suprapune peste slot (`intervalsOverlap`);
- `tooSoon = true` pentru sloturile de azi care încep în mai puțin de 2 ore (buffer global).

**3. Program de funcționare**
Din tabelul `weekly_schedule` (`day_of_week`, `open_time`, `close_time`, `is_available`), citit o singură dată la încărcarea paginii și pus în `scheduleByDay`.

**4. Sunt datele deja disponibile?**
Da. Rezervările sunt încărcate în bloc la montarea paginii pentru **azi → azi + 60 de zile**, cu statusurile relevante (se exclud `refuzată`, `anulată`, `expirată`, deci rămân `confirmată`, `în așteptare`, `blocată`). Nu se face fetch per zi la click — calculul de slot folosește aceeași listă `bookings`. Deci disponibilitatea la nivel de zi se poate calcula complet pe client, fără request-uri noi.

**5. Câte zile afișează calendarul**
O lună odată (max 31 de zile vizibile), cu navigare înainte/înapoi. Datele acoperă 60 de zile, deci luna curentă și cea următoare sunt acoperite integral; lunile mai îndepărtate nu au date de rezervări.

## Ce propun să implementez

1. Un `useMemo` `fullyBookedDays: Set<string>` (chei ISO `YYYY-MM-DD`), calculat din `bookings` + `scheduleByDay`:
   - pentru fiecare zi din intervalul acoperit de date (azi → azi+60) care are program;
   - se generează sloturile de 30 min între `open_time` și `close_time`;
   - dacă **toate** sloturile sunt ocupate (suprapunere cu o rezervare) → ziua intră în set.
   - pentru **azi** se ia în calcul și bufferul de 2 ore: dacă toate sloturile rămase sunt fie ocupate, fie prea apropiate, ziua e considerată plină.

2. `isDayDisabled` primește o verificare în plus: `if (fullyBookedDays.has(iso)) return true;`

3. Fallback sigur: pentru zile din afara ferestrei de 60 de zile nu avem date de rezervări, deci nu se dezactivează nimic (comportament actual păstrat).

4. Opțional (spune-mi dacă vrei): tooltip/`title` pe ziua dezactivată — „Complet rezervat".

## Detalii tehnice
- Fișier atins: `src/routes/sali.$slug.tsx` (doar logică de afișare a calendarului).
- Se refolosesc helperii existenți `timeToMinutes`, `minutesToTime`, `intervalsOverlap`, `slotFromTime`, `getDayOfWeek`, `formatDateISO`.
- Zero query-uri noi, zero modificări de bază de date, zero schimbări în calculul prețului.
