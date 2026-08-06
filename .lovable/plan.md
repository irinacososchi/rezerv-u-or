# Audit: ce citește un vizitator nelogat din rezervări

## Rezultatul auditului

### 1. Pagina de confirmare (`src/routes/confirmare.tsx`, linia 155)

```ts
let query = supabase.from("bookings_full").select("*");
if (group) query = query.eq("booking_group_id", group).order("booking_date").order("start_time");
else      query = query.eq("reference", reference);
```

Important: `bookings_full` **NU este accesibil anonim** azi. Un apel anonim returnează
`permission denied for view bookings_full`. Deci confirmarea pentru un oaspete nelogat
este deja ruptă (afișează „nu am găsit rezervarea"), independent de politica `qual:true`.

Coloane efectiv folosite în pagină (tipul `BookingFull`, liniile 30–56):
`id, reference, room_id, guest_name, guest_email, guest_phone, booking_date, start_time,
end_time, duration_hours, duration_minutes, price_per_hour, pricing_rule_label, subtotal,
discount_amount, voucher_code_used, total_amount, status, payment_method, payment_status,
room_name, room_address, room_city, room_currency`.

### 2. Calendarul sălii (`src/routes/sali.$slug.tsx`)

Nu mai citește tabelul direct. Singurul apel rămas este
`supabase.rpc("get_room_availability", ...)` (linia 290). Confirmat: nu depinde de politica anonimă.

### 3. Căutare „rezervarea mea după referință" pentru oaspeți

Nu mai există. `src/routes/rezervari.tsx` încarcă date doar când există utilizator autentificat
(`init()`, liniile 86–99) prin `bookings_full` filtrat pe `renter_id`/`guest_email`;
câmpul „referință" filtrează doar în client, peste lista deja încărcată.

### 4. Alte citiri anonime posibile

- `src/routes/rezerva.$slug.tsx`, linia 720 (`checkSlotAvailability`) — **singura citire reală
  a tabelului făcută de un vizitator nelogat**: `booking_date, start_time, end_time, status`
  pentru o sală și un interval de date.
- `src/routes/rezerva.$slug.tsx`, liniile 790 (conflicte proprii), 1063/1147/1216 (update de
  metadate după RPC) — toate rulează doar pentru utilizator logat / rezervări proprii.
- `src/components/site-header.tsx`, `src/hooks/use-user-role.ts`, paginile din `/panou` —
  doar autentificat.

### 5. De ce are nevoie anonimul, minimal

| Flux | Date necesare |
| --- | --- |
| Verificare disponibilitate la rezervare | `booking_date, start_time, end_time, status` pentru o sală |
| Confirmare oaspete după referință | doar rândul cu acea referință (sau acel `booking_group_id`), fără date ale altora |

## Propunere de remediere

1. **Elimin dependența anonimă de tabel în fluxul de rezervare**: în `rezerva.$slug.tsx`,
   `checkSlotAvailability` trece pe `get_room_availability` (aceeași formă de date, aceleași
   patru coloane) — RPC-ul deja livrează exact asta.
2. **Confirmarea oaspetelui trece pe o funcție de server dedicată**, de ex.
   `get_booking_by_reference(p_reference text)` / `get_booking_group(p_group uuid, p_reference text)`,
   care întoarce doar coloanele din lista de la punctul 1 și doar pentru referința exactă
   (fără listare, fără căutare parțială). Pagina de confirmare o apelează în locul
   `bookings_full` — asta repară și eroarea actuală de permisiune pentru oaspeți.
3. **Ștergerea politicii anonime `Anyone can read booking by reference` (`qual: true`)**
   după ce cele două puncte de mai sus sunt live. Nicio altă parte din frontend nu mai
   depinde de citirea anonimă a tabelului.

## Detalii tehnice

- Fișiere atinse la implementare: `src/routes/rezerva.$slug.tsx` (o singură interogare),
  `src/routes/confirmare.tsx` (o singură interogare + maparea câmpurilor).
- Funcțiile de server sunt `SECURITY DEFINER`, cu `search_path` fix, fără parametri care
  permit enumerarea (referința trebuie dată exact, comparație strictă).
- Verificare: rezervare ca oaspete nelogat → pagina de confirmare afișează corect rezervarea;
  citirea directă anonimă a tabelului returnează zero rânduri.
