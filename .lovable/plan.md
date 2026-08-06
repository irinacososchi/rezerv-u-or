# Blocarea acțiunilor de status pentru rezervări vechi (raport de audit + plan)

Regulă cerută: dacă `booking_date` este strict mai vechi decât ieri, proprietarul nu mai poate schimba statusul rezervării. Singura excepție: o rezervare `confirmată` poate fi în continuare marcată ca plătită.

## 1. Unde schimbă proprietarul statusul (locuri găsite)

**a) `/panou/cereri` — `src/routes/panou.cereri.tsx`, componenta `ActionButtons` (liniile ~84-160)**
Butoane, în funcție de status:
- `în așteptare` → **Aprobă** (`confirmată`), **Refuză** (`refuzată`)
- `confirmată` → **Anulează** (`anulată`)
- `anulată` / `refuzată` / `expirată` → **Reactivează ca confirmată**, **Pune în așteptare**
- plată: `payment_status === "neplatit"` ȘI `status === "confirmată"` → **Marchează plătit**; `payment_status === "platit"` → **Marchează neplatit** (afișat pe orice status)
Handler: `handleAction` face un singur `update` pe `bookings` cu `status` sau `payment_status`.

**b) `/panou/cereri` + `/panou/dashboard` — carduri de serie recurentă (`src/components/owner/recurring-group-card.tsx`)**
Butoane: **Aprobă seria**, **Refuză seria**, **Gestionează serie** (aprobă/refuză selecția). Se aplică doar sesiunilor `în așteptare`. Rulează prin `bulkUpdateStatus` în ambele rute.

**c) `/panou/dashboard` — `src/routes/panou.dashboard.tsx` (~liniile 364-386)**
Carduri „cereri în așteptare": **Aprobă** / **Refuză** (`handleDecision`). Tabelul „Rezervări recente" afișează doar badge-uri, fără acțiuni.

**d) Calendarul sălii — `src/routes/panou.sali.$id.calendar.tsx`, dialogul de detalii rezervare (~liniile 1590-1700)**
- **Marchează ca plătit / neplatit** (`togglePayment` → `payment_status` = `platit`/`neplatit`)
- **Editează tarif** (blocat deja la <48h prin `tariffLocked`)
- **Modifică intervalul**
- **Anulează rezervarea** / **Anulează rezervarea...** (dialog recurent cu 3 opțiuni), ascunse când statusul e deja `anulată`
- separat: ștergerea blocărilor (`blocată`)

**e) `/rezervari`** — este vizualizarea chiriașului (anulare proprie), nu conține acțiuni de proprietar.
**f) `ClientList`** — doar activare/dezactivare clienți, fără statusuri de rezervare.
**g) `/panou/orarul-meu`** — doar afișare colorată după status, fără butoane.

## 2. Acțiunea „plătit"
Există în două locuri: `/panou/cereri` (`Marchează plătit` / `Marchează neplatit`) și dialogul din calendarul sălii (`togglePayment`). Setează `payment_status` = `platit` sau `neplatit`. În Cereri, „plătit" apare doar pe rezervări `confirmată`; „neplatit" apare pe orice status cu plata deja marcată.

## 3. Disponibilitatea datei
`booking_date` (string `YYYY-MM-DD`) există pe obiectul rezervării în toate locurile: `BookingFull` în cereri/dashboard, `Entry` în calendar, `Booking` în cardul de serie recurentă (fiecare sesiune are propria dată).

## 4. Regula de blocare (confirmată)
Blocat = `booking_date < formatDateISO(azi - 1 zi)`, comparație pe string ISO (fără oră). Deci azi și ieri rămân complet editabile; alaltăieri și mai vechi sunt blocate.

## Ce voi implementa (la aprobare)

1. **Helper comun** în `src/lib/date-utils.ts`:
   - `isBookingLocked(bookingDate: string): boolean` — folosește `addDays(new Date(), -1)` + `formatDateISO`.
   - `canMarkPaid(booking): boolean` — `!isBookingLocked(date) || status === "confirmată"`.
2. **`panou.cereri.tsx` / `ActionButtons`**: dacă e blocată, ascund Aprobă, Refuză, Anulează, Reactivează, Pune în așteptare. Păstrez „Marchează plătit" doar pentru `confirmată`; „Marchează neplatit" rămâne pe rezervări `confirmată` (ascuns pe celelalte statusuri blocate). Adaug un text scurt: „Rezervare arhivată — statusul nu mai poate fi modificat."
3. **`panou.dashboard.tsx`**: ascund Aprobă/Refuză pentru cererile cu dată blocată.
4. **`recurring-group-card.tsx`**: pentru butoanele „pe serie", iau în calcul doar sesiunile neblocate; dacă nicio sesiune eligibilă nu e `în așteptare`, ascund butoanele. În modul selecție, sesiunile blocate nu pot fi selectate.
5. **Dialogul din calendarul sălii**: ascund „Anulează rezervarea", „Modifică intervalul" și „Editează tarif" pe rezervări blocate; păstrez plata activă doar dacă statusul e `confirmată`.

Nu modific baza de date, RLS sau RPC-urile — este strict o restricție de interfață.
