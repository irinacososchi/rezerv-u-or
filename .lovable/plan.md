# Citiri anonime prin funcții de server (fără modificări de politici)

## Ce se schimbă

### 1. Pagina de confirmare — `src/routes/confirmare.tsx`

În `useEffect`-ul de încărcare (liniile 153–169), înlocuiesc interogarea din vederea
`bookings_full` — inaccesibilă unui vizitator nelogat, motiv pentru care confirmarea
oaspetelui afișează acum „Rezervarea nu a fost găsită" — cu apelul funcției de server:

```ts
const { data, error } = await supabase.rpc("get_booking_by_reference", {
  p_reference: reference || null,
  p_group: group || null,
});
```

- Grup: se trimite `p_group`; lista rămâne sortată după dată și oră (sortare aplicată în
  client dacă funcția nu garantează ordinea, ca să păstrez comportamentul actual).
- Referință simplă: `p_group: null`.
- Eroare sau zero rânduri → aceeași stare „nu a fost găsită".
- Câmpurile întoarse (`room_name`, `room_address`, `room_city`, `room_currency`,
  `booking_group_id`, `is_recurring` etc.) se mapează direct pe tipul `BookingFull`;
  tipul primește `booking_group_id` și `is_recurring` explicit, în locul cast-ului `any`
  folosit azi la linia 178.

### 2. Verificarea disponibilității la rezervare — `src/routes/rezerva.$slug.tsx`

În `checkSlotAvailability` (~linia 720), înlocuiesc citirea directă a tabelului cu:

```ts
const { data, error } = await supabase.rpc("get_room_availability", {
  p_room_id: room.id,
  p_from: minDate,
  p_to: maxDate,
});
```

Aceeași fereastră de date (`minDate`/`maxDate` deja calculate), aceleași patru câmpuri
(`booking_date, start_time, end_time, status`), aceeași logică de suprapunere mai jos.

## Ce NU se schimbă

- Nicio politică de acces nu e modificată sau revocată — pas separat, ulterior.
- Layoutul paginii de confirmare, textele, ICS-ul, calculul prețurilor recurente.
- Logica de rezervare și toate celelalte citiri (doar pentru utilizatori autentificați).

## Verificare

1. Build fără erori.
2. Rezervare ca oaspete nelogat → pagina `/confirmare?reference=...` afișează rezervarea
   (înainte apărea „nu a fost găsită"); varianta cu `group` afișează toate intervalele,
   ordonate cronologic.
3. În fluxul de rezervare, sloturile deja ocupate sunt în continuare respinse la
   verificarea de disponibilitate.
