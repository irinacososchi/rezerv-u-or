# Indicare clară a orelor parțial disponibile în grila de rezervare

## Ce se schimbă

Fișier: `src/routes/sali.$slug.tsx` — randarea butoanelor `hourPoints`.

### 1. Etichetă ajustată

- Când doar jumătatea a doua (`:30`) este liberă (`!canStart00 && canStart30`) și butonul nu e într-o stare de selecție/finalizare, eticheta devine `H:30` în loc de `H:00`.
- Exemplu: blocaj 18:00–19:30 → butonul orei 19 afișează **19:30**.

### 2. Tooltip explicit

- `!canStart00 && canStart30` → `Disponibil de la 19:30`.
- `canStart00 && !canStart30` → `Disponibil doar la 19:00`.
- Restul cazurilor păstrează tooltipul de preț existent.

### 3. Stil vizual „parțial disponibil"

Pentru orele cu o singură jumătate liberă (în afara stărilor de selecție):
- jumătatea ocupată primește un strat hașurat/dimmed (`bg-muted/60` + pattern diagonal peste `var(--color-border)`);
- poziționarea e pe stânga pentru `partialRight` (jumătatea stângă = H:00 ocupată) și pe dreapta pentru `partialLeft`;
- starea de selecție/finalizare (start, end, interval deja confirmat) rămâne neschimbată și ia prioritate.

## Ce NU se schimbă

- `get_room_availability`, generarea de sloturi de 30 min, `intervalsOverlap`, logica de preț, confirmarea intervalului.
- `handleHourTap` rămâne neschimbat; continuă să aleagă corect `H:30` când doar acea jumătate e liberă.

## Verificare

1. Build fără erori.
2. Zi cu blocaj 18:00–19:30: 18:00 dezactivat, butonul 19 afișează **19:30** cu tooltip „Disponibil de la 19:30" și stil vizual parțial, 20:00 normal.
3. Click pe 19:30 setează startul la 19:30; nicio selecție nu poate include 19:00.
