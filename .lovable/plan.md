# Vouchere: raport + plan de corecție afișare

## Ce am găsit

### 1. Panoul de vouchere (`src/routes/panou.vouchere.tsx`) — bug confirmat
Afișarea utilizărilor citește un câmp care **nu există** în baza de date:

```tsx
type Voucher = { ...; used_count: number | null; ... }

function formatUses(v: Voucher) {
  const used = v.used_count ?? 0;
  return v.max_uses ? `${used} / ${v.max_uses}` : `${used} / ∞`;
}
```

Am verificat direct în baza de date: coloana `voucher_codes.used_count` **nu există**
(eroarea returnată: `column voucher_codes.used_count does not exist`), în timp ce
`times_used` și `max_uses` există. Interogarea folosește `select("*, rooms(name)")`,
deci `times_used` chiar vine în răspuns — dar codul îl ignoră și citește `used_count`,
care este `undefined` → `?? 0` → afișează mereu `0 / 2`.

### 2. Interogarea listei — corectă
`select("*, rooms(name)")` aduce toate coloanele, inclusiv `times_used`. Nu lipsește
nimic din select; problema e strict numele câmpului folosit la afișare.

### 3. Validarea voucherului la rezervare (`src/routes/rezerva.$slug.tsx`, `applyVoucher`)
Verificarea de limită **există** și citește `times_used`:

```tsx
if (v.max_uses != null && (v.times_used ?? 0) >= v.max_uses) {
  setVoucher(null);
  setVoucherError("Acest voucher a atins limita de utilizări.");
  return;
}
```
Verifică, în ordine: `is_active`, `valid_from`, `valid_until`, limita de utilizări, sala.

### 4. De ce, totuși, voucherul epuizat pare acceptat
Codul citește `times_used`, deci logica pare corectă — cauza exactă nu este confirmată
din citirea codului. Ipoteza cea mai probabilă (de verificat înainte de fix): regulile de
acces la `voucher_codes` returnează chiriașului o versiune a rândului fără valoarea reală
a contorului (sau rândul e citit dintr-o sursă care nu reflectă incrementul), astfel încât
`times_used` ajunge `null`/`0` în browser. Nu am putut interoga tabelul cu un cont de
chiriaș din acest mediu.

Observație suplimentară: voucherul este validat o singură dată, la apăsarea butonului
„Aplică”. Dacă limita se atinge între aplicare și trimiterea rezervării, UI-ul rămâne cu
reducerea afișată până când serverul respinge.

## Plan

1. **Fix afișare panou**: în `panou.vouchere.tsx`, înlocuiesc `used_count` cu `times_used`
   în tipul `Voucher` și în `formatUses`. Rezultat: `2 / 2` în loc de `0 / 2`.
2. **Verificare cauză reală pentru punctul 4**: adaug temporar un log al rândului primit
   de `applyVoucher` (sau verific ce valoare are `times_used` pentru contul de chiriaș).
   - Dacă `times_used` vine corect → problema e doar de moment (validare o singură dată)
     și adaug re-validarea voucherului la submit, cu mesaj clar.
   - Dacă `times_used` vine `null`/`0` pentru chiriaș → cauza e la nivel de acces în
     backend, iar soluția curată este validarea voucherului printr-un apel server
     (aceeași sursă de adevăr ca `create_booking`), nu prin citire directă din browser.
3. **Mesaj clar în UI** atunci când voucherul e epuizat: „Acest voucher a atins numărul
   maxim de utilizări.”, identic cu mesajul serverului.

## Detalii tehnice
- Fișiere atinse: `src/routes/panou.vouchere.tsx` (sigur), `src/routes/rezerva.$slug.tsx`
  (în funcție de rezultatul verificării de la pasul 2).
- Fără modificări de preț, fără modificări la `create_booking`.
