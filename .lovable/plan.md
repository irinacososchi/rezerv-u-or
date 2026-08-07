# Ascunde vederea „Săptămână" pe mobil (< 768px)

## Situația actuală (verificată în cod)

- `panou.sali.$id.calendar.tsx`: switcher-ul mobil (`inline-flex lg:hidden`) randează explicit toate cele trei vederi — Zi / Săpt. / Lună. Guard-ul existent rulează doar pe eveniment `resize` (nu la montare), folosește pragul `<1024px` și comută pe „Zi", nu pe „Lună".
- `panou.orarul-meu.tsx`: un singur switcher, fără filtrare responsive — „Săptămână" apare pe orice ecran. Vederea implicită vine din `localStorage` (`orarul-meu-view-mode`), deci un „week" salvat rămâne activ și pe telefon; fallback-ul pentru mobil e „day".
- Ramura de randare „week" (grilă `min-w-[760px]` în `overflow-x-auto`) nu are nicio condiție de viewport, deci chiar se randează pe telefon.

## Ce se schimbă

Prag: **< 768px = mobil** (`useIsMobile()` din `src/hooks/use-mobile.tsx`, deja bazat pe `matchMedia("(max-width: 767px)")`). Vedere implicită pe mobil: **Lună**.

### Pentru fiecare dintre cele două pagini

1. **Toggle-ul „Săptămână"** se ascunde sub 768px (`hidden md:inline-flex` pe butonul respectiv). Pe telefon rămân vizibile doar **Zi** și **Lună**; de la md în sus apar toate trei.
2. **Guard pe viewport real** (nu doar CSS): un `useEffect` care urmărește `isMobile` și, dacă `view === "week"` pe mobil, setează `"month"`. Acoperă atât încărcarea inițială (inclusiv valoarea din `localStorage`), cât și micșorarea ferestrei de la desktop la mobil.
3. **Randarea vederii week** primește o condiție suplimentară: nu se randează când e mobil — dacă starea ar rămâne cumva „week", se afișează Luna.
4. **Desktop / tabletă (≥768px)**: nimic nu se schimbă — toate trei vederile rămân complet funcționale, iar preferința salvată în `localStorage` continuă să funcționeze.
5. **Fără scroll orizontal** în vederile Zi și Lună pe mobil: se verifică și se corectează, dacă e cazul, cu `min-w-0` pe containerele de text și `truncate` pe etichete; grila lunii rămâne `grid-cols-7` fără lățime minimă fixă.

### Detalii specifice

- `panou.sali.$id.calendar.tsx`: se unifică cele două switcher-e (desktop `hidden lg:inline-flex` cu Săptămână/Lună și mobil `lg:hidden` cu toate trei) într-o singură listă Zi / Săptămână / Lună, unde butonul Săptămână are `hidden md:inline-flex`. Se elimină listener-ul vechi de `resize` cu prag 1024px și se înlocuiește cu guard-ul bazat pe `useIsMobile()`.
- `panou.orarul-meu.tsx`: `detectDefaultView()` returnează „month" pe mobil când nu există preferință salvată; valoarea „week" din `localStorage` este ignorată pe mobil. Detecția rămâne client-side (după hidratare) pentru a evita nepotriviri SSR.

## Verificare

Build, apoi verificare cu Playwright pe ambele calendare, la 390px și la 1280px: sub prag apar doar Zi și Lună, implicit Lună, iar grila săptămânală nu se randează; peste prag toate trei vederile funcționează.
