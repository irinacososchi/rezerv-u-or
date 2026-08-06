# Disponibilitate identică pentru toți: calendarul sălii citește prin RPC

## Problema

Calendarul public citește direct din tabelul de rezervări, iar regulile de acces returnează seturi diferite de rânduri: vizitatorii nelogați văd toate rezervările și blocările, în timp ce un utilizator logat care nu e proprietarul sălii vede doar rezervările proprii. Astfel, blocările altui proprietar dispar pentru el, iar zilele complet blocate apar libere.

## Modificare (un singur fișier: `src/routes/sali.$slug.tsx`)

În `useEffect`-ul de încărcare (în jurul liniilor 271–297), înlocuiesc ultimul element din `Promise.all` — citirea directă din tabelul de rezervări — cu apelul funcției de server:

```ts
supabase.rpc("get_room_availability", {
  p_room_id: roomData.id,
  p_from: todayISO,
  p_to: horizonISO,
})
```

Se păstrează aceeași fereastră de date (azi → azi + `CALENDAR_WINDOW_DAYS` = 130).

La preluarea rezultatului (linia 313), tratez eroarea fără să crape pagina:

```ts
if (bookRes.error) {
  console.error("get_room_availability failed", bookRes.error);
}
setBookings((bookRes.data ?? []) as Booking[]);
```

## Ce NU se schimbă

- `fullyBookedDays`, calculul de sloturi ocupate, `isDayDisabled`, tooltipul „Complet rezervat".
- Fereastra de 130 de zile, generarea sloturilor de 30 min, prețurile, pozele, orarul.
- Forma datelor: RPC-ul întoarce aceleași câmpuri `booking_date`, `start_time`, `end_time`, `status`.

## Verificare

1. Build fără erori.
2. Deschid `/sali/nunu` nelogat: 15, 17, 22, 24 august rămân gri, neclickabile, cu „Complet rezervat".
3. Deschid aceeași pagină autentificat ca utilizator care NU e proprietarul sălii și confirm că lunile 17/24/31 august sunt gri, identic cu starea nelogată; zilele parțial libere rămân selectabile.
