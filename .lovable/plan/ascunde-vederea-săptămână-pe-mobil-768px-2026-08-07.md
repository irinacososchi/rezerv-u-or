# Ascunde vederea „Săptămână" pe mobil (< 768px)

## Situația actuală (verificată în cod)

- `panou.sali.$id.calendar.tsx`: switcher-ul mobil (`inline-flex lg:hidden`) randează explicit toate cele trei vederi — Zi / Săpt. / Lună. Guard-ul existent rulează doar pe eveniment `resize` (nu la montare), folosește pragul `<1024px` și comută pe „Zi", nu pe „Lună".
- `panou.orarul-meu.tsx`: un singur switcher, fără filtrare responsive — „Săptămână" apare pe orice ecran. Vederea implicită vine din `localStorage` (`orarul-meu-view-mode`), deci un „week" salvat rămâne activ și pe telefon; fallback-ul pentru mobil e „day".
- Ramura de randare „week" (grilă `min-w-[760px]` în `overflow-x-auto`) nu are nicio condiție de viewport, deci chiar se randează pe telefon.

## Ce se schimbă

Prag unic: **< 768px = mobil**, detectat direct cu `window.matchMedia("(max-width: 767px)")`. Vedere implicită pe mobil: **Lună**; pe desktop rămâne **Săptămână**.

### Pentru fiecare dintre cele două pagini

1. **Toggle-ul „Săptămână"** este exclus din lista mobilă. Pe telefon se randează doar **Zi** și **Lună**; de la md în sus se randează toate trei.
2. **Guard pe viewport real** (nu doar CSS): fiecare pagină instalează un listener `matchMedia("(max-width: 767px)")`, rulează verificarea imediat la montare și apoi la fiecare schimbare de viewport. Dacă media query-ul este activ și `view === "week"`, setează `"month"`. Listener-ul este eliminat la demontare.
3. **Randarea vederii week** este condiționată și de starea mobilă derivată din același `matchMedia`; astfel grila `min-w-[760px]` nu poate apărea sub 768px nici înainte ca actualizarea de stare din efect să se finalizeze.
4. **Desktop / tabletă (≥768px)**: nimic nu se schimbă — toate trei vederile rămân complet funcționale, iar preferința salvată în `localStorage` continuă să funcționeze.
5. **Fără scroll orizontal** în vederile Zi și Lună pe mobil: se verifică și se corectează, dacă e cazul, cu `min-w-0` pe containerele de text și `truncate` pe etichete; grila lunii rămâne `grid-cols-7` fără lățime minimă fixă.

### Detalii specifice

- `panou.sali.$id.calendar.tsx`: lista din switcher-ul mobil devine explicit `["day", "month"]`; switcher-ul pentru ≥768px oferă Zi / Săptămână / Lună. Inițializatorul alege „month" când media query-ul mobil este activ și „week" în rest. Listener-ul vechi de `resize` cu prag 1024px este înlocuit cu guard-ul `matchMedia` de 768px.
- `panou.orarul-meu.tsx`: lista de toggle-uri exclude condiționat „week" când media query-ul mobil este activ. `detectDefaultView()` tratează mobilul înainte de a accepta preferința: un „week" salvat este convertit în „month", iar fără preferință mobilul pornește tot pe „month". Preferințele continuă să fie salvate, dar „week" nu este niciodată activat pe mobil.

## Verificare

Build, apoi verificare cu Playwright pe ambele calendare, la 390px și la 1280px: sub prag apar doar Zi și Lună, implicit Lună, iar grila săptămânală nu se randează; peste prag toate trei vederile funcționează.
