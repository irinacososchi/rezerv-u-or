# De ce 19:00 rămâne disponibil la un blocaj 18:00–19:30

## Diagnostic (verificat în cod)

Datele și calculul pe 30 de minute sunt corecte. Bug-ul e strict în afișarea butoanelor „pe oră".

1. `get_room_availability` întoarce blocajul ca rând cu `start_time` 18:00, `end_time` 19:30, `status` „blocată" — fără rotunjire (`src/routes/sali.$slug.tsx`, liniile 290–314).
2. `slots` (liniile 433–472) generează sloturi de 30 min și marchează `busy` prin `intervalsOverlap` cu orele reale. Pentru acest blocaj rezultă corect: 18:00 busy, 18:30 busy, **19:00 busy**, 19:30 liber.
3. Grila afișează doar butoane pe oră întreagă (`hourPoints`), iar fiecare buton acoperă două jumătăți: `H:00` și `H:30`. Activarea butonului (linia ~1226) este:
   `enabled = canStart00 || canStart30`
   Pentru ora 19: `canStart00 = false` (19:00 e blocat), `canStart30 = true` (19:30 e liber) → **butonul rămâne activ**, deși eticheta afișată este „19:00".
4. La click, `handleHourTap` face fallback corect (`slotAvail(h00) ? h00 : h30`) și setează de fapt startul la **19:30**, nu 19:00. Deci nu se poate rezerva peste blocaj — dar UI-ul minte: butonul scrie „19:00" și pare liber.

Concluzie: nu e o problemă de date (RPC) și nici de suprapunere ratată; e o problemă de etichetare/afișare — un buton „pe oră" cu doar jumătatea a doua liberă apare identic cu unul complet liber, iar eticheta arată `H:00` până când devine start.

## Remediu propus (dacă vrei să îl aplic)

În `src/routes/sali.$slug.tsx`, în randarea `hourPoints`:
- când `!canStart00 && canStart30`, eticheta butonului devine `19:30` (nu `19:00`) și se aplică un stil de „parțial disponibil" (ex. jumătatea stângă hașurată/estompată);
- simetric pentru cazul `canStart00 && !canStart30`, dacă butonul poate fi doar sfârșit de interval;
- `title` devine explicit: „Disponibil de la 19:30".

Nicio schimbare în RPC, în `slots`, în prețuri sau în logica de confirmare a intervalului.

## Verificare
1. Build fără erori.
2. Pe o zi cu blocaj 18:00–19:30: 18:00 dezactivat, butonul orei 19 afișează „19:30" ca parțial disponibil, 20:00 normal.
3. Selecția 19:30 → 21:00 se confirmă corect; nicio selecție nu poate include 19:00.
