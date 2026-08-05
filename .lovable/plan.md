# Fix afișare vouchere (panou + flux rezervare)

## 1. Panoul de vouchere arată mereu „0 / 2”
Cauza confirmată: codul citește coloana `used_count`, care nu există în baza de date
(coloana reală este `times_used`).

Modificări în `src/routes/panou.vouchere.tsx`:
- în tipul `Voucher`: `used_count` → `times_used`;
- în `formatUses`: `const used = v.times_used ?? 0;`
- interogarea rămâne neschimbată (`select("*, rooms(name)")` aduce deja `times_used`).

Rezultat: se afișează „2 / 2” corect.

## 2. Voucher epuizat — mesaj clar la trimiterea rezervării
Verificarea din `applyVoucher` rămâne exact cum este (feedback rapid). Sursa de adevăr
rămâne serverul.

Modificări în `src/routes/rezerva.$slug.tsx`, în ramura de eroare a apelului
`create_booking`:
- dacă mesajul de eroare conține „numărul maxim de utilizări”:
  - se șterge voucherul aplicat (`setVoucher(null)`, se golește câmpul de cod);
  - se afișează inline, lângă câmpul de voucher: „Acest voucher a atins numărul maxim
    de utilizări.”;
  - se afișează un toast de eroare: „Voucherul a atins numărul maxim de utilizări.
    L-am eliminat — poți continua fără el.”;
- orice altă eroare păstrează comportamentul actual (toast + mesaj inline).

## Ce NU se modifică
- `create_booking` și restul backendului.
- Calculul reducerii și al prețurilor.
- Logica de validare client existentă (rămâne ca pre-verificare).
